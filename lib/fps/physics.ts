import { MapBlock, MapData, PlayerInput, PlayerState, Vec3 } from './types';

export const PLAYER_RADIUS = 0.42;
export const PLAYER_HEIGHT = 1.75;
export const PLAYER_EYE_HEIGHT = 1.56;
export const SLIDE_EYE_HEIGHT = 0.92;
export const GRAVITY = 26.0;
export const JUMP_VELOCITY = 9.4;
export const MAX_GROUND_SPEED = 9.4;
export const GROUND_ACCEL = 110.0;
export const AIR_ACCEL = 26.0;
export const GROUND_FRICTION = 7.2;
export const SLIDE_BOOST_SPEED = 15.6;
export const STEP_UP_HEIGHT = 1.05;

export function getAimDirection(yaw: number, pitch: number): Vec3 {
  const cosPitch = Math.cos(pitch);
  return {
    x: -Math.sin(yaw) * cosPitch,
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * cosPitch,
  };
}

function overlapsXZ(x: number, z: number, r: number, b: MapBlock): boolean {
  const minX = b.x - b.w * 0.5;
  const maxX = b.x + b.w * 0.5;
  const minZ = b.z - b.d * 0.5;
  const maxZ = b.z + b.d * 0.5;
  return x + r > minX && x - r < maxX && z + r > minZ && z - r < maxZ;
}

function blockTop(b: MapBlock): number {
  return b.y + b.h * 0.5;
}

function blockBottom(b: MapBlock): number {
  return b.y - b.h * 0.5;
}

export function stepPlayerMovement(
  s: PlayerState,
  input: Pick<PlayerInput, 'dt' | 'forward' | 'strafe' | 'yaw' | 'pitch' | 'jump' | 'slide'>,
  map: MapData,
) {
  const dt = Math.min(Math.max(input.dt, 0.001), 0.05);
  s.yaw = input.yaw;
  s.pitch = Math.max(-1.45, Math.min(1.45, input.pitch));

  const fwdX = -Math.sin(s.yaw);
  const fwdZ = -Math.cos(s.yaw);
  const rightX = Math.cos(s.yaw);
  const rightZ = -Math.sin(s.yaw);

  let wishX = fwdX * input.forward + rightX * input.strafe;
  let wishZ = fwdZ * input.forward + rightZ * input.strafe;
  const wishLen = Math.hypot(wishX, wishZ);
  if (wishLen > 1e-4) {
    wishX /= wishLen;
    wishZ /= wishLen;
  }

  // Slide initiation & decay
  if (input.slide && s.grounded && !s.sliding) {
    const horizSpeed = Math.hypot(s.vx, s.vz);
    if (horizSpeed > 3.0 || wishLen > 0.1) {
      s.sliding = true;
      s.slideTimer = 0.58;
      const dirX = wishLen > 0.1 ? wishX : s.vx / Math.max(0.01, horizSpeed);
      const dirZ = wishLen > 0.1 ? wishZ : s.vz / Math.max(0.01, horizSpeed);
      const targetSpeed = Math.max(horizSpeed + 3.2, SLIDE_BOOST_SPEED);
      s.vx = dirX * targetSpeed;
      s.vz = dirZ * targetSpeed;
    }
  }

  if (s.sliding) {
    s.slideTimer -= dt;
    if (!input.slide || s.slideTimer <= 0 || !s.grounded) {
      s.sliding = false;
      s.slideTimer = 0;
    }
  }

  // Ground friction & acceleration
  if (s.grounded) {
    s.coyoteTimer = 0.11;
    const speed = Math.hypot(s.vx, s.vz);
    if (speed > 0.001) {
      const fric = s.sliding ? GROUND_FRICTION * 0.28 : GROUND_FRICTION;
      const drop = speed * fric * dt;
      const newSpeed = Math.max(0, speed - drop);
      s.vx *= newSpeed / speed;
      s.vz *= newSpeed / speed;
    }

    if (!s.sliding && wishLen > 0.01) {
      const addSpeed = Math.min(GROUND_ACCEL * dt, MAX_GROUND_SPEED);
      s.vx += wishX * addSpeed;
      s.vz += wishZ * addSpeed;
      const cur = Math.hypot(s.vx, s.vz);
      if (cur > MAX_GROUND_SPEED) {
        // Gentle cap only if not carrying slide-hop momentum
        const damp = Math.max(MAX_GROUND_SPEED, cur - 18 * dt);
        s.vx *= damp / cur;
        s.vz *= damp / cur;
      }
    }
  } else {
    s.coyoteTimer = Math.max(0, s.coyoteTimer - dt);
    if (wishLen > 0.01) {
      const proj = s.vx * wishX + s.vz * wishZ;
      const add = Math.max(0, Math.min(AIR_ACCEL * dt, MAX_GROUND_SPEED - proj));
      s.vx += wishX * add;
      s.vz += wishZ * add;
    }
  }

  // Jump (with coyote time + slide-hop momentum conservation)
  if (input.jump && (s.grounded || s.coyoteTimer > 0)) {
    s.vy = JUMP_VELOCITY;
    s.grounded = false;
    s.coyoteTimer = 0;
    s.sliding = false;
    s.slideTimer = 0;
  }

  // Gravity
  s.vy -= GRAVITY * dt;

  // Move X & resolve AABB collisions (with step-up)
  s.x += s.vx * dt;
  for (const b of map.blocks) {
    if (!overlapsXZ(s.x, s.z, PLAYER_RADIUS, b)) continue;
    const top = blockTop(b);
    const bot = blockBottom(b);
    if (s.y < top && s.y + PLAYER_HEIGHT > bot) {
      if (top - s.y <= STEP_UP_HEIGHT && s.vy <= 1.5) {
        s.y = top;
      } else {
        const minX = b.x - b.w * 0.5 - PLAYER_RADIUS;
        const maxX = b.x + b.w * 0.5 + PLAYER_RADIUS;
        if (Math.abs(s.x - minX) < Math.abs(s.x - maxX)) {
          s.x = minX;
        } else {
          s.x = maxX;
        }
        s.vx = 0;
      }
    }
  }

  // Move Z & resolve AABB collisions (with step-up)
  s.z += s.vz * dt;
  for (const b of map.blocks) {
    if (!overlapsXZ(s.x, s.z, PLAYER_RADIUS, b)) continue;
    const top = blockTop(b);
    const bot = blockBottom(b);
    if (s.y < top && s.y + PLAYER_HEIGHT > bot) {
      if (top - s.y <= STEP_UP_HEIGHT && s.vy <= 1.5) {
        s.y = top;
      } else {
        const minZ = b.z - b.d * 0.5 - PLAYER_RADIUS;
        const maxZ = b.z + b.d * 0.5 + PLAYER_RADIUS;
        if (Math.abs(s.z - minZ) < Math.abs(s.z - maxZ)) {
          s.z = minZ;
        } else {
          s.z = maxZ;
        }
        s.vz = 0;
      }
    }
  }

  // Clamp inside arena bounds
  const limitX = map.bounds.halfW - PLAYER_RADIUS;
  const limitZ = map.bounds.halfD - PLAYER_RADIUS;
  if (s.x < -limitX) { s.x = -limitX; s.vx = Math.max(0, s.vx); }
  if (s.x > limitX) { s.x = limitX; s.vx = Math.min(0, s.vx); }
  if (s.z < -limitZ) { s.z = -limitZ; s.vz = Math.max(0, s.vz); }
  if (s.z > limitZ) { s.z = limitZ; s.vz = Math.min(0, s.vz); }

  // Vertical Y sweep
  const prevY = s.y;
  s.y += s.vy * dt;
  let floorY = 0;
  for (const b of map.blocks) {
    if (!overlapsXZ(s.x, s.z, PLAYER_RADIUS, b)) continue;
    const top = blockTop(b);
    const bot = blockBottom(b);
    if (prevY >= top - 0.12 && s.y <= top && s.vy <= 0) {
      if (top > floorY) floorY = top;
    } else if (s.y + PLAYER_HEIGHT > bot && prevY + PLAYER_HEIGHT <= bot + 0.12 && s.vy > 0) {
      s.y = bot - PLAYER_HEIGHT;
      s.vy = 0;
    }
  }

  if (s.y <= floorY) {
    s.y = floorY;
    s.vy = 0;
    s.grounded = true;
  } else {
    s.grounded = false;
  }
}

