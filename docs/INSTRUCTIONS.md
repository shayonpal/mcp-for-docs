I am going to call this checkpoint "Checkpoint D" so that I can refer to this later.

====================

# Phase 4: Configuration System Implementation - Revised Instructions

## Key Changes Based on Your Feedback

1. **Config WILL be tracked in git** (for multi-machine sync)
2. **Remove confusing site-specific configs** - The DocumentationCategorizer already handles this dynamically
3. **Focus on operational settings** that users actually need to customize

## Why We Need This Configuration System

Currently, hardcoded values prevent users from:
- Changing the documentation storage path (critical for different machines)
- Adjusting crawler behavior (timeouts, rate limits)
- Modifying cheatsheet generation settings

The configuration should ONLY contain settings that users need to customize, not logic that the system handles automatically.

## Step-by-Step Implementation Instructions

### Step 1: Create Simplified Configuration Types
**File to create**: `src/config/types.ts`
**Reason**: Define only the settings users actually need to configure.

```typescript
// Simplified configuration focusing on user-customizable settings
export interface Config {
  // Base directory where all documentation is stored
  // Users MUST customize this for their machine
  docsBasePath: string;
  
  // Settings for the web crawler
  crawler: {
    // How deep to crawl by default (3 means start page + 2 levels)
    defaultMaxDepth: number;
    
    // Requests per second limit to avoid overwhelming servers
    defaultRateLimit: number;
    
    // Milliseconds to wait for pages to load before timing out
    pageTimeout: number;
    
    // How the crawler identifies itself to websites
    userAgent: string;
  };
  
  // Settings for cheatsheet generation
  cheatsheet: {
    // Maximum characters in generated cheatsheet
    maxLength: number;
    
    // Suffix added to filenames (e.g., "obsidian" + "-Cheatsheet.md")
    filenameSuffix: string;
  };
}
```

### Step 2: Create Configuration Module
**File to create**: `src/config/index.ts`
**Reason**: Load and validate configuration with clear defaults.

```typescript
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Config } from './types.js';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  
  const configPath = path.join(__dirname, '../../config.json');
  
  try {
    const configData = await fs.readFile(configPath, 'utf-8');
    const cleanedJson = stripJsonComments(configData);
    const loadedConfig = JSON.parse(cleanedJson);
    
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
```

### Step 3: Update Parser to Remove Site Configs
**File to modify**: `src/crawler/parser.ts`
**Reason**: Remove the confusing site-specific configurations since categorization is dynamic.

**Delete lines 20-47** (the entire DEFAULT_SITE_CONFIGS object)

**Replace the getSiteConfig method (lines 74-95)** with:
```typescript
/**
 * Get site configuration for a URL
 * @deprecated Site-specific configs are no longer used. Categorization is dynamic.
 */
getSiteConfig(url: string): SiteConfig | null {
  // Return null - categorization is now handled dynamically by DocumentationCategorizer
  return null;
}
```

**Update the SiteConfig interface (lines 8-17)** to mark category as deprecated:
```typescript
export interface SiteConfig {
  name: string;
  category?: 'tools' | 'apis'; // @deprecated - determined dynamically by categorizer
  max_depth?: number;
  content_selector?: string;
  title_selector?: string;
  exclude_selectors?: string[];
  include_patterns?: string[];
  exclude_patterns?: string[];
}
```

### Step 4: Create Configuration Files
**File to create**: `config.json` (YES, track this in git)
**Reason**: This is your actual configuration that will sync between machines.

```json
{
  // IMPORTANT: Update this path for your machine!
  // This is where all documentation will be stored
  "docsBasePath": "/Users/shayon/DevProjects/~meta/docs",
  
  // Web crawler settings
  "crawler": {
    // How many levels deep to crawl from the starting URL
    // 3 is recommended for most documentation sites
    "defaultMaxDepth": 3,
    
    // Maximum requests per second (be polite to servers!)
    // 2 is safe for most sites
    "defaultRateLimit": 2,
    
    // How long to wait for slow pages (in milliseconds)
    // 30000ms = 30 seconds
    "pageTimeout": 30000,
    
    // How the crawler identifies itself
    // Some sites block generic crawlers
    "userAgent": "Mozilla/5.0 (compatible; MCP-for-docs/1.0; +https://github.com/shayonpal/mcp-for-docs)"
  },
  
  // Cheatsheet generation settings
  "cheatsheet": {
    // Maximum characters (10000 H 2000 words)
    // Increase for more comprehensive cheatsheets
    "maxLength": 10000,
    
    // What to append to generated filenames
    "filenameSuffix": "-Cheatsheet.md"
  }
}
```

**File to create**: `config.example.json`
**Reason**: Show users what they need to customize.

