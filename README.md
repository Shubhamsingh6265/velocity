# Project Velocity

Project Velocity is a browser-based 3D multiplayer arena FPS built with Next.js, React, Three.js and a custom WebSocket game server. It includes Free-for-All, Team Deathmatch and Gun Game modes, bots, custom rooms, map editing, 12 built-in arenas, touch controls and a PWA manifest.

## Requirements

- Node.js 20 or newer
- npm 10 or newer (or a compatible package manager)

## Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The custom `server.ts` entry point serves Next.js and the `/ws` WebSocket endpoint together. Do not replace it with `next start` unless you also provide an equivalent WebSocket server.

## Production

```bash
npm install
npm run build
npm start
```

Set `PORT` if the host requires a non-default port. Run one server process per deployment for the current in-memory room model. The JSON leaderboard is stored in `.velocity-leaderboard.json` in the process working directory; mount persistent storage there if leaderboard retention is required. Back up this file.

## Controls

- Desktop: WASD movement, mouse aim, mouse buttons to fire/aim, Space to jump, Shift to slide, number keys to switch weapons, and Esc to pause.
- Mobile: use the on-screen movement/look controls and action buttons. Rotate to landscape for the intended layout.

The in-game controls panel is the authoritative reference if a binding differs by device or browser.

## Tests and quality checks

```bash
npm test
npm run lint
npm run build
```

Also test actual gameplay in current desktop and mobile browsers, multiple devices on a real network, reconnects, custom maps, and sustained matches. Unit tests do not replace browser or load testing.

## Deployment and security notes

- The game server is authoritative for movement, hit registration, room state and match outcomes, but this is not a full anti-cheat system.
- WebSocket messages are size-limited and rate-limited per connection. Put a reverse proxy or edge gateway in front of public deployments and configure connection/IP-level rate limits there as well.
- Rooms and player state are in memory. Multiple server instances do not share rooms; use a shared authoritative service and persistence layer before horizontal scaling.
- The current leaderboard is keyed by display name, not by authenticated account identity. It is suitable for a prototype/community leaderboard only. Before operating a competitive public leaderboard, integrate an authentication provider and bind stats to immutable verified account IDs. Do not treat a client-provided name or guest ID as proof of identity.
- Private-room passwords are ephemeral room access secrets, not account credentials. Avoid reusing personal passwords.
- Set HTTPS/WSS at the deployment edge. Restrict WebSocket origins at the edge to the production site if the deployment platform supports it.

## Project structure

- `app/` – Next.js app shell and global styles
- `components/fps/` – game UI, HUD, lobby, overlays and touch controls
- `lib/fps/` – maps, physics, weapons, rules, rendering, audio and profile helpers
- `server/` – authoritative game server and server tests
- `server.ts` – combined HTTP and WebSocket server entry point

## Known deployment constraints

The server currently uses a single process and local JSON persistence. For production-scale multiplayer, add authenticated accounts, a database, centralized room coordination, observability, abuse monitoring and load-tested deployment limits. Graphics, browser compatibility and device performance must be validated on the target devices before release.
