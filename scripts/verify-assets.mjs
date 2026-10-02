import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { decodeProgram, variableFile } from '../public/ti/files.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const sha256 = data => createHash('sha256').update(data).digest('hex');
const manifest = JSON.parse(read('public/ti/assets/manifest.json'));
const tokens = JSON.parse(read('public/ti/assets/tokens.json'));
for (const [name, checksum] of Object.entries(manifest.files)) {
  const data = read(`public/ti/assets/${name}`);
  assert.equal(sha256(data), checksum, `${name}: deployment checksum`);
  variableFile(data);
  if (name.endsWith('.83p')) assert.equal(decodeProgram(data, tokens), read(`research/original/${name.slice(0, -4)}.tibasic`).toString(), `${name}: decoded source`);
}
assert.equal(sha256(read('GAME.83p')), manifest.files['GAME.83p']);
console.log('Verified calculator file checksums, binary formats, and both decoded programs.');