```json
{
  // CUSTOMIZE THIS PATH FOR YOUR MACHINE!
  // Mac example: "/Users/username/Documents/mcp-docs"
  // Windows example: "C:\\Users\\username\\Documents\\mcp-docs"
  // Linux example: "/home/username/documents/mcp-docs"
  "docsBasePath": "/path/to/your/documentation/storage",
  
  // Crawler settings (these defaults work well for most sites)
  "crawler": {
    "defaultMaxDepth": 3,
    "defaultRateLimit": 2,
    "pageTimeout": 30000,
    "userAgent": "Mozilla/5.0 (compatible; MCP-for-docs/1.0; +https://github.com/shayonpal/mcp-for-docs)"
  },
  
  // Cheatsheet settings
  "cheatsheet": {
    "maxLength": 10000,
    "filenameSuffix": "-Cheatsheet.md"
  }
}
```

**File to modify**: `.gitignore`
**Reason**: We now WANT to track config.json for multi-machine sync.

Remove these lines if they exist:
```
# REMOVE THESE LINES:
config.json
!config.example.json
```

The config.json SHOULD be tracked in git.

### Step 5: Update README.md
**File to modify**: `README.md`
**Reason**: Explain the new configuration system clearly.

**Replace the Configuration section (lines 130-150)** with:
```markdown
## Configuration

### Initial Setup

1. Copy the example configuration:
```bash
cp config.example.json config.json
```

2. Edit `config.json` and update the `docsBasePath` for your machine:
```json
{
  "docsBasePath": "/Users/yourusername/path/to/docs"
}
```

**Important**: The `config.json` file is tracked in git. When you clone this repository on a different machine, you'll need to update the `docsBasePath` to match that machine's directory structure.

### How Documentation Organization Works

The tool automatically organizes documentation based on content analysis:

1. **You provide a URL** when calling the tool (e.g., `https://docs.n8n.io`)
2. **The categorizer analyzes the content** and determines if it's:
   - `tools/` - Software tools, applications, plugins
   - `apis/` - API references, SDK documentation
3. **Documentation is saved** to: `{docsBasePath}/{category}/{tool-name}/`

For example:
- `https://docs.n8n.io` � `/Users/shayon/DevProjects/~meta/docs/tools/n8n/`
- `https://docs.anthropic.com` � `/Users/shayon/DevProjects/~meta/docs/apis/anthropic/`

This happens automatically - you don't need to configure anything per-site!

### Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| `docsBasePath` | Where to store all documentation | Required - no default |
| `crawler.defaultMaxDepth` | How many levels deep to crawl | 3 |
| `crawler.defaultRateLimit` | Requests per second | 2 |
| `crawler.pageTimeout` | Page load timeout (ms) | 30000 |
| `crawler.userAgent` | Browser identification | MCP-for-docs/1.0 |
| `cheatsheet.maxLength` | Max characters in cheatsheet | 10000 |
| `cheatsheet.filenameSuffix` | Append to cheatsheet names | -Cheatsheet.md |

### Multi-Machine Setup

Since `config.json` is tracked in git:

1. **First machine**: Set your `docsBasePath` and commit
2. **Other machines**: After cloning, update `docsBasePath` to match that machine
3. **Use environment variable** to override without changing the file:
   ```bash
   export DOCS_BASE_PATH="/different/path/on/this/machine"
   ```
```

### Step 6: Update file.ts More Clearly
**File to modify**: `src/utils/file.ts`
**Reason**: The previous instructions weren't clear about async changes.

**Replace the entire file** with this updated version that properly handles async config:
```typescript
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
```

### Step 7: Update All Callers of getDocumentationPath
**Reason**: Since getDocumentationPath is now async, all its callers need updating.

**In crawler/index.ts**, update lines 78-79:
```typescript
const docPath = await getDocumentationPath(category, name);
const indexExists = await fileExists(`${docPath}/index.md`);
```

**Update line 256**:
```typescript
const docPath = await getDocumentationPath(category, name);
```

### Step 8: Update CheatsheetFinder.ts
**File to modify**: `src/discovery/CheatsheetFinder.ts`
**Reason**: Use configuration instead of hardcoded values.

Add import at line 5:
```typescript
import { loadConfig } from '../config/index.js';
import { Config } from '../config/types.js';
```

Replace line 18:
```typescript
export class CheatsheetFinder {
  private config: Config | null = null;
  private readonly categorizer = new DocumentationCategorizer();
```

Add this method after the constructor:
```typescript
  private async getConfig(): Promise<Config> {
    if (!this.config) {
      this.config = await loadConfig();
    }
    return this.config;
  }
```

Update line 29 in `findExistingCheatsheets`:
```typescript
const config = await this.getConfig();
const categoryPath = path.join(config.docsBasePath, category);
```

Update line 77 in `analyzeCheatsheet`:
```typescript
const config = await this.getConfig();
const relativePath = path.relative(config.docsBasePath, filePath);
```

Update line 249 in `getCheatsheetPath`:
```typescript
const config = await this.getConfig();
const basePath = path.join(config.docsBasePath, category);
```

Update line 258:
```typescript
const cheatsheetName = `${toolName}${config.cheatsheet.filenameSuffix}`;
```

### Step 9: Update CheatSheetGenerator
**File to modify**: `src/cheatsheet/generator.ts`
**Reason**: Use configuration for max length.

Add imports at top:
```typescript
import { loadConfig } from '../config/index.js';
import { Config } from '../config/types.js';
```

Update the class definition (lines 49-54):
```typescript
export class CheatSheetGenerator {
  private maxLength: number;
  private config: Config | null = null;

