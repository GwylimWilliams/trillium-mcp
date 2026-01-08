/**
 * Attachment Tools for Trillium MCP
 * Manage file attachments, images, and documents
 */

import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import type { TrilliumClient } from '../client.js';
import { getExportsDirectory, generateFilename } from './helpers.js';

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const AttachmentsGetSchema = z.object({
  attachmentId: z.string().min(1).describe('Attachment ID to retrieve'),
});

export const AttachmentsGetContentSchema = z.object({
  attachmentId: z.string().min(1).describe('Attachment ID to get content from'),
});

export const AttachmentsCreateSchema = z.object({
  ownerId: z.string().min(1).describe('Note ID that owns this attachment'),
  role: z.string().describe('Attachment role (e.g., "image", "file")'),
  mime: z.string().describe('MIME type (e.g., "image/png", "application/pdf")'),
  title: z.string().min(1).describe('Attachment title/filename'),
  content: z.string().describe('Base64-encoded attachment content'),
  position: z.number().optional().describe('Position among attachments'),
});

export const AttachmentsUpdateSchema = z.object({
  attachmentId: z.string().min(1).describe('Attachment ID to update'),
  role: z.string().optional().describe('New attachment role'),
  mime: z.string().optional().describe('New MIME type'),
  title: z.string().optional().describe('New title/filename'),
  position: z.number().optional().describe('New position among attachments'),
});

export const AttachmentsDeleteSchema = z.object({
  attachmentId: z.string().min(1).describe('Attachment ID to delete'),
});

export const AttachmentsUpdateContentSchema = z.object({
  attachmentId: z.string().min(1).describe('Attachment ID to update content'),
  content: z.string().describe('Base64-encoded new content'),
});

// ============================================================================
// JSON SCHEMAS (for MCP)
// ============================================================================

const AttachmentsGetJsonSchema = {
  type: 'object' as const,
  properties: {
    attachmentId: {
      type: 'string' as const,
      description: 'Attachment ID to retrieve',
    },
  },
  required: ['attachmentId'],
};

const AttachmentsGetContentJsonSchema = {
  type: 'object' as const,
  properties: {
    attachmentId: {
      type: 'string' as const,
      description: 'Attachment ID to get content from',
    },
  },
  required: ['attachmentId'],
};

const AttachmentsCreateJsonSchema = {
  type: 'object' as const,
  properties: {
    ownerId: {
      type: 'string' as const,
      description: 'Note ID that owns this attachment',
    },
    role: {
      type: 'string' as const,
      description: 'Attachment role (e.g., "image", "file")',
    },
    mime: {
      type: 'string' as const,
      description: 'MIME type (e.g., "image/png", "application/pdf")',
    },
    title: {
      type: 'string' as const,
      description: 'Attachment title/filename',
    },
    content: {
      type: 'string' as const,
      description: 'Base64-encoded attachment content',
    },
    position: {
      type: 'number' as const,
      description: 'Position among attachments',
    },
  },
  required: ['ownerId', 'role', 'mime', 'title', 'content'],
};

const AttachmentsUpdateJsonSchema = {
  type: 'object' as const,
  properties: {
    attachmentId: {
      type: 'string' as const,
      description: 'Attachment ID to update',
    },
    role: {
      type: 'string' as const,
      description: 'New attachment role',
    },
    mime: {
      type: 'string' as const,
      description: 'New MIME type',
    },
    title: {
      type: 'string' as const,
      description: 'New title/filename',
    },
    position: {
      type: 'number' as const,
      description: 'New position among attachments',
    },
  },
  required: ['attachmentId'],
};

const AttachmentsDeleteJsonSchema = {
  type: 'object' as const,
  properties: {
    attachmentId: {
      type: 'string' as const,
      description: 'Attachment ID to delete',
    },
  },
  required: ['attachmentId'],
};

const AttachmentsUpdateContentJsonSchema = {
  type: 'object' as const,
  properties: {
    attachmentId: {
      type: 'string' as const,
      description: 'Attachment ID to update content',
    },
    content: {
      type: 'string' as const,
      description: 'Base64-encoded new content',
    },
  },
  required: ['attachmentId', 'content'],
};

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

export async function attachmentsGet(client: TrilliumClient, args: unknown): Promise<string> {
  const params = AttachmentsGetSchema.parse(args);

  const attachment = await client.getAttachment(params.attachmentId);

  return [
    `**${attachment.title}**`,
    ``,
    `MIME: ${attachment.mime}`,
    `Role: ${attachment.role}`,
    `Size: ${attachment.contentLength || 0} bytes`,
    `Position: ${attachment.position}`,
    `Modified: ${attachment.utcDateModified}`,
    ``,
    `[Attachment ID: ${attachment.attachmentId}]`,
    `[Owner: ${attachment.ownerId}]`,
  ].join('\n');
}

