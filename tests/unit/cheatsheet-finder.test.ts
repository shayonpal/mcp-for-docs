import { describe, it, expect, beforeEach } from '@jest/globals';
import { CheatsheetFinder } from '../../src/discovery/CheatsheetFinder.js';
import { clearConfigCache } from '../../src/config/index.js';
import { clearFileConfigCache } from '../../src/utils/file.js';

// Use the test environment base path
const TEST_DOCS_BASE = process.env.DOCS_BASE_PATH || '/tmp/mcp-for-docs-test';

describe('CheatsheetFinder', () => {
  let finder: CheatsheetFinder;

  beforeEach(() => {
    // Clear caches so tests use environment variables
    clearConfigCache();
    clearFileConfigCache();
    finder = new CheatsheetFinder();
  });

  describe('getCheatsheetPath', () => {
    it('should generate correct path for tool documentation', async () => {
      const testCases = [
        {
          url: 'https://docs.obsidian.md',
          expected: `${TEST_DOCS_BASE}/tools/obsidian/obsidian-Cheatsheet.md`
        },
        {
          url: 'https://docs.n8n.io',
          expected: `${TEST_DOCS_BASE}/tools/n8n/n8n-Cheatsheet.md`
        },
        {
          url: 'https://help.github.com',
          expected: `${TEST_DOCS_BASE}/tools/github/github-Cheatsheet.md`
        }
      ];

      for (const testCase of testCases) {
        const path = await finder.getCheatsheetPath(testCase.url);
        expect(path).toBe(testCase.expected);
      }
    });

    it('should generate correct path for API documentation', async () => {
      const testCases = [
        {
          url: 'https://api.stripe.com',
          expected: `${TEST_DOCS_BASE}/apis/stripe/stripe-Cheatsheet.md`
        },
        {
          url: 'https://developers.google.com/maps',
          expected: `${TEST_DOCS_BASE}/apis/google/maps/google-Cheatsheet.md`
        },
        {
          url: 'https://api.openai.com/v1/chat',
          expected: `${TEST_DOCS_BASE}/apis/openai/v1/chat/openai-Cheatsheet.md`
        }
      ];

      for (const testCase of testCases) {
        const path = await finder.getCheatsheetPath(testCase.url);
        expect(path).toBe(testCase.expected);
      }
    });

    it('should handle complex plugin paths correctly', async () => {
      const path = await finder.getCheatsheetPath('https://docs.obsidian.md/plugins/dataview');
      expect(path).toBe(`${TEST_DOCS_BASE}/tools/obsidian/plugins/dataview/obsidian-Cheatsheet.md`);
    });

    it('should sanitize tool names for filesystem', async () => {
      const path = await finder.getCheatsheetPath('https://docs.example!!@#$.com/path');
      expect(path).not.toContain('!');
      expect(path).not.toContain('@');
      expect(path).not.toContain('#');
      expect(path).not.toContain('$');
    });

    it('should handle malformed URLs gracefully', async () => {
      const path = await finder.getCheatsheetPath('not-a-url');
      expect(path).toContain('tools'); // Default category
      expect(path).toContain('cheatsheet-');
      expect(path).toContain('.md');
    });

    it('should strip common prefixes from hostnames', async () => {
      const testCases = [
        'https://www.example.com',
        'https://docs.example.com',
        'https://api.example.com',
        'https://developer.example.com'
      ];

      for (const url of testCases) {
        const path = await finder.getCheatsheetPath(url);
        expect(path).toContain('/example/example-Cheatsheet.md');
      }
    });
  });
});