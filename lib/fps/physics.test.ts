import assert from 'node:assert/strict';
import test from 'node:test';
import { MAPS, MAP_LIST } from './maps';
import { getAimDirection, PLAYER_EYE_HEIGHT, raycastMap, raycastPlayers, stepPlayerMovement } from './physics';
import {
  buildInviteUrl,
  formatPlayerDisplayName,
  generateRoomCode,
  parseHexColor,
  sanitizeClanTag,
} from './profile';
import { applyDamageAndCheckKill, assignTeam, computePostGameSummary } from './rules';
import { PlayerState } from './types';
import { getWeaponBySlot, LOADOUT_WEAPONS, WEAPONS } from './weapons';

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'p1',
    name: 'Test',
    isBot: false,
    team: 'NONE',
    characterStyle: 'vanguard',
    accentColor: '#38BDF8',
    x: -4,
    y: 0,
    z: -20,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    pitch: 0,
    hp: 100,
    maxHp: 100,
    shield: 50,
    maxShield: 50,
    grounded: true,
    sliding: false,
    slideTimer: 0,
    coyoteTimer: 0.1,
    alive: true,
    respawnTimer: 0,
    weaponId: 'rifle',
    ammo: 30,
    reloading: false,
    reloadTimer: 0,
    lastFireTime: 0,
    kills: 0,
    deaths: 0,
    score: 0,
    gunGameTier: 0,
    streak: 0,
    shotsFired: 0,
    shotsHit: 0,
    lastProcessedSeq: 0,
    ...overrides,
  };
}

test('All 12 preset maps have >= 8 spawns with >= 4.0m unobstructed forward sightlines', () => {
  assert.equal(MAP_LIST.length, 12);
  for (const map of Object.values(MAPS)) {
    assert.ok(map.spawns.length >= 8, `${map.id} should support >= 8 spawns`);
    for (const sp of map.spawns) {
      const origin = { x: sp.x, y: sp.y + PLAYER_EYE_HEIGHT, z: sp.z };
      const dir = getAimDirection(sp.yaw, 0);
      const hit = raycastMap(origin, dir, 10, map.blocks);
      if (hit) {
        assert.ok(
          hit.distance >= 4.0,
          `${map.id} spawn (${sp.x},${sp.z}) faces obstacle at ${hit.distance.toFixed(2)}m`,
        );
      }
    }
  }
});

test('Slide-hop movement grants boost and conserves momentum on jump', () => {
  const p = makePlayer({ x: -4, y: 0, z: -20, yaw: Math.PI });
  for (let i = 0; i < 18; i++) {
    stepPlayerMovement(
      p,
      { dt: 0.033, forward: 1, strafe: 0, yaw: Math.PI, pitch: 0, jump: false, slide: false },
      MAPS.foundry,
    );
  }
  const walkSpeed = Math.hypot(p.vx, p.vz);
  assert.ok(walkSpeed > 7.5, `Expected walk speed > 7.5, got ${walkSpeed}`);

  // Initiate slide
  stepPlayerMovement(
    p,
    { dt: 0.033, forward: 1, strafe: 0, yaw: Math.PI, pitch: 0, jump: false, slide: true },
    MAPS.foundry,
  );
  const slideSpeed = Math.hypot(p.vx, p.vz);
  assert.ok(slideSpeed > 13.0, `Expected slide boost > 13.0, got ${slideSpeed}`);

  // Jump out of slide (slide-hop)
  stepPlayerMovement(
    p,
    { dt: 0.033, forward: 1, strafe: 0, yaw: Math.PI, pitch: 0, jump: true, slide: false },
    MAPS.foundry,
  );
  assert.equal(p.grounded, false);
  const airSpeed = Math.hypot(p.vx, p.vz);
  assert.ok(airSpeed > 12.5, `Expected conserved hop speed > 12.5, got ${airSpeed}`);
});

test('Map wall occludes raycast and headshots register above cutoff', () => {
  const origin = { x: 0, y: 1.6, z: -12 };
  const dir = getAimDirection(Math.PI, 0); // +Z toward central steel platform
  const wallHit = raycastMap(origin, dir, 50, MAPS.foundry.blocks);
  assert.ok(wallHit && wallHit.blockId === 'c_plat', 'Expected ray to hit central platform');

  const hit = raycastPlayers(
    { x: 0, y: 1.56, z: -6 },
    getAimDirection(Math.PI, 0),
    30,
    [{ id: 'enemy', x: 0, y: 0, z: 2, sliding: false }],
    'self',
  );
  assert.ok(hit && hit.playerId === 'enemy' && hit.headshot, 'Expected headshot at eye height');
});

