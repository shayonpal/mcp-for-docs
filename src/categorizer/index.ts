/**
 * Documentation categorization system with confidence scoring
 */

export interface CategorizationResult {
  category: 'tools' | 'apis';
  confidence: number; // 0-1 score
  reasons: string[];
}

export interface UrlAnalysisResult {
  category: 'tools' | 'apis' | 'unknown';
  confidence: number;
  matchedPatterns: string[];
}

export interface ContentAnalysisResult {
  category: 'tools' | 'apis' | 'unknown';
  confidence: number;
  indicators: string[];
}

/**
 * Smart documentation categorizer that uses URL patterns and content analysis
 */
export class DocumentationCategorizer {
  // URL patterns that indicate API documentation
  private readonly apiUrlPatterns = [
    /\/api\//i,
    /\/reference\//i,
    /\/rest\//i,
    /\/graphql\//i,
    /\/endpoints?\//i,
    /\/swagger\//i,
    /\/openapi\//i,
    /api\./i,
    /developers?\./i,
    /\/v\d+\//i, // versioned APIs like /v1/, /v2/
  ];

  // URL patterns that indicate tool documentation
  private readonly toolUrlPatterns = [
    /\/docs?\//i,
    /\/guide\//i,
    /\/tutorial\//i,
    /\/getting[_-]?started\//i,
    /\/learn\//i,
    /\/manual\//i,
    /\/handbook\//i,
    /docs\./i,
    /help\./i,
    /support\./i,
    /learn\./i,
    /\/install/i,
    /\/setup/i,
  ];

  // Content indicators for API documentation
  private readonly apiContentIndicators = [
    'endpoint',
    'request',
    'response',
    'authentication',
    'authorization',
    'rate limit',
    'api key',
    'access token',
    'http method',
    'status code',
    'query parameter',
    'request body',
    'response body',
    'bearer token',
    'webhook',
    'rest api',
    'graphql',
    'mutation',
    'subscription',
  ];

  // Content indicators for tool documentation
  private readonly toolContentIndicators = [
    'installation',
    'configuration',
    'workflow',
    'getting started',
    'tutorial',
    'quick start',
    'how to',
    'step by step',
    'user guide',
    'features',
    'requirements',
    'dependencies',
    'cli',
    'command line',
    'desktop app',
    'plugin',
    'extension',
    'interface',
    'settings',
  ];

  /**
   * Categorize documentation based on URL patterns and content analysis
   */
  async categorize(url: string, content?: string): Promise<CategorizationResult> {
    const urlScore = this.analyzeUrl(url);
    const contentScore = content ? await this.analyzeContent(content) : null;
    
    return this.combineScores(urlScore, contentScore);
  }

  /**
   * Analyze URL patterns to determine category
   */
  private analyzeUrl(url: string): UrlAnalysisResult {
    const urlLower = url.toLowerCase();
    const matchedApiPatterns: string[] = [];
    const matchedToolPatterns: string[] = [];

    // Check API patterns
    for (const pattern of this.apiUrlPatterns) {
      if (pattern.test(urlLower)) {
        matchedApiPatterns.push(pattern.source);
      }
    }

    // Check tool patterns
    for (const pattern of this.toolUrlPatterns) {
      if (pattern.test(urlLower)) {
        matchedToolPatterns.push(pattern.source);
      }
    }

    // Special case: if URL contains both api patterns and doc patterns,
    // prioritize API if it appears in subdomain or path segments
    if (matchedApiPatterns.length > 0 && matchedToolPatterns.length > 0) {
      // Check if api-related terms are in subdomain
      if (/^(https?:\/\/)?(api|developer|developers)\./i.test(url)) {
        // API subdomain takes precedence
        return {
          category: 'apis',
          confidence: 0.85,
          matchedPatterns: matchedApiPatterns,
        };
      }
      // Check if /api/ or /reference/ appears in path (common API doc patterns)
      if (/\/(api|reference|rest|graphql|endpoints?|swagger|openapi)\//i.test(url)) {
        return {
          category: 'apis',
          confidence: 0.85,
          matchedPatterns: matchedApiPatterns,
        };
      }
    }

    // Determine category based on matches
    if (matchedApiPatterns.length > matchedToolPatterns.length) {
      return {
        category: 'apis',
        confidence: Math.min(0.8 + (matchedApiPatterns.length * 0.1), 0.95),
        matchedPatterns: matchedApiPatterns,
      };
    } else if (matchedToolPatterns.length > matchedApiPatterns.length) {
      // Special case: if it's docs.domain.com/api, it's likely API docs
      if (/docs\..*\/api(?:\/|$)/i.test(url)) {
        return {
          category: 'apis',
          confidence: 0.8, // Good confidence - clear API documentation pattern
          matchedPatterns: matchedApiPatterns,
        };
      }
      return {
        category: 'tools',
        confidence: Math.min(0.8 + (matchedToolPatterns.length * 0.1), 0.95),
        matchedPatterns: matchedToolPatterns,
      };
    } else if (matchedApiPatterns.length > 0 && matchedToolPatterns.length > 0) {
      // Mixed signals
      return {
        category: 'unknown',
        confidence: 0.5,
        matchedPatterns: [...matchedApiPatterns, ...matchedToolPatterns],
      };
    }

    return {
      category: 'unknown',
      confidence: 0.3,
      matchedPatterns: [],
    };
  }

