# the record

A focused, offline-first note taking web app with a split-pane library + editor.

## Concept
A warm, modern writing space with Space Grotesk + Fraunces typography, soft gradients, and a subtle glow.

## Features
- Create, edit, and delete notes
- Pin important notes to the top
- Search across titles, tags, and text
- Autosave to localStorage after a short pause while typing
- Export and import JSON backups
- Subtle staggered reveals for note cards

## Quick start
Open `index.html` in your browser.

## Project structure
- `index.html` — app shell
- `styles.css` — theme + layout
- `app.js` — state, storage, UI rendering
- `AGENTS.md` — agent workflow rules

## Development notes
- No build step required
- Data lives in localStorage under the key `the-record-notes`
- Export files are JSON snapshots of the full note list
