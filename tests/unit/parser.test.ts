import { describe, it, expect, beforeEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { ContentParser } from '../../src/crawler/parser.js';

const testDir = process.cwd();

describe('ContentParser', () => {
  let parser: ContentParser;
  let sampleN8nHtml: string;
  let sampleAnthropicHtml: string;

  beforeEach(async () => {
    parser = new ContentParser();
    
    // Load test fixtures
    sampleN8nHtml = await fs.readFile(
      path.join(testDir, 'tests', 'fixtures', 'sample-n8n.html'), 
      'utf8'
    );
    sampleAnthropicHtml = await fs.readFile(
      path.join(testDir, 'tests', 'fixtures', 'sample-anthropic.html'), 
      'utf8'
    );
  });

  describe('getSiteConfig', () => {
    it('should return config for known n8n domain', () => {
      const config = parser.getSiteConfig('https://docs.n8n.io/getting-started');
      
      expect(config).toBeDefined();
      expect(config?.name).toBe('n8n');
      expect(config?.category).toBe('tools');
    });

    it('should return config for known anthropic domain', () => {
      const config = parser.getSiteConfig('https://docs.anthropic.com/api/reference');
      
      expect(config).toBeDefined();
      expect(config?.name).toBe('anthropic');
      expect(config?.category).toBe('apis');
    });

    it('should return null for unknown domains', () => {
      const config = parser.getSiteConfig('https://unknown-site.com/docs');
      expect(config).toBeNull();
    });

    it('should handle invalid URLs gracefully', () => {
      const config = parser.getSiteConfig('not-a-url');
      expect(config).toBeNull();
    });
  });

  describe('extractTitle', () => {
    it('should extract title from h1 element', () => {
      const title = parser.extractTitle(sampleN8nHtml, 'https://docs.n8n.io');
      expect(title).toBe('Getting Started with n8n');
    });

    it('should extract title from page title as fallback', () => {
      const htmlWithoutH1 = '<html><head><title>Page Title</title></head><body><p>Content</p></body></html>';
      const title = parser.extractTitle(htmlWithoutH1, 'https://example.com');
      expect(title).toBe('Page Title');
    });

    it('should return "Untitled" for pages without title', () => {
      const htmlWithoutTitle = '<html><body><p>Content without title</p></body></html>';
      const title = parser.extractTitle(htmlWithoutTitle, 'https://example.com');
      expect(title).toBe('Untitled');
    });

    it('should clean up title text', () => {
      const htmlWithMessyTitle = '<html><body><h1>  Title\\nWith\\nNewlines  </h1></body></html>';
      const title = parser.extractTitle(htmlWithMessyTitle, 'https://example.com');
      expect(title).toBe('Title With Newlines');
    });
  });

  describe('extractContent', () => {
    it('should extract main content from n8n HTML', () => {
      const content = parser.extractContent(sampleN8nHtml, 'https://docs.n8n.io');
      
      expect(content).toContain('Getting Started with n8n');
      expect(content).toContain('Installation');
      expect(content).toContain('npm install -g n8n');
      expect(content).toContain('Quick Start');
      
      // Should preserve code blocks
      expect(content).toContain('```bash');
      
      // Should preserve tables
      expect(content).toContain('| Step | Action |');
      
      // Should remove navigation and scripts
      expect(content).not.toContain('This should not appear in markdown');
      expect(content).not.toContain('<nav');
    });

    it('should extract main content from anthropic HTML', () => {
      const content = parser.extractContent(sampleAnthropicHtml, 'https://docs.anthropic.com');
      
      expect(content).toContain('Chat Completions API');
      expect(content).toContain('Authentication');
      expect(content).toContain('Request Format');
      
      // Should preserve code blocks with language
      expect(content).toContain('```bash');
      expect(content).toContain('```json');
      
      // Should preserve API parameters table
      expect(content).toContain('| Parameter | Type | Required | Description |');
      
      // Should remove sidebar and navigation
      expect(content).not.toContain('Quick Links');
      expect(content).not.toContain('<aside');
    });

    it('should handle HTML without main content selector', () => {
      const simpleHtml = '<html><body><p>Simple content</p></body></html>';
      const content = parser.extractContent(simpleHtml, 'https://example.com');
      
      expect(content).toContain('Simple content');
    });

    it('should convert alerts and callouts properly', () => {
      const content = parser.extractContent(sampleN8nHtml, 'https://docs.n8n.io');
      
      // Should convert info alerts
      expect(content).toContain('> ℹ️');
      
      // Should convert warning callouts  
      expect(content).toContain('> ⚠️');
    });

    it('should preserve inline code', () => {
      const content = parser.extractContent(sampleAnthropicHtml, 'https://docs.anthropic.com');
      
      expect(content).toContain('`/v1/messages`');
      expect(content).toContain('`model`');
      expect(content).toContain('`messages`');
    });
  });

  describe('extractLinks', () => {
    it('should extract and convert relative links to absolute', () => {
      const links = parser.extractLinks(sampleN8nHtml, 'https://docs.n8n.io/getting-started/');
      
      expect(links).toContain('https://docs.n8n.io/docs/');
      expect(links).toContain('https://docs.n8n.io/docs/getting-started/');
      expect(links).toContain('https://docs.n8n.io/docs/nodes/');
    });

    it('should extract links from anthropic HTML', () => {
      const links = parser.extractLinks(sampleAnthropicHtml, 'https://docs.anthropic.com/api/');
      
      expect(links).toContain('https://docs.anthropic.com/docs/');
      expect(links).toContain('https://docs.anthropic.com/api/');
      expect(links).toContain('https://docs.anthropic.com/docs/quickstart');
      expect(links).toContain('https://docs.anthropic.com/docs/models');
      expect(links).toContain('https://docs.anthropic.com/docs/pricing');
    });

    it('should remove duplicate links', () => {
      const htmlWithDuplicates = `
        <html><body>
          <a href="/page1">Link 1</a>
          <a href="/page1">Link 1 Again</a>
          <a href="/page2">Link 2</a>
        </body></html>
      `;
      
      const links = parser.extractLinks(htmlWithDuplicates, 'https://example.com');
      
      expect(links).toHaveLength(2);
      expect(links).toContain('https://example.com/page1');
      expect(links).toContain('https://example.com/page2');
    });

    it('should handle invalid href attributes gracefully', () => {
      const htmlWithInvalidLinks = `
        <html><body>
          <a href="/valid">Valid Link</a>
          <a href="">Empty Link</a>
          <a>No href</a>
          <a href="javascript:void(0)">JS Link</a>
        </body></html>
      `;
      
      const links = parser.extractLinks(htmlWithInvalidLinks, 'https://example.com');
      
      // Should only include valid, convertible links
      expect(links).toContain('https://example.com/valid');
      expect(links.some(link => link.includes('javascript'))).toBe(false);
    });
  });

  describe('markdown conversion quality', () => {
    it('should properly convert nested lists', () => {
      const htmlWithNestedList = `
        <html><body>
          <ol>
            <li>First item</li>
            <li>Second item
              <ul>
                <li>Nested item 1</li>
                <li>Nested item 2</li>
              </ul>
            </li>
            <li>Third item</li>
          </ol>
        </body></html>
      `;
      
      const content = parser.extractContent(htmlWithNestedList, 'https://example.com');
      
      expect(content).toContain('1. First item');
      expect(content).toContain('2. Second item');
      expect(content).toContain('- Nested item 1');
      expect(content).toContain('3. Third item');
    });

    it('should handle complex tables correctly', () => {
      const content = parser.extractContent(sampleAnthropicHtml, 'https://docs.anthropic.com');
      
      // Should create proper markdown table
      expect(content).toContain('| Parameter | Type | Required | Description |');
      expect(content).toContain('| --- | --- | --- | --- |');
      expect(content).toContain('| `model` | string | Yes | The model to use for completion |');
    });

    it('should preserve code block languages', () => {
      const content = parser.extractContent(sampleAnthropicHtml, 'https://docs.anthropic.com');
      
      expect(content).toContain('```bash');
      expect(content).toContain('```json');
    });
  });
});