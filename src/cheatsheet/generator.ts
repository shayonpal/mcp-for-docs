import { getAllMarkdownFiles, readFileContent, getDocumentationPath, writeFileContent } from '../utils/file.js';
import { extractDomainName } from '../utils/url.js';
import { CheatsheetFinder } from '../discovery/CheatsheetFinder.js';
import { loadConfig } from '../config/index.js';
import { Config } from '../config/types.js';

export interface CheatSheetOptions {
  url: string;
  useLocal?: boolean;
  sections?: string[];
  outputFormat?: 'single' | 'multi';
  maxLength?: number;
}

export interface CheatSheetResult {
  content: string;
  filePath?: string;
  sections?: string[];
  wordCount: number;
  sourceFiles: string[];
}

export interface ContentSection {
  title: string;
  content: string;
  type: 'heading' | 'code' | 'example' | 'command' | 'api' | 'text' | 'table' | 'function' | 'concept';
  level: number;
  priority: number;
  metadata?: {
    codeLanguage?: string;
    tableColumns?: string[];
    functionSignature?: string;
    conceptDefinition?: string;
  };
}

export interface ExtractedFunction {
  name: string;
  syntax: string;
  description: string;
  module?: string;
  example?: string;
}

export interface ExtractedConcept {
  term: string;
  definition: string;
  category?: string;
}

export class CheatSheetGenerator {
  private maxLength: number;
  private config: Config | null = null;

  constructor(options: Partial<CheatSheetOptions> = {}) {
    this.maxLength = options.maxLength || 10000; // Will be overridden by config
  }

  private async getConfig(): Promise<Config> {
    if (!this.config) {
      this.config = await loadConfig();
    }
    return this.config;
  }

  /**
   * Generate cheat sheet from documentation
   */
  async generate(options: CheatSheetOptions): Promise<CheatSheetResult> {
    const config = await this.getConfig();
    // Use configured max length if not overridden by options
    if (!options.maxLength) {
      this.maxLength = config.cheatsheet.maxLength;
    }
    
    const { url, useLocal = true, sections } = options;
    
    let sourceFiles: string[] = [];
    let contentSections: ContentSection[] = [];

    if (useLocal) {
      // Try to find local documentation first
      const localFiles = await this.findLocalDocumentation(url);
      if (localFiles.length > 0) {
        sourceFiles = localFiles;
        contentSections = await this.extractFromLocalFiles(localFiles);
      }
    }

    // If no local files found and useLocal is false, would need to crawl
    // For now, focus on local file processing as per the issue requirements
    if (sourceFiles.length === 0) {
      throw new Error(`No local documentation found for ${url}. Please crawl the documentation first.`);
    }

    // Filter sections if specified
    if (sections && sections.length > 0) {
      contentSections = this.filterSections(contentSections, sections);
    }

    // Prioritize and truncate content
    const prioritizedSections = this.prioritizeSections(contentSections);
    const finalContent = this.generateCheatSheetContent(prioritizedSections);

    // Create output file path using CheatsheetFinder
    const cheatsheetFinder = new CheatsheetFinder();
    const outputPath = await cheatsheetFinder.getCheatsheetPath(url);

    // Write to file
    await writeFileContent(outputPath, finalContent);

    return {
      content: finalContent,
      filePath: outputPath,
      sections: prioritizedSections.map(s => s.title),
      wordCount: finalContent.split(/\s+/).length,
      sourceFiles,
    };
  }

  /**
   * Find local documentation files for a given URL
   */
  private async findLocalDocumentation(url: string): Promise<string[]> {
    const domain = extractDomainName(url);
    const files: string[] = [];

    // Search in both tools and apis categories
    for (const category of ['tools', 'apis'] as const) {
      try {
        const docPath = await getDocumentationPath(category, domain);
        const categoryFiles = await getAllMarkdownFiles(docPath);
        files.push(...categoryFiles);
      } catch {
        // Directory doesn't exist, continue
      }
    }

    return files;
  }

