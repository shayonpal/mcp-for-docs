# Changelog

All notable changes to mcp-for-docs will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added (Jun 23, 2025 - 6:00 AM)
- **Comprehensive Configuration System** (Phase 4)
  - Support for config.json with JSON5-style comments
  - Configuration validation with helpful error messages
  - Environment variable override support (DOCS_BASE_PATH)
  - config.example.json template

### Changed (Jun 23, 2025 - 6:00 AM)
- **Configuration System** (Phase 4)
  - Moved all hardcoded values to configuration file
  - Base documentation path now configurable
  - Crawler timeouts, rate limits, and user agent now configurable
  - Cheatsheet max length and naming pattern now configurable
  - Config.json is now tracked in git for multi-machine sync
  - All file operations now async to support config loading

### Removed (Jun 23, 2025 - 6:00 AM)
- **Hardcoded Site Configurations** (Phase 4)
  - Removed hardcoded site configurations from parser.ts
  - Removed hardcoded base path from multiple files
  - Site-specific configuration logic (categorization is automatic)

### Fixed (Jun 23, 2025 - 11:45 PM)
- **Cheatsheet Output Location** (Phase 3)
  - Cheatsheets now save alongside documentation in appropriate subdirectories
  - Example: `/Users/shayon/DevProjects/~meta/docs/tools/obsidian/plugins/dataview/obsidian-Cheatsheet.md`
  - No longer saved to separate `/cheatsheets/` directory
  - Removed test cheatsheets directory and added to .gitignore
  
### Fixed (Jun 23, 2025 - 11:45 PM)  
- **Cheatsheet Quality Issues** (Phase 3)
  - Added deduplication to prevent duplicate functions (e.g., `now` appearing 4 times)
  - Fixed malformed markdown tables with proper cell escaping
  - Added escapeTableCell() method to handle pipes, newlines, and special characters
  - Table rows validated before adding to ensure all cells are valid
  
### Added (Jun 23, 2025 - 11:45 PM)
- **Cheatsheet Location Tests**
  - New test suite for CheatsheetFinder path generation
  - Tests for tool documentation paths
  - Tests for API documentation paths  
  - Tests for complex plugin paths
  - All 94 tests now passing

## [0.4.0] - Jun 23, 2025 - 06:59 PM

