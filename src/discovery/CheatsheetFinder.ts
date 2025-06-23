import { promises as fs } from 'fs';
import path from 'path';
import { URL } from 'url';
import { DocumentationCategorizer } from '../categorizer/index.js';
import { loadConfig } from '../config/index.js';
import { Config } from '../config/types.js';

export interface FoundCheatsheet {
  url: string;
  localPath: string;
  filename: string;
  lastModified: Date;
  size: number;
  relativePath: string;
  sections?: string[];
  functionCount?: number;
}

export class CheatsheetFinder {
  private config: Config | null = null;
  private readonly categorizer = new DocumentationCategorizer();

  private async getConfig(): Promise<Config> {
    if (!this.config) {
      this.config = await loadConfig();
    }
    return this.config;
  }

  async findExistingCheatsheets(targetUrl?: string): Promise<FoundCheatsheet[]> {
    const found: FoundCheatsheet[] = [];
    
    try {
      const config = await this.getConfig();
      // Search in both tools and apis directories
      const categories = ['tools', 'apis'];
      
      for (const category of categories) {
        const categoryPath = path.join(config.docsBasePath, category);
        try {
          await this.searchCheatsheets(categoryPath, found, targetUrl);
        } catch (error) {
          // Skip if directory doesn't exist
          continue;
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not search documentation directories: ${error}`);
    }
    
    return found;
  }

  private async searchCheatsheets(
    dirPath: string, 
    found: FoundCheatsheet[], 
    targetUrl?: string
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip hidden directories
          if (!entry.name.startsWith('.')) {
            await this.searchCheatsheets(fullPath, found, targetUrl);
          }
        } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name.includes('Cheatsheet')) {
          const cheatsheet = await this.analyzeCheatsheet(fullPath);
          if (cheatsheet && (!targetUrl || this.isUrlMatch(targetUrl, cheatsheet))) {
            found.push(cheatsheet);
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
      return;
    }
  }

  private async analyzeCheatsheet(filePath: string): Promise<FoundCheatsheet | null> {
    try {
      const config = await this.getConfig();
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const relativePath = path.relative(config.docsBasePath, filePath);
      const filename = path.basename(filePath, '.md');
      
      // Extract URL from content
      const url = this.extractUrlFromContent(content);
      
      // Analyze content for basic metrics
      const sections = this.extractSections(content);
      const functionCount = this.countFunctions(content);
      
      return {
        url: url || '',
        localPath: filePath,
        filename,
        lastModified: stats.mtime,
        size: stats.size,
        relativePath,
        sections,
        functionCount,
      };
    } catch (error) {
      return null;
    }
  }

  private extractUrlFromContent(content: string): string | null {
    // Try to find URL in common patterns for cheatsheets
    const urlPatterns = [
      /<!-- Generated from: (https?:\/\/[^\s]+) -->/,
      /Source: (https?:\/\/[^\s]+)/,
      /\*\*Source:\*\* (https?:\/\/[^\s]+)/,
      /Based on: (https?:\/\/[^\s]+)/,
      /(https?:\/\/[^\s\)]+)/,
    ];
    
    for (const pattern of urlPatterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }

  private extractSections(content: string): string[] {
    const sections: string[] = [];
    const headerPattern = /^##\s+(.+)$/gm;
    let match;
    
    while ((match = headerPattern.exec(content)) !== null) {
      sections.push(match[1].trim());
    }
    
    return sections;
  }

  private countFunctions(content: string): number {
    // Count various function-like patterns
    const patterns = [
      /`[^`]*\([^)]*\)`/g, // Function calls like `func()`
      /\|\s*`[^`]+`\s*\|/g, // Table entries with code
      /`[^`]*<%[^%]*%>[^`]*`/g, // Templater functions
    ];
    
    let count = 0;
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        count += matches.length;
      }
    }
    
    return count;
  }

  private isUrlMatch(targetUrl: string, cheatsheet: FoundCheatsheet): boolean {
    if (!cheatsheet.url) return false;
    
    try {
      const target = new URL(targetUrl);
      const existing = new URL(cheatsheet.url);
      
      // Exact match
      if (target.href === existing.href) return true;
      
      // Domain match
      if (target.hostname === existing.hostname) return true;
      
      // Subdomain match
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

  formatCheatsheetResults(cheatsheets: FoundCheatsheet[]): string {
    if (cheatsheets.length === 0) {
      return 'No existing cheatsheets found.';
    }

    let output = `Found ${cheatsheets.length} existing cheatsheet(s):\n\n`;
    
    for (const sheet of cheatsheets) {
      output += `**${sheet.filename}**\n`;
      output += `- Path: ${sheet.relativePath}\n`;
      output += `- Size: ${this.formatSize(sheet.size)}\n`;
      output += `- Modified: ${this.formatDate(sheet.lastModified)}\n`;
      
      if (sheet.url) {
        output += `- Source: ${sheet.url}\n`;
      }
      
      if (sheet.sections && sheet.sections.length > 0) {
        output += `- Sections: ${sheet.sections.slice(0, 3).join(', ')}${sheet.sections.length > 3 ? '...' : ''}\n`;
      }
      
      if (sheet.functionCount && sheet.functionCount > 0) {
        output += `- Functions: ~${sheet.functionCount} entries\n`;
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

  async getCheatsheetPath(url: string): Promise<string> {
    try {
      // First, determine if this is tools or APIs using categorizer
      const result = await this.categorizer.categorize(url);
      const category = result.category;
      
      // Extract name from URL
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      // Special case for subdomains of well-known sites
      let toolName: string;
      if (hostname.includes('github.com')) {
        toolName = 'github';
      } else {
        // Remove common prefixes
        toolName = hostname.replace(/^(www\.|docs\.|api\.|developers?\.|help\.|support\.|learn\.)/, '');
        // Remove TLD (.com, .io, .md, etc.) from tool name
        toolName = toolName.split('.')[0];
      }
      
      // Build path based on category and URL structure
      const config = await this.getConfig();
      const basePath = path.join(config.docsBasePath, category);
      
      // Parse the URL path to create appropriate subdirectories
      const pathParts = urlObj.pathname.split('/').filter(p => p && p !== 'docs' && p !== 'api');
      
      // Sanitize the tool name for filesystem
      toolName = toolName.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').toLowerCase();
      
      // Generate filename with configured suffix
      const cheatsheetName = `${toolName}${config.cheatsheet.filenameSuffix}`;
      
      // Construct full path based on URL structure
      let fullPath: string;
      
      if (pathParts.length > 0) {
        // For complex paths like obsidian/plugins/dataview
        // Create subdirectories based on URL path
        const subDirs = pathParts.map(part => 
          part.replace(/[^a-zA-Z0-9.-]/g, '-').replace(/-+/g, '-').toLowerCase()
        );
        fullPath = path.join(basePath, toolName, ...subDirs, cheatsheetName);
      } else {
        // For simple URLs, just use tool name directory
        fullPath = path.join(basePath, toolName, cheatsheetName);
      }
      
      return fullPath;
    } catch (error) {
      // Fallback naming
      const config = await this.getConfig();
      const timestamp = new Date().toISOString().split('T')[0];
      return path.join(config.docsBasePath, 'tools', `cheatsheet-${timestamp}.md`);
    }
  }
}