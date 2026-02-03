/**
 * Client-side agent tools
 * Executes tools using the existing GitHub API client and UI state
 */

import { listFilePaths, readFileByPath, writeFileByPath, searchNotes } from './github.js';
import { snapToGrid, DEFAULT_WIDTH, DEFAULT_HEIGHT } from './windowManager.js';

/**
 * @typedef {Object} ToolContext
 * @property {string} token - GitHub token
 * @property {Array} notes - Current notes array
 * @property {Object} windowStates - Current window states
 * @property {function(string): void} openWindow - Open a window for a note
 * @property {function(string): void} closeWindow - Close a window
 * @property {function(string, number, number): void} moveWindow - Move a window
 * @property {function(string, number, number): void} resizeWindow - Resize a window
 * @property {function(): void} refreshNotes - Refresh notes from GitHub after write
 */

/**
 * Execute an agent tool and return the result
 * @param {string} toolName - The tool to execute
 * @param {Record<string, unknown>} args - Tool arguments
 * @param {ToolContext} context - Execution context with state and callbacks
 * @returns {Promise<string>} - JSON string result for the LLM
 */
export const executeTool = async (toolName, args, context) => {
  const { token, notes, windowStates, openWindow, closeWindow, moveWindow, resizeWindow, refreshNotes } = context;

  try {
    switch (toolName) {
      // ============================================
      // File tools
      // ============================================

      case 'list_files': {
        if (!token) {
          return JSON.stringify({ error: 'GitHub token is required.' });
        }
        const files = await listFilePaths(token);
        return JSON.stringify({ files, count: files.length });
      }

      case 'read_file': {
        if (!token) {
          return JSON.stringify({ error: 'GitHub token is required.' });
        }
        const path = args.path;
        if (!path) {
          return JSON.stringify({ error: 'Missing required parameter: path' });
        }
        const file = await readFileByPath(token, path);
        return JSON.stringify({ path: file.path, content: file.content });
      }

      case 'write_file': {
        if (!token) {
          return JSON.stringify({ error: 'GitHub token is required.' });
        }
        const path = args.path;
        const content = args.content;
        if (!path) {
          return JSON.stringify({ error: 'Missing required parameter: path' });
        }
        if (typeof content !== 'string') {
          return JSON.stringify({ error: 'Missing required parameter: content' });
        }
        const result = await writeFileByPath(token, path, content);
        // Refresh notes to pick up the new/updated file
        if (refreshNotes) {
          refreshNotes();
        }
        return JSON.stringify({
          success: true,
          path: result.path,
          created: result.created,
        });
      }

      case 'search_notes': {
        if (!token) {
          return JSON.stringify({ error: 'GitHub token is required.' });
        }
        const query = args.query;
        if (!query) {
          return JSON.stringify({ error: 'Missing required parameter: query' });
        }
        const results = await searchNotes(token, query);
        return JSON.stringify({
          query,
          results,
          count: results.length,
        });
      }

      // ============================================
      // Canvas tools
      // ============================================

      case 'get_canvas_state': {
        const canvasWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const canvasHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

        const openWindows = Object.entries(windowStates || {})
          .filter(([_, state]) => state.visible)
          .map(([noteId, state]) => {
            const note = notes?.find((n) => n.id === noteId);
            return {
              noteId,
              path: note?.path || noteId,
              x: state.x,
              y: state.y,
              width: state.width || DEFAULT_WIDTH,
              height: state.height || DEFAULT_HEIGHT,
              zIndex: state.zIndex,
            };
          });

        return JSON.stringify({
          canvasSize: { width: canvasWidth, height: canvasHeight },
          openWindows,
          totalNotes: notes?.length || 0,
        });
      }

      // ============================================
      // Window tools
      // ============================================

      case 'open_window': {
        const noteId = args.noteId || args.path;
        if (!noteId) {
          return JSON.stringify({ error: 'Missing required parameter: noteId' });
        }

        // Check if note exists
        const note = notes?.find((n) => n.id === noteId || n.path === noteId);
        if (!note) {
          return JSON.stringify({ error: `Note not found: ${noteId}` });
        }

        if (openWindow) {
          openWindow(note.id);
        }

        return JSON.stringify({
          success: true,
          noteId: note.id,
          opened: true,
        });
      }

      case 'close_window': {
        const noteId = args.noteId || args.path;
        if (!noteId) {
          return JSON.stringify({ error: 'Missing required parameter: noteId' });
        }

        const note = notes?.find((n) => n.id === noteId || n.path === noteId);
        const actualId = note?.id || noteId;

        if (closeWindow) {
          closeWindow(actualId);
        }

        return JSON.stringify({
          success: true,
          noteId: actualId,
          closed: true,
        });
      }

      case 'move_window': {
        const noteId = args.noteId || args.path;
        const x = args.x;
        const y = args.y;

        if (!noteId) {
          return JSON.stringify({ error: 'Missing required parameter: noteId' });
        }
        if (typeof x !== 'number' || typeof y !== 'number') {
          return JSON.stringify({ error: 'Missing required parameters: x, y' });
        }

        const note = notes?.find((n) => n.id === noteId || n.path === noteId);
        const actualId = note?.id || noteId;

        if (!windowStates?.[actualId]) {
          return JSON.stringify({ error: `Window not open: ${noteId}` });
        }

        if (moveWindow) {
          moveWindow(actualId, snapToGrid(x), snapToGrid(y));
        }

        return JSON.stringify({
          success: true,
          noteId: actualId,
          x: snapToGrid(x),
          y: snapToGrid(y),
        });
      }

      case 'resize_window': {
        const noteId = args.noteId || args.path;
        const width = args.width;
        const height = args.height;

        if (!noteId) {
          return JSON.stringify({ error: 'Missing required parameter: noteId' });
        }
        if (typeof width !== 'number' || typeof height !== 'number') {
          return JSON.stringify({ error: 'Missing required parameters: width, height' });
        }

        const note = notes?.find((n) => n.id === noteId || n.path === noteId);
        const actualId = note?.id || noteId;

        if (!windowStates?.[actualId]) {
          return JSON.stringify({ error: `Window not open: ${noteId}` });
        }

        const snappedWidth = snapToGrid(Math.max(160, width));
        const snappedHeight = snapToGrid(Math.max(160, height));

        if (resizeWindow) {
          resizeWindow(actualId, snappedWidth, snappedHeight);
        }

        return JSON.stringify({
          success: true,
          noteId: actualId,
          width: snappedWidth,
          height: snappedHeight,
        });
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
