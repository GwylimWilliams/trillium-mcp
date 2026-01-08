/**
 * Note Tools for Trillium MCP
 * Core note operations, search, editing, and content management
 */

import { z } from 'zod';
import type { TrilliumClient } from '../client.js';
import {
  detectContentFormat,
  formatContentForMime,
  convertHTMLToMarkdown,
  hybridMatch,
  extractLines,
  showEditContext,
  searchInContent,
  validateContentChange,
} from './helpers.js';

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const NotesSearchSchema = z.object({
  query: z.string().min(1).describe('Trilium search query (supports fulltext and advanced syntax)'),
  fastSearch: z.coerce.boolean().optional().describe('Skip content search for faster results'),
  includeArchived: z.coerce.boolean().optional().describe('Include archived notes in results'),
  limit: z.number().optional().describe('Maximum number of results (default: 20)'),
});

export const NoteGetSchema = z.object({
  noteId: z.string().min(1).describe('Note ID to retrieve'),
  includeContent: z.coerce.boolean().optional().default(true).describe('Include note content'),
});

export const NoteCreateSchema = z.object({
  parentNoteId: z.string().min(1).describe('Parent note ID'),
  title: z.string().min(1).describe('Note title'),
  content: z.string().describe('Note content (can be empty string)'),
  type: z.enum(['text', 'code', 'book', 'render']).default('text').describe('Note type'),
  mime: z.string().optional().describe(
    'MIME type for the note. ' +
    'Defaults to "text/html" for text notes. LLMs can write Markdown naturally - it will be auto-converted to HTML for Trilium. ' +
    'For code notes with raw Markdown, use type="code" with mime="text/markdown". ' +
    'Common values: "text/html" (default for text, auto-converts Markdown), "text/plain", "application/javascript", "text/css"'
  ),
});

export const NoteOverwriteSchema = z.object({
  noteId: z.string().min(1).describe('Note ID to overwrite'),
  title: z.string().optional().describe('New title (overwrites current title)'),
  content: z.string().optional().describe('New content (completely replaces current content)'),
});

export const NoteDeleteSchema = z.object({
  noteId: z.string().min(1).describe('Note ID to delete'),
});

export const NoteCreateRevisionSchema = z.object({
  noteId: z.string().min(1).describe('Note ID to create revision for'),
});

export const NoteReorderSchema = z.object({
  noteId: z.string().min(1).describe('Note ID to reorder/move'),
  parentNoteId: z.string().min(1).describe('Parent note ID where the note should be positioned'),
  position: z.union([z.string().min(1), z.number()]).describe(
    'Where to position the note. Options: ' +
    '"first" (move to beginning), "last" (move to end), ' +
    'number (1 = first position, 2 = second position, etc. - makes this the Nth child when sorted), ' +
    '"before:<noteId>" (position before sibling), "after:<noteId>" (position after sibling)'
  ),
});

export const NoteListChildrenSchema = z.object({
  noteId: z.string().min(1).describe('Parent note ID whose children to list'),
  sortBy: z.enum(['position', 'title', 'created', 'modified']).optional().default('position')
    .describe('How to sort children: position (tree order), title (alphabetical), created, or modified'),
});

export const NoteReorderChildrenSchema = z.object({
  parentNoteId: z.string().min(1).describe('Parent note ID whose children to reorder'),
  sortBy: z.enum(['title', 'created', 'modified']).describe(
    'How to sort children: title (alphabetical), created (oldest first), modified (recently modified last)'
  ),
});

// ============================================================================
// ZOD SCHEMAS - NOTES EDITING (Advanced Content Operations)
// ============================================================================

export const NoteEditSchema = z.object({
  noteId: z.string().min(1).describe('Note ID to edit'),
  old_string: z.string().min(1).describe(
    'Exact text to find and replace. This string must exist uniquely in the note content. ' +
    'For Markdown/plain text notes: use literal text. ' +
    'For HTML notes: use Markdown-formatted text - the server will handle conversion intelligently. ' +
    'If the string appears multiple times, use replace_all: true or make old_string more specific.'
  ),
  new_string: z.string().describe(
    'Replacement text. ' +
    'For Markdown/plain text notes: use literal text. ' +
    'For HTML notes: use Markdown-formatted text - the server will auto-convert to HTML.'
  ),
  replace_all: z.coerce.boolean().optional().default(false).describe(
    'Replace all occurrences of old_string (default: false). ' +
    'If false, old_string must appear exactly once in the content (safety check).'
  ),
});

export const NotePrependSchema = z.object({
  noteId: z.string().min(1).describe('Note ID to prepend content to'),
  content: z.string().min(1).describe(
    'Content to add at the beginning of the note. ' +
    'For HTML notes: write in Markdown - it will be auto-converted. ' +
    'The server automatically adds separating newlines between prepended content and existing content.'
  ),
});

export const NoteAppendSchema = z.object({
  noteId: z.string().min(1).describe('Note ID to append content to'),
  content: z.string().min(1).describe(
    'Content to add at the end of the note. ' +
    'For HTML notes: write in Markdown - it will be auto-converted. ' +
    'The server automatically adds separating newlines between existing content and appended content.'
  ),
});

export const NoteGrepSchema = z.object({
  noteId: z.string().min(1).describe('Note ID to search within'),
  pattern: z.string().min(1).describe(
    'Search pattern (case-insensitive). ' +
    'Simple substring search - finds all occurrences in note content.'
  ),
  context_lines: z.number().optional().default(2).describe(
    'Number of lines to show before and after each match for context (default: 2)'
  ),
});

export const NoteGetLinesSchema = z.object({
  noteId: z.string().min(1).describe('Note ID to read from'),
  start_line: z.number().min(1).describe(
    'Starting line number (1-indexed). First line of note is line 1.'
  ),
  end_line: z.number().min(1).describe(
    'Ending line number (1-indexed, inclusive). ' +
    'If larger than total lines, will return up to last line.'
  ),
});

// ============================================================================
// ZOD SCHEMAS - BRANCHES
// ============================================================================


// ============================================================================
// JSON SCHEMAS (for MCP)
// ============================================================================

const NotesSearchJsonSchema = {
  type: 'object' as const,
  properties: {
    query: {
      type: 'string' as const,
      description: 'Trilium search query (supports fulltext and advanced syntax)',
    },
    fastSearch: {
      type: ['boolean', 'string'] as const,
      description: 'Skip content search for faster results',
    },
    includeArchived: {
      type: ['boolean', 'string'] as const,
      description: 'Include archived notes in results',
    },
    limit: {
      type: 'number' as const,
      description: 'Maximum number of results (default: 20)',
    },
  },
  required: ['query'],
};

