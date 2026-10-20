import { writeFileSync } from 'node:fs';

const state = { startedAt: new Date().toISOString() };
export function diagnostic(patch) {
  Object.assign(state, patch, { updatedAt: new Date().toISOString() });
  try { writeFileSync(new URL('../diagnostics.json', import.meta.url), JSON.stringify(state, null, 2)); }
  catch { /* Diagnostics must never stop key updates. */ }
}