function intersectAABB(
  origin: Vec3,
  dir: Vec3,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
  maxDist: number,
): number | null {
  let tmin = 0;
  let tmax = maxDist;

  const axes: Array<[number, number, number, number]> = [
    [origin.x, dir.x, minX, maxX],
    [origin.y, dir.y, minY, maxY],
    [origin.z, dir.z, minZ, maxZ],
  ];

  for (const [o, d, minB, maxB] of axes) {
    if (Math.abs(d) < 1e-7) {
      if (o < minB || o > maxB) return null;
    } else {
      const invD = 1 / d;
      let t1 = (minB - o) * invD;
      let t2 = (maxB - o) * invD;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin >= 0 && tmin <= maxDist ? tmin : null;
}

export function raycastMap(
  origin: Vec3,
  dir: Vec3,
  maxDist: number,
  blocks: MapBlock[],
): { distance: number; point: Vec3; blockId: string } | null {
  let bestDist = maxDist;
  let bestBlockId: string | null = null;

  for (const b of blocks) {
    const t = intersectAABB(
      origin,
      dir,
      b.x - b.w * 0.5,
      b.y - b.h * 0.5,
      b.z - b.d * 0.5,
      b.x + b.w * 0.5,
      b.y + b.h * 0.5,
      b.z + b.d * 0.5,
      bestDist,
    );
    if (t !== null && t < bestDist) {
      bestDist = t;
      bestBlockId = b.id;
    }
  }

  if (!bestBlockId) return null;
  return {
    distance: bestDist,
    point: {
      x: origin.x + dir.x * bestDist,
      y: origin.y + dir.y * bestDist,
      z: origin.z + dir.z * bestDist,
    },
    blockId: bestBlockId,
  };
}

export function raycastPlayers(
  origin: Vec3,
  dir: Vec3,
  maxDist: number,
  targets: Array<{ id: string; x: number; y: number; z: number; sliding: boolean }>,
  ignoreId: string,
): { playerId: string; distance: number; point: Vec3; headshot: boolean } | null {
  let bestDist = maxDist;
  let bestHit: { playerId: string; distance: number; point: Vec3; headshot: boolean } | null = null;

  for (const target of targets) {
    if (target.id === ignoreId) continue;
    const bodyHalfW = 0.44;
    const totalH = target.sliding ? 1.18 : 1.78;
    const t = intersectAABB(
      origin,
      dir,
      target.x - bodyHalfW,
      target.y,
      target.z - bodyHalfW,
      target.x + bodyHalfW,
      target.y + totalH,
      target.z + bodyHalfW,
      bestDist,
    );
    if (t !== null && t < bestDist) {
      bestDist = t;
      const hitY = origin.y + dir.y * t;
      const headCutoff = target.y + (target.sliding ? 0.8 : 1.3);
      bestHit = {
        playerId: target.id,
        distance: t,
        point: {
          x: origin.x + dir.x * t,
          y: hitY,
          z: origin.z + dir.z * t,
        },
        headshot: hitY >= headCutoff,
      };
    }
  }

  return bestHit;
}
