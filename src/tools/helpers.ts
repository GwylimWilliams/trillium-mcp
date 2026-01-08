/**
 * Shared Helper Functions for Trillium MCP Tools
 * Content conversion, file operations, and editing utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { marked } from 'marked';
import TurndownService from 'turndown';

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Get the exports directory path, creating it if it doesn't exist
 */
export async function getExportsDirectory(): Promise<string> {
  const exportsDir = process.env.TRILLIUM_EXPORTS_DIR ||
                     path.join(os.homedir(), 'Downloads', 'trillium-exports');

  // Create directory if it doesn't exist
  await fs.promises.mkdir(exportsDir, { recursive: true });

  return exportsDir;
}

/**
 * Generate a safe filename with timestamp
 */
export function generateFilename(prefix: string, noteId: string, extension: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/T/, '_').split('.')[0];
  return `${prefix}-${noteId}-${timestamp}${extension}`;
}

// ============================================================================
// CONTENT FORMAT DETECTION & CONVERSION
// ============================================================================

/**
 * Detect content format from MIME type
 */
export function detectContentFormat(mime: string): 'html' | 'markdown' | 'plaintext' {
  const lowerMime = mime.toLowerCase();

  if (lowerMime.includes('markdown') || lowerMime === 'text/x-markdown') {
    return 'markdown';
  } else if (lowerMime === 'text/html') {
    return 'html';
  } else {
    return 'plaintext';
  }
}

/**
 * Convert Markdown content to HTML using marked library
 */
export function convertMarkdownToHTML(content: string): string {
  try {
    // Configure marked for better HTML output
    marked.setOptions({
      gfm: true,           // GitHub Flavored Markdown
      breaks: true,        // Convert \n to <br>
    });

    // Convert Markdown to HTML
    const html = marked.parse(content) as string;

    // Return trimmed HTML
    return html.trim();
  } catch (error) {
    console.error('Markdown conversion error:', error);
    // Fallback: return original content
    return content;
  }
}

/**
 * Smart content formatter that adapts to the note's MIME type
 *
 * @param content - Raw content string from LLM (typically Markdown-formatted)
 * @param mime - Target MIME type
 * @returns Formatted content appropriate for the MIME type
 */
export function formatContentForMime(content: string, mime: string): string {
  const format = detectContentFormat(mime);

  switch (format) {
    case 'html':
      // For HTML notes: Convert Markdown → HTML (LLMs write Markdown, Trilium needs HTML)
      return convertMarkdownToHTML(content);

    case 'markdown':
      // For Markdown code notes: Keep as raw Markdown (no conversion)
      return content;

    case 'plaintext':
      // For plain text: Keep as-is
      return content;

    default:
      return content;
  }
}

/**
 * Convert HTML content to Markdown using turndown library
 * Used for displaying HTML notes to LLMs in a natural format
 */
export function convertHTMLToMarkdown(html: string): string {
  try {
    const turndownService = new TurndownService({
      headingStyle: 'atx',           // Use # for headings
      codeBlockStyle: 'fenced',      // Use ``` for code blocks
      fence: '```',
      emDelimiter: '*',              // Use * for emphasis
      strongDelimiter: '**',         // Use ** for strong
      bulletListMarker: '-',         // Use - for lists
    });

    // Convert HTML to Markdown
    const markdown = turndownService.turndown(html);

    return markdown.trim();
  } catch (error) {
    console.error('HTML to Markdown conversion error:', error);
    // Fallback: return original content
    return html;
  }
}

// ============================================================================
// STRING MATCHING & EDITING
// ============================================================================

/**
 * Normalize whitespace for fuzzy matching
 * Handles differences in spacing, newlines, etc.
 */
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')           // Normalize line endings
    .replace(/[ \t]+/g, ' ')          // Normalize spaces/tabs to single space
    .replace(/\n\n+/g, '\n\n')        // Normalize multiple blank lines
    .trim();
}

/**
 * Smart string matching with multiple strategies
 * Returns { found: boolean, index: number, strategy: string }
 */
export function smartMatch(content: string, searchString: string): { found: boolean; index: number; strategy: string } {
  // Strategy 1: Exact match
  let index = content.indexOf(searchString);
  if (index !== -1) {
    return { found: true, index, strategy: 'exact' };
  }

  // Strategy 2: Whitespace-normalized match
  const normalizedContent = normalizeWhitespace(content);
  const normalizedSearch = normalizeWhitespace(searchString);
  index = normalizedContent.indexOf(normalizedSearch);
  if (index !== -1) {
    // Find the actual position in original content
    // This is approximate - we'll use the normalized index as a guide
    return { found: true, index, strategy: 'whitespace-normalized' };
  }

  // No match found
  return { found: false, index: -1, strategy: 'none' };
}

/**
 * Hybrid matching for HTML notes
 * Tries to match in both HTML and Markdown representations
 */
