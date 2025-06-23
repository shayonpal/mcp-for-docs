import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { URL } from 'url';

/**
 * Configuration for site-specific parsing
 */
export interface SiteConfig {
  name: string;
  category?: 'tools' | 'apis'; // @deprecated - determined dynamically by categorizer
  max_depth?: number;
  content_selector?: string;
  title_selector?: string;
  exclude_selectors?: string[];
  include_patterns?: string[];
  exclude_patterns?: string[];
}


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
   * @deprecated Site-specific configs are no longer used. Categorization is dynamic.
   */
  getSiteConfig(_url: string): SiteConfig | null {
    // Return null - categorization is now handled dynamically by DocumentationCategorizer
    return null;
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
      if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
        try {
          const absoluteUrl = new URL(href, baseUrl).toString();
          // Skip javascript: protocol URLs
          if (!absoluteUrl.startsWith('javascript:')) {
            links.push(absoluteUrl);
          }
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
      // Clean up the HTML string first
      const cleanHtml = html.trim();
      
      // Turndown expects a proper HTML string or DOM element
      // Let's ensure it's properly wrapped if needed
      const wrappedHtml = cleanHtml.startsWith('<') ? cleanHtml : `<div>${cleanHtml}</div>`;
      
      const result = this.turndown.turndown(wrappedHtml);
      
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
      replacement: (_content, node: any) => {
        const codeElement = node.querySelector('code');
        if (!codeElement) {
          // If no code element, use the text content of pre
          const text = node.textContent || '';
          return `\n\n\`\`\`\n${text.trim()}\n\`\`\`\n\n`;
        }
        
        // Extract the actual text content from the code element
        const codeText = codeElement.textContent || '';
        const className = codeElement.getAttribute('class') || '';
        const language = className.match(/language-([a-zA-Z0-9-]+)/)?.[1] || '';
        
        return `\n\n\`\`\`${language}\n${codeText.trim()}\n\`\`\`\n\n`;
      },
    });
    
    // Better table handling with proper markdown table generation
    this.turndown.addRule('tables', {
      filter: 'table',
      replacement: (_content, node: any) => {
        const rows: string[] = [];
        const tableRows = node.querySelectorAll('tr');
        
        // Convert NodeList to array and iterate
        Array.from(tableRows).forEach((row: any, index: number) => {
          const cells = Array.from(row.querySelectorAll('th, td'));
          const cellContents = cells.map((cell: any) => {
            // Process cell content to preserve inline code
            const codeElements = cell.querySelectorAll('code');
            let cellHtml = cell.innerHTML;
            
            // Replace code elements with placeholders to preserve them
            const placeholders: string[] = [];
            Array.from(codeElements).forEach((code: any, i: number) => {
              const placeholder = `__CODE_PLACEHOLDER_${i}__`;
              const codeText = code.textContent || '';
              placeholders.push(`\`${codeText}\``);
              cellHtml = cellHtml.replace(code.outerHTML, placeholder);
            });
            
            // Convert remaining HTML to text
            const tempDiv = {
              innerHTML: cellHtml,
              textContent: cellHtml.replace(/<[^>]+>/g, '') // Simple tag removal
            };
            let text = tempDiv.textContent?.trim() || '';
            
            // Restore code placeholders
            placeholders.forEach((code, i) => {
              text = text.replace(`__CODE_PLACEHOLDER_${i}__`, code);
            });
            
            return text.replace(/\|/g, '\\|'); // Escape pipes in cell content
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
        
        return rows.length > 0 ? `\n\n${rows.join('\n')}\n\n` : '';
      },
    });
    
    // Handle alerts/callouts
    this.turndown.addRule('alerts', {
      filter: function(node: any) {
        if (node.nodeName !== 'DIV') return false;
        const className = node.getAttribute('class') || '';
        return ['alert', 'callout', 'note', 'warning', 'info'].some(cls => className.includes(cls));
      },
      replacement: (_content, node: any) => {
        const className = node.getAttribute('class') || '';
        let prefix = '>';
        
        if (className.includes('warning')) prefix = '> ⚠️';
        else if (className.includes('info')) prefix = '> ℹ️';
        else if (className.includes('note')) prefix = '> 📝';
        
        // Get the actual text content from the alert
        const text = node.textContent?.trim() || '';
        // Convert multi-line text to blockquote format
        const lines = text.split('\n').map((line: string) => `${prefix} ${line.trim()}`).join('\n');
        
        return `\n\n${lines}\n\n`;
      },
    });
  }
}