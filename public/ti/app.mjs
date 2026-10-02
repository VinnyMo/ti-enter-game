import { fetchBundle, createSession } from './bundle.mjs';

const $ = id => document.getElementById(id);
const canvas = $('lcd'), ctx = canvas.getContext('2d', { alpha: false });
const frame = ctx.createImageData(96, 64);
const dialog = $('options');
const controlButtons = [...document.querySelectorAll('[data-key]')];
const storagePrefix = 'enter-game.tibasic.v1.';
let bundle, vm, slot = 'play', paused = false, dirty = false, lastSave = 0, lastFrame = 0, lastAnnouncement = '', recoveryBlocked = false, storageWarning = '';
let inputHeld = new Set(), pointerKeys = new Map(), repeats = new Map(), statementCredit = 0;

function status(message) { $('status').textContent = message; }
function save() {
  if (!vm || !bundle || recoveryBlocked) return;
  try {
    localStorage.setItem(storagePrefix + slot, JSON.stringify({ version: 1, identity: bundle.identity, slot, state: vm.snapshot() }));
    dirty = false; lastSave = performance.now();
    storageWarning = '';
  } catch { storageWarning = 'Browser saving is unavailable. Use Export save in Options to keep your progress.'; }
}
function selectSlot(next) {
  if (vm) save();
  slot = next; recoveryBlocked = false; storageWarning = '';
  vm = createSession(bundle, slot === 'archive');
  try {
    const raw = localStorage.getItem(storagePrefix + slot);
    if (raw) {
      try { restore(JSON.parse(raw)); }
      catch {
        // Keep the unreadable save intact. Only an explicit reset/import can replace it.
        recoveryBlocked = true;
        storageWarning = 'The saved session could not be restored. It is preserved; export it before starting a new session.';
      }
    }
  } catch { storageWarning = 'Browser saving is unavailable. You can export your progress from Options.'; }
  dirty = true; paused = false; releaseInputs(); updateSlot(); render();
}
function restore(envelope) {
  if (envelope?.version !== 1 || envelope.identity !== bundle.identity || !['play', 'archive'].includes(envelope.slot)) throw Error('This save belongs to a different game version.');
  // Restore transactionally: a malformed file must not damage the active session.
  const next = createSession(bundle, slot === 'archive');
  next.restore(envelope.state); vm = next;
}
function updateSlot() {
  $('session-name').textContent = slot === 'archive' ? '2014 archive · playable copy' : 'Your game';
  $('switch-slot').textContent = slot === 'archive' ? 'Return to your game' : 'Play the 2014 save';
  $('reset-session').textContent = slot === 'archive' ? 'Restore the original 2014 save' : 'Start a fresh session';
  $('pause-game').textContent = paused ? 'Resume' : 'Pause';
}
function render() {
  if (!vm) return;
  if (vm.display.dirty) {
    const pixels = vm.display.pixels;
    for (let i = 0; i < pixels.length; i++) {
      const color = pixels[i] ? [30, 40, 26] : [176, 190, 143];
      frame.data.set([...color, 255], i * 4);
    }
    ctx.putImageData(frame, 0, 0); vm.display.dirty = false;
  }
  const wait = vm.wait;
  const description = wait?.type === 'menu' ? `${wait.title}. ${wait.items[wait.selected].text}. Use up and down to choose; Enter to select.` : vm.display.description();
  if (description !== lastAnnouncement) {
    $('screen-reader').textContent = description;
    lastAnnouncement = description;
  }
  $('state-dot').classList.toggle('paused', paused || dialog.open);
  if (storageWarning) status(storageWarning);
  else if (vm.error) status(`${vm.error}. Open Options to restart the program or export your save.`);
  else if (paused) status('Paused. Open Options to resume.');
  else if (wait?.type === 'stop') status('Program ended. Press Enter to launch it again.');
  else if (wait?.type === 'menu') status('↑ ↓ choose · ENTER select');
  else if (wait?.type === 'pause') status('Press ENTER to continue.');
  else status('Progress Quest is running. Options lets you pause or return to the gameroom.');
}
function press(key) {
  if (!vm || paused || dialog.open) return;
  if (vm.wait?.type === 'stop' && key === 'Enter') vm.restart();
  else vm.key(key);
  // GAME is input-driven. PQ runs under a separate bounded scheduler below.
  vm.run(vm.program === 'PQ' ? 1 : 2000);
  dirty = true; render();
}
function markKey(key, pressed) { for (const button of controlButtons) if (button.dataset.key === key) button.classList.toggle('pressed', pressed); }
function hold(key, id) {
  if (!vm || inputHeld.has(id) || paused || dialog.open) return;
  inputHeld.add(id); markKey(key, true); press(key);
  // Repeat menu navigation only. Holding Enter must not accidentally skip pauses.
  if (key === 'ArrowUp' || key === 'ArrowDown') repeats.set(id, { key, next: performance.now() + 400 });
}
function release(key, id) { inputHeld.delete(id); repeats.delete(id); markKey(key, false); }
function releaseInputs() { inputHeld.clear(); repeats.clear(); pointerKeys.clear(); statementCredit = 0; controlButtons.forEach(b => b.classList.remove('pressed')); }

