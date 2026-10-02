# The Enter Game

An original TI-BASIC calculator game, restored from its calculator backup and playable in a browser.

[Play The Enter Game](https://vincentmossman.com/ti-emulator/)

Hand-typed on a calculator, on a family vacation. The original GAME and PQ programs now run in a custom JavaScript interpreter, with their pictures, menus, rules, and quirks carried along.

## Play

Use **Enter** and the **arrow keys**, or tap the on-screen calculator buttons. Open **Options** to pause, return to the gameroom, or switch to a separate playable copy of the 2014 save.

Progress saves in this browser when local storage is available. **Export save** and **Import save** move a session as a JSON file. Keep an export if you want a copy independent of browser storage.

## What is preserved

- Original calculator programs, lists, and pictures in [`public/ti/assets/`](public/ti/assets/)
- Decoded TI-BASIC source and restoration audit in [`research/original/`](research/original/)
- A 96 × 64 display and keyboard/touch controls
- Separate current-game and historical-save sessions
- The [previous web version](public/legacy.html), retained for comparison

This is a focused TI-BASIC interpreter, not a full TI hardware or ROM emulator. Small text and automatic execution speed are approximations. Hardware-level fidelity has not been established, and arbitrary TI programs are outside the verified scope.

## Run locally

Install Node.js and npm, then:

```sh
git clone https://github.com/VinnyMo/ti-enter-game.git
cd ti-enter-game
npm ci
npm start
```

Open [http://localhost:3002](http://localhost:3002). The Express server binds to the loopback interface. There is no frontend build step or ROM download required for the current game.

The server still contains older upload and TIHLE routes. The TIHLE build is not included; those routes are not the current interpreter's startup path. Review the server before exposing a fresh installation publicly.

## Check the restoration

```sh
npm test
npm run verify:assets
```

These commands run the runtime regression checks and asset verification. They do not establish full hardware fidelity or replace rendered browser checks. [Recorded live asset verification](research/live-verification.json) is a historical check, not a current uptime guarantee.

## Source map

- [`public/ti/app.mjs`](public/ti/app.mjs): controls, session switching, browser saves, and import/export
- [`public/ti/runtime.mjs`](public/ti/runtime.mjs): TI-BASIC execution
- [`public/ti/display.mjs`](public/ti/display.mjs): calculator display
- [`public/ti/files.mjs`](public/ti/files.mjs) and [`bundle.mjs`](public/ti/bundle.mjs): original file decoding and session setup
- [`server.js`](server.js): local web server

## Credits

By Vincent Mossman. Large glyphs come from [TI-JS](https://github.com/davidtorosyan/ti-js); token-decoding data comes from [TI-Toolkit](https://github.com/TI-Toolkit/tivars_lib_py). Their MIT notices are retained in [`public/ti/licenses/`](public/ti/licenses/).

Independently made; not affiliated with Texas Instruments. The package declares an MIT license.