export async function attachmentsGetContent(client: TrilliumClient, args: unknown): Promise<string> {
  const params = AttachmentsGetContentSchema.parse(args);

  // Get attachment metadata first to get title and MIME type
  const attachment = await client.getAttachment(params.attachmentId);
  const content = await client.getAttachmentContent(params.attachmentId);

  // Convert to buffer
  const buffer = Buffer.from(content);

  // Determine file extension from MIME type or title
  let extension = '';
  if (attachment.title.includes('.')) {
    extension = '.' + attachment.title.split('.').pop();
  } else {
    // Common MIME type to extension mapping
    const mimeExtensions: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/gif': '.gif',
      'image/svg+xml': '.svg',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'text/html': '.html',
      'application/json': '.json',
      'application/zip': '.zip',
    };
    extension = mimeExtensions[attachment.mime] || '.bin';
  }

  // Save to filesystem
  const exportsDir = await getExportsDirectory();
  const filename = generateFilename('attachment', params.attachmentId, extension);
  const filepath = path.join(exportsDir, filename);

  await fs.promises.writeFile(filepath, buffer);

  const sizeKB = (buffer.length / 1024).toFixed(2);

  return [
    `Attachment content retrieved and saved`,
    ``,
    `Title: ${attachment.title}`,
    `MIME: ${attachment.mime}`,
    `Size: ${sizeKB} KB`,
    ``,
    `**File saved to:**`,
    filepath,
    ``,
    `You can find the attachment file at the path above.`,
    ``,
    `[Attachment ID: ${params.attachmentId}]`,
  ].join('\n');
}

export async function attachmentsCreate(client: TrilliumClient, args: unknown): Promise<string> {
  const params = AttachmentsCreateSchema.parse(args);

  // Convert base64 to Buffer
  const contentBuffer = Buffer.from(params.content, 'base64');

  const attachment = await client.createAttachment({
    ownerId: params.ownerId,
    role: params.role,
    mime: params.mime,
    title: params.title,
    content: contentBuffer,
    position: params.position,
  });

  return [
    `Attachment created successfully!`,
    ``,
    `Title: ${attachment.title}`,
    `MIME: ${attachment.mime}`,
    `Role: ${attachment.role}`,
    `Size: ${attachment.contentLength || 0} bytes`,
    ``,
    `[Attachment ID: ${attachment.attachmentId}]`,
  ].join('\n');
}

export async function attachmentsUpdate(client: TrilliumClient, args: unknown): Promise<string> {
  const params = AttachmentsUpdateSchema.parse(args);

  const updates: Partial<{ role: string; mime: string; title: string; position: number }> = {};
  if (params.role !== undefined) updates.role = params.role;
  if (params.mime !== undefined) updates.mime = params.mime;
  if (params.title !== undefined) updates.title = params.title;
  if (params.position !== undefined) updates.position = params.position;

  const attachment = await client.updateAttachment(params.attachmentId, updates);

  return [
    `Attachment updated successfully!`,
    ``,
    `Title: ${attachment.title}`,
    `MIME: ${attachment.mime}`,
    `Role: ${attachment.role}`,
    ``,
    `[Attachment ID: ${attachment.attachmentId}]`,
  ].join('\n');
}

export async function attachmentsDelete(client: TrilliumClient, args: unknown): Promise<string> {
  const params = AttachmentsDeleteSchema.parse(args);

  await client.deleteAttachment(params.attachmentId);

  return `Attachment deleted: ${params.attachmentId}`;
}

