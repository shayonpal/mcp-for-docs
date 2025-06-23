import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import {
  ensureDirectory,
  writeFileContent,
  fileExists,
  getDocumentationPath,
  listDocumentation,
  getDocumentationStats,
  getAllMarkdownFiles,
  readFileContent,
  deleteDocumentation
} from '../../src/utils/file.js';

// Use the same path as set in environment variable
const TEST_DOCS_BASE = process.env.DOCS_BASE_PATH || path.join(process.cwd(), 'tests', 'temp', 'docs');

// Note: We'll override DOCS_BASE_PATH via environment variable for tests

describe('File Utilities', () => {
  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(TEST_DOCS_BASE, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
  });

  afterEach(async () => {
    // Clean up after each test
    try {
      await fs.rm(TEST_DOCS_BASE, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('ensureDirectory', () => {
    it('should create directory if it does not exist', async () => {
      const testDir = path.join(TEST_DOCS_BASE, 'new-dir');
      await ensureDirectory(testDir);
      
      const stats = await fs.stat(testDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should not fail if directory already exists', async () => {
      const testDir = path.join(TEST_DOCS_BASE, 'existing-dir');
      await fs.mkdir(testDir, { recursive: true });
      
      // Should not throw
      await expect(ensureDirectory(testDir)).resolves.toBeUndefined();
    });

    it('should create nested directories', async () => {
      const testDir = path.join(TEST_DOCS_BASE, 'deeply', 'nested', 'dir');
      await ensureDirectory(testDir);
      
      const stats = await fs.stat(testDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('writeFileContent', () => {
    it('should write content to file and create directories', async () => {
      const filePath = path.join(TEST_DOCS_BASE, 'tools', 'n8n', 'index.md');
      const content = '# n8n Documentation';
      
      await writeFileContent(filePath, content);
      
      const writtenContent = await fs.readFile(filePath, 'utf8');
      expect(writtenContent).toBe(content);
    });

    it('should overwrite existing files', async () => {
      const filePath = path.join(TEST_DOCS_BASE, 'test.md');
      
      await writeFileContent(filePath, 'First content');
      await writeFileContent(filePath, 'Second content');
      
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('Second content');
    });
  });

  describe('fileExists', () => {
    it('should return true for existing files', async () => {
      const filePath = path.join(TEST_DOCS_BASE, 'existing.md');
      await fs.mkdir(TEST_DOCS_BASE, { recursive: true });
      await fs.writeFile(filePath, 'content');
      
      expect(await fileExists(filePath)).toBe(true);
    });

    it('should return false for non-existing files', async () => {
      const filePath = path.join(TEST_DOCS_BASE, 'non-existing.md');
      expect(await fileExists(filePath)).toBe(false);
    });
  });

  describe('getDocumentationPath', () => {
    it('should generate correct paths for tools', () => {
      const path = getDocumentationPath('tools', 'n8n');
      expect(path).toContain('tools');
      expect(path).toContain('n8n');
    });

    it('should generate correct paths for apis', () => {
      const path = getDocumentationPath('apis', 'anthropic');
      expect(path).toContain('apis');
      expect(path).toContain('anthropic');
    });
  });

  describe('listDocumentation', () => {
    beforeEach(async () => {
      // Create test documentation structure
      await fs.mkdir(path.join(TEST_DOCS_BASE, 'tools', 'n8n'), { recursive: true });
      await fs.mkdir(path.join(TEST_DOCS_BASE, 'tools', 'obsidian'), { recursive: true });
      await fs.mkdir(path.join(TEST_DOCS_BASE, 'apis', 'anthropic'), { recursive: true });
      await fs.mkdir(path.join(TEST_DOCS_BASE, 'apis', 'openai'), { recursive: true });
    });

    it('should list all documentation when no category specified', async () => {
      const docs = await listDocumentation();
      
      expect(docs.tools).toContain('n8n');
      expect(docs.tools).toContain('obsidian');
      expect(docs.apis).toContain('anthropic');
      expect(docs.apis).toContain('openai');
    });

    it('should list only tools when category is tools', async () => {
      const docs = await listDocumentation('tools');
      
      expect(docs.tools).toContain('n8n');
      expect(docs.tools).toContain('obsidian');
      expect(docs.apis).toEqual([]);
    });

    it('should list only apis when category is apis', async () => {
      const docs = await listDocumentation('apis');
      
      expect(docs.apis).toContain('anthropic');
      expect(docs.apis).toContain('openai');
      expect(docs.tools).toEqual([]);
    });

    it('should return empty lists for non-existing categories', async () => {
      await fs.rm(TEST_DOCS_BASE, { recursive: true, force: true });
      
      const docs = await listDocumentation();
      expect(docs.tools).toEqual([]);
      expect(docs.apis).toEqual([]);
    });
  });

  describe('getAllMarkdownFiles', () => {
    beforeEach(async () => {
      const toolDir = path.join(TEST_DOCS_BASE, 'tools', 'n8n');
      await fs.mkdir(toolDir, { recursive: true });
      
      await fs.writeFile(path.join(toolDir, 'index.md'), '# Index');
      await fs.writeFile(path.join(toolDir, 'getting-started.md'), '# Getting Started');
      await fs.writeFile(path.join(toolDir, 'readme.txt'), 'Not markdown');
      
      // Create subdirectory with markdown
      const subDir = path.join(toolDir, 'advanced');
      await fs.mkdir(subDir);
      await fs.writeFile(path.join(subDir, 'workflows.md'), '# Workflows');
    });

    it('should find all markdown files recursively', async () => {
      const toolDir = path.join(TEST_DOCS_BASE, 'tools', 'n8n');
      const files = await getAllMarkdownFiles(toolDir);
      
      expect(files).toHaveLength(3);
      expect(files.some(f => f.endsWith('index.md'))).toBe(true);
      expect(files.some(f => f.endsWith('getting-started.md'))).toBe(true);
      expect(files.some(f => f.endsWith('workflows.md'))).toBe(true);
    });

    it('should not include non-markdown files', async () => {
      const toolDir = path.join(TEST_DOCS_BASE, 'tools', 'n8n');
      const files = await getAllMarkdownFiles(toolDir);
      
      expect(files.some(f => f.endsWith('readme.txt'))).toBe(false);
    });

    it('should return empty array for non-existing directory', async () => {
      const files = await getAllMarkdownFiles('/non/existing/path');
      expect(files).toEqual([]);
    });
  });

  describe('getDocumentationStats', () => {
    beforeEach(async () => {
      const toolDir = path.join(TEST_DOCS_BASE, 'tools', 'test-tool');
      await fs.mkdir(toolDir, { recursive: true });
      
      await fs.writeFile(path.join(toolDir, 'small.md'), 'Small content');
      await fs.writeFile(path.join(toolDir, 'large.md'), 'Large content with more text and details');
    });

    it('should return correct file count and total size', async () => {
      const stats = await getDocumentationStats('tools', 'test-tool');
      
      expect(stats.fileCount).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.lastModified).toEqual(expect.any(Date));
    });

    it('should return zero stats for non-existing documentation', async () => {
      const stats = await getDocumentationStats('tools', 'non-existing');
      
      expect(stats.fileCount).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.lastModified).toBeNull();
    });
  });

  describe('readFileContent', () => {
    it('should read existing file content', async () => {
      const filePath = path.join(TEST_DOCS_BASE, 'test.md');
      const content = '# Test Content';
      
      await fs.mkdir(TEST_DOCS_BASE, { recursive: true });
      await fs.writeFile(filePath, content);
      
      expect(await readFileContent(filePath)).toBe(content);
    });

    it('should return null for non-existing files', async () => {
      const filePath = path.join(TEST_DOCS_BASE, 'non-existing.md');
      expect(await readFileContent(filePath)).toBeNull();
    });
  });

  describe('deleteDocumentation', () => {
    beforeEach(async () => {
      const toolDir = path.join(TEST_DOCS_BASE, 'tools', 'to-delete');
      await fs.mkdir(toolDir, { recursive: true });
      await fs.writeFile(path.join(toolDir, 'index.md'), '# Content');
    });

    it('should delete documentation directory', async () => {
      const toolDir = path.join(TEST_DOCS_BASE, 'tools', 'to-delete');
      
      // Verify it exists first
      expect(await fileExists(path.join(toolDir, 'index.md'))).toBe(true);
      
      await deleteDocumentation('tools', 'to-delete');
      
      // Verify it's deleted
      expect(await fileExists(toolDir)).toBe(false);
    });

    it('should not fail for non-existing documentation', async () => {
      await expect(deleteDocumentation('tools', 'non-existing')).resolves.toBeUndefined();
    });
  });
});