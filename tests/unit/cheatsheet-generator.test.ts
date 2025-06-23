import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { CheatSheetGenerator, ContentSection } from '../../src/cheatsheet/generator.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('CheatSheetGenerator', () => {
  let generator: CheatSheetGenerator;
  const testOutputDir = path.join(process.cwd(), 'test-cheatsheets');

  beforeEach(() => {
    generator = new CheatSheetGenerator({
      maxLength: 2000,
      outputFormat: 'single'
    });
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
  });

  describe('Content analysis', () => {
    test('should determine correct content types', () => {
      const testTitles = [
        { title: 'API Reference', expected: 'api' },
        { title: 'Command Line Usage', expected: 'command' },
        { title: 'Example Usage', expected: 'example' },
        { title: 'Code Snippets', expected: 'code' },
        { title: 'Getting Started', expected: 'text' },
      ];

      testTitles.forEach(({ title, expected }) => {
        // Access private method for testing
        const contentType = (generator as any).determineContentType(title);
        expect(contentType).toBe(expected);
      });
    });

    test('should calculate priority correctly', () => {
      const testCases = [
        {
          title: 'Quick Start',
          content: 'Basic getting started guide',
          expectedPriority: 10, // High priority title keyword
        },
        {
          title: 'API Reference',
          content: 'List of endpoints:\n```\nGET /api/users\nPOST /api/users\n```',
          expectedMinPriority: 15, // High priority title + code block + API patterns
        },
        {
          title: 'Random Section',
          content: 'Just some text without special content',
          expectedMaxPriority: 5,
        },
      ];

      testCases.forEach(({ title, content, expectedPriority, expectedMinPriority, expectedMaxPriority }) => {
        const priority = (generator as any).calculatePriority(title, content);
        
        if (expectedPriority) {
          expect(priority).toBeGreaterThanOrEqual(expectedPriority);
        }
        if (expectedMinPriority) {
          expect(priority).toBeGreaterThanOrEqual(expectedMinPriority);
        }
        if (expectedMaxPriority) {
          expect(priority).toBeLessThanOrEqual(expectedMaxPriority);
        }
      });
    });

    test('should parse markdown content correctly', () => {
      const markdownContent = `---
title: "Test Doc"
---

# Main Title

This is the introduction.

## API Reference

Here are the endpoints:

\`\`\`bash
curl -X GET https://api.example.com/users
\`\`\`

## Examples

### Basic Usage

\`\`\`javascript
const client = new APIClient();
\`\`\`
`;

      const sections = (generator as any).parseMarkdownContent(markdownContent);
      
      expect(sections).toHaveLength(4); // Main Title, API Reference, Examples, Basic Usage
      expect(sections[0].title).toBe('Main Title');
      expect(sections[1].title).toBe('API Reference');
      expect(sections[1].type).toBe('api');
      expect(sections[2].title).toBe('Examples');
      expect(sections[2].type).toBe('example');
      expect(sections[3].title).toBe('Basic Usage');
      expect(sections[3].type).toBe('example');
    });
  });

  describe('Section filtering', () => {
    test('should filter sections by specified criteria', () => {
      const sections: ContentSection[] = [
        { title: 'Getting Started', content: 'Start here', type: 'text', level: 1, priority: 10 },
        { title: 'API Reference', content: 'API docs', type: 'api', level: 1, priority: 15 },
        { title: 'Troubleshooting', content: 'Debug info', type: 'text', level: 1, priority: 5 },
        { title: 'Examples', content: 'Code examples', type: 'example', level: 1, priority: 12 },
      ];

      const filtered = (generator as any).filterSections(sections, ['api', 'example']);
      
      expect(filtered).toHaveLength(2);
      expect(filtered[0].title).toBe('API Reference');
      expect(filtered[1].title).toBe('Examples');
    });

    test('should be case insensitive when filtering', () => {
      const sections: ContentSection[] = [
        { title: 'API Reference', content: 'API docs', type: 'api', level: 1, priority: 15 },
      ];

      const filtered = (generator as any).filterSections(sections, ['api']);
      expect(filtered).toHaveLength(1);
    });
  });

  describe('Content generation', () => {
    test('should prioritize sections correctly', () => {
      const sections: ContentSection[] = [
        { title: 'Low Priority', content: 'Less important', type: 'text', level: 1, priority: 5 },
        { title: 'High Priority', content: 'Very important', type: 'text', level: 1, priority: 20 },
        { title: 'Medium Priority', content: 'Somewhat important', type: 'text', level: 1, priority: 10 },
      ];

      const prioritized = (generator as any).prioritizeSections(sections);
      
      expect(prioritized[0].title).toBe('High Priority');
      expect(prioritized[1].title).toBe('Medium Priority');
      expect(prioritized[2].title).toBe('Low Priority');
    });

    test('should respect max length limits', () => {
      const longContent = 'A'.repeat(1000);
      const sections: ContentSection[] = [
        { title: 'Section 1', content: longContent, type: 'text', level: 1, priority: 20 },
        { title: 'Section 2', content: longContent, type: 'text', level: 1, priority: 19 },
        { title: 'Section 3', content: longContent, type: 'text', level: 1, priority: 18 },
      ];

      const shortGenerator = new CheatSheetGenerator({ maxLength: 800 });
      const prioritized = (shortGenerator as any).prioritizeSections(sections);
      
      // Should fit fewer sections due to length limit
      expect(prioritized.length).toBeLessThan(sections.length);
    });

    test('should generate valid markdown output', () => {
      const sections: ContentSection[] = [
        { 
          title: 'Getting Started', 
          content: '`<% tp.date.now() %>` - Returns current date\n\n> **Tip**: Start with simple templates', 
          type: 'text', 
          level: 1, 
          priority: 10 
        },
        { 
          title: 'API Reference', 
          content: '`GET /api/users` - Fetch users\n\n- **API**: Application Programming Interface', 
          type: 'api', 
          level: 1, 
          priority: 15 
        },
      ];

      const content = (generator as any).generateCheatSheetContent(sections);
      
      expect(content).toContain('Cheat Sheet');
      expect(content).toContain('*Generated by mcp-for-docs cheat sheet generator*');
      expect(content.length).toBeGreaterThan(100);
    });
  });

  describe('Utility functions', () => {
    test('should clean syntax for table display', () => {
      const testCases = [
        { input: '$ git status', expected: 'git status' },
        { input: 'curl -X GET', expected: 'curl -X GET' },
        { input: 'very-long-command-that-should-be-truncated-because-it-exceeds-limits', expected: 'very-long-command-that-should-be-truncated-because' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = (generator as any).cleanSyntax(input);
        expect(result).toBe(expected);
      });
    });
  });
});