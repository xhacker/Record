/**
 * Client-side agent tools
 * Executes tools using the existing GitHub API client
 */

import { listFilePaths, readFileByPath } from './github.js';

/**
 * Execute an agent tool and return the result
 * @param {string} toolName - The tool to execute
 * @param {Record<string, unknown>} args - Tool arguments
 * @param {string} token - GitHub token
 * @returns {Promise<string>} - JSON string result for the LLM
 */
export const executeTool = async (toolName, args, token) => {
  if (!token) {
    return JSON.stringify({ error: 'GitHub token is required to access notes.' });
  }

  try {
    switch (toolName) {
      case 'list_files': {
        const files = await listFilePaths(token);
        return JSON.stringify({ files, count: files.length });
      }

      case 'read_file': {
        const path = args.path;
        if (!path) {
          return JSON.stringify({ error: 'Missing required parameter: path' });
        }
        const file = await readFileByPath(token, path);
        return JSON.stringify({ path: file.path, content: file.content });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (error) {
    return JSON.stringify({
      error: error instanceof Error ? error.message : 'Tool execution failed.',
    });
  }
};
