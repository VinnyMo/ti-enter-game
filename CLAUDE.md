# THE ENTER GAME

This site runs Vincent Mossman's recovered **TI-BASIC** programs directly in a
focused browser interpreter. It is not Z80/hardware emulation. Do not replace the
original game logic with a hand-written JavaScript game.

## Serving and deployment

- `npm start` runs the existing Express server on `127.0.0.1:3002`.
- `ti-enter-game.service` has working directory `/home/maestro/ti_playground`.
- Nginx proxies `https://vincentmossman.com/ti-emulator/` to this service.
- `public/index.html` is the production entry; `public/preview.html` is the review entry.
- Both load `public/ti/app.mjs`. Assets and imports must be relative to the subpath.
- Express serves these files directly. Static changes do not need a service restart.
- Prior index, server, and instructions are in `backups/pre-ti-basic/`.
- `public/legacy.html` keeps the previous recreation playable with its original save key.
- The pre-restoration server.js change and tracked node_modules changes predate this work.
  Preserve them. The emulator restoration does not require changing server.js.

## Preservation and provenance

The source archive is `research/original/TI83.tig`, downloaded from:
https://github.com/VinnyMo/highSchool_Yoink/blob/master/TI83.tig

It contains 92 variables, including all six dependencies used by GAME/PQ. No
calculator ROM is present. The archive's GAME.83p equals the root GAME.83p exactly;
root GAME.8xp contains the same program tokens in a Plus-format wrapper.

- `research/original/backup/`: untouched GAME.83p, GAME.83l, PQ.83p, PQGD.83l,
  Pic2.83i and Pic4.83i.
- `research/original/GAME.tibasic` and `PQ.tibasic`: readable decoded originals.
- `audit.json` and `backup-audit.json`: checksums and verification.
- `public/ti/assets/`: byte-identical deployable copies; manifest.json pins hashes.
- `files.mjs`: reads TI headers, checksums, program tokens, BCD lists, and pictures.
- `tokens.json`: used-token subset derived with tivars 1.1.1 and its TI_83 table.
- `large-font.json`: printable glyphs from TI-JS `src/gen/encoding.json`, commit
  ed188eb (2025-10-12); retain `public/ti/licenses/ti-js.txt`.
- Retain the TI-Toolkit attribution and `public/ti/licenses/tivars.txt`.

Do not edit or retokenize the original binaries. Runtime corrections belong in
the interpreter/display layer; intentional game edits require a distinct version.
The `.83*` archive suggests a TI-83; the owner recalls possibly a Plus. Neither
model/OS nor cycle-accurate behavior has been conclusively verified on hardware.

## Architecture

- `runtime.mjs`: scoped expression parser, compiler, bounded BASIC VM.
- `display.mjs`: separate home/graph buffers, 96x64 LCD, original picture decoding,
  pixel drawing, line coordinates, Text/Output/Disp/Menu rendering.
- `bundle.mjs`: loads and verifies binary assets; compiles GAME/PQ; starts sessions.
- `app.mjs`: keyboard/pointer controls, bounded scheduling, options, persistence.
- `style.css`: responsive calculator case and five visible game keys.

All commands used by the recovered programs are handled. This is not a general
TI-BASIC environment. Unknown commands produce an error rather than silent no-ops.
Quoted strings, colons, omitted closing quotes/parentheses, named lists, labels,
and subprogram calls are supported. Goto finds the first matching label, preserving
the duplicate A4 in GAME. No eval or Function constructor is used.

The original behavior includes turn-based movement, player on the right, ROCK
through level 5, BOB on 6-14, GIANT on 15+, weapon upgrades costing 15, and money
being awarded at NEXT LEVEL. Preserve overshoot/negative enemy HP and other source
quirks. Do not silently fix the original program while fixing the interpreter.

Fresh GAME state is initialized by executing its own Z1 master-reset routine on
a 100-element list. PQ has no reset routine; its fresh list uses [1,1,0]. The 2014
archive profile starts from the recovered GAME/PQGD lists instead.

## Fidelity limits

A physical/ROM reference run is still outstanding because no usable ROM was
available. Wabbitemu/Numero can be investigated if one becomes available; do not
claim this build is a full hardware emulator or cycle-accurate.

The graphics use original coordinates and picture pixels. Small Text glyphs are
hand-drawn approximations; large glyphs are from TI-JS. Numeric operations round
to 14 significant decimal digits using JavaScript numbers; this is not a complete
TI decimal floating-point implementation. Progress Quest is paced at roughly 300
statements/second, with bounded frame work and no hidden-tab catch-up. Other game
screens run to their next original Pause/Menu. Full graphing, axes rendering, OS
menus, ROM boot, and arbitrary calculator programs are out of scope.

## Controls and saves

Enter advances Pause and selects Menu; up/down select menu items. All four arrows
are shown, but the original main game does not use left/right. Enter does not
repeat while held; arrow repetition is limited to menus. Options provides pause,
return to gameroom (variables retained), import/export, fresh reset, and profile
switching. Progress Quest and Endless Pushing need this external escape mechanism.

Storage keys are `enter-game.tibasic.v1.play` and `enter-game.tibasic.v1.archive`.
Each stores the instruction position, variables, stack, wait state, and LCD
buffers. Assets are immutable. The previous website's `enterGameSave` is untouched.
The archive slot is a playable copy, never a write to the original backup. Invalid
saves are left intact and automatic writes blocked until explicit reset/import.

Bump storage/schema identity when changing instruction layout or serialized
semantics. Validate imported state transactionally. Save progress before slot
switches and page hide. Do not reset or delete someone else's browser storage.

## Verification

Run `npm test` and `npm run verify:assets`. Tests cover source checksums, original
initialization, sprites and thresholds, combat, money/weapon/health purchasing,
skill, rules, summary, death, reset, historical preservation, companion games,
decimal increments, and complete state restoration. These source-based checks
are not a substitute for a future physical-calculator comparison.

Review the preview in an isolated browser context: keyboard Enter and arrows,
touch controls, Options, fresh/historical separation, reload with identical LCD,
320px/390px layouts, and console errors. Ensure legacy saves remain unchanged.
Verify the public page and asset hashes after deployment. Rollback the entry by
copying `backups/pre-ti-basic/index.html` to `public/index.html`; new saves and
original assets should remain intact.

The initial deployment's public HTTPS/browser hash checks are recorded in
`research/live-verification.json` (14 files). Direct Python HTTP requests were
rejected with 403; the actual browser loaded the site successfully and fetched
each file for byte-for-byte verification. Do not treat a bot-client 403 alone as
an application outage.
