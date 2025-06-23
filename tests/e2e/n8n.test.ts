import { DocumentationCrawler } from '../../src/crawler/index.js';
import { promises as fs } from 'fs';
import path from 'path';

const testDir = process.cwd() + '/tests/e2e';

describe('N8N Documentation E2E Test', () => {
  const testOutputDir = path.join(testDir, '../output/n8n-test');
  let crawler: DocumentationCrawler;

  beforeAll(async () => {
    crawler = new DocumentationCrawler();
    
    // Clean up test directory
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, ignore
    }
    
    // Create test directory
    await fs.mkdir(testOutputDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
  });

  test('should crawl n8n documentation with limited depth', async () => {
    const options = {
      url: 'https://docs.n8n.io',
      max_depth: 1, // Limited depth for faster testing
      rate_limit: 1, // 1 request per second to be respectful
      include_patterns: [
        '/getting-started/',
        '/workflows/',
        '/nodes/'
      ],
      exclude_patterns: [
        '/community/',
        '/api/',
        '/hosting/'
      ]
    };

    console.log('Starting n8n documentation crawl...');
    const result = await crawler.crawl(options);

    // Verify crawl results
    expect(result.success).toBeDefined();
    expect(result.stats.saved).toBeGreaterThan(0);
    expect(result.errors.length).toBeLessThan(result.stats.processed || 1); // Some errors are acceptable

    console.log(`Crawl completed: ${result.stats.saved} pages, ${result.errors.length} errors`);

    // Verify files were created
    const files = await fs.readdir(testOutputDir, { recursive: true });
    const markdownFiles = files.filter(file => typeof file === 'string' && file.endsWith('.md'));
    
    expect(markdownFiles.length).toBeGreaterThan(0);
    console.log(`Created ${markdownFiles.length} markdown files`);

    // Verify at least one file has proper content
    if (markdownFiles.length > 0) {
      const sampleFile = path.join(testOutputDir, markdownFiles[0]);
      const content = await fs.readFile(sampleFile, 'utf-8');
      
      expect(content.length).toBeGreaterThan(100); // Should have substantial content
      expect(content).toMatch(/^#/m); // Should have at least one heading
      
      console.log(`Sample file ${markdownFiles[0]} has ${content.length} characters`);
    }

    // Log summary for manual verification
    console.log('\n=== N8N Crawl Summary ===');
    console.log(`Pages saved: ${result.stats.saved}`);
    console.log(`Pages processed: ${result.stats.processed}`);
    console.log(`Errors: ${result.errors.length}`);
    console.log(`Output directory: ${testOutputDir}`);
    console.log(`Markdown files created: ${markdownFiles.length}`);
    
    if (result.errors.length > 0) {
      console.log('\nErrors encountered:');
      result.errors.slice(0, 5).forEach((error, i) => {
        console.log(`${i + 1}. ${error}`);
      });
    }
  }, 60000); // 60 second timeout for network operations

  test('should respect rate limiting', async () => {
    const startTime = Date.now();
    
    const options = {
      url: 'https://docs.n8n.io/getting-started/',
      max_depth: 0, // Only crawl the single page
      rate_limit: 2 // 2 requests per second
    };

    await crawler.crawl(options);
    
    const duration = Date.now() - startTime;
    
    // Should take at least some time due to rate limiting
    expect(duration).toBeGreaterThan(500); // At least 0.5 seconds
    
    console.log(`Single page crawl took ${duration}ms with rate limiting`);
  }, 30000);

  test('should handle invalid URLs gracefully', async () => {
    const options = {
      url: 'https://docs.n8n.io/nonexistent-page-12345',
      max_depth: 1,
      rate_limit: 1
    };

    const result = await crawler.crawl(options);
    
    // Should not crash, but might have errors
    expect(result).toBeDefined();
    expect(result.success).toBeDefined();
    
    console.log(`Invalid URL test: ${result.stats.saved} pages, ${result.errors.length} errors`);
  }, 30000);
});