/**
 * Tools Index - Central export point for all Trillium MCP tools
 * Re-exports tools from domain modules and provides getToolDefinitions()
 */

import type { Config } from '../config.js';
import { hasReadPermission, hasWritePermission } from '../config.js';

// Re-export all tool implementations
export * from './notes.js';
export * from './attributes.js';
export * from './branches.js';
export * from './attachments.js';
export * from './calendar.js';
export * from './inbox.js';

// Import tool definitions
import { noteTools } from './notes.js';
import { attributeTools } from './attributes.js';
import { branchTools } from './branches.js';
import { attachmentTools } from './attachments.js';
import { calendarTools } from './calendar.js';
import { inboxTools } from './inbox.js';

/**
 * Get tool definitions based on permissions
 * Returns array of tools available based on config permissions
 * Tools are grouped by domain (notes, branches, etc.) for better UX
 */
export function getToolDefinitions(config: Config) {
  const tools: any[] = [];

  // ============================================================================
  // NOTES - All note operations grouped together
  // ============================================================================

  if (hasReadPermission(config)) {
    // Read operations
    tools.push(
      noteTools.find(t => t.name === 'notes_search')!,
      noteTools.find(t => t.name === 'note_get')!,
      noteTools.find(t => t.name === 'note_list_children')!,
      noteTools.find(t => t.name === 'note_grep')!,
      noteTools.find(t => t.name === 'note_get_lines')!
    );
  }

  if (hasWritePermission(config)) {
    // Write operations
    tools.push(
      noteTools.find(t => t.name === 'note_create')!,
      noteTools.find(t => t.name === 'note_overwrite')!,
      noteTools.find(t => t.name === 'note_delete')!,
      noteTools.find(t => t.name === 'note_create_revision')!,
      noteTools.find(t => t.name === 'note_reorder')!,
      noteTools.find(t => t.name === 'note_reorder_children')!,
      noteTools.find(t => t.name === 'note_edit')!,
      noteTools.find(t => t.name === 'note_prepend')!,
      noteTools.find(t => t.name === 'note_append')!
    );
  }

  // ============================================================================
  // BRANCHES - All branch operations grouped together
  // ============================================================================

  if (hasReadPermission(config)) {
    tools.push(
      branchTools.find(t => t.name === 'branches_get')!
    );
  }

  if (hasWritePermission(config)) {
    tools.push(
      branchTools.find(t => t.name === 'branches_create')!,
      branchTools.find(t => t.name === 'branches_update')!,
      branchTools.find(t => t.name === 'branches_delete')!
    );
  }

  // ============================================================================
  // ATTRIBUTES - All attribute operations grouped together
  // ============================================================================

  if (hasReadPermission(config)) {
    tools.push(
      attributeTools.find(t => t.name === 'attributes_get')!
    );
  }

  if (hasWritePermission(config)) {
    tools.push(
      attributeTools.find(t => t.name === 'attributes_create')!,
      attributeTools.find(t => t.name === 'attributes_update')!,
      attributeTools.find(t => t.name === 'attributes_delete')!
    );
  }

  // ============================================================================
  // ATTACHMENTS - All attachment operations grouped together
  // DEACTIVATED FOR MVP - Will be enabled in future release
  // ============================================================================

  // if (hasReadPermission(config)) {
  //   tools.push(
  //     attachmentTools.find(t => t.name === 'attachments_get')!,
  //     attachmentTools.find(t => t.name === 'attachments_get_content')!
  //   );
  // }

  // if (hasWritePermission(config)) {
  //   tools.push(
  //     attachmentTools.find(t => t.name === 'attachments_create')!,
  //     attachmentTools.find(t => t.name === 'attachments_update')!,
  //     attachmentTools.find(t => t.name === 'attachments_delete')!,
  //     attachmentTools.find(t => t.name === 'attachments_update_content')!
  //   );
  // }

  // ============================================================================
  // CALENDAR - All calendar operations (auto-create if not exist)
  // DEACTIVATED FOR MVP - Will be enabled in future release
  // ============================================================================

  // if (hasReadPermission(config)) {
  //   tools.push(...calendarTools);
  // }

  // ============================================================================
  // INBOX - Inbox operations (auto-creates if not exist)
  // DEACTIVATED FOR MVP - Will be enabled in future release
  // ============================================================================

  // if (hasReadPermission(config)) {
  //   tools.push(...inboxTools);
  // }

  return tools;
}
