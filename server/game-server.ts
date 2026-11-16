import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { WebSocket } from 'ws';
import { makePerimeterWalls, MAPS } from '../lib/fps/maps';
import {
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  getAimDirection,
  PLAYER_EYE_HEIGHT,
  raycastMap,
  raycastPlayers,
  SLIDE_EYE_HEIGHT,
  stepPlayerMovement,
} from '../lib/fps/physics';
import { formatPlayerDisplayName, generateRoomCode } from '../lib/fps/profile';
import {
  applyDamageAndCheckKill,
  assignTeam,
  getMatchDuration,
  getScoreLimit,
  pickSpawnPoint,
} from '../lib/fps/rules';
import {
  CharacterStyle,
  ClientMessage,
  GameMode,
  KillFeedItem,
  LeaderboardEntry,
  MapData,
  MatchSnapshot,
  PlayerInput,
  PlayerState,
  RoomSummary,
  RoomVisibility,
  ServerMessage,
  ShotEvent,
  WeaponId,
} from '../lib/fps/types';
import { getWeaponBySlot, GUN_GAME_LADDER, WEAPONS } from '../lib/fps/weapons';

interface HistoryFrame {
  time: number;
  x: number;
  y: number;
  z: number;
  sliding: boolean;
}

type BotArchetype = 'rusher' | 'kiter' | 'overwatch';

interface BotBrain {
  archetype: BotArchetype;
  strafeSign: number;
  decisionTimer: number;
  burstTimer: number;
  targetYaw: number;
  targetPitch: number;
}

interface ServerPlayer {
  state: PlayerState;
  preferredWeapon: WeaponId;
  ws?: WebSocket;
  inputQueue: PlayerInput[];
  history: HistoryFrame[];
  bot?: BotBrain;
  estimatedPingMs: number;
  /** Per-weapon magazine bank so switching weapons cannot be used as an instant reload. */
  ammoBank: Partial<Record<WeaponId, number>>;
  /** Anti speed-hack: seconds of simulated movement this player may still consume. */
  inputBudget: number;
  statsRecorded: boolean;
  lastMsgAt: number;
}

interface GameRoom {
  id: string;
  joinCode: string;
  name: string;
  mode: GameMode;
  map: MapData;
  players: Map<string, ServerPlayer>;
  timeRemaining: number;
  scoreLimit: number;
  redScore: number;
  blueScore: number;
  phase: 'countdown' | 'active' | 'ended';
  countdownRemaining: number;
  winnerText: string;
  winnerId: string;
  restartCountdown: number;
  maxPlayers: number;
  botTarget: number;
  isFriendsRoom: boolean;
  visibility: RoomVisibility;
  password: string;
  hostName: string;
  emptySince: number | null;
  nextBotSeq: number;
  /** Dedicated rooms live forever; user/quick-play rooms are removed once empty. */
  persistent: boolean;
  hostId: string | null;
  shuffleMaps: boolean;
  nextMap: MapData | null;
}

export const MAX_ROOM_PLAYERS = 18;
/** Arenas a shuffle room can rotate through (every built-in map). */
const SHUFFLE_POOL = Object.keys(MAPS);
const MAX_ROOMS = 60;
const VALID_MODES: GameMode[] = ['FFA', 'TDM', 'GUN_GAME'];
const VALID_STYLES: CharacterStyle[] = ['vanguard', 'recon', 'juggernaut', 'phantom', 'medtech'];
const VALID_MATERIALS = ['concrete', 'steel', 'crate', 'hazard', 'container_red', 'container_blue', 'accent'];
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const EMPTY_ROOM_TTL_MS = 30 * 1000;
const HEARTBEAT_MS = 15000;
const MAX_CUSTOM_BLOCKS = 120;
const MAX_CUSTOM_SPAWNS = 32;
const SOCKET_MESSAGE_WINDOW_MS = 1000;
const SOCKET_MESSAGE_LIMIT = 240;
const SOCKET_JOIN_WINDOW_MS = 60_000;
const SOCKET_JOIN_LIMIT = 8;
const SOCKET_PROFILE_WINDOW_MS = 60_000;
const SOCKET_PROFILE_LIMIT = 30;

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function hashRoomPassword(password: string): string {
  if (!password) return '';
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 32);
  return `scrypt$${salt.toString('base64')}$${derived.toString('base64')}`;
}

