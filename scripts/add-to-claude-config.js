#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';

const configPath = '/Users/shayon/.claude.json';
const projectPath = '/Users/shayon/DevProjects/mcp-for-docs';

async function addMcpServer() {
  try {
    console.log('📖 Reading Claude Code configuration...');
    const configData = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configData);

    // Check if our server is already configured
    if (config.mcpServers && config.mcpServers['mcp-for-docs']) {
      console.log('✅ mcp-for-docs server is already configured in Claude Code');
      return;
    }

    // Add our MCP server configuration
    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    config.mcpServers['mcp-for-docs'] = {
      type: 'stdio',
      command: 'node',
      args: [path.join(projectPath, 'dist/index.js')],
      env: {
        DOCS_BASE_PATH: '/Users/shayon/DevProjects/~meta/docs'
      }
    };

    console.log('💾 Writing updated configuration...');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    console.log('✅ Successfully added mcp-for-docs server to Claude Code configuration!');
    console.log('\n📋 Server Configuration:');
    console.log('  Name: mcp-for-docs');
    console.log('  Type: stdio');
    console.log('  Command: node');
    console.log(`  Script: ${path.join(projectPath, 'dist/index.js')}`);
    console.log('  Env: DOCS_BASE_PATH=/Users/shayon/DevProjects/~meta/docs');
    
    console.log('\n🔄 Please restart Claude Code to load the new MCP server.');

  } catch (error) {
    console.error('❌ Failed to add MCP server:', error.message);
    process.exit(1);
  }
}

addMcpServer();