import { describe, it, expect } from '@jest/globals';
import {
  normalizeUrl,
  isValidUrl,
  toAbsoluteUrl,
  isSameDomain,
  extractDomainName,
  urlToFilename,
  matchesPatterns
} from '../../src/utils/url.js';

describe('URL Utilities', () => {
  describe('normalizeUrl', () => {
    it('should remove trailing slashes', () => {
      expect(normalizeUrl('https://example.com/')).toBe('https://example.com');
      expect(normalizeUrl('https://example.com/path/')).toBe('https://example.com/path');
    });

    it('should remove hash fragments', () => {
      expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
    });

    it('should sort query parameters', () => {
      expect(normalizeUrl('https://example.com?b=2&a=1')).toBe('https://example.com?a=1&b=2');
    });

    it('should handle invalid URLs gracefully', () => {
      expect(normalizeUrl('not-a-url')).toBe('not-a-url');
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('https://docs.n8n.io/getting-started')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('ftp://example.com')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('toAbsoluteUrl', () => {
    const baseUrl = 'https://docs.example.com/guide/';

    it('should convert relative URLs to absolute', () => {
      expect(toAbsoluteUrl(baseUrl, '../api')).toBe('https://docs.example.com/api');
      expect(toAbsoluteUrl(baseUrl, './basics')).toBe('https://docs.example.com/guide/basics');
      expect(toAbsoluteUrl(baseUrl, '/docs')).toBe('https://docs.example.com/docs');
    });

    it('should leave absolute URLs unchanged', () => {
      const absoluteUrl = 'https://other.com/page';
      expect(toAbsoluteUrl(baseUrl, absoluteUrl)).toBe(absoluteUrl);
    });

    it('should handle invalid URLs gracefully', () => {
      expect(toAbsoluteUrl(baseUrl, 'invalid url')).toBe('invalid url');
    });
  });

  describe('isSameDomain', () => {
    it('should return true for same domains', () => {
      expect(isSameDomain('https://example.com/page1', 'https://example.com/page2')).toBe(true);
      expect(isSameDomain('http://docs.n8n.io/a', 'https://docs.n8n.io/b')).toBe(true);
    });

    it('should return false for different domains', () => {
      expect(isSameDomain('https://example.com', 'https://other.com')).toBe(false);
      expect(isSameDomain('https://docs.example.com', 'https://api.example.com')).toBe(false);
    });

    it('should handle invalid URLs gracefully', () => {
      expect(isSameDomain('invalid', 'https://example.com')).toBe(false);
    });
  });

  describe('extractDomainName', () => {
    it('should extract simple domain names', () => {
      expect(extractDomainName('https://n8n.io')).toBe('n8n');
      expect(extractDomainName('https://anthropic.com')).toBe('anthropic');
    });

    it('should handle docs subdomains', () => {
      expect(extractDomainName('https://docs.n8n.io')).toBe('n8n');
      expect(extractDomainName('https://docs.anthropic.com')).toBe('anthropic');
    });

    it('should extract from documentation paths', () => {
      expect(extractDomainName('https://developer.apple.com/documentation/swift')).toBe('swift');
      expect(extractDomainName('https://github.com/org/project/docs')).toBe('project');
    });

    it('should handle edge cases', () => {
      expect(extractDomainName('https://www.example.com')).toBe('example');
      expect(extractDomainName('https://api.service.io/v1')).toBe('service');
    });

    it('should return unknown for invalid URLs', () => {
      expect(extractDomainName('invalid-url')).toBe('unknown');
    });
  });

  describe('urlToFilename', () => {
    it('should convert URLs to safe filenames', () => {
      expect(urlToFilename('https://example.com/getting-started')).toBe('getting-started.md');
      expect(urlToFilename('https://docs.com/api/users')).toBe('api_users.md');
    });

    it('should handle root URLs', () => {
      expect(urlToFilename('https://example.com')).toBe('index.md');
      expect(urlToFilename('https://example.com/')).toBe('index.md');
    });

    it('should sanitize special characters', () => {
      expect(urlToFilename('https://example.com/path?query=1&other=2')).toBe('path.md');
      expect(urlToFilename('https://example.com/special!@#$%^&*()')).toBe('special__.md');
    });

    it('should handle deep paths', () => {
      expect(urlToFilename('https://docs.com/guide/advanced/concepts')).toBe('guide_advanced_concepts.md');
    });
  });

  describe('matchesPatterns', () => {
    const patterns = ['*/docs/*', '*/api/*', 'https://specific.com/*'];

    it('should match glob patterns', () => {
      expect(matchesPatterns('https://example.com/docs/guide', patterns)).toBe(true);
      expect(matchesPatterns('https://example.com/api/v1', patterns)).toBe(true);
      expect(matchesPatterns('https://specific.com/anything', patterns)).toBe(true);
    });

    it('should not match non-matching patterns', () => {
      expect(matchesPatterns('https://example.com/blog/post', patterns)).toBe(false);
      expect(matchesPatterns('https://other.com/docs/guide', ['*/specific/*'])).toBe(false);
    });

    it('should handle empty patterns', () => {
      expect(matchesPatterns('https://example.com', [])).toBe(false);
    });

    it('should handle complex patterns', () => {
      const complexPatterns = ['https://docs.*.io/*', '*/v*/users'];
      expect(matchesPatterns('https://docs.n8n.io/guide', complexPatterns)).toBe(true);
      expect(matchesPatterns('https://api.com/v1/users', complexPatterns)).toBe(true);
    });
  });
});