const NoteGetJsonSchema = {
  type: 'object' as const,
  properties: {
    noteId: {
      type: 'string' as const,
      description: 'Note ID to retrieve',
    },
    includeContent: {
      type: ['boolean', 'string'] as const,
      description: 'Include note content',
      default: true,
    },
  },
  required: ['noteId'],
};

const NoteCreateJsonSchema = {
  type: 'object' as const,
  properties: {
    parentNoteId: {
      type: 'string' as const,
      description: 'Parent note ID',
    },
    title: {
      type: 'string' as const,
      description: 'Note title',
    },
    content: {
      type: 'string' as const,
      description: 'Note content (can be empty string)',
    },
    type: {
      type: 'string' as const,
      enum: ['text', 'code', 'book', 'render'],
      description: 'Note type',
      default: 'text',
    },
    mime: {
      type: 'string' as const,
      description: 'MIME type for the note. Defaults to "text/html" for text notes. LLMs can write Markdown naturally - it will be auto-converted to HTML for Trilium. For code notes with raw Markdown, use type="code" with mime="text/markdown". Common values: "text/html" (default for text, auto-converts Markdown), "text/plain", "application/javascript", "text/css"',
    },
  },
  required: ['parentNoteId', 'title', 'content'],
};

const NoteOverwriteJsonSchema = {
  type: 'object' as const,
  properties: {
    noteId: {
      type: 'string' as const,
      description: 'Note ID to overwrite',
    },
    title: {
      type: 'string' as const,
      description: 'New title (overwrites current title)',
    },
    content: {
      type: 'string' as const,
      description: 'New content (completely replaces current content)',
    },
  },
  required: ['noteId'],
};

const NoteDeleteJsonSchema = {
  type: 'object' as const,
  properties: {
    noteId: {
      type: 'string' as const,
      description: 'Note ID to delete',
    },
  },
  required: ['noteId'],
};

const NoteCreateRevisionJsonSchema = {
  type: 'object' as const,
  properties: {
    noteId: {
      type: 'string' as const,
      description: 'Note ID to create revision for',
    },
  },
  required: ['noteId'],
};

const NoteReorderJsonSchema = {
  type: 'object' as const,
  properties: {
    noteId: {
      type: 'string' as const,
      description: 'Note ID to reorder/move',
    },
    parentNoteId: {
      type: 'string' as const,
      description: 'Parent note ID where the note should be positioned',
    },
    position: {
      oneOf: [
        { type: 'string' as const },
        { type: 'number' as const },
      ],
      description: 'Where to position the note. Options: "first" (move to beginning), "last" (move to end), number (1 = first position, 2 = second position, etc. - makes this the Nth child when sorted), "before:<noteId>" (position before sibling), "after:<noteId>" (position after sibling)',
    },
  },
  required: ['noteId', 'parentNoteId', 'position'],
};

const NoteListChildrenJsonSchema = {
  type: 'object' as const,
  properties: {
    noteId: {
      type: 'string' as const,
      description: 'Parent note ID whose children to list',
    },
    sortBy: {
      type: 'string' as const,
      enum: ['position', 'title', 'created', 'modified'],
      description: 'How to sort children: position (tree order), title (alphabetical), created, or modified',
      default: 'position',
    },
  },
  required: ['noteId'],
};

const NoteReorderChildrenJsonSchema = {
  type: 'object' as const,
  properties: {
    parentNoteId: {
      type: 'string' as const,
      description: 'Parent note ID whose children to reorder',
    },
    sortBy: {
      type: 'string' as const,
      enum: ['title', 'created', 'modified'],
      description: 'How to sort children: title (alphabetical), created (oldest first), modified (recently modified last)',
    },
  },
  required: ['parentNoteId', 'sortBy'],
};

// ============================================================================
// JSON SCHEMAS - NOTES EDITING (Advanced Content Operations)
// ============================================================================

const NoteEditJsonSchema = {
  type: 'object' as const,
  properties: {
    noteId: {
      type: 'string' as const,
      description: 'Note ID to edit',
    },
    old_string: {
      type: 'string' as const,
      description: 'Exact text to find and replace. This string must exist uniquely in the note content. For Markdown/plain text notes: use literal text. For HTML notes: use Markdown-formatted text - the server will handle conversion intelligently. If the string appears multiple times, use replace_all: true or make old_string more specific.',
    },
    new_string: {
      type: 'string' as const,
      description: 'Replacement text. For Markdown/plain text notes: use literal text. For HTML notes: use Markdown-formatted text - the server will auto-convert to HTML.',
    },
    replace_all: {
      type: ['boolean', 'string'] as const,
      description: 'Replace all occurrences of old_string (default: false). If false, old_string must appear exactly once in the content (safety check).',
      default: false,
    },
  },
  required: ['noteId', 'old_string', 'new_string'],
};

const NotePrependJsonSchema = {
  type: 'object' as const,
  properties: {
    noteId: {
      type: 'string' as const,
      description: 'Note ID to prepend content to',
    },
    content: {
      type: 'string' as const,
      description: 'Content to add at the beginning of the note. For HTML notes: write in Markdown - it will be auto-converted. The server automatically adds separating newlines between prepended content and existing content.',
    },
  },
  required: ['noteId', 'content'],
};

const NoteAppendJsonSchema = {
  type: 'object' as const,
  properties: {
    noteId: {
      type: 'string' as const,
      description: 'Note ID to append content to',
    },
    content: {
      type: 'string' as const,
      description: 'Content to add at the end of the note. For HTML notes: write in Markdown - it will be auto-converted. The server automatically adds separating newlines between existing content and appended content.',
    },
  },
  required: ['noteId', 'content'],
};

const NoteGrepJsonSchema = {
  type: 'object' as const,
  properties: {
    noteId: {
      type: 'string' as const,
      description: 'Note ID to search within',
    },
    pattern: {
      type: 'string' as const,
      description: 'Search pattern (case-insensitive). Simple substring search - finds all occurrences in note content.',
    },
    context_lines: {
      type: 'number' as const,
      description: 'Number of lines to show before and after each match for context (default: 2)',
      default: 2,
    },
  },
  required: ['noteId', 'pattern'],
};

const NoteGetLinesJsonSchema = {
  type: 'object' as const,
  properties: {
    noteId: {
      type: 'string' as const,
      description: 'Note ID to read from',
    },
    start_line: {
      type: 'number' as const,
      description: 'Starting line number (1-indexed). First line of note is line 1.',
    },
    end_line: {
      type: 'number' as const,
      description: 'Ending line number (1-indexed, inclusive). If larger than total lines, will return up to last line.',
    },
  },
  required: ['noteId', 'start_line', 'end_line'],
};

// ============================================================================
// JSON SCHEMAS - BRANCHES
// ============================================================================


// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

