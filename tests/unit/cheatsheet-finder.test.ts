import { describe, it, expect } from '@jest/globals';
import { CheatsheetFinder } from '../../src/discovery/CheatsheetFinder.js';

describe('CheatsheetFinder', () => {
  let finder: CheatsheetFinder;

  beforeEach(() => {
    finder = new CheatsheetFinder();
  });

  describe('getCheatsheetPath', () => {
    it('should generate correct path for tool documentation', async () => {
      const testCases = [
        {
          url: 'https://docs.obsidian.md',
          expected: '/Users/shayon/DevProjects/~meta/docs/tools/obsidian/obsidian-Cheatsheet.md'
        },
        {
          url: 'https://docs.n8n.io',
          expected: '/Users/shayon/DevProjects/~meta/docs/tools/n8n/n8n-Cheatsheet.md'
        },
        {
          url: 'https://help.github.com',
          expected: '/Users/shayon/DevProjects/~meta/docs/tools/github/github-Cheatsheet.md'
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
          expected: '/Users/shayon/DevProjects/~meta/docs/apis/stripe/stripe-Cheatsheet.md'
        },
        {
          url: 'https://developers.google.com/maps',
          expected: '/Users/shayon/DevProjects/~meta/docs/apis/google/maps/google-Cheatsheet.md'
        },
        {
          url: 'https://api.openai.com/v1/chat',
          expected: '/Users/shayon/DevProjects/~meta/docs/apis/openai/v1/chat/openai-Cheatsheet.md'
        }
      ];

      for (const testCase of testCases) {
        const path = await finder.getCheatsheetPath(testCase.url);
        expect(path).toBe(testCase.expected);
      }
    });

    it('should handle complex plugin paths correctly', async () => {
      const path = await finder.getCheatsheetPath('https://docs.obsidian.md/plugins/dataview');
      expect(path).toBe('/Users/shayon/DevProjects/~meta/docs/tools/obsidian/plugins/dataview/obsidian-Cheatsheet.md');
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