  /**
   * Extract content sections from local markdown files
   */
  private async extractFromLocalFiles(files: string[]): Promise<ContentSection[]> {
    const sections: ContentSection[] = [];

    for (const file of files) {
      const content = await readFileContent(file);
      if (!content) continue;

      const fileSections = this.parseMarkdownContent(content);
      sections.push(...fileSections);
    }

    return sections;
  }

  /**
   * Parse markdown content and extract meaningful sections
   */
  private parseMarkdownContent(content: string): ContentSection[] {
    const sections: ContentSection[] = [];
    const lines = content.split('\n');
    
    let currentSection: Partial<ContentSection> = {};
    let currentContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip frontmatter
      if (i === 0 && line.trim() === '---') {
        while (i < lines.length - 1 && lines[++i].trim() !== '---') {
          // Skip frontmatter lines
        }
        continue;
      }

      // Check for headings
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        // Save previous section if exists
        if (currentSection.title && currentContent.length > 0) {
          sections.push({
            title: currentSection.title,
            content: currentContent.join('\n').trim(),
            type: currentSection.type || 'text',
            level: currentSection.level || 1,
            priority: this.calculatePriority(currentSection.title, currentContent.join('\n')),
          });
        }

        // Start new section
        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();
        
        currentSection = {
          title,
          level,
          type: this.determineContentType(title),
        };
        currentContent = [];
        continue;
      }