export async function notesSearch(client: TrilliumClient, args: unknown): Promise<string> {
  const params = NotesSearchSchema.parse(args);

  const response = await client.searchNotes({
    search: params.query,
    fastSearch: params.fastSearch,
    includeArchivedNotes: params.includeArchived,
    limit: params.limit || 20,
  });

  if (!response.results || response.results.length === 0) {
    return `No notes found matching query: "${params.query}"`;
  }

  const results = response.results.map((note) => {
    return [
      `${note.title}`,
      ``,
      `Type: ${note.type}`,
      `Created: ${note.dateCreated}`,
      `Modified: ${note.dateModified}`,
      ``,
      `[ID: ${note.noteId}]`,
      `---`,
    ].join('\n');
  });

  return [
    `Found ${response.results.length} note(s):\n`,
    ...results,
  ].join('\n');
}

export async function noteGet(client: TrilliumClient, args: unknown): Promise<string> {
  const params = NoteGetSchema.parse(args);

  const note = await client.getNote(params.noteId);
  let content = '';

  if (params.includeContent) {
    try {
      content = await client.getNoteContent(params.noteId);
    } catch (error) {
      content = `[Could not retrieve content: ${error instanceof Error ? error.message : 'Unknown error'}]`;
    }
  }

  const output = [
    `${note.title}`,
    ``,
    content || '[No content]',
    ``,
    `---`,
    `Type: ${note.type}`,
    `MIME: ${note.mime}`,
    `Created: ${note.dateCreated}`,
    `Modified: ${note.dateModified}`,
    `Protected: ${note.isProtected ? 'Yes' : 'No'}`,
  ];

  if (note.attributes && note.attributes.length > 0) {
    output.push('', `**Attributes** (use with attributes_get/update/delete):`);
    const attrs = note.attributes; // Type narrowing for forEach
    attrs.forEach((attr, index) => {
      output.push(`${index + 1}. ${attr.type}: ${attr.name} = ${attr.value}`);
      output.push(`   Attribute ID: ${attr.attributeId}`);
      output.push(`   Position: ${attr.position}`);
      output.push(`   Inheritable: ${attr.isInheritable ? 'Yes' : 'No'}`);
      if (index < attrs.length - 1) {
        output.push('');
      }
    });
  }

  if (note.childNoteIds && note.childNoteIds.length > 0) {
    output.push('', `**Children (${note.childNoteIds.length}):**`);
    output.push('Tip: Use notes_list_children for easier child management and sorting options.');
    output.push('');

    // Fetch child branches to get positions
    if (note.childBranchIds && note.childBranchIds.length > 0) {
      try {
        const childBranches = await Promise.all(
          note.childBranchIds.map(branchId => client.getBranch(branchId))
        );

        // Sort by position for display
        childBranches.sort((a, b) => a.notePosition - b.notePosition);

        // Fetch child note details for titles
        const childNotes = await Promise.all(
          childBranches.map(branch => client.getNote(branch.noteId))
        );

        // Create a map of noteId -> title
        const titleMap = new Map(childNotes.map(n => [n.noteId, n.title]));

        // Display children in a clear, structured format
        for (let i = 0; i < childBranches.length; i++) {
          const branch = childBranches[i];
          const title = titleMap.get(branch.noteId) || 'Unknown';
          const posStr = branch.notePosition.toString().padStart(4, ' ');
          output.push(`${i + 1}. "${title}"`);
          output.push(`   Note ID: ${branch.noteId}`);
          output.push(`   Branch ID: ${branch.branchId}`);
          output.push(`   Position: ${posStr}`);
          if (i < childBranches.length - 1) {
            output.push('');
          }
        }
      } catch (error) {
        // Show error details instead of silently falling back
        const errorMsg = error instanceof Error ? error.message : String(error);
        output.push(`Warning: Error fetching child details: ${errorMsg}`);
        output.push(`Child Note IDs (raw): ${note.childNoteIds.join(', ')}`);
        output.push(`Child Branch IDs (raw): ${note.childBranchIds.join(', ')}`);
      }
    } else {
      output.push(`Child Note IDs: ${note.childNoteIds.join(', ')}`);
      output.push(`Note: No childBranchIds found`);
    }
  }

  if (note.parentNoteIds && note.parentNoteIds.length > 0) {
    output.push('', `**Parents:**`);

    // Fetch parent note details for titles
    try {
      const parentNotes = await Promise.all(
        note.parentNoteIds.map(id => client.getNote(id))
      );

      for (const parent of parentNotes) {
        output.push(`  "${parent.title}" [${parent.noteId}]`);
      }
    } catch (error) {
      // Show error details instead of silently falling back
      const errorMsg = error instanceof Error ? error.message : String(error);
      output.push(`Warning: Error fetching parent details: ${errorMsg}`);
      output.push(`Parent Note IDs (raw): ${note.parentNoteIds.join(', ')}`);
    }

    // Show parent branch IDs for branches_get usage
    if (note.parentBranchIds && note.parentBranchIds.length > 0) {
      output.push('', `**Parent Branch IDs** (use with branches_get):`);
      note.parentBranchIds.forEach((branchId, index) => {
        output.push(`  ${index + 1}. ${branchId}`);
      });
    }
  }

  output.push('', `[ID: ${note.noteId}]`);

  return output.join('\n');
}

export async function noteCreate(client: TrilliumClient, args: unknown): Promise<string> {
  const params = NoteCreateSchema.parse(args);

  // Determine MIME type (text/html for text notes - Markdown content will be auto-converted)
  const mime = params.mime || (params.type === 'text' ? 'text/html' : 'text/plain');

  // Format content based on MIME type
  const formattedContent = formatContentForMime(params.content, mime);

  const result = await client.createNote({
    parentNoteId: params.parentNoteId,
    title: params.title,
    content: formattedContent,
    type: params.type,
    mime: mime,
  });

  // VERIFY: Fetch the created note to show it actually exists
  const createdNote = await client.getNote(result.note.noteId);
  const actualContent = await client.getNoteContent(result.note.noteId);

  // Show preview of created content
  const contentPreview = actualContent.length > 200
    ? actualContent.substring(0, 200) + '...'
    : actualContent;

  const format = detectContentFormat(mime);

  return [
    `Created note "${createdNote.title}"`,
    ``,
    contentPreview,
    ``,
    `---`,
    `Type: ${createdNote.type}`,
    `MIME: ${createdNote.mime}`,
    `Format: ${format}`,
    `Content: ${actualContent.length} characters`,
    `Created: ${createdNote.dateCreated}`,
    ``,
    `[ID: ${createdNote.noteId}]`,
    `[Parent: ${params.parentNoteId}]`,
  ].join('\n');
}

