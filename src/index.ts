#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { DocumentationCrawler } from './crawler/index.js';
import { listDocumentation, getDocumentationStats } from './utils/file.js';
import { CheatSheetGenerator } from './cheatsheet/index.js';

// Tool schemas
const CrawlDocumentationSchema = z.object({
  url: z.string().url().describe('Documentation homepage URL'),
  max_depth: z.number().optional().default(3).describe('Maximum crawl depth'),
  force_refresh: z.boolean().optional().default(false).describe('Force refresh existing docs'),
  rate_limit: z.number().optional().default(2).describe('Requests per second'),
  include_patterns: z.array(z.string()).optional().describe('URL patterns to include'),
  exclude_patterns: z.array(z.string()).optional().describe('URL patterns to exclude'),
});

const GenerateCheatsheetSchema = z.object({
  url: z.string().url().describe('Documentation URL'),
  use_local: z.boolean().optional().default(true).describe('Use local files if available'),
  sections: z.array(z.string()).optional().describe('Specific sections to include'),
  output_format: z.enum(['single', 'multi']).optional().default('single').describe('Output format'),
  max_length: z.number().optional().default(10000).describe('Maximum characters'),
});

const ListDocumentationSchema = z.object({
  category: z.enum(['tools', 'apis', 'all']).optional().default('all').describe('Category to list'),
  include_stats: z.boolean().optional().default(false).describe('Include file statistics'),
});

// Server setup
const server = new Server(
  {
    name: 'mcp-for-docs',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: 'crawl_documentation',
    description: 'Crawl and download documentation from a website',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Documentation homepage URL' },
        max_depth: { type: 'number', description: 'Maximum crawl depth', default: 3 },
        force_refresh: { type: 'boolean', description: 'Force refresh existing docs', default: false },
        rate_limit: { type: 'number', description: 'Requests per second', default: 2 },
        include_patterns: { type: 'array', items: { type: 'string' }, description: 'URL patterns to include' },
        exclude_patterns: { type: 'array', items: { type: 'string' }, description: 'URL patterns to exclude' },
      },
      required: ['url'],
    },
  },
  {
    name: 'generate_cheatsheet',
    description: 'Generate a cheat sheet from documentation',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Documentation URL' },
        use_local: { type: 'boolean', description: 'Use local files if available', default: true },
        sections: { type: 'array', items: { type: 'string' }, description: 'Specific sections to include' },
        output_format: { type: 'string', enum: ['single', 'multi'], description: 'Output format', default: 'single' },
        max_length: { type: 'number', description: 'Maximum characters', default: 10000 },
      },
      required: ['url'],
    },
  },
  {
    name: 'list_documentation',
    description: 'List available documentation',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['tools', 'apis', 'all'], description: 'Category to list', default: 'all' },
        include_stats: { type: 'boolean', description: 'Include file statistics', default: false },
      },
    },
  },
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'crawl_documentation': {
        const params = CrawlDocumentationSchema.parse(args);
        const crawler = new DocumentationCrawler();
        
        const result = await crawler.crawl({
          ...params,
          onProgress: (_status) => {
            // Progress updates could be logged here if needed
          },
        });
        
        const summary = [
          `✅ Crawling completed for ${params.url}`,
          `📁 Category: ${result.category}`,
          `🏷️  Name: ${result.name}`,
          `📊 Stats:`,
          `   - Discovered: ${result.stats.discovered} pages`,
          `   - Processed: ${result.stats.processed} pages`,
          `   - Saved: ${result.stats.saved} files`,
          `   - Errors: ${result.stats.errors}`,
          '',
          result.savedFiles.length > 0 ? '📄 Saved files:' : '',
          ...result.savedFiles.slice(0, 10).map(file => `   - ${file}`),
          result.savedFiles.length > 10 ? `   ... and ${result.savedFiles.length - 10} more` : '',
          '',
          result.errors.length > 0 ? '❌ Errors:' : '',
          ...result.errors.slice(0, 5).map(error => `   - ${error}`),
          result.errors.length > 5 ? `   ... and ${result.errors.length - 5} more errors` : '',
        ].filter(Boolean).join('\n');
        
        return {
          content: [
            {
              type: 'text',
              text: summary,
            },
          ],
        };
      }

      case 'generate_cheatsheet': {
        const params = GenerateCheatsheetSchema.parse(args);
        
        try {
          const generator = new CheatSheetGenerator({
            outputFormat: params.output_format,
            maxLength: params.max_length,
          });
          
          const result = await generator.generate({
            url: params.url,
            useLocal: params.use_local,
            sections: params.sections,
            outputFormat: params.output_format,
            maxLength: params.max_length,
          });
          
          const summary = [
            `✅ Cheat sheet generated for ${params.url}`,
            `📄 Output file: ${result.filePath}`,
            `📊 Stats:`,
            `   - Word count: ${result.wordCount}`,
            `   - Sections: ${result.sections?.length || 0}`,
            `   - Source files: ${result.sourceFiles.length}`,
            '',
            result.sections && result.sections.length > 0 ? '📑 Sections included:' : '',
            ...result.sections?.map(section => `   - ${section}`) || [],
            '',
            '📄 Generated content preview:',
            result.content.split('\n').slice(0, 20).join('\n'),
            result.content.split('\n').length > 20 ? '\n... (content truncated, see full file)' : '',
          ].filter(Boolean).join('\n');
          
          return {
            content: [
              {
                type: 'text',
                text: summary,
              },
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: 'text',
                text: `❌ Failed to generate cheat sheet: ${errorMessage}`,
              },
            ],
            isError: true,
          };
        }
      }

      case 'list_documentation': {
        const params = ListDocumentationSchema.parse(args);
        const docs = await listDocumentation(params.category === 'all' ? undefined : params.category);
        
        const formatCategory = async (categoryName: 'tools' | 'apis', items: string[]) => {
          if (items.length === 0) {
            return `\n📂 ${categoryName.toUpperCase()}: (none)`;
          }
          
          const lines = [`\n📂 ${categoryName.toUpperCase()}:`];
          
          for (const item of items) {
            if (params.include_stats) {
              try {
                const stats = await getDocumentationStats(categoryName, item);
                lines.push(`   📄 ${item} (${stats.fileCount} files, ${Math.round(stats.totalSize / 1024)}KB${stats.lastModified ? `, updated ${stats.lastModified.toLocaleDateString()}` : ''})`);
              } catch {
                lines.push(`   📄 ${item} (stats unavailable)`);
              }
            } else {
              lines.push(`   📄 ${item}`);
            }
          }
          
          return lines.join('\n');
        };
        
        const sections = [];
        
        if (params.category === 'all' || params.category === 'tools') {
          sections.push(await formatCategory('tools', docs.tools));
        }
        
        if (params.category === 'all' || params.category === 'apis') {
          sections.push(await formatCategory('apis', docs.apis));
        }
        
        const totalCount = docs.tools.length + docs.apis.length;
        const summary = `📚 Documentation Summary (${totalCount} total)\n${sections.join('\n')}`;
        
        return {
          content: [
            {
              type: 'text',
              text: summary,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP server for documentation started');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});