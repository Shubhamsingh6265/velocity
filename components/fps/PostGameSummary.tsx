'use client';

import React from 'react';
import { motion } from 'motion/react';
import {
  Award,
  Check,
  Copy,
  Crosshair,
  LogOut,
  RotateCcw,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { buildInviteUrl } from '@/lib/fps/profile';
import { GamePhase, HudSnapshot } from '@/lib/fps/renderer';
import { computePostGameSummary } from '@/lib/fps/rules';

interface PostGameSummaryProps {
  phase: GamePhase;
  hud: HudSnapshot;
  playerName: string;
  onPlayAgain: () => void;
  onExitToLobby: () => void;
}

export default function PostGameSummary({
  phase,
  hud,
  playerName,
  onPlayAgain,
  onExitToLobby,
}: PostGameSummaryProps) {
  const [copiedInvite, setCopiedInvite] = React.useState(false);

  const summary = React.useMemo(
    () =>
      computePostGameSummary({
        mode: hud.mode,
        redScore: hud.redScore,
        blueScore: hud.blueScore,
        scoreLimit: hud.scoreLimit,
        winnerText: hud.winnerText,
        players: hud.players,
        fallbackSelf: {
          name: playerName,
          team: hud.team,
          kills: hud.kills,
          deaths: hud.deaths,
          score: hud.score,
        },
      }),
    [
      hud.mode,
      hud.redScore,
      hud.blueScore,
      hud.scoreLimit,
      hud.winnerText,
      hud.players,
      hud.team,
      hud.kills,
      hud.deaths,
      hud.score,
      playerName,
    ],
  );

  if (phase !== 'gameover') return null;

  const shortInviteUrl = buildInviteUrl(hud.roomJoinCode);
  const copyInvite = async () => {
    try {
      await navigator.clipboard?.writeText(shortInviteUrl);
      setCopiedInvite(true);
      window.setTimeout(() => setCopiedInvite(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const { personal, mvp, teamBreakdown, standings } = summary;
  const totalTeamPoints = Math.max(1, teamBreakdown.blue.score + teamBreakdown.red.score);
  const blueSharePct = Math.round((teamBreakdown.blue.score / totalTeamPoints) * 100);

  return (
    <div
      data-testid="post-game-summary"
      className="fixed inset-0 z-30 bg-[#060A11]/88 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="w-full max-w-[680px] bg-[#0F1623] border border-white/15 rounded-2xl p-5 sm:p-6 flex flex-col gap-4 shadow-2xl max-h-[92dvh] overflow-y-auto"
      >
        {/* Header & Winner Banner */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-amber-400">
                <span>{hud.mode === 'TDM' ? 'Team Deathmatch' : hud.mode === 'GUN_GAME' ? 'Gun Game' : 'Free-For-All'}</span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-300">{hud.mapName}</span>
              </div>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-white leading-tight mt-0.5">
                Match Complete
              </h2>
              <p data-testid="postgame-winner-text" className="text-xs sm:text-sm text-slate-300 mt-0.5">
                {hud.winnerText || 'Final scoreboard locked'}
              </p>
              {hud.nextMapName && (
                <p data-testid="postgame-next-map" className="text-[11px] font-mono uppercase tracking-wider text-sky-400 mt-1">
                  Next map: {hud.nextMapName}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            title={shortInviteUrl}
            onClick={copyInvite}
            className="px-2.5 py-1.5 rounded-lg bg-[#090D16] border border-white/15 hover:border-amber-500 text-[11px] font-mono text-amber-300 flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            {copiedInvite ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                {hud.roomJoinCode}
              </>
            )}
          </button>
        </div>

        {/* Personal K/D Ratio + Match MVP Spotlight */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Personal K/D Card */}
          <div
            data-testid="postgame-personal-card"
            className="bg-[#090D16] border border-white/12 rounded-xl p-4 flex flex-col justify-between gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                Your Performance
              </span>
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] font-mono text-slate-200">
                Rank #{personal.rank} / {Math.max(1, standings.length)}
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-4">
              <div>
                <div className="text-[11px] text-slate-400 uppercase tracking-wider">K/D Ratio</div>
                <div
                  data-testid="postgame-personal-kd"
                  className="font-display font-bold text-4xl leading-none tabular-nums text-amber-400 mt-1"
                >
                  {personal.kdFormatted}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-right">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Kills</div>
                  <div className="font-mono font-bold text-base tabular-nums text-emerald-400">
                    {personal.kills}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Deaths</div>
                  <div className="font-mono font-bold text-base tabular-nums text-rose-400">
                    {personal.deaths}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Score</div>
                  <div className="font-mono font-bold text-base tabular-nums text-white">
                    {personal.score}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Match MVP Card */}
          <div
            data-testid="postgame-mvp"
            className="bg-gradient-to-br from-amber-500/12 via-[#0B111E] to-[#090D16] border border-amber-400/35 rounded-xl p-4 flex flex-col justify-between gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-amber-300 flex items-center gap-1.5 font-semibold">
                <Award className="w-4 h-4 text-amber-400" />
                Match MVP
              </span>
              {mvp && mvp.team !== 'NONE' && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    mvp.team === 'BLUE'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-400/35'
                      : 'bg-red-500/20 text-red-300 border border-red-400/35'
                  }`}
                >
                  {mvp.team} TEAM
                </span>
              )}
            </div>

            {mvp ? (
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display font-bold text-xl text-white truncate">
                    {mvp.name}
                    {mvp.isSelf && (
                      <span className="ml-1.5 text-xs font-mono text-amber-300">(YOU)</span>
                    )}
                  </div>
                  <div className="text-xs font-mono text-slate-300 mt-0.5">
                    {mvp.kills}K / {mvp.deaths}D · {mvp.kdFormatted} K/D
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-amber-300/80 uppercase font-mono">MVP Score</div>
                  <div className="font-display font-bold text-2xl leading-none tabular-nums text-amber-300 mt-0.5">
                    {mvp.score}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400">No combatant data recorded</div>
            )}
          </div>
        </div>

        {/* Team Score Breakdown (TDM) or Ranked Breakdown (FFA / Gun Game) */}
        <div
          data-testid="postgame-team-breakdown"
          className="bg-[#090D16] border border-white/10 rounded-xl p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-2">
              {teamBreakdown.isTeamMode ? (
                <>
                  <Users className="w-4 h-4 text-sky-400" />
                  Team Score Breakdown
                </>
              ) : (
                <>
                  <Swords className="w-4 h-4 text-amber-400" />
                  Match Score Breakdown
                </>
              )}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Target Limit: {summary.scoreLimit}
            </span>
          </div>

          {teamBreakdown.isTeamMode ? (
            <>
              {/* Score Comparison Bar */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-mono font-bold">
                  <span className="text-blue-400">
                    BLUE TEAM · {teamBreakdown.blue.score}
                    {teamBreakdown.winnerTeam === 'BLUE' ? ' (WIN)' : ''}
                  </span>
                  <span className="text-red-400">
                    {teamBreakdown.winnerTeam === 'RED' ? '(WIN) ' : ''}
                    {teamBreakdown.red.score} · RED TEAM
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-red-500/75 overflow-hidden flex">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${blueSharePct}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[teamBreakdown.blue, teamBreakdown.red].map((bucket) => {
                  const isBlue = bucket.team === 'BLUE';
                  const isWin = teamBreakdown.winnerTeam === bucket.team;
                  return (
                    <div
                      key={bucket.team}
                      className={`rounded-lg border p-3 flex flex-col gap-2 ${
                        isBlue
                          ? 'bg-blue-950/25 border-blue-500/30'
                          : 'bg-red-950/25 border-red-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className={`font-bold ${isBlue ? 'text-blue-300' : 'text-red-300'}`}
                        >
                          {bucket.team} TEAM {isWin ? '★' : ''}
                        </span>
                        <span className="font-mono text-[11px] text-slate-300">
                          {bucket.kills}K · {bucket.deaths}D
                        </span>
                      </div>
                      <div className="divide-y divide-white/5 max-h-36 overflow-y-auto">
                        {bucket.players.length === 0 ? (
                          <div className="py-1.5 text-[11px] text-slate-500">No players</div>
                        ) : (
                          bucket.players.map((p) => (
                            <div
                              key={p.id}
                              className={`py-1 flex items-center justify-between text-[11px] ${
                                p.isSelf ? 'text-amber-300 font-semibold' : 'text-slate-200'
                              }`}
                            >
                              <span className="truncate pr-2">{p.name}</span>
                              <span className="font-mono tabular-nums text-slate-300 shrink-0">
                                {p.kills}/{p.deaths} · {p.kdFormatted} · {p.score}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <div className="grid grid-cols-12 px-3 py-2 text-[11px] font-semibold text-slate-400 border-b border-white/10 bg-[#0D1320]">
                <span className="col-span-1">#</span>
                <span className="col-span-5">Operator</span>
                <span className="col-span-2 text-right">K / D</span>
                <span className="col-span-2 text-right">K/D</span>
                <span className="col-span-2 text-right">Score</span>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-white/5">
                {standings.map((p) => (
                  <div
                    key={p.id}
                    className={`grid grid-cols-12 px-3 py-2 text-xs ${
                      p.isSelf ? 'bg-amber-500/10 text-amber-300 font-semibold' : 'text-slate-200'
                    }`}
                  >
                    <span className="col-span-1 font-mono text-slate-400">{p.rank}</span>
                    <span className="col-span-5 truncate">{p.name}</span>
                    <span className="col-span-2 text-right font-mono tabular-nums">
                      {p.kills}/{p.deaths}
                    </span>
                    <span className="col-span-2 text-right font-mono tabular-nums text-amber-300">
                      {p.kdFormatted}
                    </span>
                    <span className="col-span-2 text-right font-mono tabular-nums">{p.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            data-start="true"
            data-testid="postgame-play-again"
            onClick={onPlayAgain}
            className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm rounded-lg flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            Play Again
          </button>
          <button
            type="button"
            data-testid="postgame-exit-lobby"
            onClick={onExitToLobby}
            className="py-2.5 px-4 bg-[#192234] hover:bg-[#222E45] text-slate-200 text-xs font-semibold rounded-lg border border-white/10 flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" />
            Exit to Lobby
          </button>
        </div>
      </motion.div>
    </div>
  );
}