export async function noteOverwrite(client: TrilliumClient, args: unknown): Promise<string> {
  const params = NoteOverwriteSchema.parse(args);

  // Fetch BEFORE state
  const noteBefore = await client.getNote(params.noteId);
  const contentBefore = params.content !== undefined
    ? await client.getNoteContent(params.noteId)
    : null;

  const updates: string[] = [];

  if (params.title) {
    await client.updateNote(params.noteId, { title: params.title });
    updates.push(`**Title:**\n  Before: "${noteBefore.title}"\n  After:  "${params.title}"`);
  }

  if (params.content !== undefined) {
    // Get the note to determine its MIME type for smart formatting
    const note = await client.getNote(params.noteId);
    const mime = note.mime || 'text/html';  // Fallback to HTML (Markdown will be auto-converted)
    const format = detectContentFormat(mime);

    // Format content based on note's MIME type
    const formattedContent = formatContentForMime(params.content, mime);

    await client.updateNoteContent(params.noteId, formattedContent);

    // Show content change with preview
    const beforePreview = contentBefore!.length > 100
      ? contentBefore!.substring(0, 100) + '...'
      : contentBefore!;
    const afterPreview = formattedContent.length > 100
      ? formattedContent.substring(0, 100) + '...'
      : formattedContent;

    updates.push(
      `**Content (${format}):**\n` +
      `  Before (${contentBefore!.length} chars): ${beforePreview}\n` +
      `  After (${formattedContent.length} chars): ${afterPreview}`
    );
  }

  if (updates.length === 0) {
    return 'No updates specified';
  }

  // VERIFY: Re-fetch to confirm changes
  const noteAfter = await client.getNote(params.noteId);

  return [
    `Overwrote note "${noteAfter.title}"`,
    ``,
    ...updates,
    ``,
    `Modified: ${noteAfter.dateModified}`,
    `[ID: ${params.noteId}]`,
  ].join('\n');
}

export async function noteDelete(client: TrilliumClient, args: unknown): Promise<string> {
  const params = NoteDeleteSchema.parse(args);

  // Fetch note details BEFORE deleting
  const note = await client.getNote(params.noteId);
  const content = await client.getNoteContent(params.noteId);

  // Show preview of what's being deleted
  const contentPreview = content.length > 100
    ? content.substring(0, 100) + '...'
    : content;

  // Perform deletion
  await client.deleteNote(params.noteId);

  return [
    `Deleted note "${note.title}"`,
    ``,
    `Type: ${note.type}`,
    `Content: ${content.length} characters`,
    `Created: ${note.dateCreated}`,
    ``,
    `**Preview of deleted content:**`,
    contentPreview,
    ``,
    `[Deleted ID: ${params.noteId}]`,
  ].join('\n');
}

export async function noteCreateRevision(client: TrilliumClient, args: unknown): Promise<string> {
  const params = NoteCreateRevisionSchema.parse(args);

  await client.createNoteRevision(params.noteId);

  return [
    `Note revision created successfully!`,
    ``,
    `A snapshot of the current note state has been saved.`,
    ``,
    `[Note ID: ${params.noteId}]`,
  ].join('\n');
}

export async function noteReorder(client: TrilliumClient, args: unknown): Promise<string> {
  const params = NoteReorderSchema.parse(args);

  // Fetch the note to get its branches
  const note = await client.getNote(params.noteId);

  if (!note.parentBranchIds || note.parentBranchIds.length === 0) {
    throw new Error(`Note "${note.title}" (${params.noteId}) has no parent branches`);
  }

  // Find the branch that connects this note to the specified parent
  let targetBranchId: string | undefined;
  for (const branchId of note.parentBranchIds) {
    const branch = await client.getBranch(branchId);
    if (branch.parentNoteId === params.parentNoteId) {
      targetBranchId = branchId;
      break;
    }
  }

  if (!targetBranchId) {
    const availableParents = note.parentNoteIds?.join(', ') || 'none';
    throw new Error(
      `Note "${note.title}" (${params.noteId}) is not a child of parent ${params.parentNoteId}. ` +
      `Available parents: ${availableParents}`
    );
  }

  const branch = await client.getBranch(targetBranchId);

  // Fetch all sibling branches to calculate position
  const parent = await client.getNote(params.parentNoteId);

  if (!parent.childBranchIds || parent.childBranchIds.length === 0) {
    throw new Error(`Parent note ${params.parentNoteId} has no child branches`);
  }

  const siblingBranches = await Promise.all(
    parent.childBranchIds.map(branchId => client.getBranch(branchId))
  );

  // Sort siblings by current position to understand the current order
  const sortedSiblings = [...siblingBranches].sort((a, b) => a.notePosition - b.notePosition);

  // Calculate the new position
  let newPosition: number;
  const position = params.position;

  if (position === 'first') {
    // Move to beginning (before first sibling)
    const firstPos = sortedSiblings[0]?.notePosition ?? 10;
    newPosition = firstPos - 10;
  } else if (position === 'last') {
    // Move to end (after last sibling)
    const lastPos = sortedSiblings[sortedSiblings.length - 1]?.notePosition ?? 0;
    newPosition = lastPos + 10;
  } else if (typeof position === 'number') {
    // Numeric position means "make this the Nth child" (1-indexed)
    // We need to place it so it becomes the Nth item when sorted
    const desiredIndex = position - 1; // Convert to 0-indexed

    if (desiredIndex <= 0) {
      // Position 1 or less - place at beginning
      const firstPos = sortedSiblings[0]?.notePosition ?? 10;
      newPosition = firstPos - 10;
    } else if (desiredIndex >= sortedSiblings.length) {
      // Position beyond end - place at end
      const lastPos = sortedSiblings[sortedSiblings.length - 1]?.notePosition ?? 0;
      newPosition = lastPos + 10;
    } else {
      // Place between siblings to achieve desired position
      // We want to be BEFORE the sibling currently at desiredIndex
      const beforeSibling = sortedSiblings[desiredIndex];
      const afterSibling = sortedSiblings[desiredIndex - 1];

      // Calculate midpoint position
      const beforePos = beforeSibling.notePosition;
      const afterPos = afterSibling?.notePosition ?? (beforePos - 20);
      newPosition = Math.floor((beforePos + afterPos) / 2);

      // If positions are adjacent, we need to create space
      if (newPosition === beforePos || newPosition === afterPos) {
        newPosition = beforePos - 5;
      }
    }
  } else if (typeof position === 'string') {
    // Handle before:<noteId> or after:<noteId>
    if (position.startsWith('before:')) {
      const targetNoteId = position.substring(7);
      const targetSibling = siblingBranches.find(s => s.noteId === targetNoteId);
      if (!targetSibling) {
        const siblingIds = siblingBranches.map(s => s.noteId).join(', ');
        throw new Error(
          `Target note ${targetNoteId} not found in siblings. ` +
          `Available siblings: ${siblingIds}`
        );
      }
      newPosition = targetSibling.notePosition - 5;
    } else if (position.startsWith('after:')) {
      const targetNoteId = position.substring(6);
      const targetSibling = siblingBranches.find(s => s.noteId === targetNoteId);
      if (!targetSibling) {
        const siblingIds = siblingBranches.map(s => s.noteId).join(', ');
        throw new Error(
          `Target note ${targetNoteId} not found in siblings. ` +
          `Available siblings: ${siblingIds}`
        );
      }
      newPosition = targetSibling.notePosition + 5;
    } else {
      throw new Error(
        `Invalid position string: "${position}". ` +
        `Must be 'first', 'last', 'before:<noteId>', or 'after:<noteId>'`
      );
    }
  } else {
    throw new Error(`Invalid position type: ${typeof position}`);
  }

  // Show BEFORE state
  const branchBefore = await client.getBranch(targetBranchId);

  // Update the branch with the new position
  await client.updateBranch(branch.branchId, { notePosition: newPosition });

  // CRITICAL: Refresh ordering to trigger Trilium to actually apply the position change
  await client.refreshNoteOrdering(params.parentNoteId);

  // VERIFY: Re-fetch to confirm change
  const branchAfter = await client.getBranch(targetBranchId);
  const parentAfter = await client.getNote(params.parentNoteId);

  // Get updated sibling order
  const siblingsAfter = await Promise.all(
    parentAfter.childBranchIds!.map(id => client.getBranch(id))
  );
  siblingsAfter.sort((a, b) => a.notePosition - b.notePosition);

  const siblingTitles = await Promise.all(
    siblingsAfter.map(async b => {
      const n = await client.getNote(b.noteId);
      const marker = b.noteId === params.noteId ? ' <- MOVED' : '';
      return `  ${b.notePosition.toString().padStart(3, ' ')}: "${n.title}"${marker}`;
    })
  );

  return [
    `Reordered "${note.title}"`,
    ``,
    `**Position:**`,
    `  Before: ${branchBefore.notePosition}`,
    `  After:  ${branchAfter.notePosition}`,
    ``,
    `**New sibling order:**`,
    ...siblingTitles,
    ``,
    `[Note: ${params.noteId}]`,
    `[Branch: ${branchAfter.branchId}]`,
  ].join('\n');
}

