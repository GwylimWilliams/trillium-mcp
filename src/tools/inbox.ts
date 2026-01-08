/**
 * Inbox Tools for Trillium MCP
 * Quick note capture and unprocessed items
 */

import { z } from 'zod';
import type { TrilliumClient } from '../client.js';

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const InboxGetSchema = z.object({
  date: z.string().describe('Date in YYYY-MM-DD format'),
});

// ============================================================================
// JSON SCHEMAS (for MCP)
// ============================================================================

const InboxGetJsonSchema = {
  type: 'object' as const,
  properties: {
    date: {
      type: 'string' as const,
      description: 'Date in YYYY-MM-DD format',
    },
  },
  required: ['date'],
};

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

export async function inboxGet(client: TrilliumClient, args: unknown): Promise<string> {
  const params = InboxGetSchema.parse(args);

  const note = await client.getInboxNote(params.date);

  return [
    `**Inbox Note: ${params.date}**`,
    ``,
    `Title: ${note.title}`,
    `Type: ${note.type}`,
    ``,
    `The inbox note has been retrieved.`,
    `Use this note for quick captures and unprocessed items.`,
    ``,
    `[Note ID: ${note.noteId}]`,
  ].join('\n');
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const inboxTools = [
  {
    name: 'inbox_get',
    description:
      'Get inbox note for a specific date. ' +
      'Date format: YYYY-MM-DD. Use for quick note captures and unprocessed items.',
    inputSchema: InboxGetJsonSchema,
  },
];
