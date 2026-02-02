# the record

A focused, offline-first note taking app with draggable windows on a canvas.

## Features
- **Multi-window canvas**: Open multiple notes as draggable windows
- **Sidebar**: Click a note to toggle its window open/closed
- **Drag to move**: Grab the title bar to reposition windows
- **Auto-save**: Notes save to localStorage automatically
- **Slash commands**: Type `/` with a prompt and press Cmd+Enter to insert AI-generated text inline

## Quick start
1. `npm install`
2. `npm run dev`
3. Copy `.env.example` to `.env.local` and add API keys

## Project structure
- `src/routes/+page.svelte` — multi-window UI and state management
- `src/app.css` — visual system and layout

## Visual Style
- Warm gradients with a soft glow atmosphere.
- Typography pairing: Space Grotesk for UI text, Fraunces for accent headings.
- Glassy, light surfaces with gentle shadows and rounded corners.
- Layering is managed via `--layer-*` tokens in `src/app.css`; note windows render above the sidebar.

## Data storage
Notes and window positions are stored in localStorage:
- `the-record-notes`: Array of notes (id, title, content, updatedAt)
- `the-record-windows`: Array of open windows (noteId, x, y, zIndex)
