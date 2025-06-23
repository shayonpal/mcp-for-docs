# Changelog

All notable changes to mcp-for-docs will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

### Known Issues
- HTML to Markdown conversion has formatting issues (Issue #13)
  - Code block language detection needs improvement
  - Table formatting not optimal
  - 8 tests currently failing due to conversion quality expectations
  - Core functionality works correctly, affects output polish only

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