function verifyRoomPassword(password: string, stored: string): boolean {
  if (!stored) return true;
  const [algorithm, saltText, hashText] = stored.split('$');
  if (algorithm !== 'scrypt' || !saltText || !hashText) return false;
  try {
    const expected = Buffer.from(hashText, 'base64');
    const actual = scryptSync(password, Buffer.from(saltText, 'base64'), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/** Sanitises untrusted custom-map geometry and keeps every object inside the playable envelope. */
export function sanitizeCustomMap(raw: unknown): MapData | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Partial<MapData>;
  if (!Array.isArray(m.blocks) || !Array.isArray(m.spawns) || m.spawns.length === 0) return null;
  if (m.blocks.length > MAX_CUSTOM_BLOCKS || m.spawns.length > MAX_CUSTOM_SPAWNS) return null;

  const halfW = clamp(num(m.bounds?.halfW, 22), 10, 40);
  const halfD = clamp(num(m.bounds?.halfD, 22), 10, 40);
  const blocks: MapData['blocks'] = m.blocks.map((b, i) => {
    const w = clamp(num(b?.w, 2), 0.2, Math.min(60, halfW * 2 + 4));
    const h = clamp(num(b?.h, 2), 0.2, 30);
    const d = clamp(num(b?.d, 2), 0.2, Math.min(60, halfD * 2 + 4));
    const xLimit = Math.max(0, halfW + 2 - w / 2);
    const zLimit = Math.max(0, halfD + 2 - d / 2);
    const y = clamp(num(b?.y, h / 2), h / 2 - 0.25, 32 - h / 2);
    return {
      id: typeof b?.id === 'string' ? b.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || `cb_${i}` : `cb_${i}`,
      x: clamp(num(b?.x), -xLimit, xLimit),
      y,
      z: clamp(num(b?.z), -zLimit, zLimit),
      w, h, d,
      material: (VALID_MATERIALS.includes(b?.material as string) ? b?.material : 'crate') as MapData['blocks'][number]['material'],
    };
  });

  const spawns = m.spawns.slice(0, MAX_CUSTOM_SPAWNS).map((sp) => ({
    x: clamp(num(sp?.x), -halfW + PLAYER_RADIUS, halfW - PLAYER_RADIUS),
    y: 0,
    z: clamp(num(sp?.z), -halfD + PLAYER_RADIUS, halfD - PLAYER_RADIUS),
    yaw: ((num(sp?.yaw) + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI,
    team: sp?.team === 'RED' || sp?.team === 'BLUE' ? sp.team : undefined,
  }));

  // Do not allow players to spawn inside low geometry after sanitisation.
  const spawnBlocked = spawns.some((sp) => blocks.some((b) => {
    const verticalOverlap = b.y + b.h / 2 > 0 && b.y - b.h / 2 < PLAYER_HEIGHT;
    const horizontalOverlap = sp.x + PLAYER_RADIUS > b.x - b.w / 2 && sp.x - PLAYER_RADIUS < b.x + b.w / 2 &&
      sp.z + PLAYER_RADIUS > b.z - b.d / 2 && sp.z - PLAYER_RADIUS < b.z + b.d / 2;
    return verticalOverlap && horizontalOverlap;
  }));
  if (spawnBlocked) return null;

  const hasWalls = blocks.some((b) => b.id.startsWith('wall_'));
  return {
    id: 'custom',
    name: typeof m.name === 'string' ? m.name.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 32) || 'Custom Arena' : 'Custom Arena',
    theme: 'custom',
    bounds: { halfW, halfD },
    skyHorizon: Math.floor(clamp(num(m.skyHorizon, 0xbdd4ea), 0, 0xffffff)),
    fogColor: Math.floor(clamp(num(m.fogColor, 0xaec2d6), 0, 0xffffff)),
    floorColor: Math.floor(clamp(num(m.floorColor, 0x3b4452), 0, 0xffffff)),
    blocks: hasWalls ? blocks : [...makePerimeterWalls(halfW, halfD, 5.0), ...blocks],
    spawns,
  };
}

const LEADERBOARD_PATH = path.join(process.cwd(), '.velocity-leaderboard.json');

const BOT_ROSTER: Array<{
  name: string;
  archetype: BotArchetype;
  weapon: WeaponId;
  style: CharacterStyle;
  accent: string;
}> = [
  { name: 'Kestrel-AI', archetype: 'kiter', weapon: 'rifle', style: 'vanguard', accent: '#F59E0B' },
  { name: 'Viper-AI', archetype: 'rusher', weapon: 'smg', style: 'phantom', accent: '#A855F7' },
  { name: 'Specter-AI', archetype: 'overwatch', weapon: 'sniper', style: 'recon', accent: '#38BDF8' },
  { name: 'Breach-AI', archetype: 'rusher', weapon: 'shotgun', style: 'juggernaut', accent: '#EF4444' },
  { name: 'Apex-AI', archetype: 'kiter', weapon: 'rifle', style: 'medtech', accent: '#10B981' },
  { name: 'Falcon-AI', archetype: 'overwatch', weapon: 'sniper', style: 'recon', accent: '#38BDF8' },
  { name: 'Titan-AI', archetype: 'rusher', weapon: 'shotgun', style: 'juggernaut', accent: '#F59E0B' },
  { name: 'Ghost-AI', archetype: 'kiter', weapon: 'smg', style: 'phantom', accent: '#A855F7' },
  { name: 'Nova-AI', archetype: 'kiter', weapon: 'rifle', style: 'medtech', accent: '#10B981' },
  { name: 'Raptor-AI', archetype: 'rusher', weapon: 'smg', style: 'vanguard', accent: '#EF4444' },
  { name: 'Orion-AI', archetype: 'overwatch', weapon: 'sniper', style: 'recon', accent: '#E2E8F0' },
  { name: 'Blaze-AI', archetype: 'rusher', weapon: 'shotgun', style: 'juggernaut', accent: '#F59E0B' },
  { name: 'Cipher-AI', archetype: 'kiter', weapon: 'rifle', style: 'phantom', accent: '#38BDF8' },
  { name: 'Pulse-AI', archetype: 'kiter', weapon: 'smg', style: 'medtech', accent: '#10B981' },
  { name: 'Talon-AI', archetype: 'rusher', weapon: 'rifle', style: 'vanguard', accent: '#F59E0B' },
  { name: 'Wraith-AI', archetype: 'overwatch', weapon: 'sniper', style: 'phantom', accent: '#A855F7' },
  { name: 'Bastion-AI', archetype: 'rusher', weapon: 'shotgun', style: 'juggernaut', accent: '#EF4444' },
];

export class VelocityGameServer {
  private rooms = new Map<string, GameRoom>();
  private socketToPlayer = new Map<WebSocket, { roomId: string; playerId: string }>();
  private leaderboard = new Map<string, LeaderboardEntry>();
  private tickInterval: NodeJS.Timeout | null = null;
  private lastTickTime = Date.now();
  private msgCounter = 0;
  private lastPrune = Date.now();
  private aliveSockets = new Set<WebSocket>();
  private allSockets = new Set<WebSocket>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private socketRates = new Map<WebSocket, { messageWindow: number; messages: number; joinWindow: number; joins: number; profileWindow: number; profiles: number }>();

  constructor() {
    this.loadLeaderboard();
    this.createRoom('foundry-ffa', 'Foundry Yard · FFA', 'FFA', MAPS.foundry, {
      joinCode: 'FOUNDRY',
      persistent: true,
      maxPlayers: MAX_ROOM_PLAYERS,
      botTarget: 4,
      isFriendsRoom: false,
      hostName: 'Dedicated',
    });
    this.createRoom('skyline-tdm', 'Skyline Blocks · TDM', 'TDM', MAPS.skyline, {
      joinCode: 'SKYLINE',
      persistent: true,
      maxPlayers: MAX_ROOM_PLAYERS,
      botTarget: 5,
      isFriendsRoom: false,
      hostName: 'Dedicated',
    });
    this.createRoom('depot-gungame', 'Container Depot · Gun Game', 'GUN_GAME', MAPS.depot, {
      joinCode: 'DEPOT',
      persistent: true,
      maxPlayers: MAX_ROOM_PLAYERS,
      botTarget: 4,
      isFriendsRoom: false,
      hostName: 'Dedicated',
    });
    this.createRoom('neon-18p', 'Cyber Spire · 18P Brawl', 'FFA', MAPS.neon_grid, {
      joinCode: 'CYBER18',
      persistent: true,
      maxPlayers: MAX_ROOM_PLAYERS,
      botTarget: 10,
      isFriendsRoom: false,
      hostName: 'Dedicated',
    });
    this.createRoom('shuffle-ffa', 'Shuffle Arena · Random Map FFA', 'FFA', MAPS[SHUFFLE_POOL[Math.floor(Math.random() * SHUFFLE_POOL.length)]], {
      joinCode: 'SHUFFLE',
      persistent: true,
      maxPlayers: MAX_ROOM_PLAYERS,
      botTarget: 5,
      isFriendsRoom: false,
      hostName: 'Dedicated',
      shuffleMaps: true,
    });
    this.startLoop();
    this.heartbeatInterval = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    this.heartbeatInterval.unref?.();
  }

  private loadLeaderboard() {
    try {
      if (fs.existsSync(LEADERBOARD_PATH)) {
        const raw = fs.readFileSync(LEADERBOARD_PATH, 'utf8');
        const entries = JSON.parse(raw) as LeaderboardEntry[];
        for (const e of entries) {
          this.leaderboard.set(e.name, e);
        }
      }
    } catch {
      // Ignore corrupt cache
    }
    if (this.leaderboard.size === 0) {
      const now = Date.now();
      const seeds: LeaderboardEntry[] = [
        { name: 'Kestrel-AI', kills: 42, deaths: 19, wins: 5, bestScore: 2150, updatedAt: now },
        { name: 'Viper-AI', kills: 31, deaths: 22, wins: 3, bestScore: 1725, updatedAt: now },
        { name: 'Specter-AI', kills: 27, deaths: 14, wins: 2, bestScore: 1550, updatedAt: now },
      ];
      for (const s of seeds) this.leaderboard.set(s.name, s);
    }
  }

  private saveLeaderboard() {
    try {
      const sorted = this.getLeaderboard().slice(0, 50);
      const tempPath = `${LEADERBOARD_PATH}.${process.pid}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(sorted, null, 2), { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(tempPath, LEADERBOARD_PATH);
    } catch {
      // Non-fatal in read-only environments
    }
  }

  private recordPlayerStats(
    name: string,
    killsDelta: number,
    deathsDelta: number,
    score: number,
    won: boolean,
    save = true,
  ) {
    if (!name) return;
    const prev = this.leaderboard.get(name) || {
      name,
      kills: 0,
      deaths: 0,
      wins: 0,
      bestScore: 0,
      updatedAt: Date.now(),
    };
    prev.kills += killsDelta;
    prev.deaths += deathsDelta;
    if (won) prev.wins += 1;
    if (score > prev.bestScore) prev.bestScore = score;
    prev.updatedAt = Date.now();
    this.leaderboard.set(name, prev);
    if (save) this.saveLeaderboard();
  }

  public getLeaderboard(): LeaderboardEntry[] {
    return Array.from(this.leaderboard.values())
      .sort((a, b) => b.bestScore - a.bestScore || b.kills - a.kills)
      .slice(0, 20);
  }

  public getRoomsSummary(): RoomSummary[] {
    return Array.from(this.rooms.values())
      .filter((r) => r.visibility === 'public')
      .map((r) => {
        let humanCount = 0;
        for (const p of r.players.values()) {
          if (!p.state.isBot) humanCount++;
        }
        return {
          id: r.id,
          joinCode: r.joinCode,
          name: r.name,
          mode: r.mode,
          mapId: r.map.id,
          humanCount,
          totalPlayers: r.players.size,
          maxPlayers: r.maxPlayers,
          botTarget: r.botTarget,
          isFriendsRoom: r.isFriendsRoom,
          visibility: r.visibility,
          hasPassword: Boolean(r.password),
          hostName: r.hostName,
          shuffleMaps: r.shuffleMaps,
          timeRemaining: Math.ceil(r.timeRemaining),
        };
      });
  }

  private generateUniqueJoinCode(): string {
    for (let i = 0; i < 16; i++) {
      const candidate = generateRoomCode(5);
      if (!this.findRoomByIdOrCode(candidate, candidate)) {
        return candidate;
      }
    }
    return `V${Date.now().toString(36).toUpperCase().slice(-5)}`;
  }

  private findRoomByIdOrCode(roomId: string, joinCode?: string): GameRoom | undefined {
    const direct = roomId ? this.rooms.get(roomId) : undefined;
    if (direct) return direct;
    const normalized = (joinCode || roomId).trim().toUpperCase();
    if (!normalized) return undefined;
    for (const r of this.rooms.values()) {
      if (r.joinCode.toUpperCase() === normalized || r.id.toUpperCase() === normalized) {
        return r;
      }
    }
    return undefined;
  }

  private generateUniqueRoomId(base: string): string {
    const cleanBase = base.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 28) || 'room';
    for (let i = 0; i < 32; i++) {
      const candidate = `${cleanBase}-${generateRoomCode(5).toLowerCase()}`;
      if (!this.rooms.has(candidate)) return candidate;
    }
    let fallback = `room-${Date.now().toString(36)}-${(++this.msgCounter).toString(36)}`;
    while (this.rooms.has(fallback)) fallback = `room-${Date.now().toString(36)}-${(++this.msgCounter).toString(36)}`;
    return fallback;
  }

  private createRoom(
    id: string,
    name: string,
    mode: GameMode,
    map: MapData,
    opts?: {
      joinCode?: string;
      maxPlayers?: number;
      botTarget?: number;
      isFriendsRoom?: boolean;
      visibility?: RoomVisibility;
      password?: string;
      hostName?: string;
      persistent?: boolean;
      hostId?: string | null;
      shuffleMaps?: boolean;
    },
  ): GameRoom {
    if (this.rooms.has(id)) throw new Error(`Room id already exists: ${id}`);
    const maxPlayers = Math.max(2, Math.min(MAX_ROOM_PLAYERS, opts?.maxPlayers ?? MAX_ROOM_PLAYERS));
    const botTarget = Math.max(0, Math.min(maxPlayers - 1, opts?.botTarget ?? 4));
    const joinCode =
      (opts?.joinCode || id).replace(/[^a-zA-Z0-9-]/g, '').toUpperCase().slice(0, 10) ||
      this.generateUniqueJoinCode();
    if (Array.from(this.rooms.values()).some((existing) => existing.joinCode === joinCode)) {
      throw new Error(`Room join code already exists: ${joinCode}`);
    }
    const isHosted = Boolean(opts?.isFriendsRoom);
    const visibility: RoomVisibility = opts?.visibility || 'public';

    const room: GameRoom = {
      id,
      joinCode,
      name,
      mode,
      map,
      players: new Map(),
      timeRemaining: getMatchDuration(mode),
      scoreLimit: getScoreLimit(mode),
      redScore: 0,
      blueScore: 0,
      phase: isHosted ? 'countdown' : 'active',
      countdownRemaining: isHosted ? 3.0 : 0,
      winnerText: '',
      winnerId: '',
      restartCountdown: 0,
      maxPlayers,
      botTarget,
      isFriendsRoom: isHosted,
      visibility,
      password: visibility === 'public' ? '' : hashRoomPassword((opts?.password || '').trim().slice(0, 24)),
      hostName: opts?.hostName || 'Host',
      emptySince: null,
      nextBotSeq: 1,
      persistent: Boolean(opts?.persistent),
      hostId: opts?.hostId ?? null,
      shuffleMaps: Boolean(opts?.shuffleMaps),
      nextMap: null,
    };
    this.rooms.set(id, room);
    this.syncRoomBots(room);
    return room;
  }

  private syncRoomBots(room: GameRoom) {
    const humanCount = Array.from(room.players.values()).filter((p) => !p.state.isBot).length;
    const maxAllowedBots = Math.max(0, room.maxPlayers - humanCount);
    const desiredBots = room.isFriendsRoom
      ? Math.min(maxAllowedBots, room.botTarget)
      : Math.min(maxAllowedBots, Math.max(0, room.botTarget - Math.max(0, humanCount - 1)));
    const currentBots = Array.from(room.players.values()).filter((p) => p.state.isBot);

    if (currentBots.length < desiredBots) {
      const needed = desiredBots - currentBots.length;
      for (let i = 0; i < needed; i++) {
        const spec = BOT_ROSTER[(room.nextBotSeq - 1) % BOT_ROSTER.length];
        const botId = `bot_${room.id}_${room.nextBotSeq++}`;
        const existingStates = Array.from(room.players.values()).map((p) => p.state);
        const team = assignTeam(room.mode, existingStates);
        const spawn = pickSpawnPoint(room.map, team, existingStates);
        const weaponId: WeaponId = room.mode === 'GUN_GAME' ? GUN_GAME_LADDER[0] : spec.weapon;

        const botPlayer: ServerPlayer = {
          preferredWeapon: spec.weapon,
          state: {
            id: botId,
            name: spec.name,
            isBot: true,
            team,
            characterStyle: spec.style,
            accentColor: spec.accent,
            x: spawn.x,
            y: spawn.y,
            z: spawn.z,
            vx: 0,
            vy: 0,
            vz: 0,
            yaw: spawn.yaw,
            pitch: 0,
            hp: 100,
            maxHp: 100,
            shield: 50,
            maxShield: 50,
            grounded: true,
            sliding: false,
            slideTimer: 0,
            coyoteTimer: 0.1,
            alive: true,
            respawnTimer: 0,
            weaponId,
            ammo: WEAPONS[weaponId].magSize,
            reloading: false,
            reloadTimer: 0,
            lastFireTime: 0,
            kills: 0,
            deaths: 0,
            score: 0,
            gunGameTier: 0,
            streak: 0,
            shotsFired: 0,
            shotsHit: 0,
            lastProcessedSeq: 0,
          },
          inputQueue: [],
          history: [],
          estimatedPingMs: 0,
          ammoBank: {},
          inputBudget: 0,
          statsRecorded: false,
          lastMsgAt: Date.now(),
          bot: {
            archetype: spec.archetype,
            strafeSign: Math.random() > 0.5 ? 1 : -1,
            decisionTimer: Math.random() * 0.5,
            burstTimer: 0,
            targetYaw: spawn.yaw,
            targetPitch: 0,
          },
        };
        room.players.set(botId, botPlayer);
      }
    } else if (currentBots.length > desiredBots) {
      const toRemove = currentBots.length - desiredBots;
      for (let i = 0; i < toRemove; i++) {
        room.players.delete(currentBots[i].state.id);
      }
    }
  }

  public handleConnection(ws: WebSocket) {
    this.aliveSockets.add(ws);
    this.allSockets.add(ws);
    this.socketRates.set(ws, { messageWindow: Date.now(), messages: 0, joinWindow: Date.now(), joins: 0, profileWindow: Date.now(), profiles: 0 });
    ws.on('pong', () => {
      this.aliveSockets.add(ws);
    });

    ws.on('message', (data) => {
      this.aliveSockets.add(ws);
      try {
        const msg = JSON.parse(data.toString()) as ClientMessage;
        if (!msg || typeof msg !== 'object' || typeof (msg as { type?: unknown }).type !== 'string') {
          throw new Error('bad packet');
        }
        const now = Date.now();
        const rate = this.socketRates.get(ws);
        if (rate) {
          if (now - rate.messageWindow >= SOCKET_MESSAGE_WINDOW_MS) { rate.messageWindow = now; rate.messages = 0; }
          rate.messages++;
          if (rate.messages > SOCKET_MESSAGE_LIMIT) {
            this.send(ws, { type: 'error', message: 'Too many messages. Slow down and reconnect.' });
            ws.close();
            return;
          }
          if (msg.type === 'join') {
            if (now - rate.joinWindow >= SOCKET_JOIN_WINDOW_MS) { rate.joinWindow = now; rate.joins = 0; }
            if (++rate.joins > SOCKET_JOIN_LIMIT) {
              this.send(ws, { type: 'error', message: 'Too many room joins. Please wait before trying again.' });
              return;
            }
          } else if (msg.type === 'update_profile') {
            if (now - rate.profileWindow >= SOCKET_PROFILE_WINDOW_MS) { rate.profileWindow = now; rate.profiles = 0; }
            if (++rate.profiles > SOCKET_PROFILE_LIMIT) {
              this.send(ws, { type: 'error', message: 'Profile updates are temporarily rate limited.' });
              return;
            }
          }
        }
        this.onClientMessage(ws, msg);
      } catch {
        this.send(ws, { type: 'error', message: 'Invalid packet format' });
      }
    });

    ws.on('close', () => {
      this.aliveSockets.delete(ws);
      this.allSockets.delete(ws);
      this.socketRates.delete(ws);
      this.removeSocket(ws);
    });
    ws.on('error', () => {
      this.aliveSockets.delete(ws);
      this.allSockets.delete(ws);
      this.socketRates.delete(ws);
      this.removeSocket(ws);
    });
  }

  /** Terminates sockets that stopped answering pings (dropped mobile connections, sleeping tabs). */
  private heartbeat() {
    for (const ws of Array.from(this.allSockets)) {
      if (!this.aliveSockets.has(ws)) {
        ws.terminate();
        continue;
      }
      this.aliveSockets.delete(ws);
      try {
        ws.ping();
      } catch {
        ws.terminate();
      }
    }
  }

  private removeSocket(ws: WebSocket) {
    const ref = this.socketToPlayer.get(ws);
    if (!ref) return;
    this.socketToPlayer.delete(ws);
    const room = this.rooms.get(ref.roomId);
    if (!room) return;
    const sp = room.players.get(ref.playerId);
    if (sp) {
      // Only record stats if this match has not been recorded already (avoids double counting).
      if (!sp.statsRecorded && room.phase !== 'ended') {
        this.recordPlayerStats(sp.state.name, sp.state.kills, sp.state.deaths, sp.state.score, false);
      }
      room.players.delete(ref.playerId);
    }
    const humans = Array.from(room.players.values()).filter((p) => !p.state.isBot);
    if (humans.length === 0) {
      room.emptySince = Date.now();
      room.hostId = null;
    } else if (room.hostId === ref.playerId) {
      room.hostId = humans[0].state.id;
    }
    this.syncRoomBots(room);
  }

  private normalizeCode(raw: unknown): string {
    return String(raw ?? '')
      .replace(/[^a-zA-Z0-9-]/g, '')
      .toUpperCase()
      .slice(0, 10);
  }

  private sanitizeInput(raw: PlayerInput): PlayerInput | null {
    if (!raw || typeof raw !== 'object') return null;
    return {
      seq: Math.max(0, Math.floor(num(raw.seq))),
      dt: clamp(num(raw.dt, 0.016), 0.001, 0.05),
      forward: clamp(num(raw.forward), -1, 1),
      strafe: clamp(num(raw.strafe), -1, 1),
      yaw: ((num(raw.yaw) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI,
      pitch: clamp(num(raw.pitch), -1.45, 1.45),
      jump: raw.jump === true,
      slide: raw.slide === true,
      fire: raw.fire === true,
      ads: raw.ads === true,
      reload: raw.reload === true,
      weaponSlot: clamp(Math.floor(num(raw.weaponSlot)), 0, 5),
      timestamp: num(raw.timestamp),
    };
  }

  private queueInput(sp: ServerPlayer, raw: PlayerInput) {
    const input = this.sanitizeInput(raw);
    if (!input) return;
    // Drop out-of-order / replayed packets so inputs can never be applied twice.
    const lastSeq = sp.inputQueue.length
      ? sp.inputQueue[sp.inputQueue.length - 1].seq
      : sp.state.lastProcessedSeq;
    if (input.seq <= lastSeq) return;
    if (sp.inputQueue.length < 64) {
      sp.inputQueue.push(input);
    }
  }

  private onClientMessage(ws: WebSocket, msg: ClientMessage) {
    if (msg.type === 'ping') {
      const ref = this.socketToPlayer.get(ws);
      this.send(ws, { type: 'pong', clientTime: msg.clientTime, serverTime: Date.now() });
      if (ref) {
        const room = this.rooms.get(ref.roomId);
        const sp = room?.players.get(ref.playerId);
        if (sp) {
          // The client measures its own round-trip time (server/client clocks are not comparable).
          const rtt = clamp(num(msg.rtt, sp.estimatedPingMs), 0, 400);
          sp.estimatedPingMs = sp.estimatedPingMs * 0.6 + rtt * 0.4;
        }
      }
      return;
    }

    if (msg.type === 'join') {
      this.removeSocket(ws);

      const mode: GameMode = VALID_MODES.includes(msg.mode) ? msg.mode : 'FFA';
      const displayName = formatPlayerDisplayName(
        typeof msg.name === 'string' ? msg.name : 'Vanguard',
        typeof msg.clanTag === 'string' ? msg.clanTag : '',
      );
      const characterStyle: CharacterStyle = VALID_STYLES.includes(msg.characterStyle as CharacterStyle)
        ? (msg.characterStyle as CharacterStyle)
        : 'vanguard';
      const accentColor =
        typeof msg.accentColor === 'string' && HEX_COLOR.test(msg.accentColor) ? msg.accentColor : '#38BDF8';
      const preferredWeapon: WeaponId =
        msg.preferredWeapon && WEAPONS[msg.preferredWeapon] ? msg.preferredWeapon : 'rifle';

      let targetMap: MapData = MAPS[msg.mapId] || MAPS.foundry;
      if (msg.mapId === 'custom') {
        const clean = sanitizeCustomMap(msg.customMap);
        if (!clean) {
          this.send(ws, { type: 'error', message: 'Custom map was rejected (invalid or empty). Rebuild it in the editor.' });
          return;
        }
        targetMap = clean;
      }

      const requestedPassword = typeof msg.password === 'string' ? msg.password.trim().slice(0, 24) : '';
      const lookupCode = this.normalizeCode(msg.joinCode || msg.roomId);
      const requestedRoomId = String(msg.roomId ?? '').slice(0, 40);
      // Join-by-code flows send a joinCode; quick-play only knows the exact room id and must never
      // be matched to another room through a (possibly colliding) join code.
      let room = msg.joinCode
        ? this.findRoomByIdOrCode(requestedRoomId, lookupCode)
        : this.rooms.get(requestedRoomId);

      if (!room) {
        if (msg.createIfMissing === false) {
          this.send(ws, {
            type: 'error',
            message: `Room ${lookupCode || '—'} not found. Check the code or host a new room.`,
          });
          return;
        }
        if (this.rooms.size >= MAX_ROOMS) {
          this.pruneEmptyRooms(Date.now(), true);
          if (this.rooms.size >= MAX_ROOMS) {
            this.send(ws, { type: 'error', message: 'Server is busy right now. Please try again in a moment.' });
            return;
          }
        }
        const isFriends = Boolean(msg.isFriendsRoom);
        const wantedCode = isFriends ? '' : lookupCode;
        const cleanCode =
          wantedCode && !this.findRoomByIdOrCode(wantedCode, wantedCode)
            ? wantedCode
            : this.generateUniqueJoinCode();
        const requestedCanonicalId = isFriends
          ? `room-${cleanCode}`
          : String(msg.roomId || `room-${cleanCode}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || `room-${cleanCode}`;
        // Never let a sanitised/canonical ID collide with and replace a live room.
        const roomId = this.rooms.has(requestedCanonicalId)
          ? this.generateUniqueRoomId(isFriends ? 'room' : requestedCanonicalId)
          : requestedCanonicalId;
        const label = typeof msg.roomName === 'string' && msg.roomName.trim()
          ? msg.roomName.trim().slice(0, 32)
          : isFriends
          ? `${displayName}'s Room · ${targetMap.name}`
          : `${targetMap.name} · ${mode}`;

        room = this.createRoom(roomId, label, mode, targetMap, {
          joinCode: cleanCode,
          maxPlayers: clamp(Math.floor(num(msg.maxPlayers, MAX_ROOM_PLAYERS)), 2, MAX_ROOM_PLAYERS),
          botTarget: clamp(Math.floor(num(msg.botCount, isFriends ? 0 : 4)), 0, MAX_ROOM_PLAYERS - 1),
          isFriendsRoom: isFriends,
          visibility: msg.visibility === 'private' ? 'private' : 'public',
          password: requestedPassword,
          hostName: displayName,
          shuffleMaps: msg.shuffleMaps === true && msg.mapId !== 'custom',
        });
      } else {
        if (room.password && !verifyRoomPassword(requestedPassword, room.password)) {
          this.send(ws, {
            type: 'error',
            message: requestedPassword
              ? `Incorrect password for room ${room.joinCode}.`
              : `Room ${room.joinCode} requires a password.`,
          });
          return;
        }
        const humansInRoom = Array.from(room.players.values()).filter((p) => !p.state.isBot).length;
        if (humansInRoom >= room.maxPlayers) {
          this.send(ws, {
            type: 'error',
            message: `Room ${room.joinCode} is full (${room.maxPlayers}/${room.maxPlayers} players).`,
          });
          return;
        }
        // NOTE: an existing room keeps its own mode and map; the welcome packet tells the client what to load.
      }

      room.emptySince = null;
      const playerId = `ply_${++this.msgCounter}_${Math.random().toString(36).slice(2, 6)}`;
      const existingStates = Array.from(room.players.values()).map((p) => p.state);
      const team = assignTeam(room.mode, existingStates);
      const spawn = pickSpawnPoint(room.map, team, existingStates);
      const startWeapon: WeaponId = room.mode === 'GUN_GAME' ? GUN_GAME_LADDER[0] : preferredWeapon;

      const sp: ServerPlayer = {
        preferredWeapon,
        state: {
          id: playerId,
          name: displayName,
          isBot: false,
          team,
          characterStyle,
          accentColor,
          x: spawn.x,
          y: spawn.y,
          z: spawn.z,
          vx: 0,
          vy: 0,
          vz: 0,
          yaw: spawn.yaw,
          pitch: 0,
          hp: 100,
          maxHp: 100,
          shield: 50,
          maxShield: 50,
          grounded: true,
          sliding: false,
          slideTimer: 0,
          coyoteTimer: 0.1,
          alive: true,
          respawnTimer: 0,
          weaponId: startWeapon,
          ammo: WEAPONS[startWeapon].magSize,
          reloading: false,
          reloadTimer: 0,
          lastFireTime: 0,
          kills: 0,
          deaths: 0,
          score: 0,
          gunGameTier: 0,
          streak: 0,
          shotsFired: 0,
          shotsHit: 0,
          lastProcessedSeq: 0,
        },
        ws,
        inputQueue: [],
        history: [],
        estimatedPingMs: 40,
        ammoBank: {},
        inputBudget: 0.3,
        statsRecorded: false,
        lastMsgAt: Date.now(),
      };

      room.players.set(playerId, sp);
      if (!room.hostId) room.hostId = playerId;
      this.socketToPlayer.set(ws, { roomId: room.id, playerId });
      this.syncRoomBots(room);

      this.send(ws, {
        type: 'welcome',
        playerId,
        roomId: room.id,
        joinCode: room.joinCode,
        maxPlayers: room.maxPlayers,
        visibility: room.visibility,
        hasPassword: Boolean(room.password),
        mode: room.mode,
        map: room.map,
      });
      this.send(ws, { type: 'snapshot', snapshot: this.buildSnapshot(room) });
      return;
    }

    const ref = this.socketToPlayer.get(ws);
    if (!ref) return;
    const room = this.rooms.get(ref.roomId);
    const sp = room?.players.get(ref.playerId);
    if (!room || !sp) return;
    sp.lastMsgAt = Date.now();

    if (msg.type === 'update_profile') {
      sp.state.name = formatPlayerDisplayName(
        typeof msg.name === 'string' && msg.name ? msg.name : sp.state.name,
        typeof msg.clanTag === 'string' ? msg.clanTag : '',
      );
      if (VALID_STYLES.includes(msg.characterStyle)) sp.state.characterStyle = msg.characterStyle;
      if (typeof msg.accentColor === 'string' && HEX_COLOR.test(msg.accentColor)) {
        sp.state.accentColor = msg.accentColor;
      }
      if (msg.preferredWeapon && WEAPONS[msg.preferredWeapon]) {
        sp.preferredWeapon = msg.preferredWeapon;
      }
      return;
    }

    if (msg.type === 'input') {
      this.queueInput(sp, msg.input);
    } else if (msg.type === 'inputs') {
      if (Array.isArray(msg.inputs)) {
        for (const raw of msg.inputs.slice(0, 16)) this.queueInput(sp, raw);
      }
    } else if (msg.type === 'respawn_now') {
      if (!sp.state.alive && sp.state.respawnTimer <= 0.6 && room.phase === 'active') {
        this.respawnPlayer(room, sp);
      }
    } else if (msg.type === 'restart_match') {
      // Anyone may rematch once the match is over; mid-match only the host (or a lone human) may restart.
      const humans = Array.from(room.players.values()).filter((p) => !p.state.isBot).length;
      const allowed = room.phase === 'ended' || humans <= 1 || room.hostId === sp.state.id;
      if (allowed) {
        this.resetRoomMatch(room);
      }
    }
  }

  /** Picks a random built-in arena that differs from the current one. */
  private pickNextMap(room: GameRoom): MapData {
    const choices = SHUFFLE_POOL.filter((id) => id !== room.map.id);
    return MAPS[choices[Math.floor(Math.random() * choices.length)]];
  }

  private resetRoomMatch(room: GameRoom) {
    if (room.nextMap) {
      room.map = room.nextMap;
      room.nextMap = null;
      this.broadcast(room, { type: 'map_change', map: room.map });
    }
    room.timeRemaining = getMatchDuration(room.mode);
    room.scoreLimit = getScoreLimit(room.mode);
    room.redScore = 0;
    room.blueScore = 0;
    room.phase = room.isFriendsRoom ? 'countdown' : 'active';
    room.countdownRemaining = room.isFriendsRoom ? 3.0 : 0;
    room.winnerText = '';
    room.winnerId = '';
    room.restartCountdown = 0;

    const allStates: PlayerState[] = [];
    for (const sp of room.players.values()) {
      sp.state.team = room.mode === 'TDM' ? assignTeam('TDM', allStates) : 'NONE';
      allStates.push(sp.state);
    }
    for (const sp of room.players.values()) {
      sp.state.kills = 0;
      sp.state.deaths = 0;
      sp.state.score = 0;
      sp.state.streak = 0;
      sp.state.gunGameTier = 0;
      sp.state.shotsFired = 0;
      sp.state.shotsHit = 0;
      sp.statsRecorded = false;
      sp.inputQueue.length = 0;
      sp.state.weaponId =
        room.mode === 'GUN_GAME' ? GUN_GAME_LADDER[0] : sp.preferredWeapon || 'rifle';
      this.respawnPlayer(room, sp);
    }
  }

  private respawnPlayer(room: GameRoom, sp: ServerPlayer) {
    const others = Array.from(room.players.values())
      .filter((p) => p.state.id !== sp.state.id)
      .map((p) => p.state);
    const spawn = pickSpawnPoint(room.map, sp.state.team, others);
    const s = sp.state;
    s.x = spawn.x;
    s.y = spawn.y;
    s.z = spawn.z;
    s.vx = 0;
    s.vy = 0;
    s.vz = 0;
    s.yaw = spawn.yaw;
    s.pitch = 0;
    s.hp = s.maxHp;
    s.shield = s.maxShield;
    s.alive = true;
    s.respawnTimer = 0;
    s.sliding = false;
    s.slideTimer = 0;
    s.reloading = false;
    s.reloadTimer = 0;
    if (room.mode !== 'GUN_GAME') {
      s.weaponId = sp.preferredWeapon || s.weaponId;
    }
    s.ammo = WEAPONS[s.weaponId].magSize;
    sp.ammoBank = {};
  }

  private startLoop() {
    if (this.tickInterval) return;
    this.lastTickTime = Date.now();
    this.tickInterval = setInterval(() => {
      const now = Date.now();
      const realDt = Math.min((now - this.lastTickTime) / 1000, 0.5);
      const dt = Math.min(realDt, 0.05);
      this.lastTickTime = now;
      this.stepAllRooms(dt, now, realDt);
    }, 33);
  }

  private pruneEmptyRooms(now: number, force = false) {
    for (const [roomId, room] of Array.from(this.rooms.entries())) {
      if (room.persistent) continue;
      const hasHuman = Array.from(room.players.values()).some((p) => !p.state.isBot);
      if (hasHuman) continue;
      const since = room.emptySince ?? now;
      if (force || now - since > EMPTY_ROOM_TTL_MS) {
        this.rooms.delete(roomId);
      }
    }
  }

  private stepAllRooms(dt: number, now: number, realDt: number) {
    if (now - this.lastPrune > 5000) {
      this.lastPrune = now;
      this.pruneEmptyRooms(now);
    }
    for (const room of this.rooms.values()) {
      const hasHuman = Array.from(room.players.values()).some((p) => !p.state.isBot);
      if (!hasHuman) continue;

      // Movement-time budget (anti speed-hack): a client may only simulate as much time as has really passed.
      for (const p of room.players.values()) {
        if (!p.state.isBot) p.inputBudget = Math.min(0.6, p.inputBudget + realDt * 1.15);
      }


      if (room.phase === 'countdown') {
        room.countdownRemaining = Math.max(0, room.countdownRemaining - dt);
        for (const sp of room.players.values()) {
          while (sp.inputQueue.length > 0) {
            const inp = sp.inputQueue.shift()!;
            sp.state.lastProcessedSeq = Math.max(sp.state.lastProcessedSeq, inp.seq);
            sp.state.yaw = inp.yaw;
            sp.state.pitch = inp.pitch;
          }
        }
        if (room.countdownRemaining <= 0) {
          room.phase = 'active';
        }
        this.broadcast(room, { type: 'snapshot', snapshot: this.buildSnapshot(room) });
        continue;
      }

      if (room.phase === 'ended') {
        room.restartCountdown -= dt;
        if (room.restartCountdown <= 0) {
          this.resetRoomMatch(room);
        }
        this.broadcast(room, { type: 'snapshot', snapshot: this.buildSnapshot(room) });
        continue;
      }

      room.timeRemaining = Math.max(0, room.timeRemaining - dt);
      if (room.timeRemaining <= 0) {
        this.finishRoomMatch(room, this.computeTimeLimitWinner(room));
        this.broadcast(room, { type: 'snapshot', snapshot: this.buildSnapshot(room) });
        continue;
      }

      for (const sp of room.players.values()) {
        if (!sp.state.alive) {
          sp.state.respawnTimer = Math.max(0, sp.state.respawnTimer - dt);
          if (sp.state.respawnTimer <= 0) {
            this.respawnPlayer(room, sp);
          }
          continue;
        }

        if (sp.state.reloading) {
          sp.state.reloadTimer -= dt;
          if (sp.state.reloadTimer <= 0) {
            sp.state.reloading = false;
            sp.state.reloadTimer = 0;
            sp.state.ammo = WEAPONS[sp.state.weaponId].magSize;
          }
        }

        if (sp.state.isBot && sp.bot) {
          const botInput = this.computeBotInput(room, sp, dt);
          this.processPlayerInput(room, sp, botInput, now);
        } else {
          if (sp.inputQueue.length > 0) {
            while (sp.inputQueue.length > 0) {
              const inp = sp.inputQueue.shift()!;
              if (inp.dt > sp.inputBudget + 0.0005) {
                // Over budget (speed-hack or extreme burst): acknowledge but do not simulate.
                sp.state.lastProcessedSeq = Math.max(sp.state.lastProcessedSeq, inp.seq);
                continue;
              }
              sp.inputBudget -= inp.dt;
              this.processPlayerInput(room, sp, inp, now);
            }
          } else {
            stepPlayerMovement(
              sp.state,
              {
                dt,
                forward: 0,
                strafe: 0,
                yaw: sp.state.yaw,
                pitch: sp.state.pitch,
                jump: false,
                slide: false,
              },
              room.map,
            );
          }
        }

        sp.history.push({
          time: now,
          x: sp.state.x,
          y: sp.state.y,
          z: sp.state.z,
          sliding: sp.state.sliding,
        });
        while (sp.history.length > 0 && now - sp.history[0].time > 550) {
          sp.history.shift();
        }
      }

      this.broadcast(room, { type: 'snapshot', snapshot: this.buildSnapshot(room) });
    }
  }

  private computeBotInput(room: GameRoom, botPlayer: ServerPlayer, dt: number): PlayerInput {
    const s = botPlayer.state;
    const brain = botPlayer.bot!;
    brain.decisionTimer -= dt;
    if (brain.decisionTimer <= 0) {
      brain.decisionTimer = 0.6 + Math.random() * 0.9;
      if (Math.random() < 0.4) brain.strafeSign *= -1;
    }

    let nearest: ServerPlayer | null = null;
    let nearestDist = 9999;
    for (const other of room.players.values()) {
      if (other.state.id === s.id || !other.state.alive) continue;
      if (room.mode === 'TDM' && other.state.team === s.team) continue;
      const d = Math.hypot(other.state.x - s.x, other.state.z - s.z);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = other;
      }
    }

    let forward = 0;
    let strafe = brain.strafeSign * 0.65;
    let jump = false;
    let slide = false;
    let fire = false;

    if (nearest) {
      const dx = nearest.state.x - s.x;
      const dz = nearest.state.z - s.z;
      const horiz = Math.hypot(dx, dz);
      const desiredYaw = Math.atan2(-dx, -dz);
      const dy = nearest.state.y + 1.2 - (s.y + PLAYER_EYE_HEIGHT);
      const desiredPitch = Math.atan2(dy, Math.max(0.5, horiz));

      let yawDiff = desiredYaw - brain.targetYaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      brain.targetYaw += yawDiff * Math.min(1, dt * 6.5);
      brain.targetPitch += (desiredPitch - brain.targetPitch) * Math.min(1, dt * 6.5);

      const eyeOrigin = { x: s.x, y: s.y + PLAYER_EYE_HEIGHT, z: s.z };
      const aimDir = getAimDirection(desiredYaw, desiredPitch);
      const wallHit = raycastMap(eyeOrigin, aimDir, horiz, room.map.blocks);
      const hasLOS = !wallHit || wallHit.distance >= horiz - 0.8;

      if (brain.archetype === 'rusher') {
        forward = horiz > 4.5 ? 1 : -0.3;
        if (hasLOS && horiz > 8 && Math.random() < 0.05) slide = true;
        if (Math.random() < 0.04) jump = true;
      } else if (brain.archetype === 'kiter') {
        forward = horiz > 14 ? 0.85 : horiz < 8 ? -0.75 : 0;
        if (Math.random() < 0.025) jump = true;
      } else {
        forward = horiz > 22 ? 0.6 : horiz < 12 ? -0.8 : 0;
        strafe = brain.strafeSign * 0.45;
      }

      if (hasLOS && Math.abs(yawDiff) < 0.25) {
        fire = Math.random() < 0.65;
      }
    } else {
      forward = 0.6;
      brain.targetYaw += dt * 0.6;
    }

    const aheadDir = getAimDirection(brain.targetYaw, 0);
    const aheadHit = raycastMap(
      { x: s.x, y: s.y + 0.8, z: s.z },
      aheadDir,
      2.0,
      room.map.blocks,
    );
    if (aheadHit && aheadHit.distance < 1.6) {
      jump = true;
      strafe = brain.strafeSign;
    }

    return {
      seq: s.lastProcessedSeq + 1,
      dt,
      forward,
      strafe,
      yaw: brain.targetYaw,
      pitch: brain.targetPitch,
      jump,
      slide,
      fire,
      ads: false,
      reload: s.ammo === 0,
      weaponSlot: 0,
      timestamp: Date.now(),
    };
  }

  private processPlayerInput(room: GameRoom, sp: ServerPlayer, input: PlayerInput, now: number) {
    const s = sp.state;
    s.lastProcessedSeq = Math.max(s.lastProcessedSeq, input.seq);

    if (input.weaponSlot >= 1 && input.weaponSlot <= 5 && room.mode !== 'GUN_GAME') {
      const nextWeapon = getWeaponBySlot(input.weaponSlot);
      if (nextWeapon !== s.weaponId) {
        // Bank the current magazine: switching weapons must not be an instant free reload.
        sp.ammoBank[s.weaponId] = s.ammo;
        s.weaponId = nextWeapon;
        s.reloading = false;
        s.reloadTimer = 0;
        const next = WEAPONS[nextWeapon];
        s.ammo = sp.ammoBank[nextWeapon] ?? next.magSize;
        if (!next.isMelee && s.ammo <= 0) {
          s.reloading = true;
          s.reloadTimer = next.reloadMs / 1000;
        }
      }
    }

    const weapon = WEAPONS[s.weaponId];
    if (input.reload && !weapon.isMelee && !s.reloading && s.ammo < weapon.magSize) {
      s.reloading = true;
      s.reloadTimer = weapon.reloadMs / 1000;
    }

    stepPlayerMovement(s, input, room.map);

    if (
      input.fire &&
      !s.reloading &&
      (weapon.isMelee || s.ammo > 0) &&
      now - s.lastFireTime >= weapon.fireRateMs
    ) {
      // Keep the weapon's true fire rate even though the server ticks at ~30 Hz.
      const overdueMs = now - (s.lastFireTime + weapon.fireRateMs);
      s.lastFireTime = s.lastFireTime > 0 && overdueMs < 40 ? s.lastFireTime + weapon.fireRateMs : now;
      s.shotsFired += 1;

      if (!weapon.isMelee) {
        s.ammo -= 1;
        if (s.ammo === 0) {
          s.reloading = true;
          s.reloadTimer = weapon.reloadMs / 1000;
        }
      }

      const eyeY = s.y + (s.sliding ? SLIDE_EYE_HEIGHT : PLAYER_EYE_HEIGHT);
      const origin = { x: s.x, y: eyeY, z: s.z };
      const speed = Math.hypot(s.vx, s.vz);
      const baseSpread = speed > 2.5 ? weapon.moveSpread : weapon.spread;
      const adsAdjusted = input.ads ? baseSpread * weapon.adsSpreadMult : baseSpread;
      const spreadScale = s.isBot ? adsAdjusted * 2.4 : adsAdjusted;

      const rewindTime = now - Math.min(160, sp.estimatedPingMs * 0.5);
      const targets = Array.from(room.players.values())
        .filter((other) => other.state.id !== s.id && other.state.alive)
        .map((other) => {
          const hist = this.sampleHistoryAt(other, rewindTime);
          return {
            id: other.state.id,
            x: hist.x,
            y: hist.y,
            z: hist.z,
            sliding: hist.sliding,
          };
        });

      let anyHit = false;
      for (let p = 0; p < weapon.pellets; p++) {
        const yawOffset = (Math.random() - 0.5) * 2 * spreadScale;
        const pitchOffset = (Math.random() - 0.5) * 2 * spreadScale;
        const dir = getAimDirection(s.yaw + yawOffset, s.pitch + pitchOffset);

        const wallHit = raycastMap(origin, dir, weapon.range, room.map.blocks);
        const maxPlayerDist = wallHit ? wallHit.distance : weapon.range;
        const playerHit = raycastPlayers(origin, dir, maxPlayerDist, targets, s.id);

        const endPoint = playerHit
          ? playerHit.point
          : wallHit
          ? wallHit.point
          : {
              x: origin.x + dir.x * weapon.range,
              y: origin.y + dir.y * weapon.range,
              z: origin.z + dir.z * weapon.range,
            };

        const shotEvent: ShotEvent = {
          id: `sh_${++this.msgCounter}`,
          shooterId: s.id,
          weaponId: s.weaponId,
          origin,
          endPoint,
          hitPlayerId: playerHit?.playerId,
          headshot: playerHit?.headshot,
          timestamp: now,
        };
        this.broadcast(room, { type: 'shot', shot: shotEvent });

        if (playerHit) {
          anyHit = true;
          const victimSp = room.players.get(playerHit.playerId);
          if (victimSp) {
            const rawDmg = weapon.damage * (playerHit.headshot ? weapon.headshotMult : 1);
            const outcome = applyDamageAndCheckKill(
              victimSp.state,
              s,
              rawDmg,
              playerHit.headshot,
              room.mode,
            );
            if (outcome.appliedDamage > 0) {
              if (sp.ws) {
                this.send(sp.ws, {
                  type: 'hit_confirm',
                  targetId: victimSp.state.id,
                  damage: outcome.appliedDamage,
                  headshot: playerHit.headshot,
                  killed: outcome.killed,
                });
              }
              if (victimSp.ws) {
                this.send(victimSp.ws, {
                  type: 'damaged',
                  attackerId: s.id,
                  damage: outcome.appliedDamage,
                  hp: victimSp.state.hp,
                  shield: victimSp.state.shield,
                });
              }

              if (outcome.killed) {
                if (sp.ws) {
                  this.send(sp.ws, {
                    type: 'medicate',
                    healedHp: outcome.healedHp,
                    healedShield: outcome.healedShield,
                    hp: s.hp,
                    shield: s.shield,
                    headshot: playerHit.headshot,
                  });
                }

                if (room.mode === 'TDM') {
                  if (s.team === 'RED') room.redScore += 1;
                  else if (s.team === 'BLUE') room.blueScore += 1;
                }
                const killItem: KillFeedItem = {
                  id: `kf_${++this.msgCounter}`,
                  killerId: s.id,
                  killerName: s.name,
                  killerTeam: s.team,
                  victimId: victimSp.state.id,
                  victimName: victimSp.state.name,
                  victimTeam: victimSp.state.team,
                  weaponId: s.weaponId,
                  headshot: playerHit.headshot,
                  timestamp: now,
                };
                this.broadcast(room, { type: 'kill', kill: killItem });

                if (room.mode === 'TDM' && (room.redScore >= room.scoreLimit || room.blueScore >= room.scoreLimit)) {
                  const winTeam = room.redScore >= room.scoreLimit ? 'RED TEAM' : 'BLUE TEAM';
                  this.finishRoomMatch(room, `${winTeam} wins Team Deathmatch (${room.redScore} - ${room.blueScore})!`);
                } else if (outcome.matchEnded) {
                  this.finishRoomMatch(room, outcome.winnerText, s.id);
                }
              }
            }
          }
        }
      }
      if (anyHit) s.shotsHit += 1;
    }
  }

  private sampleHistoryAt(sp: ServerPlayer, targetTime: number): HistoryFrame {
    const hist = sp.history;
    if (hist.length === 0) {
      return {
        time: targetTime,
        x: sp.state.x,
        y: sp.state.y,
        z: sp.state.z,
        sliding: sp.state.sliding,
      };
    }
    for (let i = hist.length - 1; i >= 0; i--) {
      if (hist[i].time <= targetTime) {
        return hist[i];
      }
    }
    return hist[0];
  }

  private computeTimeLimitWinner(room: GameRoom): string {
    if (room.mode === 'TDM') {
      if (room.redScore > room.blueScore) return `RED TEAM wins (${room.redScore} - ${room.blueScore})!`;
      if (room.blueScore > room.redScore) return `BLUE TEAM wins (${room.blueScore} - ${room.redScore})!`;
      return `Match Draw (${room.redScore} - ${room.blueScore})`;
    }
    const sorted = Array.from(room.players.values())
      .map((p) => p.state)
      .sort((a, b) => b.kills - a.kills || b.score - a.score);
    const top = sorted[0];
    return top ? `${top.name} wins with ${top.kills} eliminations!` : 'Match Complete';
  }

  private finishRoomMatch(room: GameRoom, winnerText: string, winnerId = '') {
    if (room.phase === 'ended') return;
    room.phase = 'ended';
    room.winnerText = winnerText;
    room.restartCountdown = 12;

    const players = Array.from(room.players.values());
    const topKills = players.reduce((m, p) => Math.max(m, p.state.kills), 0);
    if (!winnerId && room.mode !== 'TDM' && topKills > 0) {
      const leader = players
        .filter((p) => p.state.kills === topKills)
        .sort((a, b) => b.state.score - a.state.score)[0];
      winnerId = leader?.state.id ?? '';
    }
    room.winnerId = winnerId;
    if (room.shuffleMaps) room.nextMap = this.pickNextMap(room);

    for (const sp of players) {
      let won: boolean;
      if (room.mode === 'TDM') {
        // A drawn match has no winning team.
        won =
          (sp.state.team === 'RED' && room.redScore > room.blueScore) ||
          (sp.state.team === 'BLUE' && room.blueScore > room.redScore);
      } else {
        won = sp.state.id === winnerId;
      }
      if (!sp.statsRecorded) {
        sp.statsRecorded = true;
        this.recordPlayerStats(sp.state.name, sp.state.kills, sp.state.deaths, sp.state.score, won, false);
      }
    }
    this.saveLeaderboard();
  }

  private buildSnapshot(room: GameRoom): MatchSnapshot {
    let botCount = 0;
    for (const p of room.players.values()) {
      if (p.state.isBot) botCount++;
    }
    return {
      roomId: room.id,
      joinCode: room.joinCode,
      mode: room.mode,
      mapId: room.map.id,
      maxPlayers: room.maxPlayers,
      botCount,
      visibility: room.visibility,
      hasPassword: Boolean(room.password),
      timeRemaining: room.timeRemaining,
      scoreLimit: room.scoreLimit,
      redScore: room.redScore,
      blueScore: room.blueScore,
      phase: room.phase,
      countdownRemaining: room.countdownRemaining,
      winnerText: room.winnerText,
      winnerId: room.winnerId,
      hostId: room.hostId ?? undefined,
      nextMapName: room.phase === 'ended' && room.nextMap ? room.nextMap.name : undefined,
      serverTime: Date.now(),
      players: Array.from(room.players.values()).map((p) => {
        const st = p.state;
        return {
          ...st,
          x: round3(st.x),
          y: round3(st.y),
          z: round3(st.z),
          vx: round3(st.vx),
          vy: round3(st.vy),
          vz: round3(st.vz),
          yaw: round3(st.yaw),
          pitch: round3(st.pitch),
          slideTimer: round3(st.slideTimer),
          coyoteTimer: round3(st.coyoteTimer),
          respawnTimer: round3(st.respawnTimer),
          reloadTimer: round3(st.reloadTimer),
        };
      }),
    };
  }

  private broadcast(room: GameRoom, msg: ServerMessage) {
    const payload = JSON.stringify(msg);
    const isSnapshot = msg.type === 'snapshot';
    for (const sp of room.players.values()) {
      if (sp.ws && sp.ws.readyState === 1) {
        // Slow client (bad mobile link): skip snapshots instead of building an ever-growing send queue.
        if (isSnapshot && sp.ws.bufferedAmount > 192 * 1024) continue;
        sp.ws.send(payload);
      }
    }
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(msg));
    }
  }
}
