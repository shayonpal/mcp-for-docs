import fs from 'fs/promises';
import path from 'path';
import { loadConfig } from '../config/index.js';

// Cache the config to avoid repeated loads
let configCache: { docsBasePath: string } | null = null;

/**
 * Get base directory for storing documentation from configuration
 */
async function getDocsBasePath(): Promise<string> {
  if (!configCache) {
    const config = await loadConfig();
    configCache = { docsBasePath: config.docsBasePath };
  }
  return configCache.docsBasePath;
}

/**
 * Ensure directory exists, create if not
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Write content to file safely
 */
export async function writeFileContent(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDirectory(dir);
  await fs.writeFile(filePath, content, 'utf8');
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get documentation directory for a tool/API
 * Now async because it needs to load config
 */
export async function getDocumentationPath(category: 'tools' | 'apis', name: string): Promise<string> {
  const basePath = await getDocsBasePath();
  return path.join(basePath, category, name);
}

/**
 * List all documentation directories
 */
export async function listDocumentation(category?: 'tools' | 'apis'): Promise<{
  tools: string[];
  apis: string[];
}> {
  const result = { tools: [] as string[], apis: [] as string[] };
  const basePath = await getDocsBasePath();
  
  const categoriesToCheck = category ? [category] : ['tools', 'apis'] as const;
  
  for (const cat of categoriesToCheck) {
    const categoryPath = path.join(basePath, cat);
    
    try {
      const entries = await fs.readdir(categoryPath, { withFileTypes: true });
      const directories = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
      
      result[cat] = directories;
    } catch (error) {
      // Directory doesn't exist yet
      result[cat] = [];
    }
  }
  
  return result;
}

/**
 * Get file stats for documentation
 */
export async function getDocumentationStats(category: 'tools' | 'apis', name: string): Promise<{
  fileCount: number;
  totalSize: number;
  lastModified: Date | null;
}> {
  const docPath = await getDocumentationPath(category, name);
  
  try {
    const files = await getAllMarkdownFiles(docPath);
    let totalSize = 0;
    let lastModified: Date | null = null;
    
    for (const file of files) {
      const stats = await fs.stat(file);
      totalSize += stats.size;
      
      if (!lastModified || stats.mtime > lastModified) {
        lastModified = stats.mtime;
      }
    }
    
    return {
      fileCount: files.length,
      totalSize,
      lastModified,
    };
  } catch {
    return {
      fileCount: 0,
      totalSize: 0,
      lastModified: null,
    };
  }
}

/**
 * Recursively get all markdown files in directory
 */
export async function getAllMarkdownFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        const subFiles = await getAllMarkdownFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  
  return files;
}

/**
 * Read file content safely
 */
export async function readFileContent(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Delete documentation directory
 */
export async function deleteDocumentation(category: 'tools' | 'apis', name: string): Promise<void> {
  const docPath = await getDocumentationPath(category, name);
  await fs.rm(docPath, { recursive: true, force: true });
}