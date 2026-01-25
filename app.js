const STORAGE_KEY = "the-record-notes";

const state = {
  notes: [],
  activeId: null,
  query: "",
};

const elements = {
  list: document.querySelector("#note-list"),
  count: document.querySelector("#note-count"),
  search: document.querySelector("#search"),
  form: document.querySelector("#note-form"),
  title: document.querySelector("#title"),
  tags: document.querySelector("#tags"),
  content: document.querySelector("#content"),
  editorTitle: document.querySelector("#editor-title"),
  editorMeta: document.querySelector("#editor-meta"),
  pinButton: document.querySelector("#pin-note"),
  deleteButton: document.querySelector("#delete-note"),
  newButton: document.querySelector("#new-note"),
  exportButton: document.querySelector("#export-notes"),
  importInput: document.querySelector("#import-notes"),
};

let autosaveTimer = null;

const formatDate = (value) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);

const saveNotes = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
};

const loadNotes = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state.notes = [];
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      state.notes = parsed;
    }
  } catch (error) {
    console.warn("Failed to parse stored notes", error);
    state.notes = [];
  }
};

const getActiveNote = () =>
  state.notes.find((note) => note.id === state.activeId) || null;

const resetEditor = () => {
  state.activeId = null;
  elements.title.value = "";
  elements.tags.value = "";
  elements.content.value = "";
  elements.editorTitle.textContent = "New note";
  elements.editorMeta.textContent = "Draft mode";
  elements.pinButton.textContent = "Pin";
  elements.deleteButton.disabled = true;
};

const setEditorNote = (note) => {
  state.activeId = note.id;
  elements.title.value = note.title;
  elements.tags.value = note.tags.join(", ");
  elements.content.value = note.content;
  elements.editorTitle.textContent = "Editing";
  elements.editorMeta.textContent = `Last updated ${formatDate(
    new Date(note.updatedAt)
  )}`;
  elements.pinButton.textContent = note.pinned ? "Unpin" : "Pin";
  elements.deleteButton.disabled = false;
};

const renderNotes = () => {
  const query = state.query.trim().toLowerCase();
  const filtered = state.notes.filter((note) => {
    if (!query) return true;
    return (
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query) ||
      note.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  filtered.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });

  elements.count.textContent = `${filtered.length} note${
    filtered.length === 1 ? "" : "s"
  }`;

  elements.list.innerHTML = "";
  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "note-card";
    empty.innerHTML =
      "<h3>No notes yet</h3><p>Create a note to start your record.</p>";
    elements.list.appendChild(empty);
    return;
  }

  filtered.forEach((note, index) => {
    const card = document.createElement("article");
    card.className = "note-card";
    card.style.setProperty("--delay", `${index * 60}ms`);
    if (note.id === state.activeId) card.classList.add("active");

    const title = document.createElement("h3");
    title.textContent = note.title || "Untitled";

    const preview = document.createElement("p");
    preview.textContent = note.content
      ? note.content.slice(0, 90)
      : "No content yet.";

    const meta = document.createElement("p");
    meta.className = "panel-meta";
    meta.textContent = `Updated ${formatDate(new Date(note.updatedAt))}`;

    const tags = document.createElement("div");
    tags.className = "note-tags";
    note.tags.slice(0, 3).forEach((tag) => {
      const tagEl = document.createElement("span");
      tagEl.className = "tag";
      tagEl.textContent = tag;
      tags.appendChild(tagEl);
    });

    if (note.pinned) {
      const pinned = document.createElement("div");
      pinned.className = "pin";
      pinned.textContent = "Pinned";
      card.appendChild(pinned);
    }

    card.append(title, preview, tags, meta);
    card.addEventListener("click", () => {
      setEditorNote(note);
      renderNotes();
    });

    elements.list.appendChild(card);
  });
};

const parseTags = (value) =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

const upsertNote = () => {
  const title = elements.title.value.trim();
  const tags = parseTags(elements.tags.value);
  const content = elements.content.value.trim();

  if (!title && !content) {
    return;
  }

  const now = Date.now();
  if (state.activeId) {
    const existing = getActiveNote();
    if (!existing) return;

    existing.title = title;
    existing.tags = tags;
    existing.content = content;
    existing.updatedAt = now;
  } else {
    const note = {
      id: crypto.randomUUID(),
      title,
      tags,
      content,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    state.notes.push(note);
    state.activeId = note.id;
  }

  saveNotes();
  renderNotes();
  const active = getActiveNote();
  if (active) setEditorNote(active);
};

const scheduleAutosave = () => {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    upsertNote();
  }, 700);
};

const togglePin = () => {
  const active = getActiveNote();
  if (!active) return;
  active.pinned = !active.pinned;
  active.updatedAt = Date.now();
  saveNotes();
  setEditorNote(active);
  renderNotes();
};

const deleteNote = () => {
  const active = getActiveNote();
  if (!active) return;
  state.notes = state.notes.filter((note) => note.id !== active.id);
  saveNotes();
  resetEditor();
  renderNotes();
};

const exportNotes = () => {
  const blob = new Blob([JSON.stringify(state.notes, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `the-record-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

const importNotes = (file) => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed)) throw new Error("Invalid file");
      state.notes = parsed.map((note) => ({
        id: note.id || crypto.randomUUID(),
        title: note.title || "",
        tags: Array.isArray(note.tags) ? note.tags : [],
        content: note.content || "",
        pinned: Boolean(note.pinned),
        createdAt: Number(note.createdAt) || Date.now(),
        updatedAt: Number(note.updatedAt) || Date.now(),
      }));
      saveNotes();
      resetEditor();
      renderNotes();
    } catch (error) {
      alert("Could not import that file.");
    }
  };
  reader.readAsText(file);
};

const attachEvents = () => {
  elements.search.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderNotes();
  });

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    upsertNote();
  });

  [elements.title, elements.tags, elements.content].forEach((input) => {
    input.addEventListener("input", scheduleAutosave);
  });

  elements.newButton.addEventListener("click", () => {
    resetEditor();
    renderNotes();
  });

  elements.pinButton.addEventListener("click", togglePin);
  elements.deleteButton.addEventListener("click", deleteNote);
  elements.exportButton.addEventListener("click", exportNotes);

  elements.importInput.addEventListener("change", (event) => {
    importNotes(event.target.files[0]);
    event.target.value = "";
  });
};

const init = () => {
  loadNotes();
  resetEditor();
  renderNotes();
  attachEvents();
};

init();
