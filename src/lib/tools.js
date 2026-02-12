/**
 * Client-side agent tools
 * Executes tools using authenticated API endpoints and UI state
 */

import { snapToGrid, DEFAULT_WIDTH, DEFAULT_HEIGHT } from './windowManager.js';

/**
 * @typedef {Object} ToolContext
 * @property {Array} notes - Current notes array
 * @property {Object} windowStates - Current window states
 * @property {function(string): void} openWindow - Open a window for a note
 * @property {function(string): void} closeWindow - Close a window
 * @property {function(string, number, number): void} moveWindow - Move a window
 * @property {function(string, number, number): void} resizeWindow - Resize a window
 * @property {function(): void} refreshNotes - Refresh notes from repo after write
 */

const callRepoApi = async (path, options = {}) => {
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error ?? `${response.status} ${response.statusText}`);
  }

  return payload;
};

/**
 * Execute an agent tool and return the result
 * @param {string} toolName - The tool to execute
 * @param {Record<string, unknown>} args - Tool arguments
 * @param {ToolContext} context - Execution context with state and callbacks
 * @returns {Promise<string>} - JSON string result for the LLM
 */
export const executeTool = async (toolName, args, context) => {
  const { notes, windowStates, openWindow, closeWindow, moveWindow, resizeWindow, refreshNotes } = context;

  try {
    switch (toolName) {
      // ============================================
      // File tools
      // ============================================

      case 'list_files': {
        const payload = await callRepoApi('/api/repo/files');
        return JSON.stringify({ files: payload.files ?? [], count: payload.count ?? 0 });
      }

      case 'read_file': {
        const path = args.path;
        if (!path) {
          return JSON.stringify({ error: 'Missing required parameter: path' });
        }

        const payload = await callRepoApi(`/api/repo/file?path=${encodeURIComponent(String(path))}`);
        return JSON.stringify({ path: payload.path, content: payload.content });
      }

      case 'write_file': {
        const path = args.path;
        const content = args.content;

        if (!path) {
          return JSON.stringify({ error: 'Missing required parameter: path' });
        }
        if (typeof content !== 'string') {
          return JSON.stringify({ error: 'Missing required parameter: content' });
        }

        let existed = true;
        try {
          await callRepoApi(`/api/repo/file?path=${encodeURIComponent(String(path))}`);
        } catch {
          existed = false;
        }

        await callRepoApi('/api/repo/file', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path: String(path), content }),
        });

        if (refreshNotes) {
          refreshNotes();
        }

        return JSON.stringify({
          success: true,
          path: String(path),
          created: !existed,
        });
      }

      case 'search_notes': {
        const query = args.query;
        if (!query) {
          return JSON.stringify({ error: 'Missing required parameter: query' });
        }

        const payload = await callRepoApi(`/api/repo/search?query=${encodeURIComponent(String(query))}`);

        return JSON.stringify({
          query: payload.query,
          results: payload.results,
          count: payload.count,
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
