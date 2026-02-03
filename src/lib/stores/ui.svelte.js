/**
 * UI state store
 * Manages sidebar, loading states, and error messages
 */

/** @type {boolean} */
let sidebarOpen = $state(false);

/** @type {boolean} */
let notesLoading = $state(false);

/** @type {string} */
let notesError = $state('');

/** @type {boolean} */
let commandPending = $state(false);

// Ask AI panel state
/** @type {boolean} */
let askOpen = $state(false);

/** @type {string} */
let askPrompt = $state('');

/** @type {boolean} */
let askPending = $state(false);

/** @type {string} */
let askError = $state('');

// Sidebar
export function openSidebar() {
  sidebarOpen = true;
}

export function closeSidebar() {
  sidebarOpen = false;
}

export function getSidebarOpen() {
  return sidebarOpen;
}

// Notes loading/error
export function setNotesLoading(loading) {
  notesLoading = loading;
}

export function setNotesError(error) {
  notesError = error;
}

export function clearNotesError() {
  notesError = '';
}

export function getNotesLoading() {
  return notesLoading;
}

export function getNotesError() {
  return notesError;
}

// Command pending
export function setCommandPending(pending) {
  commandPending = pending;
}

export function getCommandPending() {
  return commandPending;
}

// Ask AI panel
export function openAskPanel() {
  askPrompt = '';
  askError = '';
  askOpen = true;
}

export function closeAskPanel() {
  askOpen = false;
  askError = '';
}

export function setAskPrompt(prompt) {
  askPrompt = prompt;
}

export function setAskPending(pending) {
  askPending = pending;
}

export function setAskError(error) {
  askError = error;
}

export function getAskOpen() {
  return askOpen;
}

export function getAskPrompt() {
  return askPrompt;
}

export function getAskPending() {
  return askPending;
}

export function getAskError() {
  return askError;
}