      // Collect content for current section
      currentContent.push(line);
    }

    // Don't forget the last section
    if (currentSection.title && currentContent.length > 0) {
      sections.push({
        title: currentSection.title,
        content: currentContent.join('\n').trim(),
        type: currentSection.type || 'text',
        level: currentSection.level || 1,
        priority: this.calculatePriority(currentSection.title, currentContent.join('\n')),
      });
    }

    return sections;
  }

  /**
   * Determine content type based on title and content
   */
  private determineContentType(title: string): ContentSection['type'] {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('api') || titleLower.includes('endpoint')) {
      return 'api';
    }
    if (titleLower.includes('command') || titleLower.includes('cli')) {
      return 'command';
    }
    if (titleLower.includes('example') || titleLower.includes('usage')) {
      return 'example';
    }
    if (titleLower.includes('code') || titleLower.includes('snippet')) {
      return 'code';
    }
    
    return 'text';
  }

  /**
   * Calculate priority score for a section
   */
  private calculatePriority(title: string, content: string): number {
    let priority = 0;
    const titleLower = title.toLowerCase();

    // High priority keywords in title
    const highPriorityTitleKeywords = [
      'quick start', 'getting started', 'installation', 'setup',
      'api reference', 'commands', 'usage', 'examples'
    ];
    
    for (const keyword of highPriorityTitleKeywords) {
      if (titleLower.includes(keyword)) {
        priority += 10;
      }
    }

    // Code blocks and examples get higher priority
    const codeBlockCount = (content.match(/```/g) || []).length / 2;
    priority += codeBlockCount * 5;

    // Command patterns
    const commandPatterns = [
      /\$\s+\w+/g,           // $ command
      /npm \w+/g,            // npm commands
      /curl\s+/g,            // curl commands
      /git \w+/g,            // git commands
    ];

    for (const pattern of commandPatterns) {
      const matches = content.match(pattern) || [];
      priority += matches.length * 3;
    }

    // API endpoint patterns
    const apiPatterns = [
      /https?:\/\/[^\s)]+/g,  // URLs
      /GET|POST|PUT|DELETE/g,  // HTTP methods
      /\/api\/[^\s)]+/g,      // API paths
    ];

    for (const pattern of apiPatterns) {
      const matches = content.match(pattern) || [];
      priority += matches.length * 4;
    }

    // Length factor (not too short, not too long)
    const wordCount = content.split(/\s+/).length;
    if (wordCount > 10 && wordCount < 200) {
      priority += 2;
    }

    return priority;
  }

  /**
   * Filter sections based on specified section names
   */
  private filterSections(sections: ContentSection[], filterSections: string[]): ContentSection[] {
    return sections.filter(section => {
      return filterSections.some(filter => 
        section.title.toLowerCase().includes(filter.toLowerCase())
      );
    });
  }

  /**
   * Prioritize sections and ensure they fit within max length
   */
  private prioritizeSections(sections: ContentSection[]): ContentSection[] {
    // Sort by priority (highest first)
    const sorted = sections.sort((a, b) => b.priority - a.priority);
    
    const result: ContentSection[] = [];
    let currentLength = 0;
    
    // Add header template length estimate
    const headerLength = 200;
    currentLength += headerLength;

    for (const section of sorted) {
      const sectionLength = section.title.length + section.content.length + 50; // padding
      
      if (currentLength + sectionLength <= this.maxLength) {
        result.push(section);
        currentLength += sectionLength;
      } else {
        // Try to fit a truncated version
        const availableSpace = this.maxLength - currentLength - 100; // leave some buffer
        if (availableSpace > 100) {
          const truncatedContent = section.content.substring(0, availableSpace) + '...';
          result.push({
            ...section,
            content: truncatedContent,
          });
        }
        break;
      }
    }

    return result;
  }

  /**
   * Extract functions from content
   */
  private extractFunctions(content: string): ExtractedFunction[] {
    const seen = new Map<string, ExtractedFunction>(); // Track unique functions
    
    // Pattern for templater-style functions with descriptions on same line
    const templaterPatterns = [
      /`([^`]*<%[^%]*%>[^`]*)`\s*-\s*(.+?)(?:\n|$)/g,
      /`([^`]*tp\.[^`]+)`\s*-\s*(.+?)(?:\n|$)/g,
    ];
    
    // Pattern for API endpoints
    const apiPatterns = [
      /(?:GET|POST|PUT|DELETE|PATCH)\s+([\/\w\-\{\}:]+)/g,
      /curl\s+.*?([\/\w\-\{\}:]+)/g,
    ];
    
    // Pattern for function definitions in code blocks
    const functionPatterns = [
      /(?:function|def|const|let|var)\s+(\w+)\s*\([^)]*\)/g,
      /(\w+)\s*\([^)]*\)\s*[{=>]/g,
    ];
    
    // Pattern for command line tools
    const commandPatterns = [
      /`([a-zA-Z0-9\-_]+(?:\s+[a-zA-Z0-9\-_]+)*)`/g,
      /\$\s+([a-zA-Z0-9\-_\s]+)/g,
    ];

    // Extract templater-style functions first (they have descriptions on the same line)
    for (const pattern of templaterPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const syntax = match[1].trim();
        const description = match[2].trim();
        
        if (syntax.length > 5 && description.length > 10) {
          // Extract function name from syntax
          const nameMatch = syntax.match(/tp\.(\w+)\.(\w+)/) || syntax.match(/(%[^%]*%)/);
          const name = nameMatch ? (nameMatch[2] || nameMatch[1]) : syntax.substring(0, 20);
          
          const functionData = {
            name: name.trim(),
            syntax: syntax,
            description: description,
          };
          
          // Deduplicate based on name and syntax
          const key = `${functionData.name}-${functionData.syntax}`;
          if (!seen.has(key)) {
            seen.set(key, functionData);
          } else {
            // If we have a better description, update it
            const existing = seen.get(key)!;
            if (functionData.description.length > existing.description.length) {
              existing.description = functionData.description;
            }
          }
        }
      }
    }

    // Extract other patterns
    for (const pattern of [...apiPatterns, ...functionPatterns, ...commandPatterns]) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1];
        if (name && name.length > 1 && name.length < 50) {
          const functionData = {
            name: name.trim(),
            syntax: match[0].trim(),
            description: this.extractDescriptionForFunction(content, match.index),
          };
          
          // Deduplicate
          const key = `${functionData.name}-${functionData.syntax}`;
          if (!seen.has(key)) {
            seen.set(key, functionData);
          }
        }
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Extract description for a function based on surrounding context
   */
  private extractDescriptionForFunction(content: string, index: number): string {
    const lines = content.split('\n');
    let currentLine = 0;
    let charCount = 0;
    
    // Find the line containing the function
    for (let i = 0; i < lines.length; i++) {
      if (charCount + lines[i].length >= index) {
        currentLine = i;
        break;
      }
      charCount += lines[i].length + 1;
    }
    
    // Look for description in surrounding lines
    for (let i = Math.max(0, currentLine - 3); i <= Math.min(lines.length - 1, currentLine + 3); i++) {
      const line = lines[i].trim();
      if (line && !line.includes('`') && !line.startsWith('#') && line.length > 10) {
        return line.replace(/^[*\-\+]\s*/, '').trim();
      }
    }
    
    return 'Function or command';
  }

  /**
   * Extract key concepts and definitions
   */
  private extractConcepts(content: string): ExtractedConcept[] {
    const concepts: ExtractedConcept[] = [];
    
    // Pattern for definition lists
    const definitionPatterns = [
      /^\*\*([^*]+)\*\*:\s*(.+)$/gm,
      /^-\s*\*\*([^*]+)\*\*:\s*(.+)$/gm,
      /^([A-Z][a-zA-Z\s]+):\s*(.+)$/gm,
    ];
    
    for (const pattern of definitionPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const term = match[1].trim();
        const definition = match[2].trim();
        
        if (term.length > 2 && term.length < 50 && definition.length > 10) {
          concepts.push({
            term,
            definition,
          });
        }
      }
    }
    
    return concepts;
  }

  /**
   * Extract and format tables from markdown content
   */
  private extractTables(content: string): string[] {
    const tables: string[] = [];
    const tableRegex = /\|[^|\n]*\|[^|\n]*\|[^\n]*\n\|[-\s|:]+\|\n(\|[^|\n]*\|[^\n]*\n)*/g;
    
    let match;
    while ((match = tableRegex.exec(content)) !== null) {
      tables.push(match[0].trim());
    }
    
    return tables;
  }

  /**
   * Generate the final cheat sheet content
   */
  private generateCheatSheetContent(sections: ContentSection[]): string {
    // Extract structured information from all content
    const allContent = sections.map(s => s.content).join('\n\n');
    const extractedFunctions = this.extractFunctions(allContent);
    const extractedConcepts = this.extractConcepts(allContent);
    const extractedTables = this.extractTables(allContent);
    
    // Group functions by module/category
    const functionsByModule = this.groupFunctionsByModule(extractedFunctions);
    
    const parts: string[] = [];
    
    // Header with title and brief description
    parts.push(this.generateHeader(sections));
    
    // Key Concepts section
    if (extractedConcepts.length > 0) {
      parts.push(this.generateKeyConceptsSection(extractedConcepts));
    }
    
    // Functions/Commands by Module
    if (Object.keys(functionsByModule).length > 0) {
      parts.push(this.generateFunctionsSection(functionsByModule));
    }
    
    // Code Examples section
    const codeExamples = this.extractCodeExamples(sections);
    if (codeExamples.length > 0) {
      parts.push(this.generateCodeExamplesSection(codeExamples));
    }
    
    // Reference Tables section
    if (extractedTables.length > 0) {
      parts.push(this.generateTablesSection(extractedTables));
    }
    
    // Best Practices section
    const bestPractices = this.extractBestPractices(sections);
    if (bestPractices.length > 0) {
      parts.push(this.generateBestPracticesSection(bestPractices));
    }
    
    // Footer
    parts.push(this.generateFooter());
    
    return parts.join('\n\n');
  }

  /**
   * Generate header section
   */
  private generateHeader(sections: ContentSection[]): string {
    const toolName = this.inferToolName(sections);
    const description = this.generateDescription(sections);
    
    return [
      `# ${toolName}: Cheat Sheet`,
      '',
      description,
      '',
      '---',
    ].join('\n');
  }

  /**
   * Generate Key Concepts section
   */
  private generateKeyConceptsSection(concepts: ExtractedConcept[]): string {
    const parts = [
      '## Key Concepts',
      '',
    ];
    
    concepts.slice(0, 8).forEach(concept => {
      parts.push(`- **${concept.term}**: ${concept.definition}`);
    });
    
    return parts.join('\n');
  }

  /**
   * Generate Functions section with tables
   */
  private generateFunctionsSection(functionsByModule: { [key: string]: ExtractedFunction[] }): string {
    const parts = ['## Common Functions'];
    
    Object.entries(functionsByModule).forEach(([module, functions]) => {
      if (functions.length === 0) return;
      
      parts.push('');
      parts.push(`### ${module}`);
      parts.push('');
      parts.push('| Function | Syntax | Description |');
      parts.push('|---|---|---|');
      
      functions.slice(0, 10).forEach(func => {
        // Properly escape table cells
        const cells = [
          this.escapeTableCell(func.name),
          `\`${this.escapeTableCell(this.cleanSyntax(func.syntax))}\``,
          this.escapeTableCell(this.cleanDescription(func.description))
        ];
        
        // Only add if all cells are valid
        if (cells.every(cell => cell && cell.length > 0)) {
          parts.push(`| ${cells.join(' | ')} |`);
        }
      });
    });
    
    return parts.join('\n');
  }

  /**
   * Generate Code Examples section
   */
  private generateCodeExamplesSection(examples: { title: string; code: string; language?: string }[]): string {
    const parts = [
      '## Quick Examples',
      '',
    ];
    
    examples.slice(0, 5).forEach(example => {
      parts.push(`### ${example.title}`);
      parts.push('');
      parts.push(`\`\`\`${example.language || ''}`);
      parts.push(example.code.trim());
      parts.push('```');
      parts.push('');
    });
    
    return parts.join('\n');
  }

  /**
   * Generate Tables section
   */
  private generateTablesSection(tables: string[]): string {
    const parts = [
      '## Reference Tables',
      '',
    ];
    
    tables.slice(0, 3).forEach((table, index) => {
      if (index > 0) parts.push('');
      parts.push(table);
    });
    
    return parts.join('\n');
  }

  /**
   * Generate Best Practices section
   */
  private generateBestPracticesSection(practices: string[]): string {
    const parts = [
      '## Best Practices and Tips',
      '',
    ];
    
    practices.slice(0, 8).forEach(practice => {
      parts.push(`- ${practice}`);
    });
    
    return parts.join('\n');
  }

  /**
   * Generate footer
   */
  private generateFooter(): string {
    return [
      '---',
      '',
      '*Generated by mcp-for-docs cheat sheet generator*',
      `*Last updated: ${new Date().toLocaleDateString()}*`,
    ].join('\n');
  }

  /**
   * Group functions by module or category
   */
  private groupFunctionsByModule(functions: ExtractedFunction[]): { [key: string]: ExtractedFunction[] } {
    const groups: { [key: string]: ExtractedFunction[] } = {};
    
    functions.forEach(func => {
      let module = 'General';
      
      // Try to infer module from function name or syntax
      if (func.syntax.includes('tp.date')) module = 'Date Module (tp.date)';
      else if (func.syntax.includes('tp.file')) module = 'File Module (tp.file)';
      else if (func.syntax.includes('tp.system')) module = 'System Module (tp.system)';
      else if (func.syntax.includes('tp.user')) module = 'User Functions (tp.user)';
      else if (func.syntax.includes('<%') && func.syntax.includes('%>')) module = 'Template Commands';
      else if (func.syntax.includes('GET') || func.syntax.includes('POST')) module = 'API Endpoints';
      else if (func.syntax.includes('$') || func.syntax.includes('npm') || func.syntax.includes('curl')) module = 'CLI Commands';
      else if (func.syntax.includes('git')) module = 'Git Commands';
      
      if (!groups[module]) groups[module] = [];
      groups[module].push(func);
    });
    
    return groups;
  }

  /**
   * Extract code examples from sections
   */
  private extractCodeExamples(sections: ContentSection[]): { title: string; code: string; language?: string }[] {
    const examples: { title: string; code: string; language?: string }[] = [];
    
    sections.forEach(section => {
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      let match;
      
      while ((match = codeBlockRegex.exec(section.content)) !== null) {
        const language = match[1];
        const code = match[2].trim();
        
        if (code.length > 10 && code.length < 500) {
          examples.push({
            title: this.generateExampleTitle(code, language),
            code,
            language,
          });
        }
      }
    });
    
    return examples;
  }

  /**
   * Extract best practices from content
   */
  private extractBestPractices(sections: ContentSection[]): string[] {
    const practices: string[] = [];
    
    sections.forEach(section => {
      const content = section.content;
      
      // Look for tips, best practices, notes, etc.
      const tipPatterns = [
        /(?:Tip|Note|Best Practice|Important|Remember):\s*(.+)/gi,
        /💡\s*(.+)/g,
        /⚠️\s*(.+)/g,
        /^>\s*(.+)/gm, // Blockquotes
      ];
      
      tipPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const tip = match[1].trim();
          if (tip.length > 20 && tip.length < 200) {
            practices.push(tip);
          }
        }
      });
    });
    
    return [...new Set(practices)]; // Remove duplicates
  }

  /**
   * Infer tool name from content
   */
  private inferToolName(sections: ContentSection[]): string {
    const allContent = sections.map(s => s.title + ' ' + s.content).join(' ');
    
    // Look for common tool names
    const toolPatterns = [
      /([A-Z][a-zA-Z]+)\s+(?:API|Documentation|Guide)/,
      /^([A-Z][a-zA-Z]+):/,
      /Using\s+([A-Z][a-zA-Z]+)/,
    ];
    
    for (const pattern of toolPatterns) {
      const match = allContent.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return 'Documentation';
  }

  /**
   * Generate description from content
   */
  private generateDescription(sections: ContentSection[]): string {
    // Look for introduction or overview sections
    const introSection = sections.find(s => 
      s.title.toLowerCase().includes('introduction') || 
      s.title.toLowerCase().includes('overview') ||
      s.title.toLowerCase().includes('getting started')
    );
    
    if (introSection) {
      // Extract first meaningful sentence
      const sentences = introSection.content.split(/[.!?]+/);
      for (const sentence of sentences) {
        const clean = sentence.trim().replace(/^[*\-\+]\s*/, '');
        if (clean.length > 50 && clean.length < 300 && !clean.includes('`')) {
          return clean + '.';
        }
      }
    }
    
    return 'Quick reference guide for essential functions and commands.';
  }

  /**
   * Clean syntax for table display
   */
  private cleanSyntax(syntax: string): string {
    return syntax
      .replace(/^\$\s+/, '')
      .replace(/^curl\s+/, 'curl ')
      .substring(0, 50)
      .trim();
  }

  /**
   * Clean description for table display
   */
  private cleanDescription(description: string): string {
    return description
      .replace(/^[*\-\+]\s*/, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .substring(0, 80)
      .trim();
  }

  /**
   * Properly escape text for markdown table cells
   */
  private escapeTableCell(text: string): string {
    return text
      .replace(/\|/g, '\\|')  // Escape pipes
      .replace(/\n/g, ' ')    // Remove newlines
      .replace(/\r/g, '')     // Remove carriage returns
      .trim();
  }

  /**
   * Generate example title based on code content
   */
  private generateExampleTitle(code: string, language?: string): string {
    if (language === 'bash' || code.includes('$')) return 'Command Line Usage';
    if (language === 'javascript' || code.includes('function')) return 'JavaScript Example';
    if (language === 'json' || code.startsWith('{')) return 'JSON Structure';
    if (code.includes('curl')) return 'API Request';
    if (code.includes('npm') || code.includes('install')) return 'Installation';
    
    return 'Code Example';
  }

}