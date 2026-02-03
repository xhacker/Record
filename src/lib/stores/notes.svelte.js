/**
 * Notes state store
 * Manages the notes array and CRUD operations
 */

/** @typedef {import('../types').Note} Note */
/** @typedef {import('../types').NoteType} NoteType */

import {
  createNote as createNoteObj,
  normalizeNote,
  sortNotesByPath,
  getNoteTypeFromContent,
} from '$lib/notes.js';

/** @type {Note[]} */
let notes = $state([]);

/**
 * Get all notes
 * @returns {Note[]}
 */
export function getNotes() {
  return notes;
}

/**
 * Set all notes (used when loading from GitHub)
 * @param {Note[]} newNotes
 */
export function setNotes(newNotes) {
  notes = newNotes;
}

/**
 * Get a note by ID
 * @param {string} id
 * @returns {Note | undefined}
 */
export function getNoteById(id) {
  return notes.find((n) => n.id === id);
}

/**
 * Update a single note
 * @param {string} noteId
 * @param {(note: Note) => Note} updater
 */
export function updateNote(noteId, updater) {
  notes = notes.map((note) => (note.id === noteId ? updater(note) : note));
}

/**
 * Update the notes array
 * @param {(notes: Note[]) => Note[]} updater
 */
export function updateNotes(updater) {
  notes = updater(notes);
}

/**
 * Update note content and dirty flag
 * @param {string} noteId
 * @param {string} value
 */
export function updateNoteContent(noteId, value) {
  const note = notes.find((n) => n.id === noteId);
  if (!note) return;
  const dirty = value !== (note.savedContent ?? '');
  updateNote(noteId, (n) => ({ ...n, content: value, dirty }));
}

/**
 * Add a new note to the beginning of the list
 * @param {Note} note
 */
export function addNote(note) {
  notes = [note, ...notes];
}

/**
 * Remove a note by ID
 * @param {string} id
 * @returns {number} Remaining notes count
 */
export function removeNote(id) {
  if (!notes.find((n) => n.id === id)) return notes.length;
  notes = notes.filter((n) => n.id !== id);
  return notes.length;
}

/**
 * Get a Set of existing note paths
 * @returns {Set<string>}
 */
export function getExistingPaths() {
  return new Set(notes.map((n) => n.path ?? n.id).filter(Boolean));
}

/**
 * Check if a path already exists
 * @param {string} path
 * @param {string} [excludeId] - Note ID to exclude from check
 * @returns {boolean}
 */
export function pathExists(path, excludeId) {
  return notes.some((n) => (n.path ?? n.id) === path && n.id !== excludeId);
}

/**
 * Create and add an empty note
 * @param {string} filename
 * @param {boolean} withSaving - Whether to set saving flag
 * @returns {Note}
 */
export function createAndAddNote(filename, withSaving = false) {
  const fresh = normalizeNote(createNoteObj(filename));
  if (withSaving) fresh.saving = true;
  addNote(fresh);
  return fresh;
}

/**
 * Create and add a transcript note
 * @param {string} path
 * @param {string} content
 * @param {boolean} withSaving
 * @returns {Note}
 */
export function createAndAddTranscript(path, content, withSaving = false) {
  const fresh = normalizeNote(createNoteObj(path, content, 'transcript'));
  if (withSaving) fresh.saving = true;
  addNote(fresh);
  return fresh;
}
