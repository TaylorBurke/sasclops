// Picks a new secret-room hash and rewrites both places that depend on it:
// the digest radar.js checks against, and the leaked copy in index.html.
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const room = randomBytes(6).toString('hex');
const digest = createHash('sha256').update(room).digest('hex');
const leak = Buffer.from(`/#${room}`).toString('base64');

function rewrite(file, pattern, replacement) {
  const url = new URL(file, root);
  const before = readFileSync(url, 'utf8');
  if (!pattern.test(before)) throw new Error(`marker not found in ${file}`);
  writeFileSync(url, before.replace(pattern, replacement));
}

rewrite('radar.js', /const ROOM_SHA256 = '[0-9a-f]{64}';/, `const ROOM_SHA256 = '${digest}';`);
rewrite('index.html', /<!-- cfg: [A-Za-z0-9+/=]+ -->/, `<!-- cfg: ${leak} -->`);