export function hybridMatch(
  htmlContent: string,
  oldString: string,
  newString: string
): { success: boolean; result?: string; strategy?: string; error?: string } {
  // Strategy 1: Direct HTML match (LLM provided HTML)
  const htmlMatch = smartMatch(htmlContent, oldString);
  if (htmlMatch.found) {
    const result = htmlContent.replace(oldString, newString);
    return { success: true, result, strategy: `html-${htmlMatch.strategy}` };
  }

  // Strategy 2: Markdown-space matching
  // Convert HTML to Markdown, try to match LLM's Markdown strings, convert back
  const markdownContent = convertHTMLToMarkdown(htmlContent);
  const mdMatch = smartMatch(markdownContent, oldString);

  if (mdMatch.found) {
    // Match found in Markdown representation
    const updatedMarkdown = markdownContent.replace(oldString, newString);
    const updatedHTML = convertMarkdownToHTML(updatedMarkdown);
    return { success: true, result: updatedHTML, strategy: `markdown-${mdMatch.strategy}` };
  }

  // Strategy 3: Try converting LLM's strings to HTML first
  const oldHTML = convertMarkdownToHTML(oldString);
  const newHTML = convertMarkdownToHTML(newString);
  const convertedMatch = smartMatch(htmlContent, oldHTML);

  if (convertedMatch.found) {
    const result = htmlContent.replace(oldHTML, newHTML);
    return { success: true, result, strategy: `converted-html-${convertedMatch.strategy}` };
  }

  // No match found with any strategy
  return {
    success: false,
    error: `Could not find match for old_string. Tried strategies: HTML exact, HTML normalized, Markdown exact, Markdown normalized, Converted HTML. ` +
           `Original content has ${htmlContent.length} characters, markdown version has ${markdownContent.length} characters.`
  };
}

// ============================================================================
// LINE-BASED OPERATIONS
// ============================================================================

/**
 * Extract specific lines from content
 * Returns the lines and metadata about the extraction
 */
export function extractLines(
  content: string,
  startLine: number,
  endLine: number
): { lines: string; totalLines: number; actualStart: number; actualEnd: number } {
  const allLines = content.split('\n');
  const totalLines = allLines.length;

  // Normalize line numbers (1-indexed input, convert to 0-indexed)
  const actualStart = Math.max(0, startLine - 1);
  const actualEnd = Math.min(totalLines, endLine);

  const selectedLines = allLines.slice(actualStart, actualEnd);

  return {
    lines: selectedLines.join('\n'),
    totalLines,
    actualStart: actualStart + 1,  // Convert back to 1-indexed for display
    actualEnd: actualEnd,
  };
}

/**
 * Show context around an edit (like Claude Code's Edit tool)
 * Finds where new_string appears and shows surrounding lines
 */
export function showEditContext(
  content: string,
  newString: string,
  contextLines: number = 3
): string {
  const lines = content.split('\n');

  // Find where the new string appears (it might span multiple lines)
  const newStringLines = newString.split('\n');
  const firstNewLine = newStringLines[0];

  // Find the line where our change starts
  let matchLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(firstNewLine)) {
      matchLineIndex = i;
      break;
    }
  }

  if (matchLineIndex === -1) {
    return ''; // Change not found (shouldn't happen)
  }

  // Calculate range with context
  const startLine = Math.max(0, matchLineIndex - contextLines);
  const endLine = Math.min(lines.length, matchLineIndex + newStringLines.length + contextLines);

  // Build output with line numbers
  const output: string[] = [];
  for (let i = startLine; i < endLine; i++) {
    const lineNum = (i + 1).toString().padStart(4, ' ');
    const isChangedLine = i >= matchLineIndex && i < matchLineIndex + newStringLines.length;
    const marker = isChangedLine ? ' ←' : '  ';
    output.push(`${lineNum}${marker} ${lines[i]}`);
  }

  return output.join('\n');
}

/**
 * Search for pattern in content with context lines
 */
export function searchInContent(
  content: string,
  pattern: string,
  contextLines: number = 2
): Array<{ lineNumber: number; line: string; context: string[] }> {
  const lines = content.split('\n');
  const results: Array<{ lineNumber: number; line: string; context: string[] }> = [];

  // Simple case-insensitive search (can be enhanced with regex later)
  const searchLower = pattern.toLowerCase();

  lines.forEach((line, index) => {
    if (line.toLowerCase().includes(searchLower)) {
      // Found a match - collect context
      const contextBefore = lines.slice(Math.max(0, index - contextLines), index);
      const contextAfter = lines.slice(index + 1, Math.min(lines.length, index + 1 + contextLines));

      results.push({
        lineNumber: index + 1,  // 1-indexed
        line: line,
        context: [...contextBefore, line, ...contextAfter],
      });
    }
  });

  return results;
}

/**
 * Validate that content change doesn't lose data unexpectedly
 * Returns { valid: boolean, warnings: string[] }
 */
export function validateContentChange(
  originalContent: string,
  newContent: string,
  operation: string
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Check for significant size reduction (potential data loss)
  if (newContent.length < originalContent.length * 0.5) {
    warnings.push(`Content size reduced by more than 50% (${originalContent.length} → ${newContent.length} chars). Verify this is intentional.`);
  }

  // Check if content is empty after non-empty
  if (originalContent.length > 0 && newContent.length === 0) {
    warnings.push(`Content is now empty after ${operation}. This will delete all content.`);
  }

  // For now, we consider it valid even with warnings (user may want this)
  // In the future, could add strict mode that rejects changes with warnings
  return { valid: true, warnings };
}
