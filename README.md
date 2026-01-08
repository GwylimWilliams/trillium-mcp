# Trillium Notes MCP Server

[![npm version](https://img.shields.io/npm/v/@aimbitgmbh/trillium-mcp)](https://npmjs.com/package/@aimbitgmbh/trillium-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An MCP (Model Context Protocol) server that provides LLM access to your [TriliumNext Notes](https://github.com/TriliumNext/Trilium) instance. This enables AI assistants to read, search, create, and manage your notes through the Trilium ETAPI.

Tested and optimized for **gpt-oss:20b**.

## Prerequisites

- Node.js >= 18.0.0
- TriliumNext Notes instance (local or remote)
- ETAPI token from Trilium (Options > ETAPI > Create Token)

## Features

- Full Trilium ETAPI integration
- Advanced note editing (search, replace, prepend, append)
- Content format support (HTML, Markdown, Plain Text)
- Hierarchical note management (branches, attributes)
- Permission-based access control (READ / READ;WRITE)
- TypeScript with Zod validation

## Installation

### NPM Package

```bash
npx @aimbitgmbh/trillium-mcp
```

### MCP Client Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "trillium": {
      "command": "npx",
      "args": ["-y", "@aimbitgmbh/trillium-mcp"],
      "env": {
        "TRILLIUM_API_URL": "http://localhost:8080/etapi",
        "TRILLIUM_API_TOKEN": "your-token-here",
        "TRILLIUM_PERMISSIONS": "READ"
      }
    }
  }
}
```

## Configuration

### Environment Variables

Create a `.env` file or set environment variables:

```bash
# Trillium ETAPI URL (required)
TRILLIUM_API_URL=http://localhost:8080/etapi

# ETAPI token (required)
# Generate in Trilium: Options > ETAPI > Create Token
TRILLIUM_API_TOKEN=your-token-here

# Permissions (default: READ)
# READ: Safe, read-only operations
# READ;WRITE: Full access including create/update/delete
TRILLIUM_PERMISSIONS=READ

# SSL verification (default: false)
VERIFY_SSL=false
```

See [.env.example](.env.example) for a complete example.

## Available Tools

### Notes

- `notes_search` - Search notes using Trilium query language
- `note_get` - Get note metadata and content
- `note_list_children` - List all children of a note
- `note_create` - Create new note (WRITE)
- `note_overwrite` - Replace note content (WRITE)
- `note_delete` - Delete a note (WRITE)
- `note_create_revision` - Create revision snapshot (WRITE)
- `note_reorder` - Reorder note within parent (WRITE)
- `note_reorder_children` - Reorder all children (WRITE)
- `note_edit` - Surgical find-and-replace (WRITE)
- `note_prepend` - Add content at beginning (WRITE)
- `note_append` - Add content at end (WRITE)
- `note_grep` - Search within note content
- `note_get_lines` - Read specific line ranges

### Branches

- `branches_get` - Get branch details
- `branches_create` - Place note in tree (WRITE)
- `branches_update` - Modify branch properties (WRITE)
- `branches_delete` - Remove note from parent (WRITE)

### Attributes

- `attributes_get` - Get attribute details
- `attributes_create` - Add label/relation (WRITE)
- `attributes_update` - Modify attribute (WRITE)
- `attributes_delete` - Remove attribute (WRITE)

## Troubleshooting

If you encounter connection issues:

- Verify your ETAPI token is valid (Options > ETAPI in Trilium)
- Ensure the ETAPI URL includes the `/etapi` path
- For self-signed certificates, set `VERIFY_SSL=false`
- Check that your Trilium instance is accessible

## Security

- Store ETAPI tokens in environment variables
- Default to READ-only permissions for safety
- Never commit `.env` files to version control
- Use `VERIFY_SSL=true` in production with valid certificates

## Contributing

Contributions are welcome! Please open an issue or pull request on GitHub.

## License

MIT © [aimbit GmbH](https://aimbit.de)

See [LICENSE](LICENSE) file for details.

## Links

- [GitHub Repository](https://github.com/aimbitgmbh/trillium-mcp)
- [Report Issues](https://github.com/aimbitgmbh/trillium-mcp/issues)
- [npm Package](https://npmjs.com/package/@aimbitgmbh/trillium-mcp)
- [TriliumNext](https://github.com/TriliumNext/Trilium)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [aimbit GmbH](https://aimbit.de)
