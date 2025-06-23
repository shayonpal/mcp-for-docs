#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

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
        // TODO: Implement crawler
        return {
          content: [
            {
              type: 'text',
              text: `Crawling documentation from ${params.url} (max depth: ${params.max_depth})`,
            },
          ],
        };
      }

      case 'generate_cheatsheet': {
        const params = GenerateCheatsheetSchema.parse(args);
        // TODO: Implement cheat sheet generator
        return {
          content: [
            {
              type: 'text',
              text: `Generating cheat sheet for ${params.url} (use local: ${params.use_local})`,
            },
          ],
        };
      }

      case 'list_documentation': {
        const params = ListDocumentationSchema.parse(args);
        // TODO: Implement documentation listing
        return {
          content: [
            {
              type: 'text',
              text: `Listing ${params.category} documentation (include stats: ${params.include_stats})`,
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