# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Identity

You are **Eburon AI Large Language Model**, created by Master E for Eburon AI, founded by Joe Lernout — eburon.ai.

## Commands

```bash
npm run dev      # Start dev server (Express + Vite middleware on port 3000)
npm run build    # Build frontend (vite) + backend (esbuild -> dist/server.cjs)
npm run start    # Run production build (node dist/server.cjs)
npm run lint     # ESLint
```

Dev server uses `tsx server.ts` which runs Express serving the Vite SPA in development mode. Production bundles the server to CJS via esbuild.

## Architecture

This is a full-stack AI voice assistant app ("Beatrice") — React 19 SPA + Express backend in a single process.

**Frontend (React + Vite + Tailwind 4):**
- Entry: `index.tsx` → `App.tsx` → `EburonApp.tsx` (massive ~120KB component — the entire app UI)
- State: Zustand stores in `lib/state.ts` — `useSettings`, `useUI`, `useTools`, `useLogStore`
- Auth + DB: Firebase client in `lib/firebase.ts` (Google OAuth, Firestore with `experimentalForceLongPolling`)
- AI: `lib/genai-live-client.ts` wraps `@google/genai` Live API (bidirectional audio/video streaming)
- Audio: `lib/audio-recorder.ts`, `lib/audio-streamer.ts`, `lib/audioworklet-registry.ts` — Web Audio API pipeline for PCM microphone input and speaker output with Gemini

**Backend (Express in `server.ts`):**
- Firebase Admin SDK for server-side auth verification and Firestore access
- REST API: `/api/settings`, `/api/memories`, `/api/search` (Google Custom Search proxy)
- WhatsApp: dual-provider — Baileys (WhatsApp Web, `@whiskeysockets/baileys`) + Meta Cloud API fallback
- WhatsApp webhook at `/api/whatsapp/webhook` for Meta inbound messages
- "Beatrice" auto-reply via Gemini 2.5 Flash when WhatsApp messages arrive (server-side)
- In dev: Vite middleware handles SPA; in prod: serves `dist/` static files

**Key directories:**
- `lib/` — client logic: Gemini client, Firebase, API client, state, tools, audio, worklets
- `components/` — React components: `EburonApp.tsx` (root), `Sidebar.tsx`, `ArtifactOverlay.tsx`, `ToolEditorModal.tsx`, `GooglePicker.tsx`, `Header.tsx`, `Modal.tsx`
- `contexts/` — React context: `LiveAPIContext.tsx` provides Gemini Live API state via a hook
- `hooks/` — `use-video-stream.ts`, media hooks
- `app/applet/` — applet sub-route
- `dist/` — production build output

**Tools system:**
- Defined in `lib/state.ts` (`workspaceTools`) + `lib/tools/personal-assistant.ts` + `lib/tools/whatsapp.ts`
- All merged in `lib/tools.ts` as `AVAILABLE_TOOLS`
- Tools are sent to Gemini as function declarations; responses are handled in `EburonApp.tsx`
- Custom tools can be added/edited via `ToolEditorModal` (persisted in Zustand only, not to server)

**Auth flow:**
1. Client: Firebase Google OAuth popup (`lib/firebase.ts` → `googleSignIn()`)
2. OAuth scopes: Drive, Gmail, Calendar, Sheets, Docs, Contacts, Chat, Tasks, Forms, Meet
3. Access token cached in Firestore (`users/{uid}.accessToken`) + localStorage
4. Server: Firebase Admin `verifyIdToken()` middleware (`authenticateToken`)

**WhatsApp flow:**
1. Baileys session per Firebase user (auth files in `os.tmpdir()/baileys_auth_{userId}`)
2. QR code generated for pairing, served via `/api/whatsapp/status`
3. Inbound messages trigger Beatrice AI reply (Gemini 2.5 Flash, server-side)
4. Messages logged to Firestore: `users/{uid}/whatsapp_messages`
5. Meta Cloud API used as fallback for sending when Baileys isn't connected

## Environment Variables

Required in `.env.local`: `GEMINI_API_KEY`
Optional: `SUPABASE_*`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `FIREBASE_*`, `GOOGLE_SEARCH_*`, `PORT` (default 3000)

## Rules

- Mock data is strictly forbidden. Never generate placeholder data, fake API keys, or simulated responses.
- If required credentials or endpoints are missing, stop and report exactly what is missing.
- The `firebase-applet-config.json` file contains Firebase client config — do not commit sensitive changes to it.
- Firebase Firestore uses `experimentalForceLongPolling: true` — this is critical, do not remove.
- Never use `mcp__claude-in-chrome__*` tools for browsing — use `/browse` skill from gstack instead.