test('TDM blocks friendly fire, Gun Game cycles weapon, and Kill Medicate heals killer', () => {
  const blue1 = makePlayer({ id: 'b1', team: 'BLUE' });
  const blue2 = makePlayer({ id: 'b2', team: 'BLUE' });
  const ff = applyDamageAndCheckKill(blue2, blue1, 100, false, 'TDM');
  assert.equal(ff.appliedDamage, 0);
  assert.equal(blue2.hp, 100);

  // Body kill medicate (+35 HP / +20 Shield, capped at max)
  const killerBody = makePlayer({ id: 'kb', team: 'NONE', hp: 50, shield: 10 });
  const victimBody = makePlayer({ id: 'vb', team: 'NONE', hp: 25, shield: 0 });
  const bodyRes = applyDamageAndCheckKill(victimBody, killerBody, 35, false, 'FFA');
  assert.equal(bodyRes.killed, true);
  assert.equal(bodyRes.healedHp, 35);
  assert.equal(bodyRes.healedShield, 20);
  assert.equal(killerBody.hp, 85);
  assert.equal(killerBody.shield, 30);

  // Headshot kill medicate (+50 HP / +30 Shield, capped) + Gun Game weapon advance
  const killerHs = makePlayer({
    id: 'k1',
    team: 'NONE',
    weaponId: 'rifle',
    gunGameTier: 0,
    hp: 75,
    shield: 40,
  });
  const victimHs = makePlayer({ id: 'v1', team: 'NONE', hp: 30, shield: 0 });
  const hsRes = applyDamageAndCheckKill(victimHs, killerHs, 50, true, 'GUN_GAME');
  assert.equal(hsRes.killed, true);
  assert.equal(hsRes.healedHp, 25); // capped at 100
  assert.equal(hsRes.healedShield, 10); // capped at 50
  assert.equal(killerHs.hp, 100);
  assert.equal(killerHs.shield, 50);
  assert.equal(killerHs.weaponId, 'smg');
  assert.equal(killerHs.gunGameTier, 1);

  assert.equal(assignTeam('TDM', [blue1]), 'RED');
});

test('Weapon ADS/scope configuration and player profile helpers work cleanly', () => {
  assert.equal(WEAPONS.sniper.hasScope, true);
  assert.ok(WEAPONS.sniper.adsFovMult < 0.45);
  assert.ok(WEAPONS.sniper.adsSpreadMult <= 0.15);
  assert.equal(WEAPONS.rifle.hasScope, false);

  assert.equal(sanitizeClanTag('v#e!l99'), 'VEL9');
  assert.equal(formatPlayerDisplayName('Nova', 'apex'), '[APEX] Nova');
  assert.equal(formatPlayerDisplayName('Solo', ''), 'Solo');
  assert.equal(parseHexColor('#38BDF8'), 0x38bdf8);

  const code = generateRoomCode(5);
  assert.match(code, /^[A-Z2-9]{5}$/);
  assert.equal(
    buildInviteUrl('ab#12'),
    'https://combat-velocity.vercel.app/?r=AB12',
  );
  assert.equal(
    buildInviteUrl(code),
    `https://combat-velocity.vercel.app/?r=${code}`,
  );
});

test('Post-game match summary computes personal K/D, Match MVP, and TDM team breakdown', () => {
  const tdmSummary = computePostGameSummary({
    mode: 'TDM',
    redScore: 18,
    blueScore: 25,
    scoreLimit: 25,
    winnerText: 'BLUE TEAM wins Team Deathmatch (18 - 25)!',
    players: [
      { id: 'self', name: 'Nova', team: 'BLUE', kills: 9, deaths: 4, score: 1100, isSelf: true },
      { id: 'b2', name: 'Specter', team: 'BLUE', kills: 16, deaths: 5, score: 1950 },
      { id: 'r1', name: 'Valkyrie', team: 'RED', kills: 11, deaths: 9, score: 1250 },
      { id: 'r2', name: 'Kestrel', team: 'RED', kills: 7, deaths: 12, score: 750 },
    ],
  });

  assert.equal(tdmSummary.personal.kdFormatted, '2.25');
  assert.equal(tdmSummary.personal.rank, 3);
  assert.equal(tdmSummary.mvp?.id, 'b2');
  assert.equal(tdmSummary.mvp?.kdFormatted, '3.20');
  assert.equal(tdmSummary.teamBreakdown.isTeamMode, true);
  assert.equal(tdmSummary.teamBreakdown.winnerTeam, 'BLUE');
  assert.equal(tdmSummary.teamBreakdown.blue.kills, 25);
  assert.equal(tdmSummary.teamBreakdown.red.kills, 18);

  // 0-death personal K/D tie-break check
  const ffaSummary = computePostGameSummary({
    mode: 'FFA',
    redScore: 0,
    blueScore: 0,
    scoreLimit: 15,
    winnerText: 'ZeroDeath wins!',
    players: [
      { id: 'self', name: 'ZeroDeath', team: 'NONE', kills: 15, deaths: 0, score: 1650, isSelf: true },
      { id: 'bot1', name: 'Orion', team: 'NONE', kills: 10, deaths: 7, score: 1000 },
    ],
  });
  assert.equal(ffaSummary.personal.kdFormatted, '15.00');
  assert.equal(ffaSummary.mvp?.id, 'self');
  assert.equal(ffaSummary.teamBreakdown.isTeamMode, false);
});

test('Knife melee weapon is registered in slot 5 loadout with close-quarters range', () => {
  assert.equal(WEAPONS.knife.slot, 5);
  assert.equal(WEAPONS.knife.isMelee, true);
  assert.equal(WEAPONS.knife.reloadMs, 0);
  assert.ok(WEAPONS.knife.range <= 4.0);
  assert.equal(getWeaponBySlot(5), 'knife');
  assert.ok(LOADOUT_WEAPONS.includes('knife'));
});


