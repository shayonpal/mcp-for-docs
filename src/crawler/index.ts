import { chromium, Browser } from 'playwright';
import PQueue from 'p-queue';
import { ContentParser, SiteConfig } from './parser.js';
import { normalizeUrl, isSameDomain, extractDomainName, urlToFilename, matchesPatterns } from '../utils/url.js';
import { writeFileContent, getDocumentationPath, fileExists } from '../utils/file.js';

export interface CrawlOptions {
  url: string;
  max_depth?: number;
  force_refresh?: boolean;
  rate_limit?: number;
  include_patterns?: string[];
  exclude_patterns?: string[];
  onProgress?: (status: CrawlStatus) => void;
}

export interface CrawlStatus {
  discovered: number;
  processed: number;
  saved: number;
  errors: number;
  currentUrl?: string;
}

export interface CrawlResult {
  success: boolean;
  stats: CrawlStatus;
  savedFiles: string[];
  errors: string[];
  category: 'tools' | 'apis';
  name: string;
}

/**
 * Documentation crawler
 */
export class DocumentationCrawler {
  private browser: Browser | null = null;
  private parser: ContentParser;
  private queue: PQueue;
  private visited = new Set<string>();
  private discovered = new Set<string>();
  private errors: string[] = [];
  private savedFiles: string[] = [];
  
  constructor() {
    this.parser = new ContentParser();
    this.queue = new PQueue({ concurrency: 1, interval: 1000, intervalCap: 2 }); // Default 2 requests per second
  }
  
  /**
   * Crawl documentation from a starting URL
   */
  async crawl(options: CrawlOptions): Promise<CrawlResult> {
    try {
      await this.initialize();
      
      const config = this.parser.getSiteConfig(options.url) || this.inferSiteConfig(options.url);
      const category = config.category;
      const name = config.name;
      
      // Check if documentation already exists and not forcing refresh
      if (!options.force_refresh) {
        const docPath = getDocumentationPath(category, name);
        const indexExists = await fileExists(`${docPath}/index.md`);
        if (indexExists) {
          return {
            success: true,
            stats: { discovered: 0, processed: 0, saved: 0, errors: 0 },
            savedFiles: [],
            errors: ['Documentation already exists. Use force_refresh to update.'],
            category,
            name,
          };
        }
      }
      
      // Setup rate limiting
      if (options.rate_limit) {
        this.queue = new PQueue({ 
          concurrency: 1, 
          interval: 1000, 
          intervalCap: options.rate_limit 
        });
      }
      
      // Reset state
      this.visited.clear();
      this.discovered.clear();
      this.errors = [];
      this.savedFiles = [];
      
      // Start crawling
      await this.crawlRecursive(
        options.url,
        0,
        options.max_depth || config.max_depth || 3,
        options,
        category,
        name
      );
      
      const stats: CrawlStatus = {
        discovered: this.discovered.size,
        processed: this.visited.size,
        saved: this.savedFiles.length,
        errors: this.errors.length,
      };
      
      return {
        success: this.errors.length === 0,
        stats,
        savedFiles: this.savedFiles,
        errors: this.errors,
        category,
        name,
      };
      
    } finally {
      await this.cleanup();
    }
  }
  
  /**
   * Initialize browser
   */
  private async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }
  }
  
  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
  
  /**
   * Recursively crawl pages
   */
  private async crawlRecursive(
    url: string,
    depth: number,
    maxDepth: number,
    options: CrawlOptions,
    category: 'tools' | 'apis',
    name: string
  ): Promise<void> {
    const normalizedUrl = normalizeUrl(url);
    
    // Skip if already visited or too deep
    if (this.visited.has(normalizedUrl) || depth > maxDepth) {
      return;
    }
    
    // Check URL patterns
    if (options.include_patterns && !matchesPatterns(url, options.include_patterns)) {
      return;
    }
    
    if (options.exclude_patterns && matchesPatterns(url, options.exclude_patterns)) {
      return;
    }
    
    // Only crawl same domain
    if (!isSameDomain(url, options.url)) {
      return;
    }
    
    this.visited.add(normalizedUrl);
    
    try {
      await this.queue.add(async () => {
        options.onProgress?.({
          discovered: this.discovered.size,
          processed: this.visited.size,
          saved: this.savedFiles.length,
          errors: this.errors.length,
          currentUrl: url,
        });
        
        await this.processPage(url, category, name);
      });
      
      // Only discover new links if we haven't reached max depth
      if (depth < maxDepth) {
        const links = await this.extractLinksFromPage(url);
        
        for (const link of links) {
          const normalizedLink = normalizeUrl(link);
          if (!this.discovered.has(normalizedLink)) {
            this.discovered.add(normalizedLink);
            await this.crawlRecursive(link, depth + 1, maxDepth, options, category, name);
          }
        }
      }
      
    } catch (error) {
      const errorMessage = `Failed to process ${url}: ${error instanceof Error ? error.message : String(error)}`;
      this.errors.push(errorMessage);
      console.error(errorMessage);
    }
  }
  
  /**
   * Process a single page
   */
  private async processPage(url: string, category: 'tools' | 'apis', name: string): Promise<void> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }
    
    const page = await this.browser.newPage();
    
    try {
      // Set user agent
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (compatible; MCP-for-docs/1.0; +https://github.com/shayonpal/mcp-for-docs)'
      });
      
      // Navigate to page
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Get page content
      const html = await page.content();
      
      // Extract content and title
      const title = this.parser.extractTitle(html, url);
      const content = this.parser.extractContent(html, url);
      
      if (!content.trim()) {
        throw new Error('No content extracted');
      }
      
      // Generate filename
      const filename = urlToFilename(url);
      const docPath = getDocumentationPath(category, name);
      const filePath = `${docPath}/${filename}`;
      
      // Create frontmatter
      const frontmatter = [
        '---',
        `title: "${title.replace(/"/g, '\\"')}"`,
        `url: "${url}"`,
        `date: "${new Date().toISOString()}"`,
        `category: "${category}"`,
        `tool: "${name}"`,
        '---',
        '',
      ].join('\\n');
      
      // Write file
      const finalContent = frontmatter + content;
      await writeFileContent(filePath, finalContent);
      
      this.savedFiles.push(filePath);
      
    } finally {
      await page.close();
    }
  }
  
  /**
   * Extract links from a page
   */
  private async extractLinksFromPage(url: string): Promise<string[]> {
    if (!this.browser) {
      return [];
    }
    
    const page = await this.browser.newPage();
    
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      const html = await page.content();
      return this.parser.extractLinks(html, url);
    } catch (error) {
      console.error(`Failed to extract links from ${url}:`, error);
      return [];
    } finally {
      await page.close();
    }
  }
  
  /**
   * Infer site configuration from URL
   */
  private inferSiteConfig(url: string): SiteConfig {
    const name = extractDomainName(url);
    
    // Determine category based on URL patterns and content
    let category: 'tools' | 'apis' = 'tools';
    
    const apiPatterns = [
      '/api/', '/sdk/', '/reference/', 
      'developer.', 'docs.anthropic', 'api.'
    ];
    
    if (apiPatterns.some(pattern => url.includes(pattern))) {
      category = 'apis';
    }
    
    return {
      name,
      category,
      max_depth: 3,
    };
  }
}