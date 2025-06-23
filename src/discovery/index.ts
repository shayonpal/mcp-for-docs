export { DocumentationFinder, type FoundDocumentation, type DiscoveryResult } from './DocumentationFinder.js';
export { CheatsheetFinder, type FoundCheatsheet } from './CheatsheetFinder.js';
import { DocumentationFinder } from './DocumentationFinder.js';
import { CheatsheetFinder } from './CheatsheetFinder.js';

export interface DiscoveryOptions {
  targetUrl?: string;
  forceRefresh?: boolean;
  showExisting?: boolean;
}

export class SmartDiscovery {
  private docFinder: DocumentationFinder;
  private cheatsheetFinder: CheatsheetFinder;

  constructor() {
    this.docFinder = new DocumentationFinder();
    this.cheatsheetFinder = new CheatsheetFinder();
  }

  async discoverAll(options: DiscoveryOptions = {}) {
    const [docs, cheatsheets] = await Promise.all([
      this.docFinder.findExistingDocumentation(options.targetUrl),
      this.cheatsheetFinder.findExistingCheatsheets(options.targetUrl),
    ]);

    return {
      documentation: docs,
      cheatsheets,
      hasExisting: docs.total > 0 || cheatsheets.length > 0,
    };
  }

  async shouldProceed(options: DiscoveryOptions): Promise<{ proceed: boolean; message: string }> {
    if (options.forceRefresh) {
      return { proceed: true, message: 'Force refresh enabled - proceeding with operation.' };
    }

    const discovery = await this.discoverAll(options);
    
    if (!discovery.hasExisting) {
      return { proceed: true, message: 'No existing content found - proceeding with operation.' };
    }

    let message = 'Existing content found:\n\n';
    
    if (discovery.documentation.total > 0) {
      message += this.docFinder.formatDiscoveryResults(discovery.documentation);
    }
    
    if (discovery.cheatsheets.length > 0) {
      message += this.cheatsheetFinder.formatCheatsheetResults(discovery.cheatsheets);
    }
    
    message += '\nTo regenerate existing content, use force_refresh=true parameter.';
    
    return { proceed: false, message };
  }
}