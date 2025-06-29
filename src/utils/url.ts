import { URL } from 'url';

/**
 * Normalize a URL to ensure consistent comparison
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    // Remove hash
    parsed.hash = '';
    
    // Sort query parameters for consistent comparison
    parsed.searchParams.sort();
    
    // Remove trailing slash
    if (parsed.pathname.endsWith('/') && parsed.pathname !== '/') {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    
    // For root URL with just slash and no query, remove the slash
    if (parsed.pathname === '/' && !parsed.search && !parsed.hash) {
      return `${parsed.protocol}//${parsed.host}`;
    }
    
    // For root URL with query params, remove the slash but keep the query
    if (parsed.pathname === '/' && parsed.search) {
      return `${parsed.protocol}//${parsed.host}${parsed.search}`;
    }
    
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Check if a URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only accept http and https protocols
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Convert relative URL to absolute
 */
export function toAbsoluteUrl(baseUrl: string, relativeUrl: string): string {
  try {
    // If relativeUrl is already absolute, return it as-is
    if (isValidUrl(relativeUrl)) {
      return relativeUrl;
    }
    
    // If it contains spaces or other invalid characters, don't try to convert
    if (relativeUrl.includes(' ')) {
      return relativeUrl;
    }
    
    return new URL(relativeUrl, baseUrl).toString();
  } catch {
    return relativeUrl;
  }
}

/**
 * Check if URL belongs to the same domain
 */
export function isSameDomain(url1: string, url2: string): boolean {
  try {
    const parsed1 = new URL(url1);
    const parsed2 = new URL(url2);
    return parsed1.hostname === parsed2.hostname;
  } catch {
    return false;
  }
}

/**
 * Extract the domain name from URL for folder naming
 */
export function extractDomainName(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    
    // Remove common prefixes
    const cleanHostname = hostname
      .replace(/^(www\.|docs\.|api\.|developer\.|developers\.)/, '')
      .replace(/\.(com|org|io|dev|net|edu)$/, '');
    
    // Extract tool/API name from path if needed
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    
    // Special cases for documentation patterns
    if (pathParts.includes('documentation') && pathParts.length > 1) {
      // e.g., developer.apple.com/documentation/swift -> swift
      const docIndex = pathParts.indexOf('documentation');
      if (docIndex < pathParts.length - 1) {
        return pathParts[docIndex + 1];
      }
    }
    
    if (pathParts.includes('docs') && pathParts.length > 1) {
      // e.g., github.com/org/project/docs -> project
      const docsIndex = pathParts.indexOf('docs');
      if (docsIndex > 0) {
        return pathParts[docsIndex - 1];
      }
    }
    
    return cleanHostname;
  } catch {
    return 'unknown';
  }
}

/**
 * Convert URL to safe filename
 */
export function urlToFilename(url: string): string {
  try {
    const parsed = new URL(url);
    let filename = parsed.pathname;
    
    // Remove leading/trailing slashes
    filename = filename.replace(/^\/|\/$/g, '');
    
    // Replace remaining slashes with underscores
    filename = filename.replace(/\//g, '_');
    
    // If empty, use index
    if (!filename) {
      filename = 'index';
    }
    
    // Sanitize filename (before adding extension)
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // Add .md extension if not present
    if (!filename.endsWith('.md')) {
      filename += '.md';
    }
    
    return filename;
  } catch {
    return 'unknown.md';
  }
}

/**
 * Check if URL matches any of the patterns
 */
export function matchesPatterns(url: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    // Escape regex special characters except * and ?
    let regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape special chars
      .replace(/\*/g, '.*')                   // * becomes .*
      .replace(/\?/g, '.');                   // ? becomes .
    
    try {
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(url)) {
        return true;
      }
    } catch {
      // Invalid regex pattern, skip
      continue;
    }
  }
  return false;
}