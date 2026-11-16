export type GameMode = 'FFA' | 'TDM' | 'GUN_GAME';
export type Team = 'NONE' | 'RED' | 'BLUE';
export type WeaponId = 'rifle' | 'smg' | 'shotgun' | 'sniper' | 'pistol' | 'knife';
export type GraphicsQuality = 'auto' | 'low' | 'medium' | 'high';
export type TouchMode = 'auto' | 'on' | 'off';
export type CharacterStyle = 'vanguard' | 'recon' | 'juggernaut' | 'phantom' | 'medtech';
export type RoomVisibility = 'public' | 'private';

export type BlockMaterialType =
  | 'concrete'
  | 'steel'
  | 'crate'
  | 'hazard'
  | 'container_red'
  | 'container_blue'
  | 'accent';

export interface PlayerProfile {
  callsign: string;
  clanTag: string;
  characterStyle: CharacterStyle;
  accentColor: string;
  preferredWeapon: WeaponId;
  careerKills: number;
  careerDeaths: number;
  careerWins: number;
  careerMatches: number;
  bestScore: number;
}

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  role: string;
  slot: number;
  damage: number;
  headshotMult: number;
  fireRateMs: number;
  magSize: number;
  reloadMs: number;
  range: number;
  pellets: number;
  spread: number;
  moveSpread: number;
  adsFovMult: number;
  adsSpreadMult: number;
  hasScope: boolean;
  isMelee?: boolean;
}

export interface MapBlock {
  id: string;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  material: BlockMaterialType;
}

export interface SpawnPoint {
  x: number;
  y: number;
  z: number;
  yaw: number;
  team?: Team;
}

export interface MapData {
  id: string;
  name: string;
  theme:
    | 'industrial'
    | 'rooftop'
    | 'depot'
    | 'reactor'
    | 'citadel'
    | 'cyber'
    | 'warehouse'
    | 'canyon'
    | 'harbor'
    | 'arctic'
    | 'colosseum'
    | 'maze'
    | 'custom';
  bounds: {
    halfW: number;
    halfD: number;
  };
  skyHorizon: number;
  fogColor: number;
  floorColor: number;
  blocks: MapBlock[];
  spawns: SpawnPoint[];
}

export interface PlayerInput {
  seq: number;
  dt: number;
  forward: number;
  strafe: number;
  yaw: number;
  pitch: number;
  jump: boolean;
  slide: boolean;
  fire: boolean;
  ads?: boolean;
  reload: boolean;
  weaponSlot: number;
  timestamp: number;
}

export interface PlayerState {
  id: string;
  name: string;
  isBot: boolean;
  team: Team;
  characterStyle: CharacterStyle;
  accentColor: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  grounded: boolean;
  sliding: boolean;
  slideTimer: number;
  coyoteTimer: number;
  alive: boolean;
  respawnTimer: number;
  weaponId: WeaponId;
  ammo: number;
  reloading: boolean;
  reloadTimer: number;
  lastFireTime: number;
  kills: number;
  deaths: number;
  score: number;
  gunGameTier: number;
  streak: number;
  shotsFired: number;
  shotsHit: number;
  lastProcessedSeq: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ShotEvent {
  id: string;
  shooterId: string;
  weaponId: WeaponId;
  origin: Vec3;
  endPoint: Vec3;
  hitPlayerId?: string;
  headshot?: boolean;
  timestamp: number;
}

export interface KillFeedItem {
  id: string;
  killerId: string;
  killerName: string;
  killerTeam: Team;
  victimId: string;
  victimName: string;
  victimTeam: Team;
  weaponId: WeaponId;
  headshot: boolean;
  timestamp: number;
}

export interface MatchSnapshot {
  roomId: string;
  joinCode: string;
  mode: GameMode;
  mapId: string;
  maxPlayers: number;
  botCount: number;
  visibility: RoomVisibility;
  hasPassword: boolean;
  timeRemaining: number;
  scoreLimit: number;
  redScore: number;
  blueScore: number;
  phase: 'countdown' | 'active' | 'ended';
  countdownRemaining: number;
  winnerText: string;
  /** Server-decided winner (player id) for FFA / Gun Game, empty otherwise. */
  winnerId?: string;
  /** Player id of the room host (may restart the match). */
  hostId?: string;
  /** Set while a shuffle room is waiting to rotate: name of the next arena */
  nextMapName?: string;
  serverTime: number;
  players: PlayerState[];
}

export interface RoomSummary {
  id: string;
  joinCode: string;
  name: string;
  mode: GameMode;
  mapId: string;
  humanCount: number;
  totalPlayers: number;
  maxPlayers: number;
  botTarget: number;
  isFriendsRoom: boolean;
  visibility: RoomVisibility;
  hasPassword: boolean;
  hostName: string;
  shuffleMaps: boolean;
  timeRemaining: number;
}

export interface LeaderboardEntry {
  name: string;
  kills: number;
  deaths: number;
  wins: number;
  bestScore: number;
  updatedAt: number;
}

export type ClientMessage =
  | {
      type: 'join';
      roomId: string;
      joinCode?: string;
      roomName?: string;
      name: string;
      clanTag?: string;
      characterStyle?: CharacterStyle;
      accentColor?: string;
      preferredWeapon?: WeaponId;
      mode: GameMode;
      mapId: string;
      maxPlayers?: number;
      botCount?: number;
      isFriendsRoom?: boolean;
      visibility?: RoomVisibility;
      password?: string;
      shuffleMaps?: boolean;
      createIfMissing?: boolean;
      customMap?: MapData;
    }
  | {
      type: 'update_profile';
      name: string;
      clanTag?: string;
      characterStyle: CharacterStyle;
      accentColor: string;
      preferredWeapon?: WeaponId;
    }
  | { type: 'input'; input: PlayerInput }
  | { type: 'inputs'; inputs: PlayerInput[] }
  | { type: 'ping'; clientTime: number; rtt?: number }
  | { type: 'respawn_now' }
  | { type: 'restart_match' };

export type ServerMessage =
  | {
      type: 'welcome';
      playerId: string;
      roomId: string;
      joinCode: string;
      maxPlayers: number;
      visibility: RoomVisibility;
      hasPassword: boolean;
      mode: GameMode;
      map: MapData;
    }
  | { type: 'snapshot'; snapshot: MatchSnapshot }
  | { type: 'map_change'; map: MapData }
  | { type: 'shot'; shot: ShotEvent }
  | { type: 'kill'; kill: KillFeedItem }
  | {
      type: 'hit_confirm';
      targetId: string;
      damage: number;
      headshot: boolean;
      killed: boolean;
    }
  | {
      type: 'medicate';
      healedHp: number;
      healedShield: number;
      hp: number;
      shield: number;
      headshot: boolean;
    }
  | {
      type: 'damaged';
      attackerId: string;
      damage: number;
      hp: number;
      shield: number;
    }
  | { type: 'pong'; clientTime: number; serverTime: number }
  | { type: 'error'; message: string };
