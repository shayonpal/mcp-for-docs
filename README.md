# mcp-for-docs

An MCP (Model Context Protocol) server that automatically downloads and converts documentation from various sources into organized markdown files.

## Overview

mcp-for-docs is designed to crawl documentation websites, convert their content to markdown format, and organize them in a structured directory system. It can also generate condensed cheat sheets from the downloaded documentation.

## Features

- 🕷️ **Smart Documentation Crawler**: Automatically crawls documentation sites with configurable depth
- 📝 **HTML to Markdown Conversion**: Preserves code blocks, tables, and formatting
- 📁 **Automatic Categorization**: Intelligently organizes docs into tools/APIs categories
- 📄 **Cheat Sheet Generator**: Creates condensed reference guides from documentation
- 🔍 **Smart Discovery System**: Automatically detects existing documentation before crawling
- 🚀 **Local-First**: Uses existing downloaded docs when available
- ⚡ **Rate Limiting**: Respects server limits and robots.txt
- ✅ **User Confirmation**: Prevents accidental regeneration of existing content

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
  max_depth: 3,           // Optional, defaults to 3
  force_refresh: false    // Optional, set to true to regenerate existing docs
});
```

The tool will first check for existing documentation and show you what's already available. To regenerate existing content, use `force_refresh: true`.

The documentation will be saved to:
- Tools: `/Users/shayon/DevProjects/~meta/docs/tools/[tool-name]/`
- APIs: `/Users/shayon/DevProjects/~meta/docs/apis/[api-name]/`

### Generating Cheat Sheets

To create a cheat sheet from documentation:

```typescript
await generate_cheatsheet({
  url: "https://docs.anthropic.com/",
  use_local: true,          // Use local files if available (default)
  force_regenerate: false   // Optional, set to true to regenerate existing cheatsheets
});
```

Cheat sheets are saved to: `/Users/shayon/DevProjects/~meta/docs/cheatsheets/`

The tool will check for existing cheatsheets and show you what's already available. To regenerate existing content, use `force_regenerate: true`.

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
- `https://docs.n8n.io` → `/Users/shayon/DevProjects/~meta/docs/tools/n8n/`
- `https://docs.anthropic.com` → `/Users/shayon/DevProjects/~meta/docs/apis/anthropic/`

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