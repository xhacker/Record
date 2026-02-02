import { STATES_KEY, loadJSON, saveJSON } from './storage.js';

export const GRID_SIZE = 40;
export const DEFAULT_WIDTH = GRID_SIZE * 12; // 480px
export const DEFAULT_HEIGHT = GRID_SIZE * 10; // 400px
const MIN_SIZE = GRID_SIZE * 4; // 160px

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

export const createDragHandler = (windowStates, setWindowStates) => {
  let dragState = null;

  const startDrag = (noteId, event, state) => {
    if (event.target.closest('input, textarea, button')) return;
    event.preventDefault();
    dragState = {
      noteId,
      startX: event.clientX,
      startY: event.clientY,
      origX: state.x,
      origY: state.y,
    };
  };

  const onDrag = (event) => {
    if (!dragState) return false;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    const newX = snapToGrid(Math.max(0, dragState.origX + dx));
    const newY = snapToGrid(Math.max(0, dragState.origY + dy));
    const existing = windowStates[dragState.noteId];
    if (existing) {
      setWindowStates({ ...windowStates, [dragState.noteId]: { ...existing, x: newX, y: newY } });
    }
    return true;
  };

  const endDrag = () => {
    if (dragState) {
      dragState = null;
      return true;
    }
    return false;
  };

  return { startDrag, onDrag, endDrag };
};

export const createResizeHandler = (windowStates, setWindowStates) => {
  let resizeState = null;

  const startResize = (noteId, event, state) => {
    event.preventDefault();
    event.stopPropagation();
    resizeState = {
      noteId,
      startX: event.clientX,
      startY: event.clientY,
      origWidth: state.width ?? DEFAULT_WIDTH,
      origHeight: state.height ?? DEFAULT_HEIGHT,
    };
  };

  const onResize = (event) => {
    if (!resizeState) return false;
    const dx = event.clientX - resizeState.startX;
    const dy = event.clientY - resizeState.startY;
    const newWidth = snapToGrid(Math.max(MIN_SIZE, resizeState.origWidth + dx));
    const newHeight = snapToGrid(Math.max(MIN_SIZE, resizeState.origHeight + dy));
    const existing = windowStates[resizeState.noteId];
    if (existing) {
      setWindowStates({ ...windowStates, [resizeState.noteId]: { ...existing, width: newWidth, height: newHeight } });
    }
    return true;
  };

  const endResize = () => {
    if (resizeState) {
      resizeState = null;
      return true;
    }
    return false;
  };

  return { startResize, onResize, endResize };
};
