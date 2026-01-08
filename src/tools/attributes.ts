/**
 * Attribute Tools for Trillium MCP
 * Labels and relations for note metadata and linking
 */

import { z } from 'zod';
import type { TrilliumClient } from '../client.js';

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const AttributesGetSchema = z.object({
  attributeId: z.string().min(1).describe('Attribute ID to retrieve'),
});

export const AttributesCreateSchema = z.object({
  noteId: z.string().min(1).describe('Note ID to add attribute to'),
  type: z.enum(['label', 'relation']).describe('Attribute type'),
  name: z.string().min(1).describe('Attribute name'),
  value: z.string().describe('Attribute value (for relations, this is target noteId)'),
});

export const AttributesUpdateSchema = z.object({
  attributeId: z.string().min(1).describe('Attribute ID to update'),
  name: z.string().optional().describe('New attribute name'),
  value: z.string().optional().describe('New attribute value'),
  position: z.number().optional().describe('New position among attributes'),
  isInheritable: z.coerce.boolean().optional().describe('Whether attribute is inherited by children'),
});

export const AttributesDeleteSchema = z.object({
  attributeId: z.string().min(1).describe('Attribute ID to delete'),
});

// ============================================================================
// JSON SCHEMAS (for MCP)
// ============================================================================

const AttributesGetJsonSchema = {
  type: 'object' as const,
  properties: {
    attributeId: {
      type: 'string' as const,
      description: 'Attribute ID to retrieve',
    },
  },
  required: ['attributeId'],
};

const AttributesCreateJsonSchema = {
  type: 'object' as const,
  properties: {
    noteId: {
      type: 'string' as const,
      description: 'Note ID to add attribute to',
    },
    type: {
      type: 'string' as const,
      enum: ['label', 'relation'],
      description: 'Attribute type',
    },
    name: {
      type: 'string' as const,
      description: 'Attribute name',
    },
    value: {
      type: 'string' as const,
      description: 'Attribute value (for relations, this is target noteId)',
    },
  },
  required: ['noteId', 'type', 'name', 'value'],
};

const AttributesUpdateJsonSchema = {
  type: 'object' as const,
  properties: {
    attributeId: {
      type: 'string' as const,
      description: 'Attribute ID to update',
    },
    name: {
      type: 'string' as const,
      description: 'New attribute name',
    },
    value: {
      type: 'string' as const,
      description: 'New attribute value',
    },
    position: {
      type: 'number' as const,
      description: 'New position among attributes',
    },
    isInheritable: {
      type: ['boolean', 'string'] as const,
      description: 'Whether attribute is inherited by children',
    },
  },
  required: ['attributeId'],
};

const AttributesDeleteJsonSchema = {
  type: 'object' as const,
  properties: {
    attributeId: {
      type: 'string' as const,
      description: 'Attribute ID to delete',
    },
  },
  required: ['attributeId'],
};

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

export async function attributesGet(client: TrilliumClient, args: unknown): Promise<string> {
  const params = AttributesGetSchema.parse(args);

  const attribute = await client.getAttribute(params.attributeId);

  return [
    `**Attribute Details**`,
    ``,
    `Type: ${attribute.type}`,
    `Name: ${attribute.name}`,
    `Value: ${attribute.value}`,
    `Position: ${attribute.position}`,
    `Inheritable: ${attribute.isInheritable ? 'Yes' : 'No'}`,
    `Modified: ${attribute.utcDateModified}`,
    ``,
    `[Attribute ID: ${attribute.attributeId}]`,
    `[Note ID: ${attribute.noteId}]`,
  ].join('\n');
}

export async function attributesCreate(client: TrilliumClient, args: unknown): Promise<string> {
  const params = AttributesCreateSchema.parse(args);

  const attribute = await client.createAttribute({
    noteId: params.noteId,
    type: params.type,
    name: params.name,
    value: params.value,
  });

  return [
    `Attribute created successfully!`,
    ``,
    `Type: ${attribute.type}`,
    `Name: ${attribute.name}`,
    `Value: ${attribute.value}`,
    ``,
    `[Attribute ID: ${attribute.attributeId}]`,
  ].join('\n');
}

