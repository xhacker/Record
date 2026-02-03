import { STATES_KEY, loadJSON, saveJSON } from './storage.js';

export const GRID_SIZE = 40;
export const DEFAULT_WIDTH = GRID_SIZE * 12; // 480px
export const DEFAULT_HEIGHT = GRID_SIZE * 10; // 400px

export const snapToGrid = (value) => Math.round(value / GRID_SIZE) * GRID_SIZE;

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

export const loadWindowStates = () => {
  const parsed = loadJSON(STATES_KEY, {});
  if (parsed && typeof parsed === 'object') {
    return parsed;
  }
  return {};
};

export const getTopZ = (windowStates) => {
  const zValues = Object.values(windowStates).map(s => s.zIndex || 1);
  return Math.max(1, ...zValues) + 1;
};

export const persistStates = (windowStates) => {
  saveJSON(STATES_KEY, windowStates);
};

export const getOpenWindows = (windowStates) =>
  Object.entries(windowStates)
    .filter(([_, state]) => state.visible)
    .map(([noteId, state]) => ({ noteId, ...state }));
