#!/usr/bin/env node

/**
 * Trillium MCP Server
 * Provides AI-powered access to Trilium Notes via Model Context Protocol
 */

// Load environment variables from .env file (for local development)
// Only load if env vars are not already set (to avoid stdout pollution in Claude Desktop)
import { config as dotenvConfig } from 'dotenv';
if (!process.env.TRILLIUM_API_URL || !process.env.TRILLIUM_API_TOKEN) {
  dotenvConfig({ debug: false }); // Silent mode
}

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { config } from './config.js';
import { TrilliumClient } from './client.js';
import {
  getToolDefinitions,
  notesSearch,
  noteGet,
  noteCreate,
  noteOverwrite,
  noteDelete,
  noteCreateRevision,
  noteReorder,
  noteListChildren,
  noteReorderChildren,
  noteEdit,
  notePrepend,
  noteAppend,
  noteGrep,
  noteGetLines,
  attributesCreate,
  attributesUpdate,
  attributesDelete,
  attributesGet,
  branchesCreate,
  branchesUpdate,
  branchesDelete,
  branchesGet,
  // DEACTIVATED FOR MVP:
  // attachmentsCreate,
  // attachmentsGet,
  // attachmentsUpdate,
  // attachmentsDelete,
  // attachmentsGetContent,
  // attachmentsUpdateContent,
  // calendarGetDay,
  // calendarGetWeek,
  // calendarGetMonth,
  // calendarGetYear,
  // inboxGet,
} from './tools/index.js';

// Initialize Trillium API client
const client = new TrilliumClient(config);

// Initialize MCP server
const server = new Server(
  {
    name: 'trillium-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Log server info to stderr (not stdout which is used for MCP protocol)
console.error('Trillium MCP Server');
console.error(`API URL: ${config.apiUrl}`);
console.error(`Permissions: ${config.permissions}`);
console.error('');

/**
 * List available tools based on permissions
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = getToolDefinitions(config);
  console.error(`Listing ${tools.length} tools`);
  return { tools };
});

/**
 * Handle tool execution
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  console.error(`Executing tool: ${name}`);

  try {
    let result: string;

    switch (name) {
      // READ operations
      case 'notes_search':
        result = await notesSearch(client, args);
        break;

      case 'note_get':
        result = await noteGet(client, args);
        break;

      // DEACTIVATED FOR MVP:
      // case 'attachments_get':
      //   result = await attachmentsGet(client, args);
      //   break;

      // case 'attachments_get_content':
      //   result = await attachmentsGetContent(client, args);
      //   break;

      case 'branches_get':
        result = await branchesGet(client, args);
        break;

      case 'attributes_get':
        result = await attributesGet(client, args);
        break;

      // DEACTIVATED FOR MVP:
      // case 'calendar_get_day':
      //   result = await calendarGetDay(client, args);
      //   break;

      // case 'calendar_get_week':
      //   result = await calendarGetWeek(client, args);
      //   break;

      // case 'calendar_get_month':
      //   result = await calendarGetMonth(client, args);
      //   break;

      // case 'calendar_get_year':
      //   result = await calendarGetYear(client, args);
      //   break;

      // case 'inbox_get':
      //   result = await inboxGet(client, args);
      //   break;

      // WRITE operations
      case 'note_create':
        result = await noteCreate(client, args);
        break;

      case 'note_overwrite':
        result = await noteOverwrite(client, args);
        break;

      case 'note_delete':
        result = await noteDelete(client, args);
        break;

      case 'attributes_create':
        result = await attributesCreate(client, args);
        break;

      case 'attributes_delete':
        result = await attributesDelete(client, args);
        break;

      case 'branches_create':
        result = await branchesCreate(client, args);
        break;

      case 'branches_delete':
        result = await branchesDelete(client, args);
        break;

      case 'attributes_update':
        result = await attributesUpdate(client, args);
        break;

      case 'branches_update':
        result = await branchesUpdate(client, args);
        break;

      // DEACTIVATED FOR MVP:
      // case 'attachments_create':
      //   result = await attachmentsCreate(client, args);
      //   break;

      // case 'attachments_update':
      //   result = await attachmentsUpdate(client, args);
      //   break;

      // case 'attachments_delete':
      //   result = await attachmentsDelete(client, args);
      //   break;

      // case 'attachments_update_content':
      //   result = await attachmentsUpdateContent(client, args);
      //   break;

      case 'note_create_revision':
        result = await noteCreateRevision(client, args);
        break;

      case 'note_reorder':
        result = await noteReorder(client, args);
        break;

      case 'note_list_children':
        result = await noteListChildren(client, args);
        break;

      case 'note_reorder_children':
        result = await noteReorderChildren(client, args);
        break;

      // Advanced editing operations
      case 'note_edit':
        result = await noteEdit(client, args);
        break;

      case 'note_prepend':
        result = await notePrepend(client, args);
        break;

      case 'note_append':
        result = await noteAppend(client, args);
        break;

      case 'note_grep':
        result = await noteGrep(client, args);
        break;

      case 'note_get_lines':
        result = await noteGetLines(client, args);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    console.error(`Tool ${name} completed successfully`);

    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  } catch (error) {
    console.error(`Tool ${name} failed:`, error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * Start the MCP server
 */
async function main() {
  try {
    // Test connection to Trilium
    console.error('Testing connection to Trilium...');
    const appInfo = await client.getAppInfo();
    console.error(`Connected to Trilium ${appInfo.appVersion}`);
    console.error('');

    // Start MCP server with stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('Trillium MCP server running');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.error('\nShutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('\nShutting down...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