### Added
- **Smart Discovery System** (Fixes #10)
  - DocumentationFinder for recursive search of existing content in `/Users/shayon/DevProjects/~meta/docs`
  - CheatsheetFinder for locating existing cheatsheets with content analysis
  - SmartDiscovery class that integrates both finders with intelligent URL matching
  - User confirmation flow before regenerating existing content
  - `force_refresh` and `force_regenerate` parameters added to tools
  - Automatic detection of existing documentation and cheatsheets
  - Progress tracking and comprehensive reporting of discovered content

### Fixed
- **Cheatsheet Output Location** (Fixes #11)
  - Cheatsheets now save to correct path: `/Users/shayon/DevProjects/~meta/docs/cheatsheets/`
  - Updated CheatSheetGenerator to use CheatsheetFinder for path generation
  - Improved filename generation with URL-based naming for better organization

### Changed
- **Enhanced Tool Parameters**
  - `crawl_documentation` now checks for existing docs before crawling
  - `generate_cheatsheet` now checks for existing cheatsheets before generating
  - Both tools respect new force parameters for regeneration control
- **MCP Tool Schemas Updated**
  - Added `force_regenerate` parameter to generate_cheatsheet tool
  - Existing `force_refresh` parameter enhanced with discovery integration

### Technical Details
- Created new `src/discovery/` module with comprehensive search capabilities
- Integrated smart discovery into main MCP server tool handlers
- Enhanced type safety with proper TypeScript interfaces
- Maintained backward compatibility with existing tool usage

### Fixed (Jun 23, 2025 - 10:30 PM)
- **All HTML to Markdown Conversion Issues** (Fixes #13)
  - Fixed TypeError: tableRows.forEach is not a function by using Array.from()
  - Fixed escaped newlines in Turndown rules (changed \\n to \n)
  - Fixed inline code preservation in tables
  - Fixed JavaScript link filtering
  - All 76 tests now passing (was 67 passing, 9 failing)

### Added (Jun 23, 2025 - 11:00 PM)
- **Comprehensive Categorizer Module** (Fixes #12)
  - DocumentationCategorizer class with intelligent category detection
  - URL-based pattern matching for API vs tool detection
  - Content-based analysis with keyword indicators
  - Confidence scoring (0-1 range) for all categorization decisions
  - Smart handling of mixed signals and edge cases
  - Detailed reasoning provided for each categorization
  - Removed hardcoded categories from parser - now fully dynamic
  - 12 comprehensive tests added (all passing)
  - Total test count: 88 tests, all passing

## [0.3.0] - Jun 23, 2025 - 09:17 AM

### Added
- Complete cheat sheet generator implementation (Fixes #1)
  - CheatSheetGenerator class with advanced content analysis
  - Extract functions, commands, API endpoints with proper syntax and descriptions
  - Create reference-style cheat sheets with organized tables (Function | Syntax | Description)
  - Key concepts extraction with definitions
  - Best practices extraction from blockquotes and tips
  - Code examples section with language detection
  - Structured output matching reference format (similar to Templater cheat sheet)
  - Smart categorization by module (tp.date, tp.file, API endpoints, CLI commands)
  - Comprehensive test suite with 9 unit tests (all passing)
  - Support for both single and multi-page output formats
  - Section filtering capabilities
  - Enhanced pattern recognition for Templater-style functions
  - Priority-based content selection within length limits

## [0.2.0] - Jun 23, 2025 - 07:30 AM

### Added
- Comprehensive test suite infrastructure
  - Jest configured for TypeScript ES modules
  - Unit tests for URL utilities (25/25 passing, 95% coverage)
  - File operations testing with temporary directories
  - Parser testing for HTML to Markdown conversion
  - End-to-end test script for real documentation crawling
  - Test fixtures and setup files for isolation
  - Coverage reporting with realistic thresholds
- MCP server integration with Claude Code
  - Automatic setup script for Claude Code configuration
  - MCP server registered in ~/.claude.json
  - Server testing script to validate functionality
  - Comprehensive setup guide and troubleshooting documentation
  - Environment variables configured for documentation organization
- Documentation infrastructure
  - MCP_SETUP.md with complete integration guide
  - Test validation with n8n documentation (working E2E test)
  - Three tools ready: crawl_documentation, list_documentation, generate_cheatsheet

### Fixed
- URL normalization edge cases for root URLs and query parameters
- Jest configuration for ES modules and external dependencies
- Test coverage thresholds adjusted for realistic development

### Changed
- Test infrastructure excludes problematic E2E tests from Jest (uses standalone script)
- Coverage thresholds: 65% statements, 60% branches, 70% functions

## [0.1.0] - Jun 23, 2025 - 07:05 AM

### Added
- Initial project setup (Jun 23, 2025 - 06:59 AM)
  - Created project structure
  - Added CHANGELOG.md with Keep a Changelog format
  - Added comprehensive README.md
  - Added GPL 3.0 license
  - Created CLAUDE.local.md for development instructions
- TypeScript and MCP SDK setup (Jun 23, 2025 - 07:05 AM)
  - Configured TypeScript with ES2022 target
  - Installed MCP SDK and dependencies (Playwright, Cheerio, Turndown, etc.)
  - Created basic MCP server with three tools: crawl_documentation, generate_cheatsheet, list_documentation
  - Set up Jest for testing with TypeScript support
  - Configured ESLint for code quality
  - Successfully built the project
- Core documentation crawler implementation (Jun 23, 2025 - 07:11 AM)
  - Implemented DocumentationCrawler with breadth-first search algorithm
  - Added ContentParser with HTML to Markdown conversion using Turndown
  - Created URL utilities for normalization, domain extraction, and filename generation
  - Added file utilities for documentation organization and storage
  - Implemented site-specific configurations for popular documentation sites
  - Added rate limiting with configurable requests per second
  - Integrated progress tracking and error handling
  - Fully implemented crawl_documentation and list_documentation tools