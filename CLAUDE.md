# Project: Life-Stage Auto-Shooter (working title)

A mobile-first 2D action game inspired by **Mr. Autofire** and **Archero**. The goal right now is a **playable browser demo** that I can send as a link to a friend (a Python backend dev) to get him interested in building the backend later.

## About me / how to work with me
- I'm a junior developer: C#/.NET at work, React + TypeScript from a bootcamp. I'm **new to Phaser and game dev**.
- Explain game-dev concepts briefly when you introduce them (game loop, scenes, physics bodies, etc.).
- Work in small steps. After each step, tell me how to run and test it before moving on.
- Don't build ahead of the current step. Ask before adding dependencies.

## Tech stack
- **Phaser (installed as `phaser` v4.0.0, using the "Phaser 3 style" Vite/TS template) + TypeScript**, bundled with **Vite**
- Runs in the browser; deploy to Netlify or itch.io
- Mobile later via Capacitor (NOT part of the demo)
- Strict TypeScript, no `any`
- **Landscape orientation** (matches the side-scrolling platformer gameplay)

## Core gameplay
- **Side-scrolling platformer rooms** (Mr. Autofire style).
- **Controls:** the player auto-fires at the nearest enemy **constantly**, including while moving and jumping (Mr. Autofire style, not Archero). Dodging comes from movement and jumping, not from stopping fire.
- Touch-friendly controls (on-screen joystick/buttons), keyboard for desktop testing.

## Three progression systems
1. **Account level** (permanent, per player, starts at 1): separate from character levels. Players earn account XP during runs and keep it even if they die. Reaching account levels unlocks upgrades (details TBD). *Future plans — not in the demo.*
2. **Battle XP** (in-run, resets every run): kills give battle XP during combat. Filling the bar banks a skill pick — combat is never paused for this. When the room is cleared, the player spends banked picks one at a time (1 of 3 random cards each); leftover XP carries into the next room. *The demo only has this system.*
3. **Character level** (permanent, per character): upgraded with gold + shards. Sets the life stage:
   - Baby: 1–9 (small hitbox, fast, weak)
   - Teen: 10–19 (balanced)
   - Adult: 20–40 (strong, bigger hitbox)

## Skill system
- Combat is never paused for skill picks. Each time the battle XP bar fills during combat, a pick is **banked** (a small counter/icon shows the player one is waiting) and the bar resets; leftover XP carries into the next room.
- When the room is cleared, the player spends banked picks one at a time: **3 random skill cards** are shown, the player taps one, then the next banked pick (if any) is shown the same way. E.g. 2 bars filled in a room = 2 picks after clearing it.
- Skills come from a **local data pool** (plain TS objects, no network).
- Architecture: `SkillData` objects containing stat modifiers (additive and multiplicative). A `PlayerStats` class recalculates final stats from base stats + all active modifiers.
- Flow: battle XP bar fills → `SkillManager.bankPick()` increments the banked-pick counter → on room clear, `SkillManager.onLevelUp()` returns 3 choices per banked pick → render cards → `chooseSkill()` applies the pick → repeat until no picks remain banked.

## Future plans (design for them, don't build them yet)
- Multiple characters/professions (e.g. "Sportsman"), each with a fixed identity perk and its own skill pool.
- Skill rarity tiers C → S. S-tier skills change *how you play*, not just numbers.
- A "Veteran" character who skips the baby stage.
- Python backend (built by my friend) for saving progress, unlocks, leaderboard. It's only called at session start/end. **All gameplay stays client-side.** Anti-cheat = simple sanity checks on submitted run results.

## Economy (Future plans, not in the demo)
- Loot drops (gold, gems, character shards) are chance-based, NOT guaranteed. Shard drop chance is very low by default so upgrades take time and players come back daily.
- Future "Jackpot" character: identity perk increases drop chance for shards, gems and gold.
- Energy system (like Archero): each run costs 4–5 energy, max 30 energy, regenerates 1 energy every 15–30 min (TBD).
- All drop rates, costs and energy values must live in one config/data file so they're easy to tune later.
- Energy and rewards will eventually be validated by the backend (my friend's Python server), since client-side timers can be cheated by changing the device clock.

## Art direction
- Gritty, atmospheric **pixel art** like Terraria/Starbound: moody palettes, dark cracked-reality portals.
- **Not** cute/chibi mobile style.
- For the demo, use **placeholder shapes/colours**. No real art needed yet.

## Demo scope (build ONLY this)
1. One hardcoded character
2. One enemy type
3. Battle XP → skill cards; debug menu selector to start a run as Baby, Teen or Adult (life-stage stats applied at run start, no permanent progression)
4. 5–8 skills, no rarity tiers
5. Game feel ("juice"): hit-stop, screen shake, particles, sound
6. Death screen with restart
7. Deployable browser build (link I can share)

## Out of scope for the demo
Backend, accounts, character select, shop, shards, gems, energy, loot, currencies, rarity tiers, real art, app store builds.

## Build order
1. Scaffold runs; empty scene with a player rectangle that moves and jumps
2. Platform room + camera
3. Auto-fire at nearest enemy constantly, including while moving and jumping
4. One enemy type with health, damage, death
5. Battle XP bar that banks a skill pick on fill (no combat pause, counter/icon shown, leftover XP carries over) + debug menu selector to start a run as Baby/Teen/Adult, applying that life stage's hitbox/speed/damage for the run
6. Room-clear skill-pick screen that works through banked picks one at a time + `PlayerStats` modifier system
7. Juice pass
8. Death screen + restart
9. Production build + deploy

## Commands
Always use the `-nolog` scripts (`npm run dev` / `npm run build` also work but silently ping Phaser Studio's anonymous template-usage tracker via `log.js` — avoid them).
- `npm install`: install dependencies
- `npm run dev-nolog`: run the dev server with hot-reload at http://localhost:8080
- `npm run build-nolog`: production build, output goes to `dist/`

## Project structure (from the official `template-vite-ts` scaffold)
- `index.html` — HTML page hosting the `#game-container` div
- `src/main.ts` — bootstraps the game on `DOMContentLoaded`
- `src/game/main.ts` — Phaser `GameConfig` (1024x768, AUTO renderer) and scene list
- `src/game/scenes/` — `Boot` → `Preloader` → `MainMenu` → `Game` → `GameOver`, in load order
- `public/assets/` — static assets copied as-is into the build
