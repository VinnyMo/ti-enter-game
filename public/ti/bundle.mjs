import { decodeProgram, decodeList, decodePicture } from './files.mjs';
import { compile, Runtime } from './runtime.mjs';
import { Display } from './display.mjs';

export function assembleBundle(files, table, font) {
  return {
    programs: Object.fromEntries(['GAME', 'PQ'].map(name => [name, compile(decodeProgram(files[`${name}.83p`], table))])),
    lists: { GAME: decodeList(files['GAME.83l']), PQGD: decodeList(files['PQGD.83l']) },
    pictures: { 2: decodePicture(files['Pic2.83i']), 4: decodePicture(files['Pic4.83i']) }, font
  };
}

export function createSession(bundle, historical = false) {
  const vm = new Runtime(bundle.programs, new Display(bundle.font, bundle.pictures), historical ? bundle.lists : { GAME: Array(100).fill(0), PQGD: [1, 1, 0] });
  if (!historical) {
    // Invoke the original program's master-reset routine to initialize a new game.
    // PQ has no reset routine; its independent fresh-session seed starts at level 1.
    vm.jump('Z1'); vm.run();
    if (vm.error) throw Error(vm.error);
    vm.restart();
  }
  vm.run();
  return vm;
}

export async function fetchBundle() {
  const request = async (name, json = false) => {
    const response = await fetch(new URL(`assets/${name}`, import.meta.url));
    if (!response.ok) throw Error(`Could not load ${name} (${response.status})`);
    return json ? response.json() : response.arrayBuffer();
  };
  const [manifest, table, font] = await Promise.all([request('manifest.json', true), request('tokens.json', true), request('large-font.json', true)]);
  const names = ['GAME.83p', 'PQ.83p', 'GAME.83l', 'PQGD.83l', 'Pic2.83i', 'Pic4.83i'];
  const entries = await Promise.all(names.map(async name => {
    const bytes = await request(name);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
    if (hash !== manifest.files[name]) throw Error(`Original asset integrity check failed: ${name}`);
    return [name, bytes];
  }));
  return { ...assembleBundle(Object.fromEntries(entries), table, font), identity: manifest.files['GAME.83p'] + ':' + manifest.files['PQ.83p'] };
}
