/**
 * Branch Tools for Trillium MCP
 * Manage note placement and parent-child relationships in the tree
 */

import { z } from 'zod';
import type { TrilliumClient } from '../client.js';

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const BranchesGetSchema = z.object({
  branchId: z.string().min(1).describe('Branch ID to retrieve'),
});

export const BranchesCreateSchema = z.object({
  noteId: z.string().min(1).describe('Note ID to place in tree'),
  parentNoteId: z.string().min(1).describe('Parent note ID'),
  prefix: z.string().optional().describe('Branch-specific title prefix'),
});

export const BranchesUpdateSchema = z.object({
  branchId: z.string().min(1).describe('Branch ID to update'),
  prefix: z.string().optional().describe('New branch-specific title prefix'),
  notePosition: z.number().optional().describe('New position among siblings'),
  isExpanded: z.coerce.boolean().optional().describe('Whether folder is expanded'),
});

export const BranchesDeleteSchema = z.object({
  branchId: z.string().min(1).describe('Branch ID to delete'),
});

// ============================================================================
// JSON SCHEMAS (for MCP)
// ============================================================================

const BranchesGetJsonSchema = {
  type: 'object' as const,
  properties: {
    branchId: {
      type: 'string' as const,
      description: 'Branch ID to retrieve',
    },
  },
  required: ['branchId'],
};

const BranchesCreateJsonSchema = {
  type: 'object' as const,
  properties: {
    noteId: {
      type: 'string' as const,
      description: 'Note ID to place in tree',
    },
    parentNoteId: {
      type: 'string' as const,
      description: 'Parent note ID',
    },
    prefix: {
      type: 'string' as const,
      description: 'Branch-specific title prefix',
    },
  },
  required: ['noteId', 'parentNoteId'],
};

const BranchesUpdateJsonSchema = {
  type: 'object' as const,
  properties: {
    branchId: {
      type: 'string' as const,
      description: 'Branch ID to update',
    },
    prefix: {
      type: 'string' as const,
      description: 'New branch-specific title prefix',
    },
    notePosition: {
      type: 'number' as const,
      description: 'New position among siblings',
    },
    isExpanded: {
      type: ['boolean', 'string'] as const,
      description: 'Whether folder is expanded',
    },
  },
  required: ['branchId'],
};

const BranchesDeleteJsonSchema = {
  type: 'object' as const,
  properties: {
    branchId: {
      type: 'string' as const,
      description: 'Branch ID to delete',
    },
  },
  required: ['branchId'],
};

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

export async function branchesGet(client: TrilliumClient, args: unknown): Promise<string> {
  const params = BranchesGetSchema.parse(args);

  const branch = await client.getBranch(params.branchId);

  return [
    `**Branch Details**`,
    ``,
    `Note ID: ${branch.noteId}`,
    `Parent Note ID: ${branch.parentNoteId}`,
    branch.prefix ? `Prefix: ${branch.prefix}` : '',
    `Position: ${branch.notePosition}`,
    `Expanded: ${branch.isExpanded ? 'Yes' : 'No'}`,
    `Modified: ${branch.utcDateModified}`,
    ``,
    `[Branch ID: ${branch.branchId}]`,
  ].filter(Boolean).join('\n');
}

export async function branchesCreate(client: TrilliumClient, args: unknown): Promise<string> {
  const params = BranchesCreateSchema.parse(args);

  const branch = await client.createBranch({
    noteId: params.noteId,
    parentNoteId: params.parentNoteId,
    prefix: params.prefix,
  });

  return [
    `Branch created successfully!`,
    ``,
    `Note placed under parent: ${params.parentNoteId}`,
    params.prefix ? `Prefix: ${params.prefix}` : '',
    ``,
    `[Branch ID: ${branch.branchId}]`,
  ].filter(Boolean).join('\n');
}

export async function branchesUpdate(client: TrilliumClient, args: unknown): Promise<string> {
  const params = BranchesUpdateSchema.parse(args);

  const updates: Partial<{ prefix: string; notePosition: number; isExpanded: boolean }> = {};
  if (params.prefix !== undefined) updates.prefix = params.prefix;
  if (params.notePosition !== undefined) updates.notePosition = params.notePosition;
  if (params.isExpanded !== undefined) updates.isExpanded = params.isExpanded;

  const branch = await client.updateBranch(params.branchId, updates);

  return [
    `Branch updated successfully!`,
    ``,
    branch.prefix ? `Prefix: ${branch.prefix}` : '',
    `Position: ${branch.notePosition}`,
    `Expanded: ${branch.isExpanded ? 'Yes' : 'No'}`,
    ``,
    `[Branch ID: ${branch.branchId}]`,
  ].filter(Boolean).join('\n');
}

