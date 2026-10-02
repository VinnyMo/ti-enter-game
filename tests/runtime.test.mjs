import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { assembleBundle, createSession } from '../public/ti/bundle.mjs';
import { decodeProgram, variableFile } from '../public/ti/files.mjs';
import { compile, numeric } from '../public/ti/runtime.mjs';

const asset = name => readFileSync(new URL(`../public/ti/assets/${name}`, import.meta.url));
const tokens = JSON.parse(asset('tokens.json'));
const manifest = JSON.parse(asset('manifest.json'));
const files = Object.fromEntries(Object.keys(manifest.files).map(name => [name, asset(name)]));
const bundle = assembleBundle(files, tokens, JSON.parse(asset('large-font.json')));
function key(vm, key = 'Enter') { vm.key(key); vm.run(); assert.equal(vm.error, null); }
function select(vm, text) {
  assert.equal(vm.wait?.type, 'menu', `Expected menu before selecting ${text}`);
  const i = vm.wait.items.findIndex(item => item.text === text);
  assert.notEqual(i, -1, `${text} exists in ${vm.wait.title}`);
  while (vm.wait.selected !== i) key(vm, 'ArrowDown');
  key(vm);
}
function play(vm = createSession(bundle)) {
  select(vm, 'ENTER GAME'); key(vm); select(vm, 'START');
  if (vm.wait?.title === 'CONTINUE GAME?') select(vm, 'CONTINUE...');
  assert.equal(vm.wait.type, 'pause'); return vm;
}
function defeat(vm) { for (let i = 0; i < 10000 && vm.wait.type === 'pause'; i++) key(vm); assert.equal(vm.wait.title, 'YOU WON!'); }

test('all six deployed files retain the original SHA-256 and TI checksum', () => {
  for (const [name, bytes] of Object.entries(files)) {
    assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.files[name]);
    assert.doesNotThrow(() => variableFile(bytes));
  }
  assert.equal(decodeProgram(files['GAME.83p'], tokens), readFileSync(new URL('../research/original/GAME.tibasic', import.meta.url), 'utf8'));
  const corrupt = Buffer.from(files['GAME.83p']); corrupt[100] ^= 1;
  assert.throws(() => decodeProgram(corrupt, tokens), /checksum/);
});

test('the unchanged programs compile, including omitted parentheses and first duplicate label', () => {
  assert.equal(bundle.programs.GAME.code.length, 571);
  assert.equal(bundle.programs.PQ.code.length, 33);
  const p = bundle.programs.GAME;
  assert.equal(p.labels.get('A4'), p.code.findIndex(s => s.op === 'label' && s.label === 'A4'));
  assert.throws(() => compile('getKey→A'), /Unsupported/);
  assert.throws(() => compile('Goto XY'), /Missing label/);
});

test('fresh reset comes from original BASIC; 2014 historical variables stay immutable', () => {
  const fresh = createSession(bundle), historical = createSession(bundle, true);
  assert.deepEqual(fresh.lists.GAME.slice(0, 14), [0,10,1,1,5,1,0,0,0,1,1,1,1,0]);
  assert.equal(historical.lists.GAME[5], 598);
  assert.equal(historical.lists.GAME[0], 592);
  historical.lists.GAME[5] = 1;
  assert.equal(bundle.lists.GAME[5], 598);
});

test('title loads recovered Pic2 and Enter opens the original menu', () => {
  const vm = createSession(bundle); select(vm, 'ENTER GAME');
  assert.equal(vm.wait.type, 'pause'); assert.equal(vm.lists.GAME[13], 1);
  // The prompt only modifies the bottom rows; title pixels remain exact.
  assert.deepEqual(vm.display.graph.slice(0, 96 * 50), bundle.pictures[2].slice(0, 96 * 50));
  key(vm); assert.equal(vm.wait.title, 'THE ENTER GAME');
});

test('five Enter presses beat level one; next-level selection awards money and enemy health', () => {
  const vm = play();
  assert.equal(vm.lists.GAME[4], 5); assert.equal(vm.variables.B, 0);
  assert.equal(vm.display.graph[52 * 96 + 87], 1, 'original player is on the right');
  assert.equal(vm.display.graph[62 * 96 + 4], 1, 'rock starts on the left');
  key(vm); assert.equal(vm.variables.B, 1); assert.equal(vm.lists.GAME[4], 4);
  for (let i = 0; i < 4; i++) key(vm);
  assert.equal(vm.wait.title, 'YOU WON!'); assert.equal(vm.lists.GAME[6], 0); assert.equal(vm.lists.GAME[5], 1);
  select(vm, 'NEXT LEVEL');
  assert.equal(vm.lists.GAME[6], 10); assert.equal(vm.lists.GAME[5], 2); assert.equal(vm.lists.GAME[4], 6);
});

test('arrow selection wraps and left/right do not invent game actions', () => {
  const vm = createSession(bundle);
  key(vm, 'ArrowUp'); assert.equal(vm.wait.selected, 2);
  key(vm, 'ArrowDown'); assert.equal(vm.wait.selected, 0);
  const state = vm.snapshot(); key(vm, 'ArrowLeft'); key(vm, 'ArrowRight');
  assert.deepEqual(vm.snapshot(), state);
});

