# Project Velocity – Upgrade Report

## IMPORTANT: what was and was not verified
This sandbox had no network, so `npm install`, `next build` and a browser run were NOT possible.
- Verified: every .ts/.tsx file parses (esbuild); strict type-check of audio + server code; 23/23 automated tests pass (11 original + 12 new multiplayer tests that drive the real server with fake sockets).
- NOT verified: full `tsc`/`next build`, and anything that renders (WebGL visuals, CSS, touch layout, fullscreen, actual audio output). Please run `npm install && npm run dev` and test on a phone and desktop before shipping.

## Multiplayer – bugs found and fixed
1. **Netcode speed bug (client):** at 60 FPS only every 2nd input frame was sent, so the server simulated ~half the movement -> rubber-banding. Now every frame is sent, batched (`inputs` message).
2. **Any player could restart the match for everyone** from the pause menu. Now only the host, a lone human, or anyone after the match ends. Button hidden otherwise.
3. **Joining a room by code could silently change its mode/map** if empty. Rooms now keep their own mode/map.
4. **Lag compensation used a wrong ping** (server clock minus client clock). Client now reports its measured RTT.
5. **Speed-hack / NaN inputs:** inputs were trusted. Added sanitising, replay rejection and a real-time movement budget.
6. **Weapon switching was a free reload** (server + client). Ammo is now banked per weapon.
7. **Fire rate** was quantised by the 30 Hz tick (SMG ~99 ms instead of 75 ms) and disagreed with client prediction. Now matches spec. NOTE: this makes fast weapons slightly stronger than before – rebalance if desired.
8. **Untrusted join data** (huge/NaN custom maps, bad colours/modes, NaN limits) is validated; WebSocket payload capped at 256 KB (was 100 MB).
9. **Room leaks:** unlimited rooms could be created and never deleted. Added 60-room cap and cleanup of empty rooms after 30 s (dedicated rooms persist).
10. **Custom-map rooms shared one id** (`custom-ffa`), so players got each other's maps. Now unique per player; join codes are guaranteed unique.
11. **Dead connections** (mobile network drops) stayed as ghost players. Added ping/pong heartbeat (15 s).
12. **Client had no disconnect handling** – the game froze silently. Now shows an error and returns to lobby; 10 s connect timeout.
13. **Leaderboard double counting** on leaving after a match, TDM draws counting as wins for both teams, and a disk write per player. Fixed. Winner is now decided by the server (`winnerId`) instead of matching names in text.
14. Snapshot bandwidth reduced (numbers rounded) and slow clients skipped instead of buffering.

Multiplayer options rechecked by tests: join dedicated room by code, unknown code error, public/private rooms, password required/wrong/correct, private rooms hidden from the list, max-player limit, host restart rules, sanitising, speed-hack cap, ammo bank, disconnect/prune, heartbeat.
Not testable here: real network play across devices, latency feel, and 18-player load.

## Sound
The old audio was single oscillator beeps. Replaced with a synthesised engine (no asset files): noise-based gunshots per weapon with distance filtering and reverb, bus compressor, footsteps (local + other players in 3D), landing, jump/slide, 3-stage reload, empty-click, bullet impacts, near-miss whiz, death/respawn, win/lose jingle, UI clicks, low-health heartbeat, procedural background music (calmer menu, driving in-match). Added Master Volume slider and Music toggle in the pause menu. Mute button still works.

## Mobile
Floating joystick (appears under your thumb), look area, **weapon switch buttons (previously missing on touch)**, fire button no longer sticks when the thumb slides off, drag-while-firing aims, haptic taps, safe-area insets for notches, `100dvh` layout (no URL-bar overflow), no accidental zoom, portrait hint, PWA manifest + icons so "Add to Home Screen" runs fullscreen landscape.

## Fullscreen
Button pinned at the top-centre on every screen. Uses Fullscreen API (with webkit fallback), locks landscape on phones, syncs with Esc. iPhone Safari has no fullscreen API for pages, so the button shows how to Add to Home Screen instead.

## Visuals
Gradient sky dome with sun glow, drifting dust motes, 2048 shadows on High (shadows off on Low), directional damage indicators, pulsing low-health vignette. Kept modest on purpose: the game targets low-spec devices and I could not run WebGL here, so I avoided risky post-processing (bloom etc.).

