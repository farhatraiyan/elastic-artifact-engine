import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Page } from 'playwright-core';

/**
 * ReadabilityProvider: A static utility to manage the injection of
 * Mozilla's Readability library into Playwright pages.
 */
export abstract class ReadabilityProvider {
  private static readonly scriptPath: string = ReadabilityProvider.resolveScriptPath();

  /**
   * Resolves the absolute path to the Readability.js file in node_modules.
   */
  private static resolveScriptPath(): string {
    const packageEntry = import.meta.resolve('@mozilla/readability');
    const packageDir = dirname(fileURLToPath(packageEntry));
    return join(packageDir, 'Readability.js');
  }

  /**
   * Injects the Readability library into the provided Playwright page.
   * Delegates file reading and injection to Playwright's native implementation.
   */
  public static async inject(page: Page): Promise<void> {
    await page.addScriptTag({ path: this.scriptPath });
  }
}
