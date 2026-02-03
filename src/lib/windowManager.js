/** @typedef {import('./types').WindowState} WindowState */
/** @typedef {import('./types').WindowStates} WindowStates */

import { STATES_KEY, loadJSON, saveJSON } from './storage.js';

export const GRID_SIZE = 40;
export const DEFAULT_WIDTH = GRID_SIZE * 12; // 480px
export const DEFAULT_HEIGHT = GRID_SIZE * 10; // 400px

/**
 * Snap a value to the grid
 * @param {number} value
 * @returns {number}
 */
export const snapToGrid = (value) => Math.round(value / GRID_SIZE) * GRID_SIZE;

/**
 * Calculate position for a new window (cascading from center)
 * @param {number} [visibleCount]
 * @returns {{ x: number, y: number }}
 */
export const getNewWindowPosition = (visibleCount = 0) => {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const offsetStep = GRID_SIZE * 2;
  const offset = visibleCount * offsetStep;
  return {
    x: snapToGrid((vw - DEFAULT_WIDTH) / 2) + offset,
    y: snapToGrid((vh - DEFAULT_HEIGHT) / 2) + offset,
  };
};

/**
 * Load window states from localStorage
 * @returns {WindowStates}
 */
export const loadWindowStates = () => {
  const parsed = loadJSON(STATES_KEY, {});
  if (parsed && typeof parsed === 'object') {
    return parsed;
  }
  return {};
};

/**
 * Get the next z-index value
 * @param {WindowStates} windowStates
 * @returns {number}
 */
export const getTopZ = (windowStates) => {
  const zValues = Object.values(windowStates).map(s => s.zIndex || 1);
  return Math.max(1, ...zValues) + 1;
};

/**
 * Persist window states to localStorage
 * @param {WindowStates} windowStates
 */
export const persistStates = (windowStates) => {
  saveJSON(STATES_KEY, windowStates);
};

/**
 * Get list of visible windows with their note IDs
 * @param {WindowStates} windowStates
 * @returns {WindowState[]}
 */
export const getOpenWindows = (windowStates) =>
  Object.entries(windowStates)
    .filter(([_, state]) => state.visible)
    .map(([noteId, state]) => ({ noteId, ...state }));

/**
 * Create a new window state for a note
 * @param {WindowStates} windowStates
 * @param {number} zIndex
 * @returns {Omit<WindowState, 'noteId'>}
 */
export const createWindowState = (windowStates, zIndex) => {
  const visibleCount = Object.values(windowStates).filter(s => s.visible).length;
  const pos = getNewWindowPosition(visibleCount);
  return {
    x: pos.x,
    y: pos.y,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    zIndex,
    visible: true,
  };
};
