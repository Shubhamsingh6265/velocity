'use client';

import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Copy,
  Crosshair,
  Flame,
  Globe,
  ListOrdered,
  Lock,
  Pause,
  Shield,
  Sword,
  Target,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { buildInviteUrl } from '@/lib/fps/profile';
import { GameMode, KillFeedItem, RoomVisibility, WeaponId } from '@/lib/fps/types';
import { GUN_GAME_LADDER, LOADOUT_WEAPONS, WEAPONS } from '@/lib/fps/weapons';

export const DamageVignette = React.memo(function DamageVignette({
  intensity,
}: {
  intensity: number;
}) {
  if (intensity <= 0.02) return null;
  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{
        boxShadow: `inset 0 0 90px rgba(239, 68, 68, ${Math.min(0.75, intensity)})`,
      }}
    />
  );
});

export interface MatchScoreCardProps {
  timeRemaining: number;
  mode: GameMode;
  blueScore: number;
  redScore: number;
  scoreLimit: number;
  gunGameTier: number;
  kills: number;
  score: number;
}

export const MatchScoreCard = React.memo(function MatchScoreCard({
  timeRemaining,
  mode,
  blueScore,
  redScore,
  scoreLimit,
  gunGameTier,
  kills,
  score,
}: MatchScoreCardProps) {
  const mins = Math.floor(timeRemaining / 60);
  const secs = String(timeRemaining % 60).padStart(2, '0');

  return (
    <div
      data-testid="hud-score-card"
      className="bg-[#0B0F17]/85 border border-white/15 rounded-lg px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 flex flex-col gap-0.5 sm:gap-1"
    >
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        <span className="font-mono tabular-nums text-base sm:text-xl font-bold text-white leading-none">
          {mins}:{secs}
        </span>
        <span className="text-[11px] sm:text-xs font-semibold text-amber-400">
          {mode === 'TDM' ? 'TDM' : mode === 'GUN_GAME' ? 'GUN' : 'FFA'}
        </span>
      </div>
      {mode === 'TDM' ? (
        <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-mono tabular-nums whitespace-nowrap">
          <span className="text-blue-400 font-bold">B {blueScore}</span>
          <span className="text-slate-500">/</span>
          <span className="text-red-400 font-bold">R {redScore}</span>
          <span className="hidden sm:inline text-slate-400">({scoreLimit})</span>
        </div>
      ) : mode === 'GUN_GAME' ? (
        <div className="text-[11px] sm:text-xs font-mono tabular-nums text-slate-300 whitespace-nowrap">
          T{gunGameTier + 1}/{GUN_GAME_LADDER.length} · {kills}K
        </div>
      ) : (
        <div className="text-[11px] sm:text-xs font-mono tabular-nums text-slate-300 whitespace-nowrap">
          <span>
            {kills}/{scoreLimit} Kills
          </span>
          <span className="hidden sm:inline"> · Score {score}</span>
        </div>
      )}
    </div>
  );
});

export const TelemetryBadge = React.memo(function TelemetryBadge({
  fps,
  pingMs,
  renderScale,
}: {
  fps: number;
  pingMs: number;
  renderScale: number;
}) {
  return (
    <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0B0F17]/85 border border-white/12 text-xs font-mono tabular-nums text-slate-300">
      <span>{fps} FPS</span>
      <span className="text-slate-600">·</span>
      <span>{pingMs} ms</span>
      {renderScale < 100 && (
        <>
          <span className="text-slate-600">·</span>
          <span className="text-amber-400">{renderScale}%</span>
        </>
      )}
    </div>
  );
});

