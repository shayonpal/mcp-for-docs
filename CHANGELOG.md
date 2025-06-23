# Changelog

All notable changes to mcp-for-docs will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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