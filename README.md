# mcp-for-docs

An MCP (Model Context Protocol) server that automatically downloads and converts documentation from various sources into organized markdown files.

## Overview

mcp-for-docs is designed to crawl documentation websites, convert their content to markdown format, and organize them in a structured directory system. It can also generate condensed cheat sheets from the downloaded documentation.

## Features

- 🕷️ **Smart Documentation Crawler**: Automatically crawls documentation sites with configurable depth
- 📝 **HTML to Markdown Conversion**: Preserves code blocks, tables, and formatting
- 📁 **Automatic Categorization**: Intelligently organizes docs into tools/APIs categories
- 📄 **Cheat Sheet Generator**: Creates condensed reference guides from documentation
- 🚀 **Local-First**: Uses existing downloaded docs when available
- ⚡ **Rate Limiting**: Respects server limits and robots.txt

## Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Claude Desktop or Claude Code CLI

### Setup

1. Clone the repository:
```bash
git clone https://github.com/shayonpal/mcp-for-docs.git
cd mcp-for-docs
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Add to your MCP configuration:

**For Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "mcp-for-docs": {
      "command": "node",
      "args": ["/path/to/mcp-for-docs/dist/index.js"],
      "env": {}
    }
  }
}
```

**For Claude Code CLI** (`~/.claude.json`):
```json
{
  "mcpServers": {
    "mcp-for-docs": {
      "command": "node",
      "args": ["/path/to/mcp-for-docs/dist/index.js"],
      "env": {}
    }
  }
}
```

## Usage

### Crawling Documentation

To download documentation from a website:

```typescript
await crawl_documentation({
  url: "https://docs.n8n.io/",
  max_depth: 3  // Optional, defaults to 3
});
```

The documentation will be saved to:
- Tools: `/Users/shayon/DevProjects/~meta/docs/tools/[tool-name]/`
- APIs: `/Users/shayon/DevProjects/~meta/docs/apis/[api-name]/`

### Generating Cheat Sheets

To create a cheat sheet from documentation:

```typescript
await generate_cheatsheet({
  url: "https://docs.anthropic.com/",
  use_local: true  // Use local files if available (default)
});
```

### Listing Downloaded Documentation

To see what documentation is available locally:

```typescript
await list_documentation({
  category: "all",  // Options: "tools", "apis", "all"
  include_stats: true
});
```

## Supported Documentation Sites

The server has been tested with:
- n8n documentation
- Anthropic API docs
- Obsidian Tasks plugin docs
- Apple Swift documentation

Most documentation sites following standard patterns should work automatically.

## Configuration

Create a `.docsconfig.json` file for site-specific rules:

```json
{
  "sites": {
    "docs.example.com": {
      "name": "example",
      "category": "tools",
      "max_depth": 4,
      "content_selector": ".main-content"
    }
  },
  "defaults": {
    "max_depth": 3,
    "rate_limit": 2,
    "timeout": 30000
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Lint code
npm run lint
```

## Architecture

- **Crawler**: Uses Playwright for JavaScript-rendered pages
- **Parser**: Extracts content using configurable selectors
- **Converter**: Turndown library with custom rules for markdown
- **Categorizer**: Smart detection of tools vs APIs
- **Storage**: Organized file system structure

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Update CHANGELOG.md
5. Submit a pull request

## License

This project is licensed under the GPL 3.0 License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with the [Model Context Protocol SDK](https://github.com/anthropics/mcp)
- Uses [Playwright](https://playwright.dev/) for web scraping
- Markdown conversion powered by [Turndown](https://github.com/mixmark-io/turndown)