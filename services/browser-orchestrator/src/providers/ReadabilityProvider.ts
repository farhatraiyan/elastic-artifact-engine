import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Page } from 'playwright-core';

export abstract class ReadabilityProvider {
  private static readonly scriptPath: string = ReadabilityProvider.resolveScriptPath();

  private static resolveScriptPath(): string {
    const packageEntry = import.meta.resolve('@mozilla/readability');
    const packageDir = dirname(fileURLToPath(packageEntry));
    return join(packageDir, 'Readability.js');
  }

  public static async inject(page: Page): Promise<void> {
    await page.addScriptTag({ path: this.scriptPath });
  }
}
