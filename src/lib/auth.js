import { AUTH_KEY, loadJSON, removeJSON, saveJSON } from './storage.js';

export const loadAuthToken = () => {
  const parsed = loadJSON(AUTH_KEY);
  if (typeof parsed?.token === 'string' && parsed.token.trim()) {
    return parsed.token.trim();
  }
  return null;
};

export const saveAuth = (token) => {
  if (!token?.trim()) {
    return false;
  }
  saveJSON(AUTH_KEY, { token: token.trim() });
  return true;
};

export const clearAuth = () => {
  removeJSON(AUTH_KEY);
};
