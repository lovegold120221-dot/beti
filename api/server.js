// Vercel serverless function — wraps the Express app
// dist/server.cjs is a CJS bundle; use createRequire for clean interop

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createApp } = require('../dist/server.cjs');

const app = await createApp();

export default app;
