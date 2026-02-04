/**
 * Type definitions for The Record application
 */

/** Note types */
export type NoteType = 'note' | 'transcript';

/** A note document stored in the repository */
export interface Note {
  /** Unique identifier (same as path for file-backed notes) */
  id: string;
  /** File path in the repository (e.g., "notes/my-note.md") */
  path: string;
  /** Just the filename portion (e.g., "my-note.md") */
  filename: string;
  /** The note's content (markdown) */
  content: string;
  /** The type of note */
  type: NoteType;
  /** Content as last saved to GitHub */
  savedContent: string;
  /** Whether local content differs from savedContent */
  dirty: boolean;
  /** Whether a save operation is in progress */
  saving: boolean;
  /** GitHub blob SHA for the file (used for updates) */
  sha: string | null;
}

/** Window state for a note on the canvas */
export interface WindowState {
  /** Note ID this window displays */
  noteId: string;
  /** X position in pixels (snapped to grid) */
  x: number;
  /** Y position in pixels (snapped to grid) */
  y: number;
  /** Width in pixels (snapped to grid) */
  width: number;
  /** Height in pixels (snapped to grid) */
  height: number;
  /** Z-index for stacking order */
  zIndex: number;
  /** Whether the window is visible on the canvas */
  visible: boolean;
}

/** Map of note IDs to their window states */
export type WindowStates = Record<string, Omit<WindowState, 'noteId'>>;

/** Repository metadata from GitHub */
export interface RepoMeta {
  owner: string;
  name: string;
  defaultBranch: string;
}

/** Parsed transcript content */
export interface TranscriptContent {
  /** Thread identifier for the conversation */
  threadId: string;
  /** User's message (plain text, sanitized) */
  userText: string;
  /** Tool results captured from transcript tool code blocks */
  toolResults?: Array<{ tool: string; content: string }>;
  /** Assistant's response (plain text) */
  assistantText: string;
}

/** Parsed frontmatter result */
export interface FrontmatterResult {
  /** Parsed key-value pairs from frontmatter */
  data: Record<string, string>;
  /** Content after frontmatter */
  body: string;
}

/** Result from a remote operation */
export interface RemoteResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
}