export async function attributesUpdate(client: TrilliumClient, args: unknown): Promise<string> {
  const params = AttributesUpdateSchema.parse(args);

  const updates: Partial<{ name: string; value: string; position: number; isInheritable: boolean }> = {};
  if (params.name !== undefined) updates.name = params.name;
  if (params.value !== undefined) updates.value = params.value;
  if (params.position !== undefined) updates.position = params.position;
  if (params.isInheritable !== undefined) updates.isInheritable = params.isInheritable;

  const attribute = await client.updateAttribute(params.attributeId, updates);

  return [
    `Attribute updated successfully!`,
    ``,
    `Type: ${attribute.type}`,
    `Name: ${attribute.name}`,
    `Value: ${attribute.value}`,
    ``,
    `[Attribute ID: ${attribute.attributeId}]`,
  ].join('\n');
}

export async function attributesDelete(client: TrilliumClient, args: unknown): Promise<string> {
  const params = AttributesDeleteSchema.parse(args);

  await client.deleteAttribute(params.attributeId);

  return `Attribute deleted: ${params.attributeId}`;
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const attributeTools = [
  {
    name: 'attributes_get',
    description:
      'Get attribute details by attributeId. Attributes are metadata attached to notes - either labels (key-value pairs) or relations (links to other notes). ' +
      'Returns: type (label/relation), name, value, position, inheritability, and modification date. ' +
      'WHEN TO USE: Inspect attribute before updating/deleting, verify attribute settings, check inherited attributes. ' +
      'WORKFLOW: (1) note_get to see attribute IDs, (2) attributes_get to inspect specific attribute, (3) attributes_update/delete to modify. ' +
      'KEY CONCEPT: Labels store metadata (#author=tolkien, #priority=5), relations link notes (~references, ~template). Attributes shown in note_get output.',
    inputSchema: AttributesGetJsonSchema,
  },
  {
    name: 'attributes_create',
    description:
      'Add a label or relation to a note. Labels are key-value metadata (#tag=value), relations link notes together (~linkType=targetNoteId). ' +
      'WHEN TO USE: Tag notes for organization (#project=alpha, #status=done), create relationships between notes (~references, ~dependsOn), ' +
      'add searchable metadata (#author, #priority), apply inheritable attributes to note trees. ' +
      'WORKFLOW: (1) notes_search to find note, (2) For relations: find target note, (3) attributes_create with noteId and attribute details. ' +
      'EXAMPLES: ' +
      'Add tag → type: "label", name: "status", value: "done". ' +
      'Link notes → type: "relation", name: "references", value: "<target-note-id>". ' +
      'Priority → type: "label", name: "priority", value: "5". ' +
      'Inheritable tag → type: "label", name: "project", value: "alpha", isInheritable: true (applies to all children). ' +
      'TIP: Use # prefix for labels (#status), ~ prefix for relations (~references) when searching.',
    inputSchema: AttributesCreateJsonSchema,
  },
  {
    name: 'attributes_update',
    description:
      'Update an existing attribute. Modify name, value, position, or inheritability. Only provide fields you want to change. ' +
      'WHEN TO USE: Update tag values (#status: active→done), change relation targets, reorder attributes, make attribute inheritable/non-inheritable. ' +
      'WORKFLOW: (1) note_get to see attribute IDs, (2) attributes_get to check current values, (3) attributes_update to modify. ' +
      'EXAMPLES: ' +
      'Update status → value: "done". ' +
      'Change priority → value: "10". ' +
      'Make inheritable → isInheritable: true (applies to all children). ' +
      'Rename tag → name: "category" (was "type"). ' +
      'Reorder → position: 10 (move earlier in list). ' +
      'CAUTION: Changing inherited attributes affects entire subtree. Verify before enabling inheritability.',
    inputSchema: AttributesUpdateJsonSchema,
  },
  {
    name: 'attributes_delete',
    description:
      'Remove an attribute from a note. Deletes the specific attribute instance - does not affect the note content or other attributes. ' +
      'WHEN TO USE: Remove outdated tags, delete obsolete relations, clean up duplicate attributes, remove inherited attributes from specific notes. ' +
      'WORKFLOW: (1) note_get to see all attribute IDs, (2) attributes_get to verify which attribute to remove, (3) attributes_delete that attributeId. ' +
      'EXAMPLES: ' +
      'Remove tag → Delete #status=done attribute. ' +
      'Remove relation → Delete ~references link. ' +
      'Clean up → Delete duplicate #priority attributes. ' +
      'SAFETY: If attribute is inherited (isInheritable=true), deleting it removes inheritance for ALL child notes. Always check isInheritable with attributes_get first.',
    inputSchema: AttributesDeleteJsonSchema,
  },
];
