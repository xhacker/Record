/**
 * Window state store
 * Manages window positions, visibility, and z-index
 */

/** @typedef {import('../types').WindowState} WindowState */
/** @typedef {import('../types').WindowStates} WindowStates */

import {
  loadWindowStates as loadStates,
  getTopZ as computeTopZ,
  persistStates,
  getOpenWindows as computeOpenWindows,
  createWindowState as createState,
} from '$lib/windowManager.js';

/** @type {WindowStates} */
let windowStates = $state({});

/** @type {number} */
let topZ = $state(1);

/**
 * Initialize window states from localStorage
 */
export function initWindowStates() {
  windowStates = loadStates();
  topZ = computeTopZ(windowStates);
}

/**
 * Get all window states
 * @returns {WindowStates}
 */
export function getWindowStates() {
  return windowStates;
}

/**
 * Get list of open windows
 * @returns {WindowState[]}
 */
export function getOpenWindows() {
  return computeOpenWindows(windowStates);
}

/**
 * Get window state for a note
 * @param {string} noteId
 * @returns {Omit<WindowState, 'noteId'> | undefined}
 */
export function getWindowState(noteId) {
  return windowStates[noteId];
}

/**
 * Set window states (used after pruning)
 * @param {WindowStates} states
 */
export function setWindowStates(states) {
  windowStates = states;
  persistStates(windowStates);
}

/**
 * Update a single window state
 * @param {string} noteId
 * @param {Partial<Omit<WindowState, 'noteId'>>} updates
 */
export function updateWindowState(noteId, updates) {
  if (windowStates[noteId]) {
    windowStates = { ...windowStates, [noteId]: { ...windowStates[noteId], ...updates } };
  }
}

/**
 * Create a new window for a note
 * @param {string} noteId
 * @returns {Omit<WindowState, 'noteId'>}
 */
export function createWindow(noteId) {
  const state = createState(windowStates, topZ++);
  windowStates = { ...windowStates, [noteId]: state };
  persistStates(windowStates);
  return state;
}

/**
 * Bring a window to the front
 * @param {string} noteId
 */
export function bringToFront(noteId) {
  if (windowStates[noteId]) {
    windowStates = { ...windowStates, [noteId]: { ...windowStates[noteId], zIndex: topZ++ } };
  }
}

/**
 * Toggle window visibility
 * @param {string} noteId
 */
export function toggleWindow(noteId) {
  const existing = windowStates[noteId];
  if (existing?.visible) {
    windowStates = { ...windowStates, [noteId]: { ...existing, visible: false } };
  } else if (existing) {
    windowStates = { ...windowStates, [noteId]: { ...existing, visible: true, zIndex: topZ++ } };
  } else {
    createWindow(noteId);
    return;
  }
  persistStates(windowStates);
}

/**
 * Close a window (hide it)
 * @param {string} noteId
 */
export function closeWindow(noteId) {
  if (windowStates[noteId]) {
    windowStates = { ...windowStates, [noteId]: { ...windowStates[noteId], visible: false } };
    persistStates(windowStates);
  }
}

/**
 * Remove window state for a note
 * @param {string} noteId
 */
export function removeWindow(noteId) {
  if (windowStates[noteId]) {
    const { [noteId]: _, ...rest } = windowStates;
    windowStates = rest;
    persistStates(windowStates);
  }
}

/**
 * Move window state from one ID to another (used when renaming)
 * @param {string} fromId
 * @param {string} toId
 */
export function moveWindowIdentity(fromId, toId) {
  if (fromId === toId) return;
  if (windowStates[fromId]) {
    const { [fromId]: ws, ...rest } = windowStates;
    windowStates = { ...rest, [toId]: ws };
    persistStates(windowStates);
  }
}

/**
 * Update window position
 * @param {string} noteId
 * @param {number} x
 * @param {number} y
 */
export function setWindowPosition(noteId, x, y) {
  if (windowStates[noteId]) {
    windowStates = { ...windowStates, [noteId]: { ...windowStates[noteId], x, y } };
  }
}

/**
 * Update window size
 * @param {string} noteId
 * @param {number} width
 * @param {number} height
 */
export function setWindowSize(noteId, width, height) {
  if (windowStates[noteId]) {
    windowStates = { ...windowStates, [noteId]: { ...windowStates[noteId], width, height } };
  }
}

/**
 * Persist current window states
 */
export function persist() {
  persistStates(windowStates);
}

/**
 * Prune window states for notes that no longer exist
 * @param {Set<string>} validIds
 */
export function pruneStates(validIds) {
  const filtered = Object.fromEntries(
    Object.entries(windowStates).filter(([id]) => validIds.has(id))
  );
  if (Object.keys(filtered).length !== Object.keys(windowStates).length) {
    windowStates = filtered;
    persistStates(windowStates);
  }
}
