import { GameMode, MapData, PlayerState, SpawnPoint, Team } from './types';
import { GUN_GAME_LADDER, WEAPONS } from './weapons';

export const KILL_MEDICATE_HP = 35;
export const KILL_MEDICATE_SHIELD = 20;
export const HEADSHOT_MEDICATE_HP = 50;
export const HEADSHOT_MEDICATE_SHIELD = 30;

export function getMatchDuration(mode: GameMode): number {
  if (mode === 'TDM') return 210;
  return 180;
}

export function getScoreLimit(mode: GameMode): number {
  if (mode === 'TDM') return 25;
  if (mode === 'GUN_GAME') return GUN_GAME_LADDER.length;
  return 15;
}

export function assignTeam(mode: GameMode, existing: PlayerState[]): Team {
  if (mode !== 'TDM') return 'NONE';
  let red = 0;
  let blue = 0;
  for (const p of existing) {
    if (p.team === 'RED') red++;
    else if (p.team === 'BLUE') blue++;
  }
  return blue <= red ? 'BLUE' : 'RED';
}

export function pickSpawnPoint(
  map: MapData,
  team: Team,
  others: PlayerState[],
): SpawnPoint {
  const candidates =
    team !== 'NONE'
      ? map.spawns.filter((sp) => sp.team === team)
      : map.spawns;
  const pool = candidates.length > 0 ? candidates : map.spawns;

  let bestSpawn = pool[0];
  let bestScore = -Infinity;

  for (const sp of pool) {
    let minDist = 999;
    for (const o of others) {
      if (!o.alive) continue;
      if (team !== 'NONE' && o.team === team) continue;
      const d = Math.hypot(o.x - sp.x, o.z - sp.z);
      if (d < minDist) minDist = d;
    }
    const jitter = Math.random() * 1.5;
    if (minDist + jitter > bestScore) {
      bestScore = minDist + jitter;
      bestSpawn = sp;
    }
  }

  return bestSpawn;
}

export function applyDamageAndCheckKill(
  victim: PlayerState,
  attacker: PlayerState,
  rawDamage: number,
  headshot: boolean,
  mode: GameMode,
): {
  appliedDamage: number;
  killed: boolean;
  healedHp: number;
  healedShield: number;
  matchEnded: boolean;
  winnerText: string;
} {
  if (!victim.alive) {
    return {
      appliedDamage: 0,
      killed: false,
      healedHp: 0,
      healedShield: 0,
      matchEnded: false,
      winnerText: '',
    };
  }
  if (mode === 'TDM' && victim.team === attacker.team && victim.id !== attacker.id) {
    return {
      appliedDamage: 0,
      killed: false,
      healedHp: 0,
      healedShield: 0,
      matchEnded: false,
      winnerText: '',
    };
  }

  const dmg = Math.max(1, Math.round(rawDamage));
  let rem = dmg;
  if (victim.shield > 0) {
    const absorbed = Math.min(victim.shield, rem);
    victim.shield -= absorbed;
    rem -= absorbed;
  }
  victim.hp = Math.max(0, victim.hp - rem);

  if (victim.hp > 0) {
    return {
      appliedDamage: dmg,
      killed: false,
      healedHp: 0,
      healedShield: 0,
      matchEnded: false,
      winnerText: '',
    };
  }

  // Elimination
  victim.alive = false;
  victim.respawnTimer = 2.6;
  victim.deaths += 1;
  victim.streak = 0;

  attacker.kills += 1;
  attacker.streak += 1;
  attacker.score += headshot ? 150 : 100;

  // Medicate attacker on kill (higher siphon on headshots)
  let healedHp = 0;
  let healedShield = 0;
  if (attacker.alive && attacker.id !== victim.id) {
    const hpBoost = headshot ? HEADSHOT_MEDICATE_HP : KILL_MEDICATE_HP;
    const shieldBoost = headshot ? HEADSHOT_MEDICATE_SHIELD : KILL_MEDICATE_SHIELD;
    const prevHp = attacker.hp;
    const prevShield = attacker.shield;
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + hpBoost);
    attacker.shield = Math.min(attacker.maxShield, attacker.shield + shieldBoost);
    healedHp = Math.max(0, attacker.hp - prevHp);
    healedShield = Math.max(0, attacker.shield - prevShield);
  }

  let matchEnded = false;
  let winnerText = '';

  if (mode === 'GUN_GAME') {
    attacker.gunGameTier += 1;
    if (attacker.gunGameTier >= GUN_GAME_LADDER.length) {
      matchEnded = true;
      winnerText = `${attacker.name} completed the Gun Game Arsenal!`;
    } else {
      const nextWeapon = GUN_GAME_LADDER[attacker.gunGameTier];
      attacker.weaponId = nextWeapon;
      attacker.ammo = WEAPONS[nextWeapon].magSize;
      attacker.reloading = false;
      attacker.reloadTimer = 0;
    }
  } else if (mode === 'FFA') {
    if (attacker.kills >= getScoreLimit('FFA')) {
      matchEnded = true;
      winnerText = `${attacker.name} wins Free-For-All with ${attacker.kills} eliminations!`;
    }
  }

  return {
    appliedDamage: dmg,
    killed: true,
    healedHp,
    healedShield,
    matchEnded,
    winnerText,
  };
}

