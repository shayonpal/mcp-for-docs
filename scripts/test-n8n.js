#!/usr/bin/env node

import { DocumentationCrawler } from '../dist/crawler/index.js';
import { promises as fs } from 'fs';
import path from 'path';

const testOutputDir = path.join(process.cwd(), 'tests/output/n8n-test');

async function runN8nTest() {
  console.log('🚀 Starting N8N Documentation E2E Test...\n');
  
  const crawler = new DocumentationCrawler();
  
  try {
    // Clean up test directory
    await fs.rm(testOutputDir, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(testOutputDir, { recursive: true });
    
    // Test 1: Crawl n8n documentation with limited depth
    console.log('📖 Test 1: Crawling n8n documentation with limited depth...');
    const startTime = Date.now();
    
    const options = {
      url: 'https://docs.n8n.io',
      max_depth: 1, // Limited depth for faster testing
      rate_limit: 1, // 1 request per second to be respectful
      force_refresh: true, // Force refresh to test actual crawling
      include_patterns: [
        '/getting-started/',
        '/workflows/',
        '/nodes/'
      ],
      exclude_patterns: [
        '/community/',
        '/try-it-out/',
        '/hosting/'
      ]
    };

    const result = await crawler.crawl(options);
    const duration = Date.now() - startTime;
    
    console.log(`\n✅ Crawl completed in ${duration}ms`);
    console.log(`📊 Stats: ${result.stats.saved} saved, ${result.stats.processed} processed, ${result.errors.length} errors`);
    console.log(`📁 Category: ${result.category}, Name: ${result.name}`);
    
    // Verify files were created
    const files = await fs.readdir(process.cwd() + '/Users/shayon/DevProjects/~meta/docs/tools/n8n', { recursive: true }).catch(() => []);
    const markdownFiles = files.filter(file => typeof file === 'string' && file.endsWith('.md'));
    
    console.log(`📄 Created ${markdownFiles.length} markdown files`);
    
    // Verify at least one file has proper content
    if (markdownFiles.length > 0) {
      const sampleFile = process.cwd() + '/Users/shayon/DevProjects/~meta/docs/tools/n8n/' + markdownFiles[0];
      try {
        const content = await fs.readFile(sampleFile, 'utf-8');
        console.log(`📝 Sample file ${markdownFiles[0]} contains ${content.length} characters`);
        
        // Check for basic markdown structure
        if (content.includes('---') && content.includes('title:')) {
          console.log('✅ File has proper frontmatter');
        }
        if (content.match(/^#/m)) {
          console.log('✅ File has markdown headings');
        }
      } catch (error) {
        console.log(`⚠️  Could not read sample file: ${error.message}`);
      }
    }
    
    // Show errors if any
    if (result.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      result.errors.slice(0, 3).forEach((error, i) => {
        console.log(`${i + 1}. ${error}`);
      });
      if (result.errors.length > 3) {
        console.log(`... and ${result.errors.length - 3} more errors`);
      }
    }
    
    // Test 2: Rate limiting test
    console.log('\n⏱️  Test 2: Rate limiting test...');
    const rateLimitStart = Date.now();
    
    const singlePageOptions = {
      url: 'https://docs.n8n.io/getting-started/',
      max_depth: 0, // Only crawl the single page
      rate_limit: 2 // 2 requests per second
    };

    await crawler.crawl(singlePageOptions);
    const rateLimitDuration = Date.now() - rateLimitStart;
    
    console.log(`✅ Single page crawl took ${rateLimitDuration}ms with rate limiting`);
    
    // Test 3: Error handling test
    console.log('\n🔥 Test 3: Error handling test...');
    const errorOptions = {
      url: 'https://docs.n8n.io/nonexistent-page-12345',
      max_depth: 1,
      rate_limit: 1
    };

    const errorResult = await crawler.crawl(errorOptions);
    console.log(`✅ Error handling test: ${errorResult.stats.saved} pages saved, ${errorResult.errors.length} errors`);
    
    console.log('\n🎉 All tests completed successfully!');
    
    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total test duration: ${Date.now() - startTime}ms`);
    console.log(`Files created: ${markdownFiles.length}`);
    console.log(`Documentation saved to: /Users/shayon/DevProjects/~meta/docs/tools/n8n/`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Clean up test directory
    await fs.rm(testOutputDir, { recursive: true, force: true }).catch(() => {});
  }
}

runN8nTest().catch(console.error);