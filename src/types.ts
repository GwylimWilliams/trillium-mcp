/**
 * TypeScript types for Trillium ETAPI
 * Based on the OpenAPI specification
 */

export type EntityId = string;

export type NoteType =
  | 'text'
  | 'code'
  | 'render'
  | 'file'
  | 'image'
  | 'search'
  | 'relationMap'
  | 'book'
  | 'noteMap'
  | 'mermaid'
  | 'webView'
  | 'shortcut'
  | 'doc'
  | 'contentWidget'
  | 'launcher';

export type AttributeType = 'label' | 'relation';

/**
 * Note metadata (without content)
 */
export interface Note {
  noteId: EntityId;
  title: string;
  type: NoteType;
  mime: string;
  isProtected: boolean;
  blobId?: string;
  attributes?: Attribute[];
  parentNoteIds?: EntityId[];
  childNoteIds?: EntityId[];
  parentBranchIds?: EntityId[];
  childBranchIds?: EntityId[];
  dateCreated: string;
  dateModified: string;
  utcDateCreated: string;
  utcDateModified: string;
  [key: string]: any; // Allow additional fields from API
}

/**
 * Parameters for creating a new note
 */
export interface CreateNoteDef {
  parentNoteId: EntityId;
  title: string;
  type: NoteType;
  content: string;
  mime?: string;
  notePosition?: number;
  prefix?: string;
  isExpanded?: boolean;
  noteId?: EntityId;
  branchId?: EntityId;
}

/**
 * Note with branch information
 */
export interface NoteWithBranch {
  note: Note;
  branch: Branch;
}

/**
 * Branch (note placement in tree)
 */
export interface Branch {
  branchId: EntityId;
  noteId: EntityId;
  parentNoteId: EntityId;
  prefix?: string;
  notePosition: number;
  isExpanded: boolean;
  utcDateModified: string;
  [key: string]: any;
}

/**
 * Attribute (label or relation)
 */
export interface Attribute {
  attributeId: EntityId;
  noteId: EntityId;
  type: AttributeType;
  name: string;
  value: string;
  position: number;
  isInheritable: boolean;
  utcDateModified: string;
  [key: string]: any;
}

/**
 * Attachment metadata
 */
export interface Attachment {
  attachmentId: EntityId;
  ownerId: EntityId;
  role: string;
  mime: string;
  title: string;
  position: number;
  blobId?: string;
  utcDateModified: string;
  utcDateScheduledForErasureSince?: string;
  contentLength?: number;
  [key: string]: any;
}

/**
 * Search response
 */
export interface SearchResponse {
  results: Note[];
  [key: string]: any;
}

/**
 * Application info
 */
export interface AppInfo {
  appVersion: string;
  dbVersion: number;
  syncVersion: number;
  buildDate: string;
  buildRevision: string;
  dataDirectory: string;
  clipperProtocolVersion: string;
  utcDateTime: string;
  [key: string]: any;
}

/**
 * Error response
 */
export interface ErrorResponse {
  status: number;
  code: string;
  message: string;
  [key: string]: any;
}
