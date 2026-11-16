'use client';

import React from 'react';
import { HudSnapshot } from '@/lib/fps/renderer';
import {
  CountdownOverlay,
  CrosshairOverlay,
  DamageVignette,
  EliminatedBanner,
  HudUtilityButtons,
  KillFeedList,
  MatchScoreCard,
  MedicateToast,
  ScopeOverlay,
  TelemetryBadge,
  VitalsCard,
  WeaponCard,
} from './HudSections';
import MiniMap from './MiniMap';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  fov?: number;
  showTouchControls: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onSelectWeapon: (slot: number) => void;
  onRequestPointerLock?: () => void;
  onShowScoreboard: () => void;
}

const GameHud = React.memo(function GameHud({
  hud,
  muted,
  fov = 78,
  showTouchControls,
  onToggleMute,
  onPause,
  onSelectWeapon,
  onShowScoreboard,
}: GameHudProps) {
  const quantizedFlash = hud.damageFlash > 0.02 ? Math.round(hud.damageFlash * 40) / 40 : 0;
  const quantizedCrosshairSpeed = Math.round(hud.speed * 2) / 2;
  const reloadPct = hud.reloading ? Math.round(hud.reloadProgress * 100) : 100;
  const adsActive = hud.adsBlend > 0.4;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none">
      <ScopeOverlay
        weaponId={hud.weaponId}
        scoped={hud.scoped}
        adsBlend={hud.adsBlend}
        hitmarkerActive={hud.hitmarkerActive}
        hitmarkerHeadshot={hud.hitmarkerHeadshot}
      />

      <DamageVignette intensity={quantizedFlash} />
      {hud.damageHits.map((h, i) => {
        // Bearing of the attacker relative to where the player is looking (0° = straight ahead)
        const fwdX = -Math.sin(hud.localYaw);
        const fwdZ = -Math.cos(hud.localYaw);
        const rightX = Math.cos(hud.localYaw);
        const rightZ = -Math.sin(hud.localYaw);
        const deg = (Math.atan2(h.dx * rightX + h.dz * rightZ, h.dx * fwdX + h.dz * fwdZ) * 180) / Math.PI;
        return (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 w-0 h-0 pointer-events-none"
            style={{ transform: `rotate(${deg.toFixed(0)}deg)`, opacity: Math.max(0, 1 - h.age) }}
          >
            <div className="absolute w-28 h-2.5 rounded-full bg-red-500/85 shadow-[0_0_14px_rgba(239,68,68,0.9)] -translate-x-1/2 -translate-y-[132px]" />
          </div>
        );
      })}
      {hud.alive && hud.hp <= 30 && <div className="absolute inset-0 vel-lowhp pointer-events-none" />}

      {/* Top-Left Cluster: Radar Minimap + Match Score & Timer */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex items-start gap-2 sm:gap-3">
        <MiniMap
          mapId={hud.mapId}
          mapName={hud.mapName}
          mapHalfW={hud.mapHalfW}
          mapHalfD={hud.mapHalfD}
          mapBlocks={hud.mapBlocks}
          localX={hud.localX}
          localZ={hud.localZ}
          localYaw={hud.localYaw}
          alive={hud.alive}
          mode={hud.mode}
          team={hud.team}
          players={hud.players}
          fovDeg={fov}
        />

        <MatchScoreCard
          timeRemaining={hud.timeRemaining}
          mode={hud.mode}
          blueScore={hud.blueScore}
          redScore={hud.redScore}
          scoreLimit={hud.scoreLimit}
          gunGameTier={hud.gunGameTier}
          kills={hud.kills}
          score={hud.score}
        />
      </div>

      {/* Top-Right Cluster: Utility Buttons, Telemetry & Kill Feed */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex flex-col items-end gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          <TelemetryBadge
            fps={hud.fps}
            pingMs={hud.pingMs}
            renderScale={hud.renderScale}
          />
          <HudUtilityButtons
            muted={muted}
            onShowScoreboard={onShowScoreboard}
            onToggleMute={onToggleMute}
            onPause={onPause}
          />
        </div>

        <KillFeedList killFeed={hud.killFeed} />
      </div>

      {/* Exact Center (0, 0) Crosshair & Hitmarker */}
      <CrosshairOverlay
        speed={quantizedCrosshairSpeed}
        hitmarkerActive={hud.hitmarkerActive}
        hitmarkerHeadshot={hud.hitmarkerHeadshot}
        pointerLocked={hud.pointerLocked}
        showTouchControls={showTouchControls}
        alive={hud.alive}
        scoped={hud.scoped}
        adsBlend={hud.adsBlend}
        hideLockPrompt={
          hud.matchPhase === 'countdown' ||
          hud.goBannerActive ||
          hud.scoped ||
          hud.adsBlend > 0.35
        }
      />

      <CountdownOverlay
        matchPhase={hud.matchPhase}
        countdownRemaining={hud.countdownRemaining}
        goBannerActive={hud.goBannerActive}
        roomJoinCode={hud.roomJoinCode}
        roomVisibility={hud.roomVisibility}
        roomHasPassword={hud.roomHasPassword}
      />

      <EliminatedBanner alive={hud.alive} respawnTimer={hud.respawnTimer} />

      <MedicateToast
        active={hud.medicateActive}
        hp={hud.medicateHp}
        shield={hud.medicateShield}
      />

      {!showTouchControls && (
        <VitalsCard
          hp={hud.hp}
          maxHp={hud.maxHp}
          shield={hud.shield}
          maxShield={hud.maxShield}
          speed={hud.speed}
          sliding={hud.sliding}
          team={hud.team}
        />
      )}

      {!showTouchControls && (
        <WeaponCard
          weaponId={hud.weaponId}
          ammo={hud.ammo}
          magSize={hud.magSize}
          reloading={hud.reloading}
          reloadPct={reloadPct}
          mode={hud.mode}
          adsActive={adsActive}
          onSelectWeapon={onSelectWeapon}
        />
      )}
    </div>
  );
});

export default GameHud;
