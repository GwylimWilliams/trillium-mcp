/**
 * Trillium API Client
 * Handles all communication with the Trillium ETAPI
 */

import type { Config } from './config.js';
import type {
  Note,
  CreateNoteDef,
  NoteWithBranch,
  Branch,
  Attribute,
  Attachment,
  SearchResponse,
  AppInfo,
} from './types.js';

export class TrilliumClient {
  private apiUrl: string;
  private apiToken: string;
  private verifySsl: boolean;

  constructor(config: Config) {
    this.apiToken = config.apiToken;
    this.apiUrl = config.apiUrl.replace(/\/$/, ''); // Remove trailing slash
    this.verifySsl = config.verifySsl;
  }

  /**
   * Generic request handler for Trillium ETAPI
   */
  private async request<T>(
    method: string,
    path: string,
    body?: any,
    isTextResponse = false
  ): Promise<T> {
    const url = `${this.apiUrl}${path}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiToken}`,
    };

    // Set Content-Type based on body type
    if (body !== undefined) {
      if (typeof body === 'string') {
        // String content (e.g., note content) requires text/plain
        headers['Content-Type'] = 'text/plain; charset=utf-8';
      } else if (typeof body === 'object') {
        // JSON payloads require application/json
        headers['Content-Type'] = 'application/json';
      }
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    // Note: In Node.js 18+, fetch doesn't support rejectUnauthorized directly
    // For self-signed certs, you may need to use NODE_TLS_REJECT_UNAUTHORIZED=0
    // or use a custom agent with undici or https module

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Trillium API error (${response.status}): ${errorText || response.statusText}`
        );
      }

      if (isTextResponse) {
        return (await response.text()) as T;
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return '' as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`API request failed: ${error.message}`);
        throw error;
      }
      throw new Error('Unknown error occurred during API request');
    }
  }

  // ===== APP INFO =====

  /**
   * Get application information
   */
  async getAppInfo(): Promise<AppInfo> {
    return this.request<AppInfo>('GET', '/app-info');
  }

  // ===== NOTES =====

  /**
   * Search notes using Trilium query language
   */
  async searchNotes(params: {
    search: string;
    fastSearch?: boolean;
    includeArchivedNotes?: boolean;
    ancestorNoteId?: string;
    ancestorDepth?: string;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    limit?: number;
    debug?: boolean;
  }): Promise<SearchResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append('search', params.search);

    if (params.fastSearch !== undefined) queryParams.append('fastSearch', String(params.fastSearch));
    if (params.includeArchivedNotes !== undefined) queryParams.append('includeArchivedNotes', String(params.includeArchivedNotes));
    if (params.ancestorNoteId) queryParams.append('ancestorNoteId', params.ancestorNoteId);
    if (params.ancestorDepth) queryParams.append('ancestorDepth', params.ancestorDepth);
    if (params.orderBy) queryParams.append('orderBy', params.orderBy);
    if (params.orderDirection) queryParams.append('orderDirection', params.orderDirection);
    if (params.limit !== undefined) queryParams.append('limit', String(params.limit));
    if (params.debug !== undefined) queryParams.append('debug', String(params.debug));

    return this.request<SearchResponse>('GET', `/notes?${queryParams.toString()}`);
  }

  /**
   * Get note metadata by ID
   */
  async getNote(noteId: string): Promise<Note> {
    return this.request<Note>('GET', `/notes/${noteId}`);
  }

  /**
   * Update note metadata
   */
  async updateNote(noteId: string, updates: Partial<Note>): Promise<Note> {
    return this.request<Note>('PATCH', `/notes/${noteId}`, updates);
  }

  /**
   * Delete a note
   */
  async deleteNote(noteId: string): Promise<void> {
    await this.request<void>('DELETE', `/notes/${noteId}`);
  }

  /**
   * Get note content
   */
  async getNoteContent(noteId: string): Promise<string> {
    return this.request<string>('GET', `/notes/${noteId}/content`, undefined, true);
  }

  /**
   * Update note content
   */
  async updateNoteContent(noteId: string, content: string): Promise<void> {
    await this.request<void>('PUT', `/notes/${noteId}/content`, content);
  }

  /**
   * Create a new note
   */
  async createNote(noteDef: CreateNoteDef): Promise<NoteWithBranch> {
    return this.request<NoteWithBranch>('POST', '/create-note', noteDef);
  }

  // ===== BRANCHES =====

  /**
   * Create a branch (place note in tree)
   */
  async createBranch(branchDef: {
    noteId: string;
    parentNoteId: string;
    prefix?: string;
    notePosition?: number;
    isExpanded?: boolean;
  }): Promise<Branch> {
    return this.request<Branch>('POST', '/branches', branchDef);
  }

  /**
   * Get branch by ID
   */
  async getBranch(branchId: string): Promise<Branch> {
    return this.request<Branch>('GET', `/branches/${branchId}`);
  }

  /**
   * Update branch
   */
  async updateBranch(branchId: string, updates: Partial<Branch>): Promise<Branch> {
    return this.request<Branch>('PATCH', `/branches/${branchId}`, updates);
  }

  /**
   * Delete branch (remove note from parent)
   */
  async deleteBranch(branchId: string): Promise<void> {
    await this.request<void>('DELETE', `/branches/${branchId}`);
  }

  // ===== ATTRIBUTES =====

  /**
   * Create an attribute (label or relation)
   */
  async createAttribute(attrDef: {
    noteId: string;
    type: 'label' | 'relation';
    name: string;
    value: string;
    position?: number;
    isInheritable?: boolean;
  }): Promise<Attribute> {
    return this.request<Attribute>('POST', '/attributes', attrDef);
  }

  /**
   * Get attribute by ID
   */
  async getAttribute(attributeId: string): Promise<Attribute> {
    return this.request<Attribute>('GET', `/attributes/${attributeId}`);
  }

  /**
   * Update attribute
   */
  async updateAttribute(attributeId: string, updates: Partial<Attribute>): Promise<Attribute> {
    return this.request<Attribute>('PATCH', `/attributes/${attributeId}`, updates);
  }

  /**
   * Delete attribute
   */
  async deleteAttribute(attributeId: string): Promise<void> {
    await this.request<void>('DELETE', `/attributes/${attributeId}`);
  }

  // ===== ATTACHMENTS =====

  /**
   * Create an attachment
   */
  async createAttachment(attachmentDef: {
    ownerId: string;
    role: string;
    mime: string;
    title: string;
    content: string | Buffer;
    position?: number;
  }): Promise<Attachment> {
    // First create the attachment metadata
    const metadata: any = {
      ownerId: attachmentDef.ownerId,
      role: attachmentDef.role,
      mime: attachmentDef.mime,
      title: attachmentDef.title,
    };

    if (attachmentDef.position !== undefined) {
      metadata.position = attachmentDef.position;
    }

    const attachment = await this.request<Attachment>('POST', '/attachments', metadata);

    // Then upload the content
    await this.updateAttachmentContent(attachment.attachmentId, attachmentDef.content);

    return attachment;
  }

  /**
   * Get attachment by ID
   */
  async getAttachment(attachmentId: string): Promise<Attachment> {
    return this.request<Attachment>('GET', `/attachments/${attachmentId}`);
  }

  /**
   * Update attachment metadata
   */
  async updateAttachment(attachmentId: string, updates: Partial<Attachment>): Promise<Attachment> {
    return this.request<Attachment>('PATCH', `/attachments/${attachmentId}`, updates);
  }

  /**
   * Delete attachment
   */
  async deleteAttachment(attachmentId: string): Promise<void> {
    await this.request<void>('DELETE', `/attachments/${attachmentId}`);
  }

  /**
   * Get attachment content
   */
  async getAttachmentContent(attachmentId: string): Promise<string> {
    return this.request<string>('GET', `/attachments/${attachmentId}/content`, undefined, true);
  }

  /**
   * Update attachment content
   */
  async updateAttachmentContent(attachmentId: string, content: string | Buffer): Promise<void> {
    await this.request<void>('PUT', `/attachments/${attachmentId}/content`, content);
  }

  // ===== NOTE REVISIONS =====

  /**
   * Create a note revision (snapshot of current state)
   */
  async createNoteRevision(noteId: string): Promise<void> {
    await this.request<void>('POST', `/notes/${noteId}/revision`);
  }

  // ===== CALENDAR =====

  /**
   * Get or create day note for a specific date
   */
  async getDayNote(date: string): Promise<Note> {
    return this.request<Note>('GET', `/calendar/days/${date}`);
  }

  /**
   * Get or create week note for a specific date
   */
  async getWeekNote(date: string): Promise<Note> {
    return this.request<Note>('GET', `/calendar/weeks/${date}`);
  }

  /**
   * Get or create month note for a specific month
   */
  async getMonthNote(month: string): Promise<Note> {
    return this.request<Note>('GET', `/calendar/months/${month}`);
  }

  /**
   * Get or create year note for a specific year
   */
  async getYearNote(year: string): Promise<Note> {
    return this.request<Note>('GET', `/calendar/years/${year}`);
  }

  // ===== INBOX =====

  /**
   * Get inbox note for a specific date
   */
  async getInboxNote(date: string): Promise<Note> {
    return this.request<Note>('GET', `/inbox/${date}`);
  }

  // ===== MAINTENANCE =====

  /**
   * Refresh note ordering for a parent note
   * CRITICAL: Must be called after manually updating branch positions
   * to trigger Trilium to actually resort the notes in the UI
   */
  async refreshNoteOrdering(parentNoteId: string): Promise<void> {
    await this.request<void>('POST', `/refresh-note-ordering/${parentNoteId}`);
  }
}