test('source thresholds select rock, Bob and giant without cycling', () => {
  for (const [level, height] of [[5,3],[6,10],[14,10],[15,18],[30,18]]) {
    const vm = createSession(bundle); vm.lists.GAME[5] = level;
    play(vm);
    // Test distinctive sprite pixels, below the HP label and away from the HUD.
    if (height === 3) assert.equal(vm.display.graph[59 * 96 + 3], 1);
    if (height === 10) assert.equal(vm.display.graph[52 * 96 + 2], 1);
    if (height === 18) assert.equal(vm.display.graph[44 * 96 + 4], 1);
  }
});

test('store charges 15 for weapon, rejects unaffordable health, then charges 20', () => {
  const vm = play(); defeat(vm); vm.lists.GAME[6] = 20;
  select(vm, 'STORE'); key(vm); select(vm, 'WEAPON+1 -15');
  assert.equal(vm.lists.GAME[3], 2); assert.equal(vm.lists.GAME[6], 5);
  select(vm, 'STORE'); key(vm); select(vm, 'HEALTH+1 -20');
  assert.match(vm.display.description(), /NOT ENOUGH MONEY/); assert.equal(vm.lists.GAME[1], 10);
  key(vm); vm.lists.GAME[6] = 20;
  select(vm, 'STORE'); key(vm); select(vm, 'HEALTH+1 -20');
  assert.equal(vm.lists.GAME[1], 11); assert.equal(vm.lists.GAME[6], 0);
});

test('skill changes movement distance and original death resets stats while showing Pic4', () => {
  const vm = play(); vm.lists.GAME[9] = 80; vm.lists.GAME[4] = 1000;
  key(vm); assert.equal(vm.variables.B, 0); assert.equal(vm.lists.GAME[1], 9);
  vm.lists.GAME[1] = 1;
  key(vm); assert.equal(vm.wait.type, 'pause'); assert.equal(vm.lists.GAME[1], 10); assert.equal(vm.lists.GAME[5], 1);
  for (let i = 0; i < bundle.pictures[4].length; i++) if (bundle.pictures[4][i]) assert.equal(vm.display.graph[i], 1);
  key(vm); assert.equal(vm.wait.title, 'THE ENTER GAME');
});

test('skill floor, rules pages, level summary and master reset follow BASIC branches', () => {
  const vm = play(); defeat(vm);
  select(vm, 'ADJUST SKILL'); key(vm); select(vm, 'SKILL DOWN 1');
  assert.match(vm.display.description(), /SKILL CANT BE 0/); key(vm);
  select(vm, 'ADJUST SKILL'); key(vm); select(vm, 'SKILL UP 1'); assert.equal(vm.lists.GAME[9], 2);
  select(vm, 'LEVEL SUMMARY'); assert.match(vm.display.description(), /ESTIMATED DEATH/); key(vm);
  select(vm, 'GAME MENU'); select(vm, 'OTHER'); select(vm, 'RULES');
  for (let i = 0; i < 4; i++) key(vm);
  assert.equal(vm.wait.title, 'OTHER'); select(vm, 'MASTER RESET'); key(vm); select(vm, 'YES');
  assert.equal(vm.lists.GAME[9], 1); assert.equal(vm.lists.GAME[0], 0); key(vm); assert.equal(vm.wait.title, 'OTHER');
});

test('Endless Pushing retains its independent counter and original pause sequence', () => {
  const vm = createSession(bundle); select(vm, 'ENDLESS PUSHING');
  assert.equal(vm.lists.GAME[99], 1); key(vm); assert.match(vm.display.description(), /SCORE \+1/);
  key(vm); assert.equal(vm.lists.GAME[99], 2);
});

test('PQ is bounded, preserves decimal increments, and advances Enter Game levels', () => {
  const vm = createSession(bundle); select(vm, 'PROGRESS QUEST');
  assert.match(vm.display.description(), /INTEGRATION/);
  vm.key('Enter'); assert.equal(vm.run(50), 50); assert.equal(vm.wait, null);
  assert.equal(vm.lists.GAME[5], 2);
  for (let i = 0; i < 1000 && vm.lists.PQGD[0] < 2; i++) vm.run(10);
  assert.equal(vm.error, null); assert.equal(vm.lists.PQGD[0], 2); assert.equal(vm.lists.GAME[5], 3);
  let n = 1; for (let i = 0; i < 150; i++) n = numeric(n + .1); assert.equal(n, 16);
});

test('session round-trip resumes at the same pixels and instruction, including PQ', () => {
  for (const name of ['ENTER GAME', 'PROGRESS QUEST']) {
    const original = createSession(bundle); select(original, name);
    if (name === 'PROGRESS QUEST') { original.key('Enter'); original.run(80); }
    const saved = JSON.parse(JSON.stringify(original.snapshot()));
    const restored = createSession(bundle); restored.restore(saved);
    assert.deepEqual(restored.snapshot(), saved);
    original.key('Enter'); restored.key('Enter'); original.run(100); restored.run(100);
    assert.deepEqual(restored.snapshot(), original.snapshot());
  }
});

test('malformed saved state and foreign menu destinations are rejected or rebuilt', () => {
  const vm = createSession(bundle); const state = vm.snapshot();
  assert.throws(() => vm.restore({ ...state, pc: -1 }), /Invalid saved/);
  assert.throws(() => vm.restore({ ...state, lists: { GAME: [], PQGD: [] } }), /Invalid saved/);
  const edited = structuredClone(state); edited.wait.items[0].label = 'Z1';
  vm.restore(edited); assert.equal(vm.wait.items[0].label, 'G9');
});
