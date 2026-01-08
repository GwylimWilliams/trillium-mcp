/**
 * Calendar Tools for Trillium MCP
 * Day, week, month, and year notes for journaling and planning
 */

import { z } from 'zod';
import type { TrilliumClient } from '../client.js';

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const CalendarGetDaySchema = z.object({
  date: z.string().describe('Date in YYYY-MM-DD format'),
});

export const CalendarGetWeekSchema = z.object({
  date: z.string().describe('Date in YYYY-MM-DD format (any day in the week)'),
});

export const CalendarGetMonthSchema = z.object({
  month: z.string().describe('Month in YYYY-MM format'),
});

export const CalendarGetYearSchema = z.object({
  year: z.string().describe('Year in YYYY format'),
});

// ============================================================================
// JSON SCHEMAS (for MCP)
// ============================================================================

const CalendarGetDayJsonSchema = {
  type: 'object' as const,
  properties: {
    date: {
      type: 'string' as const,
      description: 'Date in YYYY-MM-DD format',
    },
  },
  required: ['date'],
};

const CalendarGetWeekJsonSchema = {
  type: 'object' as const,
  properties: {
    date: {
      type: 'string' as const,
      description: 'Date in YYYY-MM-DD format (any day in the week)',
    },
  },
  required: ['date'],
};

const CalendarGetMonthJsonSchema = {
  type: 'object' as const,
  properties: {
    month: {
      type: 'string' as const,
      description: 'Month in YYYY-MM format',
    },
  },
  required: ['month'],
};

const CalendarGetYearJsonSchema = {
  type: 'object' as const,
  properties: {
    year: {
      type: 'string' as const,
      description: 'Year in YYYY format',
    },
  },
  required: ['year'],
};

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

export async function calendarGetDay(client: TrilliumClient, args: unknown): Promise<string> {
  const params = CalendarGetDaySchema.parse(args);

  const note = await client.getDayNote(params.date);

  return [
    `**Day Note: ${params.date}**`,
    ``,
    `Title: ${note.title}`,
    `Type: ${note.type}`,
    ``,
    `The day note has been retrieved or created if it didn't exist.`,
    ``,
    `[Note ID: ${note.noteId}]`,
  ].join('\n');
}

export async function calendarGetWeek(client: TrilliumClient, args: unknown): Promise<string> {
  const params = CalendarGetWeekSchema.parse(args);

  const note = await client.getWeekNote(params.date);

  return [
    `**Week Note for: ${params.date}**`,
    ``,
    `Title: ${note.title}`,
    `Type: ${note.type}`,
    ``,
    `The week note has been retrieved or created if it didn't exist.`,
    ``,
    `[Note ID: ${note.noteId}]`,
  ].join('\n');
}

export async function calendarGetMonth(client: TrilliumClient, args: unknown): Promise<string> {
  const params = CalendarGetMonthSchema.parse(args);

  const note = await client.getMonthNote(params.month);

  return [
    `**Month Note: ${params.month}**`,
    ``,
    `Title: ${note.title}`,
    `Type: ${note.type}`,
    ``,
    `The month note has been retrieved or created if it didn't exist.`,
    ``,
    `[Note ID: ${note.noteId}]`,
  ].join('\n');
}

export async function calendarGetYear(client: TrilliumClient, args: unknown): Promise<string> {
  const params = CalendarGetYearSchema.parse(args);

  const note = await client.getYearNote(params.year);

  return [
    `**Year Note: ${params.year}**`,
    ``,
    `Title: ${note.title}`,
    `Type: ${note.type}`,
    ``,
    `The year note has been retrieved or created if it doesn't exist.`,
    ``,
    `[Note ID: ${note.noteId}]`,
  ].join('\n');
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const calendarTools = [
  {
    name: 'calendar_get_day',
    description:
      'Get or create a day note for a specific date. ' +
      'Date format: YYYY-MM-DD. Creates the note if it doesn\'t exist. ' +
      'Useful for daily journaling and date-based organization.',
    inputSchema: CalendarGetDayJsonSchema,
  },
  {
    name: 'calendar_get_week',
    description:
      'Get or create a week note for a specific date. ' +
      'Date format: YYYY-MM-DD (any day in the week). Creates the note if it doesn\'t exist. ' +
      'Useful for weekly reviews and planning.',
    inputSchema: CalendarGetWeekJsonSchema,
  },
  {
    name: 'calendar_get_month',
    description:
      'Get or create a month note for a specific month. ' +
      'Month format: YYYY-MM. Creates the note if it doesn\'t exist. ' +
      'Useful for monthly summaries and planning.',
    inputSchema: CalendarGetMonthJsonSchema,
  },
  {
    name: 'calendar_get_year',
    description:
      'Get or create a year note for a specific year. ' +
      'Year format: YYYY. Creates the note if it doesn\'t exist. ' +
      'Useful for yearly reviews and goal tracking.',
    inputSchema: CalendarGetYearJsonSchema,
  },
];
