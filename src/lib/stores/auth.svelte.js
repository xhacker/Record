/**
 * Authentication state store
 * Manages GitHub token and authentication status
 */

import { loadAuthToken, saveAuth as persistAuth } from '$lib/auth.js';

/** @typedef {import('../types').RepoMeta} RepoMeta */

/** @type {boolean} */
let hasAuth = $state(false);

/** @type {string | null} */
let authToken = $state(null);

/** @type {RepoMeta | null} */
let repoMeta = $state(null);

/** @type {boolean} */
let initialized = $state(false);

/**
 * Initialize auth from localStorage
 */
export function initAuth() {
  if (initialized) return;
  initialized = true;
  authToken = loadAuthToken();
  hasAuth = !!authToken;
}

/**
 * Save auth token and update state
 * @param {string} token
 * @returns {boolean}
 */
export function saveAuth(token) {
  if (persistAuth(token)) {
    hasAuth = true;
    authToken = token.trim();
    return true;
  }
  return false;
}

/**
 * Skip auth (local-only mode)
 */
export function skipAuth() {
  hasAuth = true;
  authToken = null;
  repoMeta = null;
}

/**
 * Clear auth (on auth error)
 */
export function clearAuth() {
  hasAuth = false;
  authToken = null;
  repoMeta = null;
}

/**
 * Update repo metadata
 * @param {RepoMeta | null} meta
 */
export function setRepoMeta(meta) {
  repoMeta = meta;
}

// Export reactive getters
export function getHasAuth() {
  return hasAuth;
}

export function getAuthToken() {
  return authToken;
}

export function getRepoMeta() {
  return repoMeta;
}
