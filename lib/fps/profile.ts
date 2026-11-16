import { CharacterStyle, PlayerProfile, WeaponId } from './types';

export interface CharacterStyleMeta {
  id: CharacterStyle;
  name: string;
  role: string;
  silhouette: string;
  badgeColor: string;
}

export const CHARACTER_STYLES: CharacterStyleMeta[] = [
  {
    id: 'vanguard',
    name: 'Vanguard',
    role: 'Assault Trooper',
    silhouette: 'Balanced chest plate, tactical pauldrons & wide visor',
    badgeColor: '#F59E0B',
  },
  {
    id: 'recon',
    name: 'Recon',
    role: 'Scout Marksman',
    silhouette: 'Slim chassis, dual-optic goggles & comms antenna',
    badgeColor: '#38BDF8',
  },
  {
    id: 'juggernaut',
    name: 'Juggernaut',
    role: 'Heavy Breacher',
    silhouette: 'Broad armored collar, heavy pauldrons & dorsal pack',
    badgeColor: '#EF4444',
  },
  {
    id: 'phantom',
    name: 'Phantom',
    role: 'Stealth Operative',
    silhouette: 'Angled stealth crest & tri-lens tactical mask',
    badgeColor: '#A855F7',
  },
  {
    id: 'medtech',
    name: 'MedTech',
    role: 'Field Medic',
    silhouette: 'Trauma chest cross, white armor trim & med-pack',
    badgeColor: '#10B981',
  },
];

export const ACCENT_SWATCHES: Array<{ id: string; label: string; hex: number }> = [
  { id: '#38BDF8', label: 'Cyan Optics', hex: 0x38bdf8 },
  { id: '#F59E0B', label: 'Amber Gold', hex: 0xf59e0b },
  { id: '#10B981', label: 'Med Emerald', hex: 0x10b981 },
  { id: '#EF4444', label: 'Crimson Core', hex: 0xef4444 },
  { id: '#A855F7', label: 'Violet Pulse', hex: 0xa855f7 },
  { id: '#E2E8F0', label: 'Titanium', hex: 0xe2e8f0 },
];

export const PROFILE_STORAGE_KEY = 'velocity_player_profile_v1';

export const DEFAULT_PROFILE: PlayerProfile = {
  callsign: 'Vanguard-01',
  clanTag: 'VEL',
  characterStyle: 'vanguard',
  accentColor: '#38BDF8',
  preferredWeapon: 'rifle',
  careerKills: 0,
  careerDeaths: 0,
  careerWins: 0,
  careerMatches: 0,
  bestScore: 0,
};

export function parseHexColor(colorStr: string | undefined, fallback = 0x38bdf8): number {
  if (!colorStr) return fallback;
  const cleaned = colorStr.replace('#', '').trim();
  const parsed = Number.parseInt(cleaned, 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function sanitizeClanTag(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4);
}

export const INVITE_BASE_URL = 'https://project-velocity.ai.studio';

export function buildInviteUrl(code: string): string {
  const clean = code.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase().slice(0, 10);
  return `${INVITE_BASE_URL}/?r=${encodeURIComponent(clean)}`;
}

export function generateRoomCode(length = 5): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function formatPlayerDisplayName(callsign: string, clanTag?: string): string {
  const cleanName = callsign.trim().slice(0, 18) || 'Vanguard-01';
  const tag = sanitizeClanTag(clanTag || '');
  return tag ? `[${tag}] ${cleanName}` : cleanName;
}

export function loadPlayerProfile(): PlayerProfile {
  if (typeof window === 'undefined') return { ...DEFAULT_PROFILE };
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    const validStyles = new Set<CharacterStyle>(CHARACTER_STYLES.map((s) => s.id));
    const validWeapons = new Set<WeaponId>(['rifle', 'smg', 'shotgun', 'sniper', 'knife']);
    return {
      callsign: typeof parsed.callsign === 'string' && parsed.callsign.trim() ? parsed.callsign.slice(0, 18) : DEFAULT_PROFILE.callsign,
      clanTag: typeof parsed.clanTag === 'string' ? sanitizeClanTag(parsed.clanTag) : DEFAULT_PROFILE.clanTag,
      characterStyle: parsed.characterStyle && validStyles.has(parsed.characterStyle) ? parsed.characterStyle : DEFAULT_PROFILE.characterStyle,
      accentColor: typeof parsed.accentColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(parsed.accentColor) ? parsed.accentColor : DEFAULT_PROFILE.accentColor,
      preferredWeapon: parsed.preferredWeapon && validWeapons.has(parsed.preferredWeapon) ? parsed.preferredWeapon : DEFAULT_PROFILE.preferredWeapon,
      careerKills: typeof parsed.careerKills === 'number' ? Math.max(0, parsed.careerKills) : 0,
      careerDeaths: typeof parsed.careerDeaths === 'number' ? Math.max(0, parsed.careerDeaths) : 0,
      careerWins: typeof parsed.careerWins === 'number' ? Math.max(0, parsed.careerWins) : 0,
      careerMatches: typeof parsed.careerMatches === 'number' ? Math.max(0, parsed.careerMatches) : 0,
      bestScore: typeof parsed.bestScore === 'number' ? Math.max(0, parsed.bestScore) : 0,
    };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function savePlayerProfile(profile: PlayerProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}