  constructor(options: Partial<CheatSheetOptions> = {}) {
    this.maxLength = options.maxLength || 10000; // Will be overridden by config
  }

  private async getConfig(): Promise<Config> {
    if (!this.config) {
      this.config = await loadConfig();
    }
    return this.config;
  }
```

Update the `generate` method to load config (add after line 60):
```typescript
const config = await this.getConfig();
// Use configured max length if not overridden by options
if (!options.maxLength) {
  this.maxLength = config.cheatsheet.maxLength;
}
```

### Step 10: Update Crawler
**File to modify**: `src/crawler/index.ts`
**Reason**: Use configuration for timeouts and rate limits.

Add imports:
```typescript
import { loadConfig } from '../config/index.js';
import { Config } from '../config/types.js';
```

Add config property after line 47:
```typescript
private config: Config | null = null;
```

Add method after constructor:
```typescript
private async getConfig(): Promise<Config> {
  if (!this.config) {
    this.config = await loadConfig();
  }
  return this.config;
}
```

Update the `crawl` method (after line 59):
```typescript
const config = await this.getConfig();
```

Update lines 92-99:
```typescript
// Setup rate limiting from config or options
const rateLimit = options.rate_limit || config.crawler.defaultRateLimit;
this.queue = new PQueue({ 
  concurrency: 1, 
  interval: 1000, 
  intervalCap: rateLimit 
});
```

Update line 111:
```typescript
options.max_depth || config.max_depth || config.crawler.defaultMaxDepth,
```

Update lines 237-238 and 329-330:
```typescript
await page.setExtraHTTPHeaders({
  'User-Agent': config.crawler.userAgent
});
```

Update lines 241, 293, and 332:
```typescript
await page.goto(url, { waitUntil: 'networkidle', timeout: config.crawler.pageTimeout });
```

Update `inferSiteConfig` method (line 313):
```typescript
private async inferSiteConfig(url: string): Promise<SiteConfig> {
  const config = await this.getConfig();
  const name = extractDomainName(url);
  
  return {
    name,
    category: 'tools', // Default, but will be overridden by categorizer
    max_depth: config.crawler.defaultMaxDepth,
  };
}
```

### Step 11: Update CHANGELOG.md
**File to modify**: `CHANGELOG.md`
**Add at the top after existing entries**:

```markdown
## [0.5.0] - TBD

### Added
- Comprehensive configuration system (closes #3)
- Support for config.json with JSON5-style comments
- Configuration validation with helpful error messages
- Environment variable override support (DOCS_BASE_PATH)
- config.example.json template

### Changed
- Moved all hardcoded values to configuration file
- Base documentation path now configurable
- Crawler timeouts, rate limits, and user agent now configurable
- Cheatsheet max length and naming pattern now configurable
- Config.json is now tracked in git for multi-machine sync
- All file operations now async to support config loading

### Removed
- Hardcoded site configurations from parser.ts
- Hardcoded base path from multiple files
- Site-specific configuration logic (categorization is automatic)
```

## Testing Instructions

1. **Create config from example**:
   ```bash
   cp config.example.json config.json
   # Edit config.json to set your docsBasePath
   ```

2. **Run tests**:
   ```bash
   npm test
   ```
   All 94+ tests should pass

3. **Test environment override**:
   ```bash
   export DOCS_BASE_PATH="/tmp/test-docs"
   npm run build
   # Run the tool - it should use /tmp/test-docs
   ```

4. **Test with invalid config**:
   - Set `defaultMaxDepth` to -1 in config.json
   - Run the tool - should see clear error message

5. **Test crawling**:
   - Crawl any documentation site
   - Verify it's saved to your configured docsBasePath
   - Check that categorization happens automatically

## Why This Implementation Is Superior

1. **Git-friendly**: Config syncs between machines automatically
2. **Simple**: Only essential settings, no confusing site-specific rules
3. **Clear errors**: Validation provides helpful messages
4. **Flexible**: Environment variables can override without editing
5. **Automatic**: Categorization happens without configuration

This completes Phase 4. The configuration system is now simple, clear, and focuses only on what users need to customize.