import { promises as fs } from 'fs';
import path from 'path';
import { URL } from 'url';

export interface FoundDocumentation {
  url: string;
  localPath: string;
  category: 'tools' | 'apis';
  lastModified: Date;
  size: number;
  relativePath: string;
}

export interface DiscoveryResult {
  found: FoundDocumentation[];
  total: number;
  categories: {
    tools: number;
    apis: number;
  };
}

export class DocumentationFinder {
  private readonly basePath = '/Users/shayon/DevProjects/~meta/docs';

  async findExistingDocumentation(targetUrl?: string): Promise<DiscoveryResult> {
    const found: FoundDocumentation[] = [];
    
    try {
      await this.searchDirectory(this.basePath, found, targetUrl);
    } catch (error) {
      console.warn(`Warning: Could not search documentation directory: ${error}`);
    }

    return {
      found,
      total: found.length,
      categories: {
        tools: found.filter(doc => doc.category === 'tools').length,
        apis: found.filter(doc => doc.category === 'apis').length,
      },
    };
  }

  private async searchDirectory(
    dirPath: string, 
    found: FoundDocumentation[], 
    targetUrl?: string
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip hidden directories and node_modules
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await this.searchDirectory(fullPath, found, targetUrl);
          }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const doc = await this.analyzeDocumentationFile(fullPath);
          if (doc && (!targetUrl || this.isUrlMatch(targetUrl, doc))) {
            found.push(doc);
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
      return;
    }
  }

  private async analyzeDocumentationFile(filePath: string): Promise<FoundDocumentation | null> {
    try {
      const stats = await fs.stat(filePath);
      const relativePath = path.relative(this.basePath, filePath);
      
      // Determine category based on path
      const category = relativePath.includes('/apis/') ? 'apis' : 'tools';
      
      // Try to extract URL from file content or filename
      const url = await this.extractUrlFromFile(filePath);
      
      return {
        url: url || '',
        localPath: filePath,
        category,
        lastModified: stats.mtime,
        size: stats.size,
        relativePath,
      };
    } catch (error) {
      return null;
    }
  }

  private async extractUrlFromFile(filePath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Try to find URL in common patterns
      const urlPatterns = [
        /<!-- Source: (https?:\/\/[^\s]+) -->/,
        /\[Source\]\((https?:\/\/[^\)]+)\)/,
        /Original: (https?:\/\/[^\s]+)/,
        /URL: (https?:\/\/[^\s]+)/,
        /(https?:\/\/[^\s]+)/,
      ];
      
      for (const pattern of urlPatterns) {
        const match = content.match(pattern);
        if (match) {
          return match[1];
        }
      }
      
      // Try to infer from filename if it contains domain
      const filename = path.basename(filePath, '.md');
      if (filename.includes('.')) {
        const parts = filename.split('.');
        if (parts.length >= 2) {
          return `https://${parts.join('.')}`;
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  private isUrlMatch(targetUrl: string, doc: FoundDocumentation): boolean {
    if (!doc.url) return false;
    
    try {
      const target = new URL(targetUrl);
      const existing = new URL(doc.url);
      
      // Exact match
      if (target.href === existing.href) return true;
      
      // Domain match
      if (target.hostname === existing.hostname) return true;
      
      // Subdomain match (e.g., docs.example.com matches example.com)
      const targetParts = target.hostname.split('.');
      const existingParts = existing.hostname.split('.');
      
      if (targetParts.length >= 2 && existingParts.length >= 2) {
        const targetDomain = targetParts.slice(-2).join('.');
        const existingDomain = existingParts.slice(-2).join('.');
        if (targetDomain === existingDomain) return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  async findExistingCheatsheets(targetUrl?: string): Promise<FoundDocumentation[]> {
    const cheatsheetPath = path.join(this.basePath, 'cheatsheets');
    const found: FoundDocumentation[] = [];
    
    try {
      await this.searchDirectory(cheatsheetPath, found, targetUrl);
    } catch (error) {
      // Cheatsheets directory might not exist yet
    }
    
    return found;
  }

  formatDiscoveryResults(result: DiscoveryResult): string {
    if (result.total === 0) {
      return 'No existing documentation found.';
    }

    let output = `Found ${result.total} existing documentation files:\n\n`;
    
    if (result.categories.tools > 0) {
      output += `**Tools Documentation (${result.categories.tools}):**\n`;
      const toolDocs = result.found.filter(doc => doc.category === 'tools');
      for (const doc of toolDocs) {
        output += `- ${doc.relativePath} (${this.formatSize(doc.size)}, ${this.formatDate(doc.lastModified)})\n`;
        if (doc.url) {
          output += `  Source: ${doc.url}\n`;
        }
      }
      output += '\n';
    }
    
    if (result.categories.apis > 0) {
      output += `**API Documentation (${result.categories.apis}):**\n`;
      const apiDocs = result.found.filter(doc => doc.category === 'apis');
      for (const doc of apiDocs) {
        output += `- ${doc.relativePath} (${this.formatSize(doc.size)}, ${this.formatDate(doc.lastModified)})\n`;
        if (doc.url) {
          output += `  Source: ${doc.url}\n`;
        }
      }
      output += '\n';
    }
    
    return output;
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
    return `${Math.round(bytes / (1024 * 1024))}MB`;
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}