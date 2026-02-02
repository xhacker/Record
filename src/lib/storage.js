export const STORAGE_KEY = 'the-record-notes';
export const STATES_KEY = 'the-record-states';
export const AUTH_KEY = 'the-record-auth';

export const loadJSON = (key, fallback = null) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const saveJSON = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};
