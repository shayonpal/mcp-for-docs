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