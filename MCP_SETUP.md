# MCP Server Setup Guide

This guide explains how to set up the mcp-for-docs server with Claude Code.

## Prerequisites

- Node.js (version 16 or higher)
- Claude Code CLI installed
- Project built (`npm run build`)

## Automatic Setup

Run the automatic setup script:

```bash
node scripts/add-to-claude-config.js
```

This will add the MCP server to your Claude Code configuration at `~/.claude.json`.

## Manual Setup

If you prefer to configure manually, add this to your `~/.claude.json` file in the `mcpServers` section:

```json
{
  "mcpServers": {
    "mcp-for-docs": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/Users/shayon/DevProjects/mcp-for-docs/dist/index.js"
      ],
      "env": {
        "DOCS_BASE_PATH": "/Users/shayon/DevProjects/~meta/docs"
      }
    }
  }
}
```

## Configuration Details

- **Server Name**: `mcp-for-docs`
- **Type**: `stdio` (communicates via stdin/stdout)
- **Command**: `node` (runs the compiled JavaScript)
- **Script Path**: `dist/index.js` (built from TypeScript source)
- **Environment**: Sets the documentation base path

## Available Tools

Once configured, Claude Code will have access to three new tools:

### 1. `crawl_documentation`
Crawls and downloads documentation from websites.

**Parameters:**
- `url` (required): The documentation homepage URL
- `max_depth` (optional): Maximum crawl depth (default: 3)
- `force_refresh` (optional): Re-download existing documentation
- `rate_limit` (optional): Requests per second (default: 2)
- `include_patterns` (optional): URL patterns to include
- `exclude_patterns` (optional): URL patterns to exclude

### 2. `list_documentation`
Lists all downloaded documentation.

**Parameters:**
- `category` (optional): Filter by 'tools' or 'apis'

### 3. `generate_cheatsheet`
Generates condensed cheat sheets from documentation.

**Parameters:**
- `category` (required): 'tools' or 'apis'
- `name` (required): Name of the documentation
- `sections` (optional): Specific sections to include

## Testing the Setup

1. **Test server startup:**
   ```bash
   node scripts/test-mcp-server.js
   ```

2. **Restart Claude Code** to load the new MCP server

3. **Test integration:** Ask Claude to use the documentation tools

## Usage Examples

Once set up, you can ask Claude Code to:

- "Crawl the Anthropic API documentation"
- "List all available documentation"
- "Generate a cheat sheet for n8n workflows"
- "Download the Obsidian plugin API docs"

## Troubleshooting

### Server Not Loading
- Ensure the project is built: `npm run build`
- Check that the path in the configuration is correct
- Restart Claude Code after configuration changes

### Permission Issues
- Ensure the script has execute permissions
- Check that Node.js can access the dist directory

### Environment Variables
- `DOCS_BASE_PATH`: Where documentation is saved (default: project directory)
- `MCP_TIMEOUT`: Server startup timeout in milliseconds

## File Structure

```
/Users/shayon/DevProjects/~meta/docs/
├── tools/           # Tool documentation (n8n, Obsidian, etc.)
└── apis/            # API documentation (Anthropic, OpenAI, etc.)
```

Each documentation set gets its own subdirectory with markdown files containing the converted content and proper frontmatter.