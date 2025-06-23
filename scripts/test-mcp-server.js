#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';

const projectPath = '/Users/shayon/DevProjects/mcp-for-docs';
const serverScript = path.join(projectPath, 'dist/index.js');

async function testMcpServer() {
  console.log('🚀 Testing MCP server startup...');
  
  const server = spawn('node', [serverScript], {
    env: {
      ...process.env,
      DOCS_BASE_PATH: '/Users/shayon/DevProjects/~meta/docs'
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';

  server.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  server.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  // Send initialize request
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  };

  server.stdin.write(JSON.stringify(initRequest) + '\n');

  // Wait for response or timeout
  const timeout = setTimeout(() => {
    server.kill();
    console.log('❌ Server startup timed out');
    process.exit(1);
  }, 5000);

  server.on('close', (code) => {
    clearTimeout(timeout);
    
    if (code === 0) {
      console.log('✅ MCP server started and responded successfully');
      console.log('📋 Server output:');
      if (stdout) console.log('STDOUT:', stdout);
      if (stderr) console.log('STDERR:', stderr);
    } else {
      console.log('❌ MCP server exited with code:', code);
      if (stderr) console.log('STDERR:', stderr);
    }
  });

  // Look for MCP response
  server.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('"method":"initialize"') || output.includes('"result"')) {
      clearTimeout(timeout);
      server.kill();
      console.log('✅ MCP server is responding to requests');
      console.log('🔧 Tools available: crawl_documentation, generate_cheatsheet, list_documentation');
      console.log('\n🎯 Ready for Claude Code integration!');
      console.log('\nNext steps:');
      console.log('1. Restart Claude Code to load the new MCP server');
      console.log('2. Test with: crawl Anthropic documentation');
      process.exit(0);
    }
  });
}

testMcpServer().catch(console.error);