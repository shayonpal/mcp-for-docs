import { chromium, Browser } from 'playwright';
import PQueue from 'p-queue';
import { ContentParser, SiteConfig } from './parser.js';
import { normalizeUrl, isSameDomain, extractDomainName, urlToFilename, matchesPatterns } from '../utils/url.js';
import { writeFileContent, getDocumentationPath, fileExists } from '../utils/file.js';
import { DocumentationCategorizer } from '../categorizer/index.js';
import { loadConfig } from '../config/index.js';
import { Config } from '../config/types.js';

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
  private categorizer: DocumentationCategorizer;
  private queue: PQueue;
  private visited = new Set<string>();
  private discovered = new Set<string>();
  private errors: string[] = [];
  private savedFiles: string[] = [];
  private config: Config | null = null;
  
  constructor() {
    this.parser = new ContentParser();
    this.categorizer = new DocumentationCategorizer();
    this.queue = new PQueue({ concurrency: 1, interval: 1000, intervalCap: 2 }); // Default 2 requests per second
  }

  private async getConfig(): Promise<Config> {
    if (!this.config) {
      this.config = await loadConfig();
    }
    return this.config;
  }
  
  /**
   * Crawl documentation from a starting URL
   */
  async crawl(options: CrawlOptions): Promise<CrawlResult> {
    try {
      await this.initialize();
      const appConfig = await this.getConfig();
      
      // First, fetch the homepage content for categorization
      const homepageContent = await this.fetchPageContent(options.url);
      
      // Use categorizer to determine category
      const categorizationResult = await this.categorizer.categorize(options.url, homepageContent);
      const category = categorizationResult.category;
      
      // Log categorization decision for transparency
      console.log(`Categorization: ${category} (confidence: ${categorizationResult.confidence.toFixed(2)})`);
      console.log(`Reasons: ${categorizationResult.reasons.join('; ')}`);
      
      // Get site config for other settings (but ignore hardcoded category)
      const siteConfig = this.parser.getSiteConfig(options.url) || await this.inferSiteConfig(options.url);
      const name = siteConfig.name;
      
      // Check if documentation already exists and not forcing refresh
      if (!options.force_refresh) {
        const docPath = await getDocumentationPath(category, name);
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
      
      // Setup rate limiting from config or options
      const rateLimit = options.rate_limit || appConfig.crawler.defaultRateLimit;
      this.queue = new PQueue({ 
        concurrency: 1, 
        interval: 1000, 
        intervalCap: rateLimit 
      });
      
      // Reset state
      this.visited.clear();
      this.discovered.clear();
      this.errors = [];
      this.savedFiles = [];
      
      // Start crawling
      await this.crawlRecursive(
        options.url,
        0,
        options.max_depth || siteConfig.max_depth || appConfig.crawler.defaultMaxDepth,
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
    
    const appConfig = await this.getConfig();
    const page = await this.browser.newPage();
    
    try {
      // Set user agent
      await page.setExtraHTTPHeaders({
        'User-Agent': appConfig.crawler.userAgent
      });
      
      // Navigate to page
      await page.goto(url, { waitUntil: 'networkidle', timeout: appConfig.crawler.pageTimeout });
      
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
      const docPath = await getDocumentationPath(category, name);
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
    
    const appConfig = await this.getConfig();
    const page = await this.browser.newPage();
    
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: appConfig.crawler.pageTimeout });
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
   * Infer site configuration from URL (category is now determined by categorizer)
   */
  private async inferSiteConfig(url: string): Promise<SiteConfig> {
    const appConfig = await this.getConfig();
    const name = extractDomainName(url);
    
    return {
      name,
      category: 'tools', // Default, but will be overridden by categorizer
      max_depth: appConfig.crawler.defaultMaxDepth,
    };
  }
  
  /**
   * Fetch page content for analysis
   */
  private async fetchPageContent(url: string): Promise<string> {
    if (!this.browser) {
      await this.initialize();
    }
    
    const appConfig = await this.getConfig();
    const page = await this.browser!.newPage();
    
    try {
      await page.setExtraHTTPHeaders({
        'User-Agent': appConfig.crawler.userAgent
      });
      
      await page.goto(url, { waitUntil: 'networkidle', timeout: appConfig.crawler.pageTimeout });
      const html = await page.content();
      return this.parser.extractContent(html, url);
    } catch (error) {
      console.error(`Failed to fetch content from ${url}:`, error);
      return '';
    } finally {
      await page.close();
    }
  }
}