export async function noteListChildren(client: TrilliumClient, args: unknown): Promise<string> {
  const params = NoteListChildrenSchema.parse(args);

  // Fetch parent note to get child branches
  const parent = await client.getNote(params.noteId);

  if (!parent.childBranchIds || parent.childBranchIds.length === 0) {
    return `Note "${parent.title}" has no children.`;
  }

  // Fetch all child branches and notes
  const childBranches = await Promise.all(
    parent.childBranchIds.map(branchId => client.getBranch(branchId))
  );

  const childNotes = await Promise.all(
    childBranches.map(branch => client.getNote(branch.noteId))
  );

  // Create array with all info
  const children = childBranches.map((branch, index) => ({
    branchId: branch.branchId,
    noteId: branch.noteId,
    title: childNotes[index].title,
    position: branch.notePosition,
    created: childNotes[index].dateCreated,
    modified: childNotes[index].dateModified,
  }));

  // Sort based on sortBy parameter
  switch (params.sortBy) {
    case 'title':
      children.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'created':
      children.sort((a, b) => a.created.localeCompare(b.created));
      break;
    case 'modified':
      children.sort((a, b) => a.modified.localeCompare(b.modified));
      break;
    case 'position':
    default:
      children.sort((a, b) => a.position - b.position);
      break;
  }

  // Format output
  const output = [
    `Children of "${parent.title}" (${children.length} total)`,
    `Sorted by: ${params.sortBy}`,
    ``,
  ];

  children.forEach((child, index) => {
    output.push(
      `${index + 1}. "${child.title}"`,
      `   ID: ${child.noteId}`,
      `   Position: ${child.position}`,
      `   Modified: ${child.modified}`,
      ``
    );
  });

  output.push(`[Parent ID: ${params.noteId}]`);

  return output.join('\n');
}

export async function noteReorderChildren(client: TrilliumClient, args: unknown): Promise<string> {
  const params = NoteReorderChildrenSchema.parse(args);

  // Fetch parent note
  const parent = await client.getNote(params.parentNoteId);

  if (!parent.childBranchIds || parent.childBranchIds.length === 0) {
    return `Note "${parent.title}" has no children to reorder.`;
  }

  // Fetch BEFORE state - all child branches and notes
  const childBranches = await Promise.all(
    parent.childBranchIds.map(branchId => client.getBranch(branchId))
  );

  const childNotes = await Promise.all(
    childBranches.map(branch => client.getNote(branch.noteId))
  );

  // Create array with all info
  const children = childBranches.map((branch, index) => ({
    branchId: branch.branchId,
    noteId: branch.noteId,
    title: childNotes[index].title,
    position: branch.notePosition,
    created: childNotes[index].dateCreated,
    modified: childNotes[index].dateModified,
  }));

  // Save BEFORE order (by position)
  const beforeOrder = [...children].sort((a, b) => a.position - b.position);

  // Sort based on sortBy parameter
  switch (params.sortBy) {
    case 'title':
      children.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'created':
      children.sort((a, b) => a.created.localeCompare(b.created));
      break;
    case 'modified':
      children.sort((a, b) => a.modified.localeCompare(b.modified));
      break;
  }

  // Assign new positions: 10, 20, 30, 40...
  // This ensures proper ordering in Trilium
  console.error(`[notes_reorder_children] Updating ${children.length} branches...`);
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    // Find the branch connecting this note to the parent
    const branch = childBranches.find(b => b.noteId === child.noteId);
    if (!branch) {
      console.error(`[notes_reorder_children] WARNING: Branch not found for note ${child.noteId}`);
      continue;
    }

    // Assign position based on index in sorted array
    const newPosition = (i + 1) * 10;
    const oldPosition = branch.notePosition;
    console.error(`[notes_reorder_children] Branch ${branch.branchId}: "${child.title}" ${oldPosition} -> ${newPosition}`);

    try {
      await client.updateBranch(branch.branchId, { notePosition: newPosition });
    } catch (error) {
      console.error(`[notes_reorder_children] ERROR updating branch ${branch.branchId}:`, error);
      throw error;
    }
  }

  // CRITICAL: Refresh ordering to apply changes
  console.error(`[notes_reorder_children] Calling refreshNoteOrdering for parent ${params.parentNoteId}...`);
  try {
    await client.refreshNoteOrdering(params.parentNoteId);
    console.error(`[notes_reorder_children] refreshNoteOrdering completed`);
  } catch (error) {
    console.error(`[notes_reorder_children] ERROR in refreshNoteOrdering:`, error);
    throw error;
  }

  // VERIFY: Re-fetch to show AFTER state
  const parentAfter = await client.getNote(params.parentNoteId);
  const childBranchesAfter = await Promise.all(
    parentAfter.childBranchIds!.map(id => client.getBranch(id))
  );
  childBranchesAfter.sort((a, b) => a.notePosition - b.notePosition);

  const childNotesAfter = await Promise.all(
    childBranchesAfter.map(b => client.getNote(b.noteId))
  );

  // Format output
  const output = [
    `Reordered children of "${parent.title}" by ${params.sortBy}`,
    ``,
    `**Before (by position):**`,
  ];

  beforeOrder.forEach((child, index) => {
    output.push(`  ${index + 1}. "${child.title}"`);
  });

  output.push(``, `**After (by ${params.sortBy}):**`);

  childNotesAfter.forEach((note, index) => {
    output.push(`  ${index + 1}. "${note.title}"`);
  });

  output.push(``, `Total: ${children.length} children reordered`, `[Parent: ${params.parentNoteId}]`);

  return output.join('\n');
}

