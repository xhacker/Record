export const STATES_KEY = 'the-record-states';

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

export const removeJSON = (key) => {
  localStorage.removeItem(key);
};
