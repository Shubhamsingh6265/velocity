'use client';

import React from 'react';
import { Check, Copy, Globe, Lock, Play } from 'lucide-react';
import { buildInviteUrl } from '@/lib/fps/profile';
import { EngineSettings, GamePhase, HudSnapshot } from '@/lib/fps/renderer';
import { LeaderboardEntry, PlayerProfile, TouchMode } from '@/lib/fps/types';
import PlayerProfilePanel from './PlayerProfilePanel';

interface MatchModalsProps {
  phase: GamePhase;
  hud: HudSnapshot;
  settings: EngineSettings;
  touchMode: TouchMode;
  leaderboard: LeaderboardEntry[];
  profile: PlayerProfile;
  onUpdateProfile: (partial: Partial<PlayerProfile>) => void;
  onResetCareerStats: () => void;
  onResume: () => void;
  onRestart: () => void;
  onExitToTitle: () => void;
  onUpdateSettings: (partial: Partial<EngineSettings>) => void;
  onTouchModeChange: (m: TouchMode) => void;
}

export default function MatchModals({
  phase,
  hud,
  settings,
  touchMode,
  leaderboard,
  profile,
  onUpdateProfile,
  onResetCareerStats,
  onResume,
  onRestart,
  onExitToTitle,
  onUpdateSettings,
  onTouchModeChange,
}: MatchModalsProps) {
  const [tab, setTab] = React.useState<'controls' | 'scoreboard' | 'profile' | 'ranks'>('controls');
  const [copiedCode, setCopiedCode] = React.useState(false);

  if (phase !== 'paused') return null;

  const sortedPlayers = [...hud.players].sort((a, b) => b.kills - a.kills || b.score - a.score);
  const kd = hud.deaths > 0 ? (hud.kills / hud.deaths).toFixed(2) : hud.kills.toFixed(2);
  // The server only lets the room host (or a lone human) restart a running match.
  const humanCount = hud.players.filter((p) => !p.isBot).length;
  const canRestart = hud.isHost || humanCount <= 1;

  const shortInviteUrl = buildInviteUrl(hud.roomJoinCode);

  const copyRoomLink = async () => {
    try {
      await navigator.clipboard?.writeText(shortInviteUrl);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div className="fixed inset-0 z-30 bg-[#070B12]/80 flex items-center justify-center p-4">
      <div className="w-full max-w-[580px] bg-[#0F1623] border border-white/15 rounded-xl p-5 sm:p-6 flex flex-col gap-4 shadow-2xl max-h-[92dvh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-2xl text-white">
              Match Paused
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
              <span>
                {hud.mode} · {hud.players.length}/{hud.maxPlayers} Combatants · Code{' '}
                <span className="text-amber-300 font-mono">{hud.roomJoinCode}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-slate-300 uppercase">
                {hud.roomVisibility === 'private' ? (
                  <Lock className="w-2.5 h-2.5 text-purple-300" />
                ) : (
                  <Globe className="w-2.5 h-2.5 text-sky-300" />
                )}
                {hud.roomVisibility}
                {hud.roomHasPassword ? ' · PW' : ''}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              title={shortInviteUrl}
              onClick={copyRoomLink}
              className="px-2.5 py-1.5 rounded-lg bg-[#090D16] border border-white/15 hover:border-amber-500 text-[11px] font-mono text-amber-300 flex items-center gap-1.5 cursor-pointer"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Copied Invite
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  {hud.roomJoinCode}
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#090D16] border border-white/10 rounded-lg p-3">
            <div className="text-[11px] text-slate-400">Eliminations</div>
            <div className="font-display font-bold text-2xl tabular-nums text-white mt-0.5">
              {hud.kills}
            </div>
          </div>
          <div className="bg-[#090D16] border border-white/10 rounded-lg p-3">
            <div className="text-[11px] text-slate-400">K / D Ratio</div>
            <div className="font-display font-bold text-2xl tabular-nums text-amber-400 mt-0.5">
              {kd}
            </div>
          </div>
          <div className="bg-[#090D16] border border-white/10 rounded-lg p-3">
            <div className="text-[11px] text-slate-400">Match Score</div>
            <div className="font-display font-bold text-2xl tabular-nums text-white mt-0.5">
              {hud.score}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#090D16] border border-white/10 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setTab('controls')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                tab === 'controls' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              Settings
            </button>
            <button
              type="button"
              onClick={() => setTab('scoreboard')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                tab === 'scoreboard' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              Scoreboard ({hud.players.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('profile')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                tab === 'profile' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              Player Details
            </button>
            <button
              type="button"
              onClick={() => setTab('ranks')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                tab === 'ranks' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              Leaderboard
            </button>
          </div>

        {tab === 'controls' && (
          <div className="flex flex-col gap-3.5 text-xs">
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="sens-range" className="text-slate-300 font-medium">
                Mouse / Look Sensitivity ({(settings.sensitivity * 1000).toFixed(1)})
              </label>
              <input
                id="sens-range"
                type="range"
                min={0.0008}
                max={0.006}
                step={0.0002}
                value={settings.sensitivity}
                onChange={(e) => onUpdateSettings({ sensitivity: parseFloat(e.target.value) })}
                className="w-44 accent-amber-500"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <label htmlFor="fov-range" className="text-slate-300 font-medium">
                Field of View ({settings.fov} deg)
              </label>
              <input
                id="fov-range"
                type="range"
                min={65}
                max={105}
                step={1}
                value={settings.fov}
                onChange={(e) => onUpdateSettings({ fov: parseInt(e.target.value, 10) })}
                className="w-44 accent-amber-500"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <label htmlFor="vol-range" className="text-slate-300 font-medium">
                Master Volume ({Math.round(settings.volume * 100)}%)
              </label>
              <input
                id="vol-range"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.volume}
                onChange={(e) => onUpdateSettings({ volume: parseFloat(e.target.value) })}
                className="w-44 accent-amber-500"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <label htmlFor="music-toggle" className="text-slate-300 font-medium">
                Background Music
              </label>
              <input
                id="music-toggle"
                type="checkbox"
                checked={settings.music !== false}
                onChange={(e) => onUpdateSettings({ music: e.target.checked })}
                className="w-5 h-5 accent-amber-500"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <label htmlFor="modal-quality" className="text-slate-300 font-medium">
                Adaptive Graphics Preset
              </label>
              <select
                id="modal-quality"
                value={settings.quality}
                onChange={(e) => onUpdateSettings({ quality: e.target.value as EngineSettings['quality'] })}
                className="w-44 px-2.5 py-1.5 bg-[#090D16] border border-white/15 rounded-lg text-white"
              >
                <option value="auto">Adaptive Auto</option>
                <option value="low">Low-Spec (0.68x)</option>
                <option value="medium">Balanced (0.85x)</option>
                <option value="high">High (1.0x)</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-4">
              <label htmlFor="modal-touch" className="text-slate-300 font-medium">
                Touch Controls Overlay
              </label>
              <select
                id="modal-touch"
                value={touchMode}
                onChange={(e) => onTouchModeChange(e.target.value as TouchMode)}
                className="w-44 px-2.5 py-1.5 bg-[#090D16] border border-white/15 rounded-lg text-white"
              >
                <option value="auto">Auto Detect</option>
                <option value="on">Always Show</option>
                <option value="off">Desktop Only</option>
              </select>
            </div>
          </div>
        )}

        {tab === 'scoreboard' && (
          <div className="bg-[#090D16] border border-white/10 rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 px-3 py-2 text-[11px] font-semibold text-slate-400 border-b border-white/10">
              <span className="col-span-6">Operator</span>
              <span className="col-span-2 text-right">Kills</span>
              <span className="col-span-2 text-right">Deaths</span>
              <span className="col-span-2 text-right">Score</span>
            </div>
            <div className="max-h-52 overflow-y-auto divide-y divide-white/5">
              {sortedPlayers.map((p) => (
                <div
                  key={p.id}
                  className={`grid grid-cols-12 px-3 py-2 text-xs ${
                    p.isSelf ? 'bg-amber-500/10 text-amber-300 font-semibold' : 'text-slate-200'
                  }`}
                >
                  <span className="col-span-6 truncate">
                    {p.name}
                    {p.team !== 'NONE' ? ` (${p.team})` : ''}
                  </span>
                  <span className="col-span-2 text-right font-mono tabular-nums">{p.kills}</span>
                  <span className="col-span-2 text-right font-mono tabular-nums">{p.deaths}</span>
                  <span className="col-span-2 text-right font-mono tabular-nums">{p.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'profile' && (
          <PlayerProfilePanel
            profile={profile}
            onUpdateProfile={onUpdateProfile}
            onResetCareerStats={onResetCareerStats}
            compact
          />
        )}

        {tab === 'ranks' && (
          <div className="bg-[#090D16] border border-white/10 rounded-lg p-3 max-h-48 overflow-y-auto divide-y divide-white/10">
            {leaderboard.slice(0, 8).map((e, i) => (
              <div key={e.name} className="py-1.5 flex items-center justify-between text-xs">
                <span className="text-slate-200 font-medium">
                  {i + 1}. {e.name}
                </span>
                <span className="font-mono tabular-nums text-amber-400">
                  {e.kills}K · {e.wins}W · {e.bestScore}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onResume}
            className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm rounded-lg flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Play className="w-4 h-4 fill-current" />
            Resume Match
          </button>
          {canRestart && (
            <button
              type="button"
              onClick={onRestart}
              className="py-2.5 px-4 bg-[#192234] hover:bg-[#222E45] text-slate-200 text-xs font-semibold rounded-lg border border-white/10 cursor-pointer whitespace-nowrap"
            >
              Restart Round
            </button>
          )}
          <button
            type="button"
            onClick={onExitToTitle}
            className="py-2.5 px-4 bg-[#192234] hover:bg-[#222E45] text-slate-200 text-xs font-semibold rounded-lg border border-white/10 cursor-pointer whitespace-nowrap"
          >
            Exit to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}