## Known limitations / suggestions
- Run `npm install` and test visuals/mobile before release; tune sky colours per map if desired.
- Server is single-process, in-memory; leaderboard is a JSON file.
- No cheat protection beyond input validation and the movement budget (hit registration is server-side).
- Possible next steps: bloom for High quality, per-map sky themes, reconnect-to-match, rate-limit joins per IP.

Run tests: `npm test`

## PC performance pass (added later)
- Adaptive resolution now targets the monitor's real refresh rate (60/120/144 Hz) and only scales back up after 4 healthy checks. Previously it assumed 60 FPS, so a 60 Hz screen could get stuck at low resolution.
- Shadow map is rendered once per map instead of every frame (only static blocks cast shadows) – large GPU saving on PC.
- Static map meshes no longer recompute matrices every frame.
- Fewer React re-renders: HUD data is sent once per second on the title screen and 4x/sec while paused (was 6x/sec and 15x/sec).
- Input history raised from 60 to 300 so 144–240 Hz monitors reconcile correctly on higher ping.
- Raw (unaccelerated) mouse input is requested where the browser supports it, with automatic fallback.
Not measured: I could not run the game here, so these are expected gains, not benchmarks. Check the FPS badge in-game before/after.

## Maps and map shuffle (added later)
- **12 arenas now** (6 original + 6 new): Midnight Warehouse (shelving + mezzanines), Dune Canyon (central mesa, rock spires), Dockside Harbor (stacked containers, cranes), Frostbite Outpost (corner watchtowers, bunker ring), Obsidian Colosseum (pillar ring, central dais), Neon Labyrinth (tight maze for close-quarters fights).
- **Original maps upgraded:** climbable staircases to towers and stacks, elevated bridges/catwalks/rampart walkways (Foundry, Skyline, Depot, Reactor, Citadel, Cyber Spire) and extra low cover. New maps are point-symmetric so both teams get the same layout.
- **Map validation tests (new):** no overlapping/out-of-bounds blocks, no spawn inside geometry, >=4 spawns per team and far apart, no sealed-off floor areas, and every elevated platform has a way up. These caught and fixed two of my own layout mistakes (foundry stairs blocking a spawn's view, labyrinth spawns facing walls).
- **Random map shuffle:** "Random Map" tile and a Shuffle button in the lobby (always picks a different arena); "Random Map" option when hosting; host checkbox "Switch to a random new map after every match" (the server rotates the map, tells all players, and the end-of-match screen shows "Next map"); and a new always-on public room **Shuffle Arena (code SHUFFLE)**.
- Not verified: how the new maps look and feel in-game (no WebGL here), bot behaviour on the new layouts, and balance. Expect some tuning after playtests. New map names/sky colours reuse the existing theme system.
- Tests: `npm test` runs 30 tests, all passing.

## Follow-up hardening pass
- Room IDs are canonicalised before creation and checked against existing rooms; `createRoom` now refuses duplicate IDs and join codes. A regression test covers punctuation/sanitisation collisions.
- WebSocket connections now have per-connection message, join and profile-update rate limits. Public deployments should also enforce IP/connection limits at the reverse proxy because per-socket limits alone cannot stop reconnect-based abuse.
- Custom map geometry is clamped to a bounded arena envelope, block/spawn counts are capped, colour values are constrained, and spawn points overlapping low geometry are rejected.
- Private-room passwords are now stored as salted scrypt hashes and checked with constant-time comparison rather than retained as plaintext in server memory.
- Leaderboard writes now use a same-directory temporary file and atomic rename to reduce corruption risk during process interruption.
- README, package metadata and `.env.example` were replaced with Project Velocity-specific setup, deployment, controls and security guidance. The unused Gemini API key setup instruction was removed.
- Added regression tests for room-ID collision handling, custom-map geometry and message flooding.

## Remaining work that requires deployment choices or external infrastructure
- Account-level identity and an impersonation-resistant competitive leaderboard require an authentication provider. This project does not currently define one; a client-supplied name or guest identifier is not secure proof of identity. The README now makes this limitation explicit rather than pretending display-name validation solves it.
- Multi-process scaling requires shared room coordination and persistence (for example Redis plus a durable database); the current authoritative room state remains single-process and in-memory.
- IP-level abuse controls should be configured at the deployment proxy/edge, where the real client address is known and trusted proxy headers can be handled correctly.
- Browser/WebGL visuals, real-device performance, gameplay balance and network load still require the owner's hands-on testing.

No tests, lint, build or browser sessions were run during this follow-up pass, as requested; the owner should run the commands in README after installing dependencies.
