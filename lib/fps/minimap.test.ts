import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from './maps';
import { getAimDirection } from './physics';
import {
  computeMiniMapTransform,
  getHeadingVector2D,
  projectMapBlocks,
  worldToMiniMap,
  yawToCanvasRotationRad,
} from './minimap';

test('computeMiniMapTransform preserves aspect ratio for rectangular maps', () => {
  const wide = computeMiniMapTransform(40, 20, 128, 128, 8);
  assert.equal(wide.arenaW > wide.arenaD, true);
  assert.ok(Math.abs(wide.arenaW / wide.arenaD - 2.0) < 1e-6);
  assert.ok(wide.arenaW <= 112 + 1e-6);
  assert.ok(wide.arenaD <= 112 + 1e-6);
  assert.equal(wide.centerX, 64);
  assert.equal(wide.centerY, 64);

  const tall = computeMiniMapTransform(15, 30, 128, 128, 8);
  assert.equal(tall.arenaD > tall.arenaW, true);
  assert.ok(Math.abs(tall.arenaD / tall.arenaW - 2.0) < 1e-6);
});

test('worldToMiniMap maps origin to center, corners accurately, and clamps out-of-bounds', () => {
  const t = computeMiniMapTransform(26, 26, 120, 120, 8);
  const center = worldToMiniMap(0, 0, t);
  assert.equal(center.x, 60);
  assert.equal(center.y, 60);

  const nw = worldToMiniMap(-26, -26, t);
  assert.ok(Math.abs(nw.x - t.arenaLeft) < 1e-6);
  assert.ok(Math.abs(nw.y - t.arenaTop) < 1e-6);

  const se = worldToMiniMap(26, 26, t);
  assert.ok(Math.abs(se.x - (t.arenaLeft + t.arenaW)) < 1e-6);
  assert.ok(Math.abs(se.y - (t.arenaTop + t.arenaD)) < 1e-6);

  const clamped = worldToMiniMap(999, -999, t, 4);
  assert.ok(Math.abs(clamped.x - (t.arenaLeft + t.arenaW - 4)) < 1e-6);
  assert.ok(Math.abs(clamped.y - (t.arenaTop + 4)) < 1e-6);
});

test('player orientation math matches 3D getAimDirection across cardinal yaws', () => {
  const yaws = [0, Math.PI * 0.5, -Math.PI * 0.5, Math.PI, -Math.PI * 0.75];
  for (const yaw of yaws) {
    const aim3d = getAimDirection(yaw, 0);
    const vec2d = getHeadingVector2D(yaw);
    assert.ok(Math.abs(vec2d.dx - aim3d.x) < 1e-9);
    assert.ok(Math.abs(vec2d.dy - aim3d.z) < 1e-9);

    // Rotating an up-pointing (0, -1) chevron by yawToCanvasRotationRad(yaw) yields (dx, dy)
    const rot = yawToCanvasRotationRad(yaw);
    const rotatedX = Math.sin(rot);
    const rotatedY = -Math.cos(rot);
    assert.ok(Math.abs(rotatedX - vec2d.dx) < 1e-9);
    assert.ok(Math.abs(rotatedY - vec2d.dy) < 1e-9);
  }
});

test('projectMapBlocks scales blocks cleanly and layers stacked obstacles above base', () => {
  const depot = MAPS.depot;
  const t = computeMiniMapTransform(depot.bounds.halfW, depot.bounds.halfD, 128, 128, 6);
  const projected = projectMapBlocks(depot.blocks, t);

  assert.equal(projected.length, depot.blocks.length);
  const baseIdx = projected.findIndex((b) => b.id === 'd_mid_b');
  const topIdx = projected.findIndex((b) => b.id === 'd_mid_t');
  assert.ok(baseIdx >= 0 && topIdx > baseIdx);

  // Perimeter walls precede interior obstacles
  const lastWallIdx = projected.reduce((acc, b, idx) => (b.isPerimeter ? idx : acc), -1);
  const firstInteriorIdx = projected.findIndex((b) => !b.isPerimeter);
  assert.ok(lastWallIdx < firstInteriorIdx);
});
