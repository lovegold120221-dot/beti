# Agents

## Dev Server

- `npm run dev` runs Vite dev server + Express backend in one process via `tsx server.ts`
- Vite port is 3000; both frontend and API are served from this single port
- Special headers set for COOP/COEP to support cross-origin work

## Build

- `npm run build` does two things:
  1. `vite build` — builds the React frontend to `dist/`
  2. `esbuild server.ts --bundle --platform=node --format=cjs` — bundles backend to `dist/server.cjs`
- `npm run start` runs the production bundle: `node dist/server.cjs`

## Key Env Vars

- `GEMINI_API_KEY` — used by both frontend (via Vite define) and backend (`server.ts`)
- `FIREBASE_PROJECT_ID` — defaults to `gen-lang-client-0836251512` if not set
- `PORT` — server port (default 3000)

## Firebase Admin

Initialized lazily in `server.ts` with fallback to `firebase-applet-config.json` if env vars are missing.

## Architecture

- `App.tsx` — React frontend entrypoint
- `server.ts` — Express backend (also serves Vite in dev, serves built assets in prod)
- `lib/` — utilities and shared code
- `components/` — React components
- `dist/` — build output (gitignored, contains bundled server.cjs)

## Lint

- `npm run lint` runs ESLint. Ignores `dist/**` and `firestore.rules`.

## Notable Dependencies

- `@whiskeysockets/baileys` — WhatsApp integration (auth state uses multi-file auth)
- `firebase-admin` — server-side Firebase/Firestore
- `@google/genai` — Gemini API client
- `@supabase/supabase-js` — database client