export async function attachmentsUpdateContent(client: TrilliumClient, args: unknown): Promise<string> {
  const params = AttachmentsUpdateContentSchema.parse(args);

  // Convert base64 to Buffer
  const contentBuffer = Buffer.from(params.content, 'base64');

  await client.updateAttachmentContent(params.attachmentId, contentBuffer);

  const sizeKB = (contentBuffer.length / 1024).toFixed(2);

  return [
    `Attachment content updated successfully!`,
    ``,
    `New size: ${sizeKB} KB`,
    ``,
    `[Attachment ID: ${params.attachmentId}]`,
  ].join('\n');
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const attachmentTools = [
  {
    name: 'attachments_get',
    description:
      'Get attachment metadata by attachmentId. Attachments are files (images, PDFs, documents) attached to notes. ' +
      'Returns: title, MIME type, role, size, position, modification date, and owner note ID. Does NOT retrieve file content. ' +
      'WHEN TO USE: Check attachment details before downloading, verify attachment exists, inspect metadata before update/delete. ' +
      'WORKFLOW: (1) note_get to see attachment IDs, (2) attachments_get to inspect metadata, (3) attachments_get_content to download file. ' +
      'KEY CONCEPT: Metadata (title, size, MIME) vs content (actual file bytes). Use attachments_get for quick metadata checks without downloading large files.',
    inputSchema: AttachmentsGetJsonSchema,
  },
  {
    name: 'attachments_get_content',
    description:
      'Download attachment file and save to filesystem. Retrieves the actual file content (image, PDF, document, etc.) and automatically saves it to disk. ' +
      'Returns: File path where attachment was saved, plus metadata (title, MIME, size). ' +
      'WHEN TO USE: Download images from notes, retrieve PDF documents, get files for external processing, extract attachments for backup. ' +
      'WORKFLOW: (1) note_get to see attachment IDs, (2) attachments_get_content to download → file saved automatically. ' +
      'EXAMPLES: ' +
      'Download screenshot → Saved as /tmp/attachment_abc123_screenshot.png. ' +
      'Get PDF report → Saved as /tmp/attachment_xyz789_report.pdf. ' +
      'Extract all note attachments → Loop attachments_get_content for each ID. ' +
      'TIP: File extension auto-detected from MIME type or title. Files saved to temp directory with unique names.',
    inputSchema: AttachmentsGetContentJsonSchema,
  },
  {
    name: 'attachments_create',
    description:
      'Upload a file attachment to a note. Creates new attachment (image, PDF, document, etc.) attached to a note. Content must be base64-encoded. ' +
      'WHEN TO USE: Attach images to notes, upload PDFs, add documents, store files with notes, create image galleries. ' +
      'WORKFLOW: (1) notes_search to find owner note, (2) Read file and base64-encode, (3) attachments_create with ownerId and encoded content. ' +
      'PARAMETERS: ' +
      'ownerId = note ID that owns this attachment. ' +
      'role = "image" (inline images), "file" (general files), or custom. ' +
      'mime = "image/png", "application/pdf", "text/plain", etc. ' +
      'title = filename like "screenshot.png" or "report.pdf". ' +
      'content = base64-encoded file bytes. ' +
      'EXAMPLES: ' +
      'Attach image → role: "image", mime: "image/png", content: base64(imageBytes). ' +
      'Upload PDF → role: "file", mime: "application/pdf", title: "report.pdf". ' +
      'TIP: For LLMs, describe the file you want and use external tool to generate/encode it.',
    inputSchema: AttachmentsCreateJsonSchema,
  },
  {
    name: 'attachments_update',
    description:
      'Update attachment metadata (title, MIME type, role, position). Changes metadata only - does NOT update file content. ' +
      'WHEN TO USE: Rename attachment, fix MIME type, change role, reorder attachments. Use attachments_update_content to replace file content. ' +
      'WORKFLOW: (1) note_get to see attachment IDs, (2) attachments_get to check current metadata, (3) attachments_update to modify. ' +
      'EXAMPLES: ' +
      'Rename → title: "final_report.pdf" (was "draft.pdf"). ' +
      'Fix MIME → mime: "image/jpeg" (was wrong). ' +
      'Change role → role: "file" (was "image"). ' +
      'Reorder → position: 10 (move earlier in list). ' +
      'TIP: Only provide fields you want to change. Leave others unchanged.',
    inputSchema: AttachmentsUpdateJsonSchema,
  },
  {
    name: 'attachments_delete',
    description:
      'Delete an attachment permanently. Removes attachment and its file content from the note. The owner note remains intact. ' +
      'WHEN TO USE: Remove outdated files, delete duplicate attachments, clean up large files, remove sensitive documents. ' +
      'WORKFLOW: (1) note_get to see all attachment IDs, (2) attachments_get to verify which attachment to remove, (3) attachments_delete. ' +
      'EXAMPLES: ' +
      'Remove old screenshot → Delete attachment after extracting info. ' +
      'Clean up duplicates → Delete redundant image files. ' +
      'Remove sensitive file → Delete confidential document attachment. ' +
      'SAFETY: Deletion is permanent and cannot be undone. Always verify attachment ID with attachments_get first. Note content unchanged.',
    inputSchema: AttachmentsDeleteJsonSchema,
  },
  {
    name: 'attachments_update_content',
    description:
      'Replace attachment file content with new file. Updates the actual file bytes while keeping metadata (title, MIME, role) the same. ' +
      'WHEN TO USE: Update image with new version, replace PDF with updated report, refresh screenshot, swap file content. ' +
      'WORKFLOW: (1) Find attachment with note_get, (2) Prepare new file and base64-encode, (3) attachments_update_content with new content. ' +
      'EXAMPLES: ' +
      'Update screenshot → Replace old image with new screenshot (same title/MIME). ' +
      'Revise PDF → Upload new version of report.pdf. ' +
      'Refresh data → Replace CSV file with updated data. ' +
      'TIP: Use attachments_update to change title/MIME if needed. This only changes file bytes.',
    inputSchema: AttachmentsUpdateContentJsonSchema,
  },
];
