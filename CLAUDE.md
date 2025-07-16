# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **THE ENTER GAME** - a complete JavaScript recreation of a TI-83 Plus calculator game originally created by Vincent Mossman. The project has evolved from TI emulation to a standalone web application.

## Current Project Structure

### Server Setup
```bash
# Start the game server
node server.js

# Server runs on port 3002
# Accessible via nginx at /ti-emulator/
```

### Key Files
- `public/index.html` - Complete JavaScript recreation of THE ENTER GAME
- `server.js` - Express server for hosting the game
- `package.json` - Node.js dependencies (express, multer, cors)
- `GAME.8xp` - Original TI-83 calculator game file (reference)

## Game Architecture

### Game Mechanics
THE ENTER GAME is a simple action game where:
- Player controls a stick figure using only the ENTER key
- Enemies (ROCK, BOB, GIANT) attack by moving left across screen
- Player attacks by pressing ENTER (damage = weapon bonus)
- Enemy collision causes player health loss
- Game progression through levels with increasing difficulty

### Technical Implementation
- **Canvas Rendering**: 300x200px game area with pixel-perfect sprites
- **TI-83 Timing**: Authentic calculator-speed animations (800ms base intervals)
- **Sprite System**: Pixel array-based rendering for authentic retro look
- **Save System**: LocalStorage for game progress and high scores
- **Menu Navigation**: Complete recreation of original TI calculator interface

### Key Game Functions
- `drawStickFigure()` - Renders 6-pixel tall player sprite at `public/index.html:455`
- `drawEnemy()` - Renders enemy sprites based on type at `public/index.html:475`
- `startEnemyAttack()` - Handles enemy movement and collision at `public/index.html:554`
- `handleEnter()` - Primary game input handler at `public/index.html:526`
- `winLevel()` - Level progression logic at `public/index.html:614`

## Nginx Configuration

The game is served through nginx proxy at `/ti-emulator/`:
- Main proxy: `localhost:3002/` 
- Config file: `/etc/nginx/sites-enabled/vincentmossman.com`
- WASM file proxying configured for emulation assets

## Development History

### Completed Features
✅ Complete game recreation with authentic TI-83 styling  
✅ Proper sprite rendering (stick figure player, ROCK/BOB/GIANT enemies)  
✅ Enemy attack animations with calculator-speed timing  
✅ Collision detection and health system  
✅ Level progression and money/weapon upgrades  
✅ Save/load game functionality  
✅ Store system for purchasing upgrades  
✅ High scores and statistics tracking  
✅ Complete menu system recreation  

### Major Fixes Applied
- Fixed game progression when enemy HP reaches 0
- Corrected sprite orientations (were rotated 90 degrees)
- Implemented proper enemy attack movement (right-to-left)
- Fixed player/enemy positioning (both at bottom Y=160)
- Resolved JavaScript syntax errors in navigation
- Updated branding from "METH LABS INC" to "MLI" for discretion
- Cleaned up development environment (removed emulation files)

## Original Game Reference

The `GAME.8xp` file contains the original TI-83 Plus assembly code with:
- Sprite coordinate data for accurate recreation
- Game logic patterns and menu structures  
- Original variable names and flow control
- Credit information and version history

## Server Commands

### Development Mode
```bash
# Install dependencies
npm install

# Start server manually
npm start
# or
node server.js

# Server will be available at:
# Local: http://localhost:3002
# Public: https://vincentmossman.com/ti-emulator/
```

### Production Service (systemd)
The game runs as a systemd service for automatic startup and management:

```bash
# Service management
sudo systemctl start ti-enter-game.service     # Start service
sudo systemctl stop ti-enter-game.service      # Stop service  
sudo systemctl restart ti-enter-game.service   # Restart service
sudo systemctl status ti-enter-game.service    # Check status

# View logs
sudo journalctl -u ti-enter-game.service -f    # Follow logs
sudo journalctl -u ti-enter-game.service       # View all logs

# Service is enabled for automatic startup on boot
# Location: /etc/systemd/system/ti-enter-game.service
```

#### Service Configuration
Service file uses NVM Node.js path and runs as user `maestro`:
- **ExecStart**: `/home/maestro/.nvm/versions/node/v20.19.3/bin/node server.js`
- **WorkingDirectory**: `/home/maestro/ti_playground`
- **User**: `maestro`
- **Auto-restart**: Enabled with 10s delay
- **Boot startup**: Enabled via `systemctl enable`

## Development Notes

### Code Style
- Authentic TI-83 calculator styling with green-on-black terminal theme
- Pixel-perfect sprite rendering with 2-3px scaling
- Monospace fonts and calculator-style UI elements
- Responsive design for mobile and desktop

### Game Balance
- Original health/damage values maintained (10 health, weapon bonus damage)
- Enemy health scales with level (+2 HP per level)
- Store prices: Weapon upgrade $100, Health upgrade $20
- Enemy types cycle every 5 levels (ROCK → BOB → GIANT)

### Testing
- Clear browser cache when testing changes
- Multiple save slots supported via localStorage
- Master reset function available in "OTHER" menu
- Debug info available in browser console