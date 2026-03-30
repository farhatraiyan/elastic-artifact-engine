import { Browser, Page, chromium } from 'playwright-core';
import { CaptureJob, CaptureType } from '@render-engine/shared-types';
import { CaptureService } from '../core/interfaces.js';

export class PlaywrightAdapter implements CaptureService {
  private browser: Browser | null = null;

  /**
   * Automatically scrolls the page to trigger lazy-loading of images and content.
   * Includes a maximum height limit to prevent hanging on infinite-scroll pages.
   */
  private async autoScroll(page: Page, maxScrolls: number = 50): Promise<void> {
    await page.evaluate(async (max) => {
      await new Promise<void>(resolve => {
        let totalHeight = 0;
        const distance = 100;
        let scrolls = 0;

        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          scrolls++;

          if (totalHeight >= scrollHeight || scrolls >= max) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    }, maxScrolls);

    await page.evaluate(() => window.scrollTo(0, 0));
    // Wait for any remaining content to stabilize
    await page.waitForTimeout(1000);
  }

  /**
   * Attempts to dismiss common cookie consent banners and overlays.
   */
  private async dismissBanners(page: Page): Promise<void> {
    const selectors = [
      'button:has-text("Accept")',
      'button:has-text("Agree")',
      'button:has-text("Consent")',
      'button:has-text("OK")',
      'button:has-text("Allow all")',
      'button:has-text("Accept all")',
      '#accept-cookies',
      '.cookie-banner button',
      '[aria-label*="accept" i]',
      '[aria-label*="consent" i]',
      '[class*="cookie" i] button',
      '[id*="cookie" i] button'
    ];

    for (const selector of selectors) {
      try {
        const btn = page.locator(selector).first();
        // Short timeout as we don't want to block if not found
        if (!await btn.isVisible({ timeout: 500 })) continue;

        await btn.click({ timeout: 500 });
      } catch { /* ignore */ }
    }
  }

  private mapError(error: unknown): Error {
    const err = error as Error;
    const msg = err.message || '';

    if (msg.includes('Timeout')) {
      return new Error('Page Timeout: The page took too long to load or stabilize.');
    }
    if (msg.includes('ERR_NAME_NOT_RESOLVED')) {
      return new Error('DNS Resolution Failed: Could not find the server at the provided URL.');
    }
    if (msg.includes('ERR_CONNECTION_REFUSED')) {
      return new Error('Connection Refused: The server at the provided URL refused the connection.');
    }
    if (msg.includes('net::ERR')) {
      return new Error(`Navigation Failed: A network error occurred (${msg.split(' at ')[0]}).`);
    }
    if (msg.includes('Browser closed')) {
      return new Error('Browser Error: The browser engine closed unexpectedly.');
    }

    return err;
  }

  async capture(job: CaptureJob): Promise<Buffer> {
    if (!this.browser) {
      await this.init();
    }

    if (!this.browser) throw new Error('Failed to initialize browser');

    // Create a fresh context and page for every job to prevent state leakage
    const context = await this.browser.newContext({
      viewport: {
        width: job.options?.width ?? 1280,
        height: job.options?.height ?? 800
      },
      // Mimic a real browser better to avoid bot detection
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    try {
      await page.goto(job.url, { waitUntil: 'networkidle', timeout: 30000 });

      if (job.options?.injectCss) {
        await page.addStyleTag({ content: job.options.injectCss });
      }

      // Handle common UI friction
      await this.dismissBanners(page);
      await this.autoScroll(page);

      if (job.options?.waitForTimeout) {
        await page.waitForTimeout(job.options.waitForTimeout);
      }

      const handlers: Record<CaptureType, () => Promise<Buffer>> = {
        pdf: () => page.pdf({
          printBackground: true,
          margin: { top: '0', right: '0', bottom: '0', left: '0' }
        }),
        screenshot: () => page.screenshot({ fullPage: true }),
      };

      return await handlers[job.type]();
    } catch (error) {
      throw this.mapError(error);
    } finally {
      // Ensure the entire context is cleaned up
      await context.close();
    }
  }

  async close(): Promise<void> {
    if (!this.browser) return;

    await this.browser.close();
    this.browser = null;
  }

  async init(): Promise<void> {
    if (this.browser) return;

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ]
    });
  }
}
