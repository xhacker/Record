# the record

A focused, offline-first note taking web app with a single, centered note.

## Visual Style
A warm, modern writing space with Space Grotesk + Fraunces typography, soft gradients, and a subtle glow.

## Features
- One note, always centered
- Title + content fields
- Autosaves to localStorage after a brief pause

## Quick start
1. Install dependencies: `npm install`
2. Run the dev server: `npm run dev`

## Project structure
- `src/routes/+page.svelte` — single-note UI + autosave logic
- `src/app.css` — visual system and layout
- `AGENTS.md` — agent workflow rules

## Development notes
- Data lives in localStorage under the key `the-record-note`