// ============================================================================
// TOOL IMPLEMENTATIONS - NOTES EDITING (Advanced Content Operations)
// ============================================================================

export async function noteEdit(client: TrilliumClient, args: unknown): Promise<string> {
  const params = NoteEditSchema.parse(args);

  // Fetch the current note and content
  const note = await client.getNote(params.noteId);
  const currentContent = await client.getNoteContent(params.noteId);
  const mime = note.mime || 'text/html';
  const format = detectContentFormat(mime);

  console.error(`[notes_edit] Editing note ${params.noteId}, format: ${format}, mime: ${mime}`);

  let newContent: string;
  let matchStrategy: string = 'unknown';

  // Strategy based on format
  if (format === 'html') {
    // HTML note - use hybrid matching
    console.error(`[notes_edit] HTML format - using hybrid matching`);
    console.error(`[notes_edit] Current content length: ${currentContent.length}`);
    console.error(`[notes_edit] Current content preview: ${currentContent.substring(0, 200)}`);
    console.error(`[notes_edit] Old string to find: ${params.old_string.substring(0, 100)}`);
    console.error(`[notes_edit] New string to replace: ${params.new_string.substring(0, 100)}`);

    const matchResult = hybridMatch(currentContent, params.old_string, params.new_string);

    console.error(`[notes_edit] Match result - success: ${matchResult.success}, strategy: ${matchResult.strategy}`);
    if (matchResult.success) {
      console.error(`[notes_edit] New content length: ${matchResult.result?.length}`);
      console.error(`[notes_edit] New content preview: ${matchResult.result?.substring(0, 200)}`);
    }

    if (!matchResult.success) {
      // Provide helpful error with context
      const preview = currentContent.length > 500
        ? currentContent.substring(0, 500) + '...'
        : currentContent;

      return [
        `Could not find the specified text to replace.`,
        ``,
        `**Error:** ${matchResult.error}`,
        ``,
        `**What you searched for:**`,
        `\`\`\``,
        params.old_string,
        `\`\`\``,
        ``,
        `**Note preview (first 500 chars):**`,
        `\`\`\``,
        preview,
        `\`\`\``,
        ``,
        `**Try:**`,
        `1. Use notes_search_content to find the exact text`,
        `2. Use notes_get_lines to read specific sections`,
        `3. Make old_string more specific`,
        `4. Use replace_all: true if the text appears multiple times`,
      ].join('\n');
    }

    newContent = matchResult.result!;
    matchStrategy = matchResult.strategy!;
  } else {
    // Markdown or plain text - direct matching
    if (params.replace_all) {
      // Replace all occurrences
      if (!currentContent.includes(params.old_string)) {
        return `Error: old_string not found in note content.\n\nSearched for: "${params.old_string}"`;
      }
      newContent = currentContent.split(params.old_string).join(params.new_string);
      matchStrategy = 'replace-all';
    } else {
      // Replace single occurrence (safety check)
      const firstIndex = currentContent.indexOf(params.old_string);
      if (firstIndex === -1) {
        return `Error: old_string not found in note content.\n\nSearched for: "${params.old_string}"`;
      }

      const lastIndex = currentContent.lastIndexOf(params.old_string);
      if (firstIndex !== lastIndex) {
        return [
          `Error: old_string appears multiple times in the note.`,
          ``,
          `For safety, when replacing text that appears multiple times, you must:`,
          `1. Set replace_all: true to replace all occurrences, OR`,
          `2. Make old_string more specific to match only one occurrence`,
          ``,
          `Found ${currentContent.split(params.old_string).length - 1} occurrences.`,
        ].join('\n');
      }

      newContent = currentContent.replace(params.old_string, params.new_string);
      matchStrategy = 'exact-single';
    }
  }

  // Validate the change
  const validation = validateContentChange(currentContent, newContent, 'edit');
  if (validation.warnings.length > 0) {
    console.error('[notes_edit] Validation warnings:', validation.warnings);
  }

  console.error(`[notes_edit] Updating note content...`);
  console.error(`[notes_edit] Size change: ${currentContent.length} -> ${newContent.length}`);

  // Update the note
  await client.updateNoteContent(params.noteId, newContent);

  // VERIFY: Re-fetch to confirm the change was applied
  console.error(`[notes_edit] Verifying update...`);
  const verifiedContent = await client.getNoteContent(params.noteId);
  console.error(`[notes_edit] Verified content length: ${verifiedContent.length}`);
  console.error(`[notes_edit] Content actually changed: ${verifiedContent !== currentContent}`);

  if (verifiedContent === currentContent) {
    console.error(`[notes_edit] ERROR: Content did not change on server!`);
  }

  // Show context around the change (like Claude Code)
  // For HTML notes, convert to Markdown for better readability
  const displayContent = format === 'html'
    ? convertHTMLToMarkdown(verifiedContent)
    : verifiedContent;

  const contextDisplay = showEditContext(displayContent, params.new_string);

  const output = [
    `Edited note "${note.title}"`,
    ``,
  ];

  // Show context if available
  if (contextDisplay) {
    output.push('**Context around change:**');
    output.push('```');
    output.push(contextDisplay);
    output.push('```');
    output.push('');
  }

  output.push(
    `Match strategy: ${matchStrategy}`,
    `Format: ${format}`,
    `Size: ${currentContent.length} -> ${newContent.length} characters`
  );

  if (verifiedContent === currentContent) {
    output.push('**WARNING: Server content unchanged!**');
  }

  if (validation.warnings.length > 0) {
    output.push('', '**Warnings:**');
    validation.warnings.forEach(w => output.push(`- ${w}`));
  }

  output.push('', `[ID: ${params.noteId}]`);

  return output.join('\n');
}