for (const button of controlButtons) {
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault(); button.focus({ preventScroll: true });
    button.setPointerCapture(event.pointerId); pointerKeys.set(event.pointerId, button.dataset.key);
    hold(button.dataset.key, `pointer:${event.pointerId}`);
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, event => {
    const key = pointerKeys.get(event.pointerId);
    if (key) release(key, `pointer:${event.pointerId}`);
    pointerKeys.delete(event.pointerId);
  });
  // Keyboard/screen-reader activation emits a click without a pointerdown.
  button.addEventListener('click', event => { if (event.detail === 0) press(button.dataset.key); });
}
window.addEventListener('keydown', event => {
  if (dialog.open || !['Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  // Keep Options and other ordinary buttons keyboard-accessible.
  const target = event.target;
  if (target instanceof HTMLElement && target.closest('button, a, input, select, textarea') && !target.closest('[data-key]')) return;
  event.preventDefault();
  if (!event.repeat) hold(event.key, `keyboard:${event.key}`);
});
window.addEventListener('keyup', event => release(event.key, `keyboard:${event.key}`));
window.addEventListener('blur', () => { releaseInputs(); save(); });
document.addEventListener('visibilitychange', () => { releaseInputs(); save(); lastFrame = 0; });
window.addEventListener('pagehide', save);

$('open-options').addEventListener('click', () => { releaseInputs(); save(); dialog.showModal(); render(); });
$('close-options').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { lastFrame = 0; releaseInputs(); canvas.focus({ preventScroll: true }); render(); });
$('pause-game').addEventListener('click', () => { paused = !paused; updateSlot(); dialog.close(); render(); });
$('restart-program').addEventListener('click', () => { vm.restart(); vm.run(); paused = false; dirty = true; save(); updateSlot(); dialog.close(); render(); });
$('switch-slot').addEventListener('click', () => { selectSlot(slot === 'play' ? 'archive' : 'play'); dialog.close(); });
$('reset-session').addEventListener('click', () => {
  const question = slot === 'archive' ? 'Restore this playable copy to the 2014 backup? Your separate game is kept.' : 'Reset your current BASIC session, including its records? The original 2014 backup and old website save are kept.';
  if (!confirm(question)) return;
  vm = createSession(bundle, slot === 'archive'); recoveryBlocked = false; storageWarning = ''; paused = false; dirty = true; save(); updateSlot(); dialog.close(); render();
});
$('export-save').addEventListener('click', () => {
  let data;
  try { data = recoveryBlocked ? localStorage.getItem(storagePrefix + slot) : null; } catch { /* in-memory export remains available */ }
  data ??= JSON.stringify({ version: 1, identity: bundle.identity, slot, state: vm.snapshot() });
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `enter-game-${slot}-save.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('import-save').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 200000) throw Error('Save file is too large.');
    const data = JSON.parse(await file.text());
    // Validate on a temporary VM before asking to replace any progress.
    const candidate = createSession(bundle); candidate.restore(data.state);
    if (data.version !== 1 || data.identity !== bundle.identity || !['play', 'archive'].includes(data.slot)) throw Error('Save is from a different game version.');
    if (!confirm('Replace the current session with this save? Export your current progress first if you want to keep it.')) return;
    restore(data); recoveryBlocked = false; storageWarning = ''; paused = false; dirty = true; save(); updateSlot(); dialog.close();
  } catch (error) { $('options-message').textContent = `Could not import: ${error.message}`; }
  finally { event.target.value = ''; render(); }
});

function tick(now) {
  if (vm && !document.hidden && !paused && !dialog.open) {
    for (const repeat of repeats.values()) if (now >= repeat.next) {
      if (vm.wait?.type === 'menu') press(repeat.key);
      repeat.next = now + 110;
    }
    if (!vm.wait) {
      // Approximate BASIC pacing, bounded per frame. Never catch up background time.
      const elapsed = lastFrame ? Math.min(now - lastFrame, 50) : 16;
      statementCredit += elapsed * 0.3;
      const budget = Math.floor(statementCredit);
      if (budget > 0) { vm.run(budget); statementCredit -= budget; dirty = true; }
    } else statementCredit = 0;
    if (dirty && now - lastSave > 1200) save();
    render();
  }
  lastFrame = now;
  requestAnimationFrame(tick);
}

try {
  bundle = await fetchBundle();
  selectSlot('play');
  controlButtons.forEach(button => { button.disabled = false; });
  $('open-options').disabled = false;
  requestAnimationFrame(tick);
} catch (error) {
  status(`Unable to load the original game: ${error.message}. Reload to try again.`);
  $('screen-reader').textContent = 'Game could not load.';
}
