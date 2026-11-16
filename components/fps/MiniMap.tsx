'use client';

import React from 'react';
import {
  computeMiniMapTransform,
  MINIMAP_MATERIAL_COLORS,
  projectMapBlocks,
  worldToMiniMap,
  yawToCanvasRotationRad,
} from '@/lib/fps/minimap';
import { HudSnapshot } from '@/lib/fps/renderer';
import { GameMode, MapBlock } from '@/lib/fps/types';

export interface MiniMapProps {
  mapId: string;
  mapName: string;
  mapHalfW: number;
  mapHalfD: number;
  mapBlocks: MapBlock[];
  localX: number;
  localZ: number;
  localYaw: number;
  alive: boolean;
  mode: GameMode;
  team: string;
  players: HudSnapshot['players'];
  fovDeg?: number;
}

const DEFAULT_FOV_DEG = 78;

function playersMatch(a: HudSnapshot['players'], b: HudSnapshot['players']): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const pa = a[i];
    const pb = b[i];
    if (
      pa.id !== pb.id ||
      pa.alive !== pb.alive ||
      pa.team !== pb.team ||
      pa.isSelf !== pb.isSelf ||
      Math.abs(pa.x - pb.x) > 0.05 ||
      Math.abs(pa.z - pb.z) > 0.05 ||
      Math.abs(pa.yaw - pb.yaw) > 0.03
    ) {
      return false;
    }
  }
  return true;
}

function areMiniMapPropsEqual(prev: MiniMapProps, next: MiniMapProps): boolean {
  return (
    prev.mapId === next.mapId &&
    prev.mapName === next.mapName &&
    prev.mapHalfW === next.mapHalfW &&
    prev.mapHalfD === next.mapHalfD &&
    prev.mapBlocks === next.mapBlocks &&
    prev.alive === next.alive &&
    prev.mode === next.mode &&
    prev.team === next.team &&
    prev.fovDeg === next.fovDeg &&
    Math.abs(prev.localX - next.localX) < 0.02 &&
    Math.abs(prev.localZ - next.localZ) < 0.02 &&
    Math.abs(prev.localYaw - next.localYaw) < 0.005 &&
    playersMatch(prev.players, next.players)
  );
}

const MiniMap = React.memo(function MiniMap({
  mapId,
  mapName,
  mapHalfW,
  mapHalfD,
  mapBlocks,
  localX,
  localZ,
  localYaw,
  alive,
  mode,
  team,
  players,
  fovDeg = DEFAULT_FOV_DEG,
}: MiniMapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const staticCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const dynamicCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const [size, setSize] = React.useState<{ w: number; h: number }>({ w: 128, h: 128 });

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.max(32, Math.round(rect.width));
      const h = Math.max(32, Math.round(rect.height));
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const padding = size.w < 84 ? 4 : 10;
  const transform = React.useMemo(
    () => computeMiniMapTransform(mapHalfW, mapHalfD, size.w, size.h, padding),
    [mapHalfW, mapHalfD, size.w, size.h, padding],
  );

  const projectedBlocks = React.useMemo(
    () => projectMapBlocks(mapBlocks, transform),
    [mapBlocks, transform],
  );

  // Static Layer: Arena footprint, tactical grid, perimeter walls, and map cover blocks.
  // Redraws ONLY when map geometry/dimensions or overlay size changes.
  React.useEffect(() => {
    const canvas = staticCanvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.round(size.w * dpr);
    const targetH = Math.round(size.h * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    // Arena floor footprint scaled to mapHalfW x mapHalfD
    ctx.fillStyle = '#111827';
    ctx.fillRect(transform.arenaLeft, transform.arenaTop, transform.arenaW, transform.arenaD);

    // Subtle 10m tactical grid centered on world (0, 0)
    ctx.save();
    ctx.beginPath();
    ctx.rect(transform.arenaLeft, transform.arenaTop, transform.arenaW, transform.arenaD);
    ctx.clip();

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 0.75;
    const gridStep = 10;
    const maxGX = Math.floor(transform.halfW / gridStep) * gridStep;
    for (let gx = -maxGX; gx <= maxGX; gx += gridStep) {
      const px = transform.centerX + gx * transform.scale;
      ctx.beginPath();
      ctx.moveTo(px, transform.arenaTop);
      ctx.lineTo(px, transform.arenaTop + transform.arenaD);
      ctx.stroke();
    }
    const maxGZ = Math.floor(transform.halfD / gridStep) * gridStep;
    for (let gz = -maxGZ; gz <= maxGZ; gz += gridStep) {
      const py = transform.centerY + gz * transform.scale;
      ctx.beginPath();
      ctx.moveTo(transform.arenaLeft, py);
      ctx.lineTo(transform.arenaLeft + transform.arenaW, py);
      ctx.stroke();
    }

    // Center world axes
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.14)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(transform.centerX, transform.arenaTop);
    ctx.lineTo(transform.centerX, transform.arenaTop + transform.arenaD);
    ctx.moveTo(transform.arenaLeft, transform.centerY);
    ctx.lineTo(transform.arenaLeft + transform.arenaW, transform.centerY);
    ctx.stroke();

    // Arena blocks & cover sorted bottom-to-top
    for (const block of projectedBlocks) {
      if (block.isPerimeter) {
        ctx.fillStyle = 'rgba(71, 85, 105, 0.65)';
        ctx.fillRect(block.left, block.top, block.width, block.height);
        continue;
      }
      ctx.fillStyle = MINIMAP_MATERIAL_COLORS[block.material] || '#64748b';
      ctx.globalAlpha = 0.68 + block.elevationNorm * 0.28;
      ctx.fillRect(block.left, block.top, block.width, block.height);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(9, 13, 22, 0.85)';
      ctx.lineWidth = 0.75;
      ctx.strokeRect(block.left, block.top, block.width, block.height);
    }
    ctx.restore();

    // Crisp arena bounds outline
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.24)';
    ctx.lineWidth = 1;
    ctx.strokeRect(transform.arenaLeft, transform.arenaTop, transform.arenaW, transform.arenaD);
  }, [projectedBlocks, size.h, size.w, transform]);

  // Dynamic Layer: Remote combatants + local player position & FOV orientation.
  React.useEffect(() => {
    const canvas = dynamicCanvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.round(size.w * dpr);
    const targetH = Math.round(size.h * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    const compact = size.w < 84;
    const remoteRadius = compact ? 2.4 : 3.2;

    // 1. Remote combatants
    for (const p of players) {
      if (p.isSelf || !p.alive) continue;
      const pos = worldToMiniMap(p.x, p.z, transform, remoteRadius + 1);
      const isAlly = mode === 'TDM' && p.team === team && team !== 'NONE';
      const fill = isAlly ? '#3B82F6' : '#EF4444';

      const rot = yawToCanvasRotationRad(p.yaw);
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(rot);

      // Subtle directional tick
      ctx.beginPath();
      ctx.moveTo(0, -remoteRadius - 2.0);
      ctx.lineTo(-1.8, -remoteRadius + 0.8);
      ctx.lineTo(1.8, -remoteRadius + 0.8);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, remoteRadius, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = '#090D16';
      ctx.stroke();
      ctx.restore();
    }

    // 2. Local player position + orientation wedge
    const selfPos = worldToMiniMap(localX, localZ, transform, compact ? 3.5 : 5);
    const selfRot = yawToCanvasRotationRad(localYaw);

    ctx.save();
    ctx.translate(selfPos.x, selfPos.y);

    if (alive) {
      const coneLen = compact ? 16 : 30;
      const halfFov = ((fovDeg * Math.PI) / 180) * 0.5;
      ctx.rotate(selfRot);

      // Clipped translucent FOV cone
      const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, coneLen);
      grad.addColorStop(0, 'rgba(245, 158, 11, 0.38)');
      grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, coneLen, -Math.PI * 0.5 - halfFov, -Math.PI * 0.5 + halfFov);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Oriented directional chevron pointing forward (-Z in world -> -Y in rotated canvas)
      const tip = compact ? 4.8 : 6.4;
      const wingX = compact ? 3.4 : 4.5;
      const tailY = compact ? 3.0 : 4.0;
      const notchY = compact ? 1.4 : 1.9;

      ctx.beginPath();
      ctx.moveTo(0, -tip);
      ctx.lineTo(wingX, tailY);
      ctx.lineTo(0, notchY);
      ctx.lineTo(-wingX, tailY);
      ctx.closePath();

      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = '#090D16';
      ctx.stroke();
      ctx.fillStyle = '#F59E0B';
      ctx.fill();

      // High-contrast center pip
      ctx.beginPath();
      ctx.arc(0, -0.4, compact ? 1.0 : 1.35, 0, Math.PI * 2);
      ctx.fillStyle = '#FEF3C7';
      ctx.fill();
    } else {
      // Eliminated marker at last position
      const r = compact ? 2.5 : 3.5;
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-r, -r);
      ctx.lineTo(r, r);
      ctx.moveTo(r, -r);
      ctx.lineTo(-r, r);
      ctx.stroke();
    }

    ctx.restore();
  }, [alive, fovDeg, localX, localYaw, localZ, mode, players, size.h, size.w, team, transform]);

  const spanW = Math.round(mapHalfW * 2);
  const spanD = Math.round(mapHalfD * 2);

  return (
    <div
      ref={containerRef}
      data-testid="minimap-overlay"
      data-map-id={mapId}
      data-map-dims={`${spanW}x${spanD}`}
      data-player-x={localX.toFixed(2)}
      data-player-z={localZ.toFixed(2)}
      data-player-yaw={localYaw.toFixed(3)}
      role="img"
      aria-label={`Tactical minimap for ${mapName} (${spanW} by ${spanD} meters)`}
      style={{ contain: 'layout style paint' }}
      className="relative w-16 h-16 sm:w-32 sm:h-32 rounded-lg bg-[#0B0F17]/88 border border-white/15 overflow-hidden shrink-0 shadow-lg"
    >
      <canvas
        ref={staticCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
      <canvas
        ref={dynamicCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
      <span className="hidden sm:block absolute top-0.5 left-1/2 -translate-x-1/2 px-1 bg-[#0B0F17]/90 text-[9px] font-mono font-bold tracking-wider text-slate-300 leading-none pointer-events-none">
        N
      </span>
      <span className="hidden sm:block absolute bottom-0.5 right-1 px-1 bg-[#0B0F17]/90 text-[9px] font-mono tabular-nums text-slate-300 leading-none pointer-events-none">
        {spanW}×{spanD}m
      </span>
    </div>
  );
}, areMiniMapPropsEqual);

export default MiniMap;