export const HudUtilityButtons = React.memo(function HudUtilityButtons({
  muted,
  onShowScoreboard,
  onToggleMute,
  onPause,
}: {
  muted: boolean;
  onShowScoreboard: () => void;
  onToggleMute: () => void;
  onPause: () => void;
}) {
  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Scoreboard"
        onClick={(e) => {
          e.currentTarget.blur();
          onShowScoreboard();
        }}
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#0B0F17]/85 border border-white/15 hover:border-amber-500 text-slate-200 flex items-center justify-center cursor-pointer"
      >
        <ListOrdered className="w-4 h-4" />
      </button>
      <button
        type="button"
        tabIndex={-1}
        aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
        onClick={(e) => {
          e.currentTarget.blur();
          onToggleMute();
        }}
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#0B0F17]/85 border border-white/15 hover:border-amber-500 text-slate-200 flex items-center justify-center cursor-pointer"
      >
        {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
      </button>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Pause Match"
        onClick={(e) => {
          e.currentTarget.blur();
          onPause();
        }}
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#0B0F17]/85 border border-white/15 hover:border-amber-500 text-slate-200 flex items-center justify-center cursor-pointer"
      >
        <Pause className="w-4 h-4" />
      </button>
    </>
  );
});

const KillFeedRow = React.memo(function KillFeedRow({ item }: { item: KillFeedItem }) {
  return (
    <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded bg-[#0B0F17]/80 border border-white/10 text-[10px] sm:text-xs flex items-center gap-1 sm:gap-1.5 truncate max-w-full">
      <span
        className={
          item.killerTeam === 'BLUE'
            ? 'text-blue-400 font-semibold truncate'
            : item.killerTeam === 'RED'
            ? 'text-red-400 font-semibold truncate'
            : 'text-amber-400 font-semibold truncate'
        }
      >
        {item.killerName}
      </span>
      <span className="text-slate-400 shrink-0">
        [{WEAPONS[item.weaponId]?.name.split(' ')[0] || item.weaponId}
        {item.headshot ? ' HS' : ''}]
      </span>
      <span
        className={
          item.victimTeam === 'BLUE'
            ? 'text-blue-300 truncate'
            : item.victimTeam === 'RED'
            ? 'text-red-300 truncate'
            : 'text-slate-200 truncate'
        }
      >
        {item.victimName}
      </span>
    </div>
  );
});

function areKillFeedsEqual(
  prev: { killFeed: KillFeedItem[] },
  next: { killFeed: KillFeedItem[] },
): boolean {
  if (prev.killFeed === next.killFeed) return true;
  if (prev.killFeed.length !== next.killFeed.length) return false;
  for (let i = 0; i < prev.killFeed.length; i++) {
    if (prev.killFeed[i].id !== next.killFeed[i].id) return false;
  }
  return true;
}

export const KillFeedList = React.memo(function KillFeedList({
  killFeed,
}: {
  killFeed: KillFeedItem[];
}) {
  return (
    <div
      data-testid="hud-kill-feed"
      className="flex flex-col items-end gap-1 mt-1 max-w-[185px] sm:max-w-none"
    >
      {killFeed.map((kf) => (
        <KillFeedRow key={kf.id} item={kf} />
      ))}
    </div>
  );
}, areKillFeedsEqual);

const OPTIC_ACCENTS: Record<WeaponId, string> = {
  rifle: 'rgba(245, 158, 11, 0.72)',
  smg: 'rgba(16, 185, 129, 0.78)',
  shotgun: 'rgba(251, 146, 60, 0.78)',
  sniper: 'rgba(56, 189, 248, 0.75)',
  pistol: 'rgba(148, 163, 184, 0.78)',
  knife: 'rgba(244, 63, 94, 0.78)',
};

export const ScopeOverlay = React.memo(function ScopeOverlay({
  weaponId,
  scoped,
  adsBlend,
  hitmarkerActive,
  hitmarkerHeadshot,
}: {
  weaponId: WeaponId;
  scoped: boolean;
  adsBlend: number;
  hitmarkerActive: boolean;
  hitmarkerHeadshot: boolean;
}) {
  if (weaponId === 'knife' || (!scoped && adsBlend <= 0.35)) return null;

  const accentStroke = OPTIC_ACCENTS[weaponId] || OPTIC_ACCENTS.rifle;

  if (!scoped) {
    return (
      <div
        data-testid="gun-scope-overlay"
        data-scope-transparent="true"
        data-weapon-id={weaponId}
        className="fixed inset-0 pointer-events-none flex items-center justify-center"
        style={{
          opacity: Math.min(1, Math.max(0, (adsBlend - 0.35) / 0.45)),
        }}
      >
        <svg viewBox="-120 -120 240 240" className="w-[min(52vw,52vh)] h-[min(52vw,52vh)]">
          {/* Crystal-clear transparent outer reflex/holographic sight ring */}
          <circle
            cx="0"
            cy="0"
            r={weaponId === 'shotgun' ? 86 : 74}
            fill="none"
            stroke={accentStroke}
            strokeWidth="1.6"
            strokeDasharray={weaponId === 'shotgun' ? '14 8' : undefined}
          />
          <circle
            cx="0"
            cy="0"
            r={weaponId === 'shotgun' ? 92 : 80}
            fill="none"
            stroke="rgba(248, 250, 252, 0.22)"
            strokeWidth="1"
          />

          {/* Open cardinal reticle ticks leaving center sightline 100% clear */}
          <line x1="-70" y1="0" x2="-16" y2="0" stroke="rgba(248, 250, 252, 0.65)" strokeWidth="1.2" />
          <line x1="16" y1="0" x2="70" y2="0" stroke="rgba(248, 250, 252, 0.65)" strokeWidth="1.2" />
          <line x1="0" y1="-70" x2="0" y2="-16" stroke="rgba(248, 250, 252, 0.65)" strokeWidth="1.2" />
          <line x1="0" y1="16" x2="0" y2="70" stroke="rgba(248, 250, 252, 0.65)" strokeWidth="1.2" />

          <circle cx="0" cy="0" r="1.8" fill={accentStroke} />

          {hitmarkerActive && (
            <g
              stroke={hitmarkerHeadshot ? '#EF4444' : '#F8FAFC'}
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <line x1="-14" y1="-14" x2="-5" y2="-5" />
              <line x1="14" y1="-14" x2="5" y2="-5" />
              <line x1="-14" y1="14" x2="-5" y2="5" />
              <line x1="14" y1="14" x2="5" y2="5" />
            </g>
          )}
        </svg>
      </div>
    );
  }

  return (
    <div
      data-testid="sniper-scope-overlay"
      data-scope-transparent="true"
      data-weapon-id={weaponId}
      className="fixed inset-0 pointer-events-none flex items-center justify-center"
      style={{
        background:
          'radial-gradient(circle at center, transparent 0%, transparent 37%, rgba(5, 8, 14, 0.34) 38.5%, rgba(3, 6, 11, 0.52) 100%)',
      }}
    >
      <svg viewBox="-200 -200 400 400" className="w-[min(86vw,86vh)] h-[min(86vw,86vh)]">
        {/* Outer optical bezel ring */}
        <circle
          cx="0"
          cy="0"
          r="150"
          fill="none"
          stroke="rgba(56, 189, 248, 0.55)"
          strokeWidth="2"
        />
        <circle
          cx="0"
          cy="0"
          r="143"
          fill="none"
          stroke="rgba(248, 250, 252, 0.25)"
          strokeWidth="1"
        />

        {/* Primary Mil-Dot crosshairs */}
        <line x1="-148" y1="0" x2="-16" y2="0" stroke="rgba(248, 250, 252, 0.78)" strokeWidth="1.1" />
        <line x1="16" y1="0" x2="148" y2="0" stroke="rgba(248, 250, 252, 0.78)" strokeWidth="1.1" />
        <line x1="0" y1="-148" x2="0" y2="-16" stroke="rgba(248, 250, 252, 0.78)" strokeWidth="1.1" />
        <line x1="0" y1="16" x2="0" y2="148" stroke="rgba(248, 250, 252, 0.78)" strokeWidth="1.1" />

        {/* Subtle outer reference posts */}
        <line x1="-148" y1="0" x2="-104" y2="0" stroke="rgba(15, 23, 42, 0.65)" strokeWidth="3" />
        <line x1="104" y1="0" x2="148" y2="0" stroke="rgba(15, 23, 42, 0.65)" strokeWidth="3" />
        <line x1="0" y1="104" x2="0" y2="148" stroke="rgba(15, 23, 42, 0.65)" strokeWidth="3" />

        {/* Fine center hair & Mil-dots */}
        <line x1="-16" y1="0" x2="16" y2="0" stroke="rgba(248, 250, 252, 0.4)" strokeWidth="0.7" />
        <line x1="0" y1="-16" x2="0" y2="16" stroke="rgba(248, 250, 252, 0.4)" strokeWidth="0.7" />
        {[-72, -48, -24, 24, 48, 72].map((pos) => (
          <g key={pos} fill="#38BDF8" fillOpacity="0.85">
            <circle cx={pos} cy="0" r="1.5" />
            <circle cx="0" cy={pos} r="1.5" />
          </g>
        ))}

        {/* Rangefinder stadia ticks */}
        <line x1="-10" y1="36" x2="10" y2="36" stroke="rgba(248, 250, 252, 0.65)" strokeWidth="1" />
        <line x1="-6" y1="60" x2="6" y2="60" stroke="rgba(248, 250, 252, 0.65)" strokeWidth="1" />

        {/* Illuminated center aiming dot */}
        <circle cx="0" cy="0" r="2" fill="#F59E0B" />

        {hitmarkerActive && (
          <g
            stroke={hitmarkerHeadshot ? '#EF4444' : '#F8FAFC'}
            strokeWidth="2.6"
            strokeLinecap="round"
          >
            <line x1="-16" y1="-16" x2="-6" y2="-6" />
            <line x1="16" y1="-16" x2="6" y2="-6" />
            <line x1="-16" y1="16" x2="-6" y2="6" />
            <line x1="16" y1="16" x2="6" y2="6" />
          </g>
        )}
      </svg>
    </div>
  );
});

export const MedicateToast = React.memo(function MedicateToast({
  active,
  hp,
  shield,
}: {
  active: boolean;
  hp: number;
  shield: number;
}) {
  if (!active || (hp <= 0 && shield <= 0)) return null;
  return (
    <div
      data-testid="hud-medicate-toast"
      className="fixed left-1/2 bottom-28 sm:bottom-24 -translate-x-1/2 pointer-events-none px-3.5 py-1.5 rounded-lg bg-emerald-950/90 border border-emerald-400/50 text-emerald-200 text-xs font-mono font-bold flex items-center gap-2 shadow-lg"
    >
      <span className="text-emerald-400">+KILL MEDICATE</span>
      {hp > 0 && <span>+{hp} HP</span>}
      {shield > 0 && <span className="text-sky-300">+{shield} ARMOR</span>}
    </div>
  );
});

export const CountdownOverlay = React.memo(function CountdownOverlay({
  matchPhase,
  countdownRemaining,
  goBannerActive,
  roomJoinCode,
  roomVisibility,
  roomHasPassword,
}: {
  matchPhase: 'countdown' | 'active' | 'ended';
  countdownRemaining: number;
  goBannerActive: boolean;
  roomJoinCode: string;
  roomVisibility: RoomVisibility;
  roomHasPassword: boolean;
}) {
  const [copied, setCopied] = React.useState(false);

  if (matchPhase !== 'countdown' && !goBannerActive) return null;

  if (matchPhase !== 'countdown' && goBannerActive) {
    return (
      <motion.div
        key="countdown-go"
        data-testid="countdown-go-banner"
        initial={{ scale: 0.45, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.2, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 20 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20 px-9 py-3.5 rounded-2xl bg-amber-500/95 text-slate-950 font-display font-bold text-4xl sm:text-5xl tracking-wider shadow-2xl border border-amber-300"
      >
        GO!
      </motion.div>
    );
  }

  const inviteUrl = buildInviteUrl(roomJoinCode);
  const count = Math.max(1, countdownRemaining);

  const handleCopyInvite = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    try {
      await navigator.clipboard?.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures in restricted environments
    }
  };

  return (
    <motion.div
      data-testid="countdown-popup"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-20 flex items-center justify-center bg-[#060911]/55 pointer-events-none px-4"
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 14 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="pointer-events-auto w-full max-w-[380px] bg-[#0B101B]/95 border border-amber-500/45 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col items-center text-center gap-3.5"
      >
        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest">
          <span
            className={`px-2 py-0.5 rounded border flex items-center gap-1 ${
              roomVisibility === 'private'
                ? 'bg-purple-500/15 border-purple-400/40 text-purple-200'
                : 'bg-sky-500/15 border-sky-400/40 text-sky-200'
            }`}
          >
            {roomVisibility === 'private' ? (
              <Lock className="w-3 h-3" />
            ) : (
              <Globe className="w-3 h-3" />
            )}
            {roomVisibility === 'private' ? 'Private Room' : 'Public Room'}
          </span>
          {roomHasPassword && (
            <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-amber-300 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Password
            </span>
          )}
        </div>

        <div className="text-xs font-semibold uppercase tracking-widest text-slate-300">
          Match Starting In
        </div>

        <div className="relative flex items-center justify-center w-28 h-24">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={`ring-${count}`}
              initial={{ scale: 0.55, opacity: 0.85 }}
              animate={{ scale: 1.55, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.82, ease: 'easeOut' }}
              className="absolute w-20 h-20 rounded-full border-2 border-amber-400/70 pointer-events-none"
            />
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.div
              key={count}
              data-testid="countdown-value"
              initial={{ scale: 1.85, opacity: 0, y: -10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.55, opacity: 0, y: 8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              className="font-display font-bold text-7xl sm:text-8xl leading-none tabular-nums text-amber-400 drop-shadow-[0_0_24px_rgba(245,158,11,0.45)]"
            >
              {count}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="w-full bg-[#090D16] border border-white/10 rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Room Code</span>
            <span
              data-testid="countdown-room-code"
              className="font-mono font-bold text-base tracking-wider text-amber-300"
            >
              {roomJoinCode}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              data-testid="countdown-invite-url"
              className="flex-1 text-[11px] font-mono text-slate-300 bg-[#0D1422] border border-white/10 rounded-lg px-2.5 py-1.5 truncate text-left"
            >
              {inviteUrl}
            </span>
            <button
              type="button"
              tabIndex={-1}
              data-testid="countdown-copy-invite"
              onClick={handleCopyInvite}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});

export const CrosshairOverlay = React.memo(function CrosshairOverlay({
  speed,
  hitmarkerActive,
  hitmarkerHeadshot,
  pointerLocked,
  showTouchControls,
  alive,
  scoped = false,
  adsBlend = 0,
  hideLockPrompt = false,
}: {
  speed: number;
  hitmarkerActive: boolean;
  hitmarkerHeadshot: boolean;
  pointerLocked: boolean;
  showTouchControls: boolean;
  alive: boolean;
  scoped?: boolean;
  adsBlend?: number;
  hideLockPrompt?: boolean;
}) {
  const gap = Math.max(2.5, (5 + Math.min(7, speed * 0.45)) * (1 - adsBlend * 0.52));
  const len = 6;
  const hideHipCrosshair = scoped || adsBlend > 0.35;

  return (
    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center">
      {!hideHipCrosshair && !hideLockPrompt && (
        <svg viewBox="-24 -24 48 48" className="w-11 h-11">
          <g stroke="#F8FAFC" strokeWidth="1.8" strokeLinecap="round">
            <line x1={0} y1={-gap} x2={0} y2={-gap - len} />
            <line x1={0} y1={gap} x2={0} y2={gap + len} />
            <line x1={-gap} y1={0} x2={-gap - len} y2={0} />
            <line x1={gap} y1={0} x2={gap + len} y2={0} />
            <circle cx="0" cy="0" r="1.4" fill="#F59E0B" stroke="none" />
          </g>

          {hitmarkerActive && (
            <g
              stroke={hitmarkerHeadshot ? '#EF4444' : '#F8FAFC'}
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <line x1="-11" y1="-11" x2="-4" y2="-4" />
              <line x1="11" y1="-11" x2="4" y2="-4" />
              <line x1="-11" y1="11" x2="-4" y2="4" />
              <line x1="11" y1="11" x2="4" y2="4" />
            </g>
          )}
        </svg>
      )}

      {!pointerLocked && !showTouchControls && alive && !hideLockPrompt && (
        <div className="mt-6 px-3 py-1 rounded bg-[#0B0F17]/80 border border-white/15 text-[11px] font-medium text-slate-200 pointer-events-none">
          Click viewport to lock aim
        </div>
      )}
    </div>
  );
});

export const EliminatedBanner = React.memo(function EliminatedBanner({
  alive,
  respawnTimer,
}: {
  alive: boolean;
  respawnTimer: number;
}) {
  if (alive) return null;
  return (
    <div className="fixed left-1/2 top-1/3 -translate-x-1/2 bg-[#0B0F17]/90 border border-red-500/40 rounded-xl px-6 py-3 text-center">
      <div className="font-display font-bold text-lg text-red-400">ELIMINATED</div>
      <div className="text-xs font-mono tabular-nums text-slate-300 mt-0.5">
        Respawning in {Math.max(1, respawnTimer)}s
      </div>
    </div>
  );
});

export const VitalsCard = React.memo(function VitalsCard({
  hp,
  maxHp,
  shield,
  maxShield,
  speed,
  sliding,
  team,
}: {
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  speed: number;
  sliding: boolean;
  team: string;
}) {
  const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const shieldPct = Math.max(0, Math.min(100, (shield / maxShield) * 100));

  return (
    <div
      data-testid="hud-vitals-card"
      className="absolute bottom-4 left-4 bg-[#0B0F17]/88 border border-white/15 rounded-xl px-4 py-3 min-w-[210px] flex flex-col gap-2"
    >
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">HP</div>
          <div className="font-display font-bold text-3xl leading-none tabular-nums text-white">
            {hp}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider">Armor</div>
          <div className="font-display font-bold text-xl leading-none tabular-nums text-sky-300">
            {shield}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-transform origin-left ${
              hpPct > 35 ? 'bg-emerald-500' : 'bg-red-500'
            }`}
            style={{ width: `${hpPct}%` }}
          />
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-sky-400" style={{ width: `${shieldPct}%` }} />
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
        <span>{speed.toFixed(1)} m/s</span>
        <span className={sliding ? 'text-amber-400 font-bold' : ''}>
          {sliding ? 'SLIDING' : team !== 'NONE' ? `TEAM ${team}` : 'READY'}
        </span>
      </div>
    </div>
  );
});

const WEAPON_CARD_THEMES: Record<
  WeaponId,
  {
    border: string;
    badgeBg: string;
    barColor: string;
    ammoColor: string;
    activeBtn: string;
    Icon: React.ComponentType<{ className?: string }>;
    dmgPct: number;
    ratePct: number;
    rangePct: number;
  }
> = {
  rifle: {
    border: 'border-amber-400/35',
    badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-400/35',
    barColor: 'bg-amber-400',
    ammoColor: 'text-amber-400',
    activeBtn: 'bg-amber-500 text-slate-950 border-amber-400',
    Icon: Crosshair,
    dmgPct: 58,
    ratePct: 76,
    rangePct: 68,
  },
  smg: {
    border: 'border-emerald-400/35',
    badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35',
    barColor: 'bg-emerald-400',
    ammoColor: 'text-emerald-400',
    activeBtn: 'bg-emerald-500 text-slate-950 border-emerald-400',
    Icon: Zap,
    dmgPct: 40,
    ratePct: 96,
    rangePct: 45,
  },
  shotgun: {
    border: 'border-orange-400/35',
    badgeBg: 'bg-orange-500/15 text-orange-300 border-orange-400/35',
    barColor: 'bg-orange-400',
    ammoColor: 'text-orange-400',
    activeBtn: 'bg-orange-500 text-slate-950 border-orange-400',
    Icon: Flame,
    dmgPct: 92,
    ratePct: 30,
    rangePct: 24,
  },
  sniper: {
    border: 'border-sky-400/40',
    badgeBg: 'bg-sky-500/15 text-sky-300 border-sky-400/35',
    barColor: 'bg-sky-400',
    ammoColor: 'text-sky-400',
    activeBtn: 'bg-sky-500 text-slate-950 border-sky-400',
    Icon: Target,
    dmgPct: 100,
    ratePct: 20,
    rangePct: 100,
  },
  pistol: {
    border: 'border-slate-400/35',
    badgeBg: 'bg-slate-500/20 text-slate-200 border-slate-400/35',
    barColor: 'bg-slate-300',
    ammoColor: 'text-slate-200',
    activeBtn: 'bg-slate-300 text-slate-950 border-slate-200',
    Icon: Shield,
    dmgPct: 52,
    ratePct: 60,
    rangePct: 42,
  },
  knife: {
    border: 'border-rose-400/40',
    badgeBg: 'bg-rose-500/15 text-rose-300 border-rose-400/35',
    barColor: 'bg-rose-400',
    ammoColor: 'text-rose-400',
    activeBtn: 'bg-rose-500 text-white border-rose-400',
    Icon: Sword,
    dmgPct: 82,
    ratePct: 55,
    rangePct: 14,
  },
};

export const WeaponCard = React.memo(function WeaponCard({
  weaponId,
  ammo,
  magSize,
  reloading,
  reloadPct,
  mode,
  adsActive = false,
  onSelectWeapon,
}: {
  weaponId: WeaponId;
  ammo: number;
  magSize: number;
  reloading: boolean;
  reloadPct: number;
  mode: GameMode;
  adsActive?: boolean;
  onSelectWeapon: (slot: number) => void;
}) {
  const activeWeapon = WEAPONS[weaponId] || WEAPONS.rifle;
  const theme = WEAPON_CARD_THEMES[weaponId] || WEAPON_CARD_THEMES.rifle;
  const WeaponIcon = theme.Icon;

  return (
    <div
      data-testid="hud-weapon-card"
      data-weapon-id={weaponId}
      className={`absolute bottom-4 right-4 bg-[#0B0F17]/90 border ${theme.border} rounded-xl px-4 py-3 min-w-[298px] flex flex-col gap-2 transition-colors duration-200 shadow-xl`}
    >
      <motion.div
        key={weaponId}
        initial={{ opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              data-testid="hud-weapon-graphic"
              className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${theme.badgeBg}`}
            >
              <WeaponIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">{activeWeapon.name}</span>
                {adsActive && !activeWeapon.isMelee && (
                  <span className="text-[10px] font-mono font-bold text-sky-300">
                    {activeWeapon.hasScope ? 'SCOPED' : 'OPTIC'}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400">
                {activeWeapon.role} · {activeWeapon.isMelee ? 'LMB Slash · V / 5' : 'RMB / F Sight'}
              </div>
            </div>
          </div>
          {activeWeapon.isMelee ? (
            <div className={`font-display font-bold text-xl leading-none tracking-wider ${theme.ammoColor}`}>
              MELEE
            </div>
          ) : (
            <div className={`font-display font-bold text-3xl leading-none tabular-nums ${theme.ammoColor}`}>
              {reloading ? 'RLD' : ammo}
              <span className="text-sm text-slate-400 font-normal">/{magSize}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-[9px] font-mono uppercase tracking-wider text-slate-400">
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between">
              <span>DMG</span>
              <span className="text-slate-200">{activeWeapon.damage}</span>
            </div>
            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full ${theme.barColor}`} style={{ width: `${theme.dmgPct}%` }} />
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between">
              <span>RPM</span>
              <span className="text-slate-200">{Math.round(60000 / activeWeapon.fireRateMs)}</span>
            </div>
            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full ${theme.barColor}`} style={{ width: `${theme.ratePct}%` }} />
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between">
              <span>RNG</span>
              <span className="text-slate-200">{activeWeapon.range}m</span>
            </div>
            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full ${theme.barColor}`} style={{ width: `${theme.rangePct}%` }} />
            </div>
          </div>
        </div>
      </motion.div>

      {reloading && !activeWeapon.isMelee && (
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full ${theme.barColor}`} style={{ width: `${reloadPct}%` }} />
        </div>
      )}

      {mode !== 'GUN_GAME' && (
        <div className="flex items-center gap-1 pointer-events-auto">
          {LOADOUT_WEAPONS.map((wid, idx) => {
            const slot = idx + 1;
            const active = weaponId === wid;
            return (
              <button
                key={wid}
                type="button"
                tabIndex={-1}
                data-testid={`weapon-slot-${slot}`}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onSelectWeapon(slot);
                }}
                className={`flex-1 py-1 px-1.5 rounded text-[10px] font-mono font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? theme.activeBtn
                    : 'bg-[#090D16] text-slate-300 border-white/10 hover:border-white/25'
                }`}
              >
                [{slot}] {WEAPONS[wid].id.toUpperCase()}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});
