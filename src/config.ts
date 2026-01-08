/**
 * Configuration management for Trillium MCP Server
 * Loads and validates environment variables using Zod
 */

import { z } from 'zod';

const ConfigSchema = z.object({
  apiUrl: z.string().url().describe('Trillium ETAPI URL (must include /etapi path)'),
  apiToken: z.string().min(1).describe('Trillium ETAPI token'),
  permissions: z.string().default('READ').describe('Permission level: READ or READ;WRITE'),
  verifySsl: z.boolean().default(false).describe('Verify SSL certificates'),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Load and validate configuration from environment variables
 */
function loadConfig(): Config {
  try {
    const config = ConfigSchema.parse({
      apiUrl: process.env.TRILLIUM_API_URL,
      apiToken: process.env.TRILLIUM_API_TOKEN,
      permissions: process.env.TRILLIUM_PERMISSIONS || 'READ',
      verifySsl: process.env.VERIFY_SSL === 'true',
    });

    // Validate API URL includes /etapi path
    if (!config.apiUrl.includes('/etapi')) {
      throw new Error('TRILLIUM_API_URL must include /etapi path (e.g., http://localhost:8080/etapi)');
    }

    return config;
  } catch (error) {
    console.error('\n❌ Configuration Error\n');
    console.error('Missing required environment variables. Please create a .env file with:');
    console.error('');
    console.error('  TRILLIUM_API_URL=http://localhost:8080/etapi');
    console.error('  TRILLIUM_API_TOKEN=your-etapi-token-here');
    console.error('  TRILLIUM_PERMISSIONS=READ');
    console.error('');
    console.error('See INSTALLATION.md for detailed setup instructions.');
    console.error('');

    if (error instanceof z.ZodError) {
      error.issues.forEach((err: z.ZodIssue) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    } else if (error instanceof Error) {
      console.error('Error:', error.message);
    }
    console.error('');

    process.exit(1);
  }
}

/**
 * Check if READ permission is enabled
 */
export function hasReadPermission(config: Config): boolean {
  return config.permissions.includes('READ');
}

/**
 * Check if WRITE permission is enabled
 */
export function hasWritePermission(config: Config): boolean {
  return config.permissions.includes('WRITE');
}

// Export singleton config instance
export const config = loadConfig();