export async function notePrepend(client: TrilliumClient, args: unknown): Promise<string> {
  const params = NotePrependSchema.parse(args);

  // Fetch current content and note metadata
  const note = await client.getNote(params.noteId);
  const currentContent = await client.getNoteContent(params.noteId);
  const mime = note.mime || 'text/html';
  const format = detectContentFormat(mime);

  console.error(`[notes_prepend] Prepending to note ${params.noteId}, format: ${format}`);

  // Format the new content for the note's MIME type
  const formattedNewContent = formatContentForMime(params.content, mime);

  // Combine with separator
  const separator = format === 'html' ? '\n\n' : '\n\n';
  const updatedContent = formattedNewContent + separator + currentContent;

  // Validate
  const validation = validateContentChange(currentContent, updatedContent, 'prepend');
  if (validation.warnings.length > 0) {
    console.error('[notes_prepend] Validation warnings:', validation.warnings);
  }

  // Update note
  await client.updateNoteContent(params.noteId, updatedContent);

  // Show preview of what was added
  const addedPreview = formattedNewContent.length > 100
    ? formattedNewContent.substring(0, 100) + '...'
    : formattedNewContent;

  return [
    `Prepended content to "${note.title}"`,
    ``,
    `**Added to beginning:**`,
    addedPreview,
    ``,
    `Format: ${format}`,
    `Size: ${currentContent.length} -> ${updatedContent.length} characters (+${formattedNewContent.length})`,
    ``,
    `[ID: ${params.noteId}]`,
  ].join('\n');
}

export async function noteAppend(client: TrilliumClient, args: unknown): Promise<string> {
  const params = NoteAppendSchema.parse(args);

  // Fetch current content and note metadata
  const note = await client.getNote(params.noteId);
  const currentContent = await client.getNoteContent(params.noteId);
  const mime = note.mime || 'text/html';
  const format = detectContentFormat(mime);

  console.error(`[notes_append] Appending to note ${params.noteId}, format: ${format}`);

  // Format the new content for the note's MIME type
  const formattedNewContent = formatContentForMime(params.content, mime);

  // Combine with separator
  const separator = format === 'html' ? '\n\n' : '\n\n';
  const updatedContent = currentContent + separator + formattedNewContent;

  // Validate
  const validation = validateContentChange(currentContent, updatedContent, 'append');
  if (validation.warnings.length > 0) {
    console.error('[notes_append] Validation warnings:', validation.warnings);
  }

  // Update note
  await client.updateNoteContent(params.noteId, updatedContent);

  // Show preview of what was added
  const addedPreview = formattedNewContent.length > 100
    ? formattedNewContent.substring(0, 100) + '...'
    : formattedNewContent;

  return [
    `Appended content to "${note.title}"`,
    ``,
    `**Added to end:**`,
    addedPreview,
    ``,
    `Format: ${format}`,
    `Size: ${currentContent.length} -> ${updatedContent.length} characters (+${formattedNewContent.length})`,
    ``,
    `[ID: ${params.noteId}]`,
  ].join('\n');
}

export async function noteGrep(client: TrilliumClient, args: unknown): Promise<string> {
  const params = NoteGrepSchema.parse(args);

  // Fetch note content
  const note = await client.getNote(params.noteId);
  const content = await client.getNoteContent(params.noteId);
  const mime = note.mime || 'text/html';
  const format = detectContentFormat(mime);

  console.error(`[notes_grep] Searching in note ${params.noteId}, format: ${format}`);

  // Search in content
  const results = searchInContent(content, params.pattern, params.context_lines);

  if (results.length === 0) {
    return [
      `No matches found for pattern: "${params.pattern}"`,
      ``,
      `Note: ${note.title}`,
      `Format: ${format.toUpperCase()}`,
      `Total lines: ${content.split('\n').length}`,
      ``,
      `[Note ID: ${params.noteId}]`,
    ].join('\n');
  }

  // Format results
  const output = [
    `Found ${results.length} match(es) for: "${params.pattern}"`,
    ``,
    `Note: ${note.title}`,
    `Format: ${format.toUpperCase()}`,
    ``,
  ];

  results.forEach((result, index) => {
    output.push(`--- Match ${index + 1} at line ${result.lineNumber} ---`);
    output.push('```');
    result.context.forEach((line, i) => {
      const isMatch = i === params.context_lines; // The middle line is the match
      const prefix = isMatch ? '>>> ' : '    ';
      output.push(`${prefix}${line}`);
    });
    output.push('```');
    output.push('');
  });

  output.push(`[Note ID: ${params.noteId}]`);

  return output.join('\n');
}

export async function noteGetLines(client: TrilliumClient, args: unknown): Promise<string> {
  const params = NoteGetLinesSchema.parse(args);

  // Fetch note content
  const note = await client.getNote(params.noteId);
  const content = await client.getNoteContent(params.noteId);
  const mime = note.mime || 'text/html';
  const format = detectContentFormat(mime);

  console.error(`[notes_get_lines] Reading lines from note ${params.noteId}, format: ${format}`);

  // For HTML notes, convert to Markdown for better readability
  const displayContent = format === 'html' ? convertHTMLToMarkdown(content) : content;

  // Extract lines
  const extraction = extractLines(displayContent, params.start_line, params.end_line);

  const output = [
    `**${note.title}**`,
    ``,
    `Showing lines ${extraction.actualStart}-${extraction.actualEnd} of ${extraction.totalLines}`,
    `Format: ${format.toUpperCase()}`,
  ];

  if (format === 'html') {
    output.push(`(Converted to Markdown for readability)`);
  }

  output.push(
    ``,
    `\`\`\``,
    extraction.lines,
    `\`\`\``,
    ``,
    `[Note ID: ${params.noteId}]`
  );

  return output.join('\n');
}

// ============================================================================
// TOOL IMPLEMENTATIONS - BRANCHES
// ============================================================================


// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const noteTools = [
  {
    name: 'notes_search',
    description:
      'Search across ALL notes using Trilium query language. ' +
      'IMPORTANT: Use fastSearch: false (default) to search note CONTENT, or fastSearch: true for titles/metadata only. ' +
      'Supports fulltext search (e.g., "meeting notes"), exact match (e.g., \'"Project Plan"\'), ' +
      'label filters (e.g., "notes #important"), and advanced queries (e.g., "#year = 2024"). ' +
      'WHEN TO USE: Finding notes that mention a topic. ' +
      'EXAMPLE: Find all notes containing "strategic question" → use fastSearch: false. ' +
      'Default limit is 20 notes.',
    inputSchema: NotesSearchJsonSchema,
  },
  {
    name: 'note_get',
    description:
      'Get a specific note by noteId. Returns complete metadata (title, type, dates, parent/child IDs) AND full content. ' +
      'WHEN TO USE: After notes_search to read full note details, or when you have a noteId and need content. ' +
      'WORKFLOW: notes_search (find notes) → note_get (read full content) → note_edit/note_append (modify). ' +
      'For large notes, use note_get_lines to read specific sections instead.',
    inputSchema: NoteGetJsonSchema,
  },
  {
    name: 'note_list_children',
    description:
      'List all children of a note with sorting options. ' +
      'Returns structured, easy-to-parse list of child notes with IDs, titles, and positions. ' +
      'Supports sorting by: position (tree order), title (alphabetical), created, modified. ' +
      'Much easier than parsing notes_get output. ' +
      'WORKFLOW: Use this to see children, then notes_reorder_children to sort them permanently.',
    inputSchema: NoteListChildrenJsonSchema,
  },
  {
    name: 'note_create',
    description:
      'Create a new note under a parent. Write Markdown naturally (# headings, **bold**, lists) - auto-converted to HTML for text notes. ' +
      'Returns full note metadata (noteId, title, content, dates, parent/child IDs) after creation. ' +
      'WHEN TO USE: Creating meeting notes, documentation, project notes, journal entries. ' +
      'WORKFLOW: (1) Use notes_search to find parent note, (2) note_create with parentNoteId, (3) Returns created note with new noteId. ' +
      'TIP: For code notes, set type: "code" and mime: "text/x-python" (or other language).',
    inputSchema: NoteCreateJsonSchema,
  },
  {
    name: 'note_overwrite',
    description:
      'Completely replace a note\'s title and/or content. Shows before/after comparison for verification. ' +
      'IMPORTANT: This REPLACES entire content - for surgical edits, use note_edit instead. ' +
      'WHEN TO USE: Rewriting entire note, changing note title, converting format. ' +
      'WHEN NOT TO USE: Small edits (use note_edit), adding content (use note_prepend/note_append). ' +
      'WORKFLOW: (1) note_get to see current content, (2) note_overwrite with new content, (3) Verify before/after output. ' +
      'Write Markdown - auto-converted to HTML for HTML notes.',
    inputSchema: NoteOverwriteJsonSchema,
  },
  {
    name: 'note_delete',
    description:
      'Permanently delete a note by noteId. Shows full note details (title, content preview) before deletion for verification. ' +
      'WARNING: This is PERMANENT. The note and its content will be deleted. Child notes are NOT deleted (they become orphaned). ' +
      'WHEN TO USE: Removing obsolete notes, cleaning up test notes, deleting duplicates. ' +
      'WORKFLOW: (1) note_get to verify you have the right note, (2) note_delete, (3) Review deletion confirmation. ' +
      'SAFETY TIP: Use note_create_revision before deleting important notes to create a backup snapshot.',
    inputSchema: NoteDeleteJsonSchema,
  },
  {
    name: 'note_create_revision',
    description:
      'Create a revision (snapshot) of a note\'s current content and metadata. Like a "save point" in version control. ' +
      'WHEN TO USE: Before major edits, before deletion (backup), before refactoring, or to mark milestones. ' +
      'WORKFLOW: (1) note_create_revision to save current state, (2) Make changes with note_edit/note_overwrite, (3) Can restore from revision later in Trilium UI. ' +
      'Returns revision details (revisionId, utcDateModified). Trilium automatically creates revisions periodically, but this lets you create them on-demand. ' +
      'TIP: Create a revision before using note_delete on important notes.',
    inputSchema: NoteCreateRevisionJsonSchema,
  },
  {
    name: 'note_reorder',
    description:
      'Reorder a note within its parent (change position in the tree). ' +
      'Supports positions: "first", "last", number (1, 2, 3...), or relative ("before:<noteId>", "after:<noteId>"). ' +
      'Shows before/after position and full sibling order to verify the change. ' +
      'To reorder multiple notes, call this tool multiple times.',
    inputSchema: NoteReorderJsonSchema,
  },
  {
    name: 'note_reorder_children',
    description:
      'Sort all children of a note in one operation (alphabetically, by created date, or by modified date). ' +
      'Shows before/after order. Much more efficient than calling notes_reorder multiple times. ' +
      'WORKFLOW: Use notes_list_children first to see current order, then notes_reorder_children to sort.',
    inputSchema: NoteReorderChildrenJsonSchema,
  },
  {
    name: 'note_edit',
    description:
      'Find and replace specific text (like Claude Code\'s Edit tool). ' +
      'Shows context around change with line numbers so you can verify correctness. ' +
      'For surgical edits without replacing entire content. Write Markdown - auto-converted for HTML notes. ' +
      'Safety: old_string must be unique (or use replace_all: true). ' +
      'WORKFLOW: (1) notes_grep to find exact text, (2) notes_edit to change it, ' +
      '(3) CHECK the context output to verify the edit looks correct.',
    inputSchema: NoteEditJsonSchema,
  },
  {
    name: 'note_prepend',
    description:
      'Add content at the beginning of a note. Shows what was added and size change. ' +
      'WORKFLOW: Use notes_get_lines to check first few lines, then notes_prepend to add header.',
    inputSchema: NotePrependJsonSchema,
  },
  {
    name: 'note_append',
    description:
      'Add content at the end of a note. Shows what was added and size change. ' +
      'WORKFLOW: Use notes_get_lines with end range to check last lines, then notes_append to add footer.',
    inputSchema: NoteAppendJsonSchema,
  },
  {
    name: 'note_grep',
    description:
      'Search WITHIN a specific note\'s content (like grep/ripgrep). ' +
      'Returns all matches with surrounding context lines. Case-insensitive. ' +
      'WHEN TO USE: After finding a note with notes_search, use this to explore its content in detail. ' +
      'WORKFLOW: notes_search (find notes) → notes_grep (explore content) → notes_edit (change it).',
    inputSchema: NoteGrepJsonSchema,
  },
  {
    name: 'note_get_lines',
    description:
      'Read specific line ranges from a note (like head/tail for notes). Returns only the lines you request, not entire content. ' +
      'Perfect for large notes: preview first 50 lines, check last 20 lines, or read a specific section. ' +
      'For HTML notes, automatically converts to Markdown for better readability. Line numbers are 1-indexed (first line is line 1). ' +
      'WHEN TO USE: Previewing large notes, checking headers/footers, reading specific sections. ' +
      'WORKFLOW: (1) note_get_lines start:1 end:50 to preview, (2) note_grep to find specific text, (3) note_get_lines to read that section. ' +
      'EXAMPLES: First 20 lines → start:1 end:20. Last 10 lines → start:-10 end:-1. Middle section → start:100 end:200.',
    inputSchema: NoteGetLinesJsonSchema,
  },
];