export async function branchesDelete(client: TrilliumClient, args: unknown): Promise<string> {
  const params = BranchesDeleteSchema.parse(args);

  await client.deleteBranch(params.branchId);

  return `Branch deleted: ${params.branchId}`;
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const branchTools = [
  {
    name: 'branches_get',
    description:
      'Get branch details by branchId. A branch is a parent-child relationship (tree placement) for a note. ' +
      'Returns: noteId, parentNoteId, prefix, position, expansion state, and modification date. ' +
      'WHEN TO USE: Check where a note is placed, verify branch before deletion, inspect prefix/position settings. ' +
      'WORKFLOW: (1) note_get to see parentBranchIds, (2) branches_get to inspect specific placement, (3) branches_update/delete to modify. ' +
      'KEY CONCEPT: Notes can have MULTIPLE branches (appear in multiple locations). Each branch has its own prefix and position.',
    inputSchema: BranchesGetJsonSchema,
  },
  {
    name: 'branches_create',
    description:
      'Clone (link) a note to a new parent location. Creates an additional parent-child relationship - the note appears in multiple places. ' +
      'IMPORTANT: This does NOT copy the note content. The same note appears in multiple tree locations (like symlinks). ' +
      'WHEN TO USE: Organize note under multiple categories (e.g., meeting note under both "Client X" and "January 2025"), ' +
      'create reference in "Quick Access" folder, show note in project AND documentation, archive while keeping in active project. ' +
      'WORKFLOW: (1) notes_search to find note and parent, (2) branches_create with noteId and parentNoteId, (3) Returns new branchId. ' +
      'EXAMPLES: Clone "API Docs" to appear under both "Documentation" and "Project Alpha". Clone "Meeting Notes" to both "Clients/ACME" and "2025/January". ' +
      'TIP: Use prefix parameter to show different context (e.g., prefix: "[Archived]" when cloning to archive folder).',
    inputSchema: BranchesCreateJsonSchema,
  },
  {
    name: 'branches_update',
    description:
      'Update branch properties: prefix (text before title), position (order among siblings), or expansion state (folder open/closed). ' +
      'Changes only affect THIS specific branch/placement, not other locations where the note appears. ' +
      'WHEN TO USE: Add context prefix ("[Important]", "[Archived 2025]"), reorder note within parent, collapse/expand folder. ' +
      'WORKFLOW: (1) note_get to see parentBranchIds, (2) branches_get to check current values, (3) branches_update to modify. ' +
      'EXAMPLES: ' +
      'Add archive marker → prefix: "[Archived 2025-01]". ' +
      'Move to top → notePosition: 5 (lower = higher in list). ' +
      'Mark important → prefix: "⭐ ". ' +
      'Collapse folder → isExpanded: false. ' +
      'TIP: Position gaps (10, 20, 30) allow inserting notes between siblings later.',
    inputSchema: BranchesUpdateJsonSchema,
  },
  {
    name: 'branches_delete',
    description:
      'Delete a branch (remove note from ONE location in tree). The note itself remains and stays in other locations. ' +
      'CRITICAL: This is NOT note_delete! This removes ONE parent-child relationship only. ' +
      'WHEN TO USE: Remove note from a category while keeping it elsewhere, clean up duplicate placements, remove from archive while keeping in project. ' +
      'WHEN NOT TO USE: To delete the note entirely (use note_delete instead), to move note (use branches_create + branches_delete instead). ' +
      'WORKFLOW: (1) note_get to see all parentBranchIds, (2) branches_get to identify which branch to remove, (3) branches_delete that branchId. ' +
      'EXAMPLES: ' +
      'Remove from archive → Delete archive branch, note stays in active project. ' +
      'Remove from old project → Delete that branch, note stays in other projects. ' +
      'SAFETY: If note has only ONE branch and you delete it, note becomes orphaned (no parent). Always check parentBranchIds first.',
    inputSchema: BranchesDeleteJsonSchema,
  },
];