export interface PostGamePlayerInput {
  id: string;
  name: string;
  team: string;
  kills: number;
  deaths: number;
  score: number;
  isBot?: boolean;
  isSelf?: boolean;
}

export interface PostGameRankedPlayer extends PostGamePlayerInput {
  rank: number;
  kdRatio: number;
  kdFormatted: string;
}

export interface TeamBreakdownBucket {
  team: 'BLUE' | 'RED';
  score: number;
  kills: number;
  deaths: number;
  players: PostGameRankedPlayer[];
}

export interface PostGameSummaryData {
  mode: GameMode;
  winnerText: string;
  scoreLimit: number;
  personal: PostGameRankedPlayer;
  mvp: PostGameRankedPlayer | null;
  teamBreakdown: {
    isTeamMode: boolean;
    winnerTeam: 'BLUE' | 'RED' | 'DRAW' | 'NONE';
    blue: TeamBreakdownBucket;
    red: TeamBreakdownBucket;
  };
  standings: PostGameRankedPlayer[];
}

export function formatKdRatio(kills: number, deaths: number): { kdRatio: number; kdFormatted: string } {
  const ratio = deaths > 0 ? kills / deaths : kills;
  return {
    kdRatio: Math.round(ratio * 100) / 100,
    kdFormatted: ratio.toFixed(2),
  };
}

export function computePostGameSummary(params: {
  mode: GameMode;
  redScore: number;
  blueScore: number;
  scoreLimit: number;
  winnerText: string;
  players: PostGamePlayerInput[];
  fallbackSelf?: {
    name: string;
    team: string;
    kills: number;
    deaths: number;
    score: number;
  };
}): PostGameSummaryData {
  const { mode, redScore, blueScore, scoreLimit, winnerText, players, fallbackSelf } = params;

  const sorted = [...players].sort(
    (a, b) =>
      b.score - a.score ||
      b.kills - a.kills ||
      a.deaths - b.deaths ||
      (a.isSelf ? -1 : b.isSelf ? 1 : 0),
  );

  const standings: PostGameRankedPlayer[] = sorted.map((p, idx) => {
    const { kdRatio, kdFormatted } = formatKdRatio(p.kills, p.deaths);
    return {
      ...p,
      rank: idx + 1,
      kdRatio,
      kdFormatted,
    };
  });

  const selfEntry = standings.find((p) => p.isSelf);
  const fallbackKills = fallbackSelf?.kills ?? 0;
  const fallbackDeaths = fallbackSelf?.deaths ?? 0;
  const fallbackKd = formatKdRatio(fallbackKills, fallbackDeaths);

  const personal: PostGameRankedPlayer = selfEntry || {
    id: 'local',
    name: fallbackSelf?.name || 'Operator',
    team: fallbackSelf?.team || 'NONE',
    kills: fallbackKills,
    deaths: fallbackDeaths,
    score: fallbackSelf?.score ?? 0,
    isSelf: true,
    rank: standings.length + 1,
    kdRatio: fallbackKd.kdRatio,
    kdFormatted: fallbackKd.kdFormatted,
  };

  const mvp = standings[0] || (players.length === 0 && fallbackSelf ? personal : null);

  const bluePlayers = standings.filter((p) => p.team === 'BLUE');
  const redPlayers = standings.filter((p) => p.team === 'RED');
  const sumKills = (list: PostGameRankedPlayer[]) => list.reduce((acc, p) => acc + p.kills, 0);
  const sumDeaths = (list: PostGameRankedPlayer[]) => list.reduce((acc, p) => acc + p.deaths, 0);

  const isTeamMode = mode === 'TDM';
  const winnerTeam: 'BLUE' | 'RED' | 'DRAW' | 'NONE' = !isTeamMode
    ? 'NONE'
    : blueScore > redScore
    ? 'BLUE'
    : redScore > blueScore
    ? 'RED'
    : 'DRAW';

  return {
    mode,
    winnerText,
    scoreLimit,
    personal,
    mvp,
    teamBreakdown: {
      isTeamMode,
      winnerTeam,
      blue: {
        team: 'BLUE',
        score: blueScore,
        kills: sumKills(bluePlayers),
        deaths: sumDeaths(bluePlayers),
        players: bluePlayers,
      },
      red: {
        team: 'RED',
        score: redScore,
        kills: sumKills(redPlayers),
        deaths: sumDeaths(redPlayers),
        players: redPlayers,
      },
    },
    standings,
  };
}

