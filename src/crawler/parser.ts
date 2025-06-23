import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { URL } from 'url';

/**
 * Configuration for site-specific parsing
 */
export interface SiteConfig {
  name: string;
  category: 'tools' | 'apis';
  max_depth?: number;
  content_selector?: string;
  title_selector?: string;
  exclude_selectors?: string[];
  include_patterns?: string[];
  exclude_patterns?: string[];
}

/**
 * Default site configurations
 */
const DEFAULT_SITE_CONFIGS: Record<string, SiteConfig> = {
  'docs.n8n.io': {
    name: 'n8n',
    category: 'tools',
    max_depth: 4,
    content_selector: '.docs-content, main, article',
  },
  'docs.anthropic.com': {
    name: 'anthropic',
    category: 'apis',
    max_depth: 3,
    content_selector: 'main, .content, article',
  },
  'developer.apple.com': {
    name: 'swift',
    category: 'apis',
    max_depth: 5,
    content_selector: 'main, .content, article',
  },
  'github.com': {
    name: 'obsidian-tasks',
    category: 'tools',
    max_depth: 3,
    content_selector: '.readme, .markdown-body, article',
  },
};

/**
 * HTML content parser
 */
export class ContentParser {
  private turndown: TurndownService;
  
  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      linkReferenceStyle: 'full',
    });
    
    // Custom rules for better markdown conversion
    this.setupTurndownRules();
  }
  
  /**
   * Get site configuration for a URL
   */
  getSiteConfig(url: string): SiteConfig | null {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname;
      
      // Check exact match first
      if (DEFAULT_SITE_CONFIGS[hostname]) {
        return DEFAULT_SITE_CONFIGS[hostname];
      }
      
      // Check for partial matches
      for (const [domain, config] of Object.entries(DEFAULT_SITE_CONFIGS)) {
        if (hostname.includes(domain) || domain.includes(hostname)) {
          return config;
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }
  
  /**
   * Extract page title
   */
  extractTitle(html: string, url: string): string {
    const $ = cheerio.load(html);
    const config = this.getSiteConfig(url);
    
    let title = '';
    
    // Try custom selector first
    if (config?.title_selector) {
      title = $(config.title_selector).first().text().trim();
    }
    
    // Fallback to common selectors
    if (!title) {
      title = $('h1').first().text().trim() ||
              $('title').text().trim() ||
              $('.page-title, .title, .heading').first().text().trim();
    }
    
    // Clean up title
    title = title.replace(/\\n/g, ' ').replace(/\\s+/g, ' ').trim();
    
    return title || 'Untitled';
  }
  
  /**
   * Extract main content from HTML
   */
  extractContent(html: string, url: string): string {
    const $ = cheerio.load(html);
    const config = this.getSiteConfig(url);
    
    // Remove unwanted elements first
    this.removeUnwantedElements($, config);
    
    // Find main content area
    let content = '';
    const selectors = config?.content_selector ? 
      config.content_selector.split(',').map(s => s.trim()) :
      ['main', 'article', '.content', '.docs-content', '.markdown-body', '#content'];
    
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        content = element.html() || '';
        break;
      }
    }
    
    // Fallback to body if no main content found
    if (!content) {
      content = $('body').html() || '';
    }
    
    // Convert to markdown
    return this.htmlToMarkdown(content);
  }
  
  /**
   * Extract all links from the page
   */
  extractLinks(html: string, baseUrl: string): string[] {
    const $ = cheerio.load(html);
    const links: string[] = [];
    
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        try {
          const absoluteUrl = new URL(href, baseUrl).toString();
          links.push(absoluteUrl);
        } catch {
          // Invalid URL, skip
        }
      }
    });
    
    return [...new Set(links)]; // Remove duplicates
  }
  
  /**
   * Remove unwanted elements from the DOM
   */
  private removeUnwantedElements($: cheerio.CheerioAPI, config: SiteConfig | null): void {
    // Default elements to remove
    const defaultSelectors = [
      'nav', 'header', 'footer', 'aside',
      '.navigation', '.nav', '.sidebar', '.menu',
      '.breadcrumb', '.breadcrumbs',
      '.toc', '.table-of-contents',
      'script', 'style', 'noscript',
      '.ads', '.advertisement',
      '.social', '.share',
      '.comment', '.comments',
      '.related', '.suggestions',
    ];
    
    // Add custom selectors
    const selectorsToRemove = [
      ...defaultSelectors,
      ...(config?.exclude_selectors || []),
    ];
    
    selectorsToRemove.forEach(selector => {
      $(selector).remove();
    });
  }
  
  /**
   * Convert HTML to Markdown
   */
  private htmlToMarkdown(html: string): string {
    try {
      const result = this.turndown.turndown(html);
      // Debug: Check if conversion actually happened
      if (result === html) {
        console.warn('Turndown returned unchanged HTML, conversion may have failed');
      }
      return result;
    } catch (error) {
      console.error('Error converting HTML to markdown:', error);
      return html;
    }
  }
  
  /**
   * Setup custom Turndown rules
   */
  private setupTurndownRules(): void {
    // Remove default code block rule first to avoid conflicts
    this.turndown.remove('pre');
    
    // Preserve code blocks with language hints
    this.turndown.addRule('codeBlocks', {
      filter: 'pre',
      replacement: (content, node) => {
        const codeElement = node.querySelector('code');
        if (!codeElement) {
          return `\\n\\n\`\`\`\\n${content.trim()}\\n\`\`\`\\n\\n`;
        }
        
        const className = codeElement.getAttribute('class') || '';
        const language = className.match(/language-([a-zA-Z0-9-]+)/)?.[1] || '';
        
        // Clean the content - remove extra whitespace and newlines
        const cleanContent = content.trim();
        
        return `\\n\\n\`\`\`${language}\\n${cleanContent}\\n\`\`\`\\n\\n`;
      },
    });
    
    // Better table handling with proper markdown table generation
    this.turndown.addRule('tables', {
      filter: 'table',
      replacement: (_content, node) => {
        const rows: string[] = [];
        const tableRows = node.querySelectorAll('tr');
        
        tableRows.forEach((row: any, index: number) => {
          const cells = Array.from(row.querySelectorAll('th, td'));
          const cellContents = cells.map((cell: any) => {
            const text = cell.textContent?.trim() || '';
            return text.replace(/\\|/g, '\\\\|'); // Escape pipes in cell content
          });
          
          if (cellContents.length > 0) {
            rows.push(`| ${cellContents.join(' | ')} |`);
            
            // Add header separator after first row if it contains th elements
            if (index === 0 && row.querySelector('th')) {
              const separator = cellContents.map(() => '---').join(' | ');
              rows.push(`| ${separator} |`);
            }
          }
        });
        
        return rows.length > 0 ? `\\n\\n${rows.join('\\n')}\\n\\n` : '';
      },
    });
    
    // Handle alerts/callouts
    this.turndown.addRule('alerts', {
      filter: ['.alert', '.callout', '.note', '.warning', '.info'],
      replacement: (content, node) => {
        const className = node.getAttribute('class') || '';
        let prefix = '>';
        
        if (className.includes('warning')) prefix = '> ⚠️';
        else if (className.includes('info')) prefix = '> ℹ️';
        else if (className.includes('note')) prefix = '> 📝';
        
        return `\\n\\n${prefix} ${content}\\n\\n`;
      },
    });
  }
}