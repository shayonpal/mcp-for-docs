import { describe, it, expect } from '@jest/globals';
import { DocumentationCategorizer } from '../../src/categorizer/index.js';

describe('DocumentationCategorizer', () => {
  let categorizer: DocumentationCategorizer;

  beforeEach(() => {
    categorizer = new DocumentationCategorizer();
  });

  describe('URL Analysis', () => {
    it('should categorize API documentation URLs with high confidence', async () => {
      const apiUrls = [
        'https://api.example.com/docs',
        'https://docs.example.com/api/reference',
        'https://example.com/rest/v2/docs',
        'https://developers.example.com/guide',
        'https://example.com/graphql/schema',
        'https://docs.stripe.com/api',
      ];

      for (const url of apiUrls) {
        const result = await categorizer.categorize(url);
        expect(result.category).toBe('apis');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
        expect(result.reasons.length).toBeGreaterThan(0);
      }
    });

    it('should categorize tool documentation URLs with high confidence', async () => {
      const toolUrls = [
        'https://docs.example.com/getting-started',
        'https://help.example.com/tutorial',
        'https://example.com/docs/installation',
        'https://learn.example.com/guide',
        'https://support.example.com/manual',
        'https://docs.n8n.io/getting-started',
      ];

      for (const url of toolUrls) {
        const result = await categorizer.categorize(url);
        expect(result.category).toBe('tools');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
        expect(result.reasons.length).toBeGreaterThan(0);
      }
    });

    it('should handle ambiguous URLs with lower confidence', async () => {
      const ambiguousUrls = [
        'https://example.com/documentation',
        'https://github.com/user/project',
        'https://example.com/overview',
      ];

      for (const url of ambiguousUrls) {
        const result = await categorizer.categorize(url);
        expect(result.confidence).toBeLessThan(0.5);
      }
    });
  });

  describe('Content Analysis', () => {
    it('should categorize API content with high confidence', async () => {
      const apiContent = `
        # REST API Reference
        
        ## Authentication
        All API requests require authentication using an API key.
        
        ## Endpoints
        
        ### GET /users
        Retrieve a list of users.
        
        **Request:**
        \`\`\`bash
        curl -X GET https://api.example.com/v1/users \\
          -H "Authorization: Bearer YOUR_API_KEY"
        \`\`\`
        
        **Response:**
        \`\`\`json
        {
          "users": [...],
          "pagination": {...}
        }
        \`\`\`
        
        ### Rate Limiting
        API requests are limited to 100 requests per minute.
      `;

      const result = await categorizer.categorize('https://example.com', apiContent);
      expect(result.category).toBe('apis');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.reasons.some(r => r.includes('Content indicators'))).toBe(true);
    });

    it('should categorize tool content with high confidence', async () => {
      const toolContent = `
        # Getting Started with Example Tool
        
        ## Installation
        
        Install the tool using npm:
        
        \`\`\`bash
        $ npm install -g example-tool
        \`\`\`
        
        ## Quick Start Tutorial
        
        1. Create a configuration file
        2. Set up your workflow
        3. Run the tool
        
        ## Configuration
        
        The tool can be configured using a YAML file...
        
        ## Features
        
        - Easy to use interface
        - Powerful automation workflows
        - Plugin system for extensions
      `;

      const result = await categorizer.categorize('https://example.com', toolContent);
      expect(result.category).toBe('tools');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.reasons.some(r => r.includes('Content indicators'))).toBe(true);
    });

    it('should handle mixed content with medium confidence', async () => {
      const mixedContent = `
        # Documentation
        
        This project provides both a CLI tool and a REST API.
        
        ## Installation
        \`\`\`bash
        $ npm install example
        \`\`\`
        
        ## API Reference
        
        ### Authentication
        Use your API key to authenticate requests.
        
        ### Endpoints
        - GET /api/data
        - POST /api/data
      `;

      const result = await categorizer.categorize('https://example.com', mixedContent);
      expect(result.confidence).toBeGreaterThan(0.4);
      expect(result.confidence).toBeLessThan(0.8);
    });
  });

  describe('Combined Analysis', () => {
    it('should have high confidence when URL and content agree', async () => {
      const apiUrl = 'https://api.example.com/reference';
      const apiContent = 'API endpoints and authentication methods with rate limiting...';

      const result = await categorizer.categorize(apiUrl, apiContent);
      expect(result.category).toBe('apis');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should reduce confidence when URL and content disagree', async () => {
      const apiUrl = 'https://api.example.com/docs';
      const toolContent = 'Installation guide: npm install example-tool. Getting started tutorial...';

      const result = await categorizer.categorize(apiUrl, toolContent);
      // Should still make a decision but with lower confidence
      expect(result.confidence).toBeLessThan(0.8);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('should default to tools category when uncertain', async () => {
      const vagueUrl = 'https://example.com/info';
      const vagueContent = 'This is some documentation about our product.';

      const result = await categorizer.categorize(vagueUrl, vagueContent);
      expect(result.category).toBe('tools');
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.reasons.some(r => r.includes('defaulting to tools'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', async () => {
      const result = await categorizer.categorize('https://docs.example.com/api', '');
      expect(result.category).toBe('apis');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8); // URL pattern is clear enough
    });

    it('should handle malformed URLs gracefully', async () => {
      const result = await categorizer.categorize('not-a-url', 'Some content');
      expect(result.category).toBe('tools'); // Default
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should provide meaningful reasons for decisions', async () => {
      const result = await categorizer.categorize(
        'https://developers.example.com/api/v2',
        'REST API with endpoints for user management'
      );
      
      expect(result.reasons).toBeDefined();
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.reasons.some(r => r.includes('URL patterns'))).toBe(true);
    });
  });
});