import assert from 'node:assert/strict';
import test from 'node:test';
import { MAP_LIST } from './maps';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from './physics';
import { MapBlock, MapData } from './types';

const isWall = (b: MapBlock) => b.id.startsWith('wall_');
const top = (b: MapBlock) => b.y + b.h / 2;
const bottom = (b: MapBlock) => b.y - b.h / 2;

test('map ids are unique and every map has the data the renderer needs', () => {
  assert.equal(new Set(MAP_LIST.map((m) => m.id)).size, MAP_LIST.length);
  assert.ok(MAP_LIST.length >= 12);
  for (const m of MAP_LIST) {
    assert.equal(new Set(m.blocks.map((b) => b.id)).size, m.blocks.length, `${m.id}: duplicate block ids`);
    for (const b of m.blocks) {
      for (const v of [b.x, b.y, b.z, b.w, b.h, b.d]) assert.ok(Number.isFinite(v), `${m.id}/${b.id} has a non-finite value`);
      assert.ok(b.w > 0 && b.h > 0 && b.d > 0, `${m.id}/${b.id} has no volume`);
    }
  }
});

test('blocks stay inside the arena and spawns are not buried in geometry', () => {
  for (const m of MAP_LIST) {
    for (const b of m.blocks) {
      if (isWall(b)) continue;
      assert.ok(Math.abs(b.x) + b.w / 2 <= m.bounds.halfW + 0.01, `${m.id}/${b.id} sticks out in X`);
      assert.ok(Math.abs(b.z) + b.d / 2 <= m.bounds.halfD + 0.01, `${m.id}/${b.id} sticks out in Z`);
    }
    for (const sp of m.spawns) {
      assert.ok(Math.abs(sp.x) < m.bounds.halfW - 1 && Math.abs(sp.z) < m.bounds.halfD - 1, `${m.id} spawn near wall`);
      for (const b of m.blocks) {
        if (bottom(b) >= PLAYER_HEIGHT || top(b) <= 0) continue;
        const inside =
          Math.abs(sp.x - b.x) < b.w / 2 + PLAYER_RADIUS && Math.abs(sp.z - b.z) < b.d / 2 + PLAYER_RADIUS;
        assert.ok(!inside, `${m.id}: spawn (${sp.x},${sp.z}) is inside ${b.id}`);
      }
    }
  }
});

test('team modes: every map has at least 4 spawns for each team, far apart', () => {
  for (const m of MAP_LIST) {
    const blue = m.spawns.filter((s) => s.team === 'BLUE');
    const red = m.spawns.filter((s) => s.team === 'RED');
    assert.ok(blue.length >= 4 && red.length >= 4, `${m.id} needs >=4 spawns per team`);
    let minDist = Infinity;
    for (const a of blue) for (const b of red) minDist = Math.min(minDist, Math.hypot(a.x - b.x, a.z - b.z));
    assert.ok(minDist >= 12, `${m.id}: opposing spawns only ${minDist.toFixed(1)}m apart`);
  }
});

function floorReachability(m: MapData) {
  const cell = 0.5;
  const w = Math.ceil((m.bounds.halfW * 2) / cell);
  const d = Math.ceil((m.bounds.halfD * 2) / cell);
  const blocked = new Uint8Array(w * d);
  const solids = m.blocks.filter((b) => !isWall(b) && bottom(b) < PLAYER_HEIGHT && top(b) > 2.0);
  const toX = (i: number) => -m.bounds.halfW + (i + 0.5) * cell;
  const toZ = (j: number) => -m.bounds.halfD + (j + 0.5) * cell;
  let free = 0;
  for (let j = 0; j < d; j++) {
    for (let i = 0; i < w; i++) {
      const x = toX(i);
      const z = toZ(j);
      const edge = Math.abs(x) > m.bounds.halfW - PLAYER_RADIUS || Math.abs(z) > m.bounds.halfD - PLAYER_RADIUS;
      const hit = solids.some(
        (b) => Math.abs(x - b.x) < b.w / 2 + PLAYER_RADIUS && Math.abs(z - b.z) < b.d / 2 + PLAYER_RADIUS,
      );
      if (edge || hit) blocked[j * w + i] = 1;
      else free++;
    }
  }
  const idx = (x: number, z: number) =>
    Math.floor((z + m.bounds.halfD) / cell) * w + Math.floor((x + m.bounds.halfW) / cell);
  const seen = new Uint8Array(w * d);
  const queue: number[] = [];
  const start = idx(m.spawns[0].x, m.spawns[0].z);
  queue.push(start);
  seen[start] = 1;
  let reached = 0;
  while (queue.length) {
    const cur = queue.pop()!;
    reached++;
    const i = cur % w;
    const j = Math.floor(cur / w);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= w || nj >= d) continue;
      const n = nj * w + ni;
      if (blocked[n] || seen[n]) continue;
      seen[n] = 1;
      queue.push(n);
    }
  }
  return { free, reached, seen, idx };
}

test('no map has sealed-off floor areas and every spawn can reach every other', () => {
  for (const m of MAP_LIST) {
    const { free, reached, seen, idx } = floorReachability(m);
    assert.ok(reached / free > 0.97, `${m.id}: only ${((reached / free) * 100).toFixed(1)}% of the floor is connected`);
    for (const sp of m.spawns) assert.ok(seen[idx(sp.x, sp.z)], `${m.id}: spawn (${sp.x},${sp.z}) is walled off`);
  }
});

test('every elevated platform can be reached on foot (jump <= 2.4m, gap <= 2.5m)', () => {
  const MAX_RISE = 2.4;
  const MAX_GAP = 2.5;
  for (const m of MAP_LIST) {
    const blocks = m.blocks.filter((b) => !isWall(b));
    const reachable = new Set<string>();
    // Anything whose top is within jump range of the floor is reachable from the floor.
    for (const b of blocks) if (top(b) <= MAX_RISE) reachable.add(b.id);
    const gap = (a: MapBlock, b: MapBlock) => {
      const gx = Math.max(0, Math.abs(a.x - b.x) - (a.w + b.w) / 2);
      const gz = Math.max(0, Math.abs(a.z - b.z) - (a.d + b.d) / 2);
      return Math.hypot(gx, gz);
    };
    let changed = true;
    while (changed) {
      changed = false;
      for (const b of blocks) {
        if (reachable.has(b.id)) continue;
        for (const a of blocks) {
          if (!reachable.has(a.id)) continue;
          if (top(b) - top(a) <= MAX_RISE && gap(a, b) <= MAX_GAP) {
            reachable.add(b.id);
            changed = true;
            break;
          }
        }
      }
    }
    for (const b of blocks) {
      const elevated = bottom(b) > 1.0 && !/_top(_m)?$/.test(b.id);
      if (elevated) assert.ok(reachable.has(b.id), `${m.id}: platform ${b.id} (top ${top(b).toFixed(1)}m) has no way up`);
    }
  }
});
