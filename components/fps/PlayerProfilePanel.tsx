'use client';

import React from 'react';
import { RotateCcw, Shield, UserCheck } from 'lucide-react';
import {
  ACCENT_SWATCHES,
  CHARACTER_STYLES,
  formatPlayerDisplayName,
  sanitizeClanTag,
} from '@/lib/fps/profile';
import { PlayerProfile } from '@/lib/fps/types';
import { LOADOUT_WEAPONS, WEAPONS } from '@/lib/fps/weapons';

interface PlayerProfilePanelProps {
  profile: PlayerProfile;
  onUpdateProfile: (partial: Partial<PlayerProfile>) => void;
  onResetCareerStats: () => void;
  compact?: boolean;
}

export default function PlayerProfilePanel({
  profile,
  onUpdateProfile,
  onResetCareerStats,
  compact = false,
}: PlayerProfilePanelProps) {
  const kd =
    profile.careerDeaths > 0
      ? (profile.careerKills / profile.careerDeaths).toFixed(2)
      : profile.careerKills.toFixed(2);
  const displayName = formatPlayerDisplayName(profile.callsign, profile.clanTag);

  return (
    <div data-testid="player-profile-panel" className="flex flex-col gap-3.5 text-xs">
      <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#090D16] border border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-3 h-3 rounded-full shrink-0 border border-white/40"
            style={{ backgroundColor: profile.accentColor }}
          />
          <span className="font-display font-bold text-sm text-white truncate">
            {displayName}
          </span>
        </div>
        <span className="text-[11px] font-mono text-slate-400 capitalize shrink-0">
          {profile.characterStyle}
        </span>
      </div>

      <div className="grid grid-cols-12 gap-2.5">
        <div className="col-span-8 flex flex-col gap-1">
          <label htmlFor="profile-callsign" className="text-[11px] font-semibold text-slate-300">
            Callsign
          </label>
          <input
            id="profile-callsign"
            type="text"
            maxLength={18}
            value={profile.callsign}
            onChange={(e) => onUpdateProfile({ callsign: e.target.value })}
            placeholder="Operator name"
            className="px-3 py-2 bg-[#090D16] border border-white/15 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
          />
        </div>
        <div className="col-span-4 flex flex-col gap-1">
          <label htmlFor="profile-clantag" className="text-[11px] font-semibold text-slate-300">
            Clan Tag
          </label>
          <input
            id="profile-clantag"
            type="text"
            maxLength={4}
            value={profile.clanTag}
            onChange={(e) => onUpdateProfile({ clanTag: sanitizeClanTag(e.target.value) })}
            placeholder="VEL"
            className="px-3 py-2 bg-[#090D16] border border-white/15 rounded-lg text-xs font-mono uppercase text-amber-300 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5 text-amber-400" />
          Character Chassis Style
        </span>
        <div className={`grid ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'} gap-1.5`}>
          {CHARACTER_STYLES.map((style) => {
            const active = profile.characterStyle === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => onUpdateProfile({ characterStyle: style.id })}
                className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                  active
                    ? 'bg-amber-500/15 border-amber-500 text-white'
                    : 'bg-[#090D16] border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-xs truncate">{style.name}</span>
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: style.badgeColor }}
                  />
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">{style.role}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-slate-300">Armor & Sleeve Accent</span>
          <div className="flex items-center gap-2 flex-wrap">
            {ACCENT_SWATCHES.map((sw) => {
              const active = profile.accentColor.toUpperCase() === sw.id.toUpperCase();
              return (
                <button
                  key={sw.id}
                  type="button"
                  title={sw.label}
                  aria-label={sw.label}
                  onClick={() => onUpdateProfile({ accentColor: sw.id })}
                  className={`w-7 h-7 rounded-lg border-2 cursor-pointer transition-transform ${
                    active ? 'border-white scale-110' : 'border-white/15 hover:border-white/40'
                  }`}
                  style={{ backgroundColor: sw.id }}
                />
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pref-weapon" className="text-[11px] font-semibold text-slate-300">
            Preferred Starting Weapon
          </label>
          <select
            id="pref-weapon"
            value={profile.preferredWeapon}
            onChange={(e) =>
              onUpdateProfile({ preferredWeapon: e.target.value as PlayerProfile['preferredWeapon'] })
            }
            className="px-2.5 py-2 bg-[#090D16] border border-white/15 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
          >
            {LOADOUT_WEAPONS.map((wid) => (
              <option key={wid} value={wid}>
                {WEAPONS[wid].name} ({WEAPONS[wid].role})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-[#090D16] border border-white/10 rounded-lg p-2.5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            Career Combat Record
          </span>
          <button
            type="button"
            onClick={onResetCareerStats}
            className="text-[11px] text-slate-400 hover:text-red-400 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
        <div className="grid grid-cols-5 gap-1.5 text-center font-mono tabular-nums">
          <div className="bg-[#0F1623] rounded py-1.5 px-1">
            <div className="text-[10px] text-slate-400">Kills</div>
            <div className="text-xs font-bold text-white">{profile.careerKills}</div>
          </div>
          <div className="bg-[#0F1623] rounded py-1.5 px-1">
            <div className="text-[10px] text-slate-400">K/D</div>
            <div className="text-xs font-bold text-amber-400">{kd}</div>
          </div>
          <div className="bg-[#0F1623] rounded py-1.5 px-1">
            <div className="text-[10px] text-slate-400">Wins</div>
            <div className="text-xs font-bold text-emerald-400">{profile.careerWins}</div>
          </div>
          <div className="bg-[#0F1623] rounded py-1.5 px-1">
            <div className="text-[10px] text-slate-400">Matches</div>
            <div className="text-xs font-bold text-slate-200">{profile.careerMatches}</div>
          </div>
          <div className="bg-[#0F1623] rounded py-1.5 px-1">
            <div className="text-[10px] text-slate-400">Best</div>
            <div className="text-xs font-bold text-sky-400">{profile.bestScore}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
