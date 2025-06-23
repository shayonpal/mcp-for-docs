import fs from 'fs/promises';
import path from 'path';
import { Config } from './types.js';

// Get project root directory relative to src/config
const getProjectRoot = () => {
  return path.resolve(process.cwd());
};

// Cache to avoid reading file multiple times
let cachedConfig: Config | null = null;

/**
 * Get default configuration values
 * These serve as fallbacks when config.json is missing or incomplete
 */
function getDefaultConfig(): Config {
  return {
    // This MUST be customized per machine
    docsBasePath: process.env.DOCS_BASE_PATH || '/Users/shayon/DevProjects/~meta/docs',
    crawler: {
      defaultMaxDepth: 3,
      defaultRateLimit: 2,
      pageTimeout: 30000,
      userAgent: 'Mozilla/5.0 (compatible; MCP-for-docs/1.0; +https://github.com/shayonpal/mcp-for-docs)'
    },
    cheatsheet: {
      maxLength: 10000,
      filenameSuffix: '-Cheatsheet.md'
    }
  };
}

/**
 * Strip comments from JSON string
 * Allows // style comments in config files for better documentation
 */
function stripJsonComments(jsonString: string): string {
  // Remove single-line comments
  let cleaned = jsonString.replace(/\/\/.*$/gm, '');
  
  // Remove multi-line comments
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Remove trailing commas (not valid in strict JSON)
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
  
  return cleaned;
}

/**
 * Validate configuration values
 * Throws descriptive errors for invalid configurations
 */
function validateConfig(config: any): Config {
  // Validate docsBasePath
  if (!config.docsBasePath || typeof config.docsBasePath !== 'string') {
    throw new Error('Configuration error: docsBasePath must be a non-empty string');
  }
  
  // Validate crawler settings
  if (!config.crawler || typeof config.crawler !== 'object') {
    throw new Error('Configuration error: crawler section is required');
  }
  
  if (!Number.isInteger(config.crawler.defaultMaxDepth) || config.crawler.defaultMaxDepth < 1) {
    throw new Error('Configuration error: crawler.defaultMaxDepth must be a positive integer (recommended: 3)');
  }
  
  if (config.crawler.defaultMaxDepth > 10) {
    console.warn('Warning: crawler.defaultMaxDepth > 10 may result in very long crawl times');
  }
  
  if (!Number.isInteger(config.crawler.defaultRateLimit) || config.crawler.defaultRateLimit < 1) {
    throw new Error('Configuration error: crawler.defaultRateLimit must be a positive integer (recommended: 2)');
  }
  
  if (config.crawler.defaultRateLimit > 10) {
    console.warn('Warning: crawler.defaultRateLimit > 10 may overwhelm some servers');
  }
  
  if (!Number.isInteger(config.crawler.pageTimeout) || config.crawler.pageTimeout < 1000) {
    throw new Error('Configuration error: crawler.pageTimeout must be at least 1000ms');
  }
  
  if (!config.crawler.userAgent || typeof config.crawler.userAgent !== 'string') {
    throw new Error('Configuration error: crawler.userAgent must be a non-empty string');
  }
  
  // Validate cheatsheet settings
  if (!config.cheatsheet || typeof config.cheatsheet !== 'object') {
    throw new Error('Configuration error: cheatsheet section is required');
  }
  
  if (!Number.isInteger(config.cheatsheet.maxLength) || config.cheatsheet.maxLength < 1000) {
    throw new Error('Configuration error: cheatsheet.maxLength must be at least 1000');
  }
  
  if (!config.cheatsheet.filenameSuffix || typeof config.cheatsheet.filenameSuffix !== 'string') {
    throw new Error('Configuration error: cheatsheet.filenameSuffix must be a non-empty string');
  }
  
  return config as Config;
}

/**
 * Load configuration from file system
 */
export async function loadConfig(): Promise<Config> {
  // Return cached config if available
  if (cachedConfig) {
    return cachedConfig;
  }
  
  const configPath = path.join(getProjectRoot(), 'config.json');
  
  try {
    const configData = await fs.readFile(configPath, 'utf-8');
    
    let loadedConfig;
    try {
      // Try parsing directly first (since we have clean JSON)
      loadedConfig = JSON.parse(configData);
    } catch (parseError) {
      // If direct parsing fails, try with comment stripping
      const cleanedJson = stripJsonComments(configData);
      loadedConfig = JSON.parse(cleanedJson);
    }
    
    // Get base config
    const defaults = getDefaultConfig();
    
    // Deep merge with defaults to fill in any missing values
    const mergedConfig = {
      docsBasePath: loadedConfig.docsBasePath || defaults.docsBasePath,
      crawler: {
        ...defaults.crawler,
        ...loadedConfig.crawler
      },
      cheatsheet: {
        ...defaults.cheatsheet,
        ...loadedConfig.cheatsheet
      }
    };
    
    // Validate and cache
    cachedConfig = validateConfig(mergedConfig);
    console.log(`Loaded configuration from: ${configPath}`);
    
    return cachedConfig;
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      throw new Error(
        'Configuration file not found. Please create config.json in the project root.\n' +
        'You can copy config.example.json as a starting point.'
      );
    }
    throw error;
  }
}

/**
 * Clear cached configuration
 * Useful for testing or when config file is updated
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}