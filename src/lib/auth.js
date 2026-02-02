import { AUTH_KEY, loadJSON, saveJSON } from './storage.js';

export const loadAuth = () => {
  const parsed = loadJSON(AUTH_KEY);
  return !!(parsed?.token);
};

export const saveAuth = (token) => {
  if (!token?.trim()) {
    return false;
  }
  saveJSON(AUTH_KEY, { token: token.trim() });
  return true;
};