  /**
   * Analyze content to determine category
   */
  private async analyzeContent(content: string): Promise<ContentAnalysisResult> {
    const contentLower = content.toLowerCase();
    const foundApiIndicators: string[] = [];
    const foundToolIndicators: string[] = [];

    // Count API indicators
    for (const indicator of this.apiContentIndicators) {
      const count = (contentLower.match(new RegExp(indicator, 'gi')) || []).length;
      if (count > 0) {
        foundApiIndicators.push(`${indicator} (${count}x)`);
      }
    }

    // Count tool indicators
    for (const indicator of this.toolContentIndicators) {
      const count = (contentLower.match(new RegExp(indicator, 'gi')) || []).length;
      if (count > 0) {
        foundToolIndicators.push(`${indicator} (${count}x)`);
      }
    }

    // Look for code patterns
    const hasRestExamples = /curl\s+-X\s+(GET|POST|PUT|DELETE|PATCH)/i.test(content) ||
                           /fetch\(['"`].*['"`]\s*,\s*{[^}]*method:\s*['"`](GET|POST|PUT|DELETE|PATCH)/i.test(content);
    const hasCliExamples = /\$\s+npm\s+install/i.test(content) ||
                          /\$\s+yarn\s+add/i.test(content) ||
                          /\$\s+pip\s+install/i.test(content) ||
                          /\$\s+brew\s+install/i.test(content);

    if (hasRestExamples) {
      foundApiIndicators.push('REST API examples');
    }
    if (hasCliExamples) {
      foundToolIndicators.push('CLI installation examples');
    }

    // Calculate scores
    const apiScore = foundApiIndicators.length;
    const toolScore = foundToolIndicators.length;

    if (apiScore > toolScore * 1.5) {
      return {
        category: 'apis',
        confidence: Math.min(0.7 + (apiScore * 0.03), 0.95),
        indicators: foundApiIndicators,
      };
    } else if (toolScore > apiScore * 1.5) {
      return {
        category: 'tools',
        confidence: Math.min(0.7 + (toolScore * 0.03), 0.95),
        indicators: foundToolIndicators,
      };
    } else if (apiScore > 0 && toolScore > 0) {
      // Mixed content
      return {
        category: 'unknown',
        confidence: 0.5,
        indicators: [...foundApiIndicators, ...foundToolIndicators],
      };
    }

    return {
      category: 'unknown',
      confidence: 0.3,
      indicators: [],
    };
  }

  /**
   * Combine URL and content analysis scores
   */
  private combineScores(
    urlScore: UrlAnalysisResult,
    contentScore: ContentAnalysisResult | null
  ): CategorizationResult {
    const reasons: string[] = [];

    // If no content analysis, rely on URL
    if (!contentScore) {
      if (urlScore.category !== 'unknown') {
        reasons.push(`URL patterns matched: ${urlScore.matchedPatterns.join(', ')}`);
        return {
          category: urlScore.category,
          confidence: urlScore.confidence, // Keep full confidence for URL-only analysis
          reasons,
        };
      } else {
        reasons.push('No clear URL patterns found, defaulting to tools');
        return {
          category: 'tools',
          confidence: 0.3,
          reasons,
        };
      }
    }

    // Both URL and content available
    if (urlScore.category === contentScore.category && urlScore.category !== 'unknown') {
      // Strong agreement
      if (urlScore.matchedPatterns.length > 0) {
        reasons.push(`URL patterns: ${urlScore.matchedPatterns.join(', ')}`);
      }
      if (contentScore.indicators.length > 0) {
        reasons.push(`Content indicators: ${contentScore.indicators.slice(0, 5).join(', ')}`);
      }
      return {
        category: urlScore.category,
        confidence: Math.max(urlScore.confidence, contentScore.confidence),
        reasons,
      };
    }

    // Disagreement or unknown
    if (contentScore.confidence > urlScore.confidence && contentScore.category !== 'unknown') {
      // Trust content analysis more
      reasons.push(`Content analysis suggests ${contentScore.category}`);
      reasons.push(`Content indicators: ${contentScore.indicators.slice(0, 5).join(', ')}`);
      return {
        category: contentScore.category,
        confidence: contentScore.confidence * 0.75,
        reasons,
      };
    } else if (urlScore.category !== 'unknown') {
      // Trust URL analysis but with reduced confidence due to content disagreement
      reasons.push(`URL analysis suggests ${urlScore.category}`);
      reasons.push(`URL patterns: ${urlScore.matchedPatterns.join(', ')}`);
      return {
        category: urlScore.category,
        confidence: Math.min(urlScore.confidence * 0.75, 0.79), // Cap at 0.79 for disagreements
        reasons,
      };
    }

    // Both are uncertain - default to tools
    reasons.push('Uncertain categorization, defaulting to tools');
    if (urlScore.matchedPatterns.length > 0) {
      reasons.push(`Mixed URL patterns: ${urlScore.matchedPatterns.join(', ')}`);
    }
    if (contentScore.indicators.length > 0) {
      reasons.push(`Mixed content indicators: ${contentScore.indicators.slice(0, 3).join(', ')}`);
    }

    return {
      category: 'tools',
      confidence: 0.4,
      reasons,
    };
  }
}