import { BlockMaterialType, MapBlock } from './types';

export interface MiniMapTransform {
  viewportW: number;
  viewportH: number;
  halfW: number;
  halfD: number;
  scale: number;
  arenaLeft: number;
  arenaTop: number;
  arenaW: number;
  arenaD: number;
  centerX: number;
  centerY: number;
}

export interface ProjectedMapBlock {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  material: BlockMaterialType;
  isPerimeter: boolean;
  topY: number;
  elevationNorm: number;
}

export const MINIMAP_MATERIAL_COLORS: Record<BlockMaterialType, string> = {
  concrete: '#64748b',
  steel: '#475569',
  crate: '#b4784a',
  hazard: '#d97706',
  container_red: '#dc2626',
  container_blue: '#2563eb',
  accent: '#eab308',
};

/**
 * Computes an aspect-ratio-preserving world-to-minimap transform from the
 * current map's half-dimensions (mapHalfW, mapHalfD) and overlay pixel size.
 */
export function computeMiniMapTransform(
  mapHalfW: number,
  mapHalfD: number,
  viewportW: number,
  viewportH: number,
  padding = 6,
): MiniMapTransform {
  const safeW = Math.max(16, viewportW);
  const safeH = Math.max(16, viewportH);
  const safePad = Math.max(0, Math.min(padding, Math.min(safeW, safeH) * 0.25));
  const halfW = Math.max(1, Number.isFinite(mapHalfW) ? mapHalfW : 26);
  const halfD = Math.max(1, Number.isFinite(mapHalfD) ? mapHalfD : 26);

  const usableW = Math.max(1, safeW - safePad * 2);
  const usableH = Math.max(1, safeH - safePad * 2);
  const scale = Math.min(usableW / (halfW * 2), usableH / (halfD * 2));

  const arenaW = halfW * 2 * scale;
  const arenaD = halfD * 2 * scale;
  const arenaLeft = (safeW - arenaW) * 0.5;
  const arenaTop = (safeH - arenaD) * 0.5;

  return {
    viewportW: safeW,
    viewportH: safeH,
    halfW,
    halfD,
    scale,
    arenaLeft,
    arenaTop,
    arenaW,
    arenaD,
    centerX: safeW * 0.5,
    centerY: safeH * 0.5,
  };
}

/**
 * Projects world (x, z) coordinates onto 2D minimap pixel coordinates.
 * +X maps right, -Z (North) maps up, +Z (South) maps down.
 */
export function worldToMiniMap(
  x: number,
  z: number,
  transform: MiniMapTransform,
  clampMargin = 0,
): { x: number; y: number } {
  const safeX = Number.isFinite(x) ? x : 0;
  const safeZ = Number.isFinite(z) ? z : 0;
  const rawX = transform.centerX + safeX * transform.scale;
  const rawY = transform.centerY + safeZ * transform.scale;

  const maxMarginX = Math.min(clampMargin, transform.arenaW * 0.45);
  const maxMarginY = Math.min(clampMargin, transform.arenaD * 0.45);

  return {
    x: Math.max(
      transform.arenaLeft + maxMarginX,
      Math.min(transform.arenaLeft + transform.arenaW - maxMarginX, rawX),
    ),
    y: Math.max(
      transform.arenaTop + maxMarginY,
      Math.min(transform.arenaTop + transform.arenaD - maxMarginY, rawY),
    ),
  };
}

/**
 * Converts 3D player yaw (Three.js Y-up where yaw=0 faces -Z) into a 2D
 * Canvas/SVG rotation in radians where 0 rad faces UP (0, -1) and positive
 * angles rotate clockwise.
 */
export function yawToCanvasRotationRad(yaw: number): number {
  return Number.isFinite(yaw) ? -yaw : 0;
}

/**
 * Returns the normalized 2D unit forward vector in minimap space matching
 * getAimDirection(yaw, 0) in physics.ts: (-sin(yaw), -cos(yaw)).
 */
export function getHeadingVector2D(yaw: number): { dx: number; dy: number } {
  const safeYaw = Number.isFinite(yaw) ? yaw : 0;
  return {
    dx: -Math.sin(safeYaw),
    dy: -Math.cos(safeYaw),
  };
}

/**
 * Projects 3D map obstacle blocks onto 2D minimap rectangles sorted bottom-to-top
 * by upper elevation so stacked blocks render over lower platforms.
 */
export function projectMapBlocks(
  blocks: MapBlock[],
  transform: MiniMapTransform,
): ProjectedMapBlock[] {
  const projected: ProjectedMapBlock[] = [];
  for (const b of blocks) {
    const isPerimeter = b.id.startsWith('wall_');
    const width = Math.max(1, b.w * transform.scale);
    const height = Math.max(1, b.d * transform.scale);
    const left = transform.centerX + (b.x - b.w * 0.5) * transform.scale;
    const top = transform.centerY + (b.z - b.d * 0.5) * transform.scale;
    const topY = b.y + b.h * 0.5;
    const elevationNorm = Math.max(0, Math.min(1, topY / 6.0));
    projected.push({
      id: b.id,
      left,
      top,
      width,
      height,
      material: b.material,
      isPerimeter,
      topY,
      elevationNorm,
    });
  }

  projected.sort((a, b) => {
    if (a.isPerimeter !== b.isPerimeter) return a.isPerimeter ? -1 : 1;
    return a.topY - b.topY;
  });
  return projected;
}
