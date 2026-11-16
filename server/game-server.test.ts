import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import type { ClientMessage, ServerMessage } from '../lib/fps/types';
import { sanitizeCustomMap, VelocityGameServer } from './game-server';

class FakeSocket extends EventEmitter {
  readyState = 1;
  bufferedAmount = 0;
  received: ServerMessage[] = [];
  terminated = false;
  send(data: string) {
    this.received.push(JSON.parse(data) as ServerMessage);
  }
  ping() {}
  terminate() {
    this.terminated = true;
    this.readyState = 3;
    this.emit('close');
  }
  close() {
    this.readyState = 3;
    this.emit('close');
  }
  say(msg: ClientMessage) {
    this.emit('message', Buffer.from(JSON.stringify(msg)));
  }
  last<T extends ServerMessage['type']>(type: T) {
    for (let i = this.received.length - 1; i >= 0; i--) {
      if (this.received[i].type === type) return this.received[i] as Extract<ServerMessage, { type: T }>;
    }
    return undefined;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function client(gs: VelocityGameServer) {
  const ws = new FakeSocket();
  gs.handleConnection(ws as never);
  return ws;
}

const base = {
  type: 'join' as const,
  name: 'Tester',
  mode: 'FFA' as const,
  mapId: 'foundry',
};

test('join dedicated room by code returns welcome + snapshot', async () => {
  const gs = new VelocityGameServer();
  const a = client(gs);
  a.say({ ...base, roomId: 'FOUNDRY', joinCode: 'FOUNDRY', createIfMissing: false });
  assert.equal(a.last('welcome')?.joinCode, 'FOUNDRY');
  assert.ok(a.last('snapshot'));
  a.close();
});

test('joining an unknown code with createIfMissing=false errors', () => {
  const gs = new VelocityGameServer();
  const a = client(gs);
  a.say({ ...base, roomId: 'NOPE1', joinCode: 'NOPE1', createIfMissing: false });
  assert.match(a.last('error')?.message ?? '', /not found/i);
});

test('joining an existing room never changes its mode or map', () => {
  const gs = new VelocityGameServer();
  const a = client(gs);
  a.say({ ...base, roomId: 'FOUNDRY', joinCode: 'FOUNDRY', mode: 'TDM', mapId: 'skyline', createIfMissing: false });
  const w = a.last('welcome')!;
  assert.equal(w.mode, 'FFA');
  assert.equal(w.map.id, 'foundry');
});

test('private room: password required, wrong password rejected, hidden from list', () => {
  const gs = new VelocityGameServer();
  const host = client(gs);
  host.say({
    ...base,
    roomId: '',
    isFriendsRoom: true,
    visibility: 'private',
    password: 'secret',
    maxPlayers: 4,
    botCount: 0,
  });
  const w = host.last('welcome')!;
  assert.ok(w.hasPassword);
  assert.ok(!gs.getRoomsSummary().some((r) => r.joinCode === w.joinCode), 'private room must not be listed');

  const g1 = client(gs);
  g1.say({ ...base, roomId: w.joinCode, joinCode: w.joinCode, createIfMissing: false });
  assert.match(g1.last('error')?.message ?? '', /requires a password/i);
  const g2 = client(gs);
  g2.say({ ...base, roomId: w.joinCode, joinCode: w.joinCode, password: 'nope', createIfMissing: false });
  assert.match(g2.last('error')?.message ?? '', /incorrect password/i);
  const g3 = client(gs);
  g3.say({ ...base, roomId: w.joinCode, joinCode: w.joinCode, password: 'secret', createIfMissing: false });
  assert.ok(g3.last('welcome'));
});

test('public hosted room is listed and respects the max player limit', () => {
  const gs = new VelocityGameServer();
  const host = client(gs);
  host.say({ ...base, roomId: '', isFriendsRoom: true, maxPlayers: 2, botCount: 3 });
  const w = host.last('welcome')!;
  const listed = gs.getRoomsSummary().find((r) => r.joinCode === w.joinCode);
  assert.ok(listed, 'public room should be listed');
  const b = client(gs);
  b.say({ ...base, roomId: w.joinCode, joinCode: w.joinCode, createIfMissing: false });
  assert.ok(b.last('welcome'));
  const c = client(gs);
  c.say({ ...base, roomId: w.joinCode, joinCode: w.joinCode, createIfMissing: false });
  assert.match(c.last('error')?.message ?? '', /full/i);
});

test('untrusted join data is sanitised (mode, colour, custom map)', () => {
  const gs = new VelocityGameServer();
  const a = client(gs);
  a.say({
    type: 'join',
    roomId: '',
    name: 'x'.repeat(200),
    mode: 'HACK' as never,
    mapId: 'custom',
    accentColor: 'url(javascript:alert(1))',
    characterStyle: 'nope' as never,
    isFriendsRoom: true,
    maxPlayers: Number.NaN,
    botCount: 9999,
    customMap: {
      id: 'custom',
      name: 'm',
      theme: 'custom',
      bounds: { halfW: 1e9, halfD: -5 },
      skyHorizon: 0,
      fogColor: 0,
      floorColor: 0,
      blocks: Array.from({ length: 5000 }, (_, i) => ({
        id: `b${i}`, x: Number.NaN, y: 1, z: 1e12, w: -1, h: 1e9, d: 2, material: 'lava' as never,
      })),
      spawns: [{ x: 1e9, y: 0, z: 0, yaw: 0 }],
    },
  });
  const w = a.last('welcome')!;
  assert.equal(w.mode, 'FFA');
  assert.ok(w.map.blocks.length <= 130);
  assert.ok(w.map.bounds.halfW <= 40 && w.map.bounds.halfD >= 10);
  for (const b of w.map.blocks) {
    assert.ok(Number.isFinite(b.x) && Math.abs(b.z) <= 60 && b.w > 0 && b.h <= 30);
  }
  const me = a.last('snapshot')!.snapshot.players.find((p) => p.id === w.playerId)!;
  assert.match(me.accentColor, /^#[0-9a-f]{6}$/i);
  assert.ok(me.name.length <= 18);
  const bad = client(gs);
  bad.say({ ...base, roomId: '', mapId: 'custom', isFriendsRoom: true, customMap: { blocks: 'x' } as never });
  assert.match(bad.last('error')?.message ?? '', /rejected/i);
});

test('restart_match mid-game: griefing blocked, host allowed, rematch after end allowed', async () => {
  const gs = new VelocityGameServer();
  const host = client(gs);
  host.say({ ...base, roomId: '', isFriendsRoom: true, maxPlayers: 6, botCount: 0 });
  const w = host.last('welcome')!;
  const guest = client(gs);
  guest.say({ ...base, roomId: w.joinCode, joinCode: w.joinCode, createIfMissing: false });
  await sleep(3400); // hosted rooms have a 3s countdown
  const t0 = host.last('snapshot')!.snapshot.timeRemaining;
  assert.equal(host.last('snapshot')!.snapshot.phase, 'active');
  await sleep(300);
  guest.say({ type: 'restart_match' });
  await sleep(100);
  const afterGuest = host.last('snapshot')!.snapshot;
  assert.equal(afterGuest.phase, 'active', 'guest restart must be ignored');
  assert.ok(afterGuest.timeRemaining < t0, 'timer must keep running');
  host.say({ type: 'restart_match' });
  await sleep(100);
  assert.equal(host.last('snapshot')!.snapshot.phase, 'countdown', 'host restart works');
  host.close();
  guest.close();
});

test('speed-hack: flooding inputs cannot out-run real time; NaN inputs cannot corrupt state', async () => {
  const gs = new VelocityGameServer();
  const a = client(gs);
  a.say({ ...base, roomId: 'FOUNDRY', joinCode: 'FOUNDRY', createIfMissing: false });
  const id = a.last('welcome')!.playerId;
  const pos = () => a.last('snapshot')!.snapshot.players.find((p) => p.id === id)!;
  await sleep(120);
  const start = { x: pos().x, z: pos().z };
  const inputs = Array.from({ length: 16 }, (_, i) => ({
    seq: i + 1, dt: 0.05, forward: 1, strafe: 0, yaw: 0, pitch: 0, jump: false, slide: false,
    fire: false, reload: false, weaponSlot: 0, timestamp: 0,
  }));
  for (let k = 0; k < 20; k++) {
    a.say({ type: 'inputs', inputs: inputs.map((i) => ({ ...i, seq: i.seq + k * 16 })) });
  }
  a.say({
    type: 'input',
    input: { ...inputs[0], seq: 99999, dt: Number.NaN, yaw: Number.NaN, forward: Number.POSITIVE_INFINITY },
  });
  await sleep(400);
  const p = pos();
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.yaw));
  const moved = Math.hypot(p.x - start.x, p.z - start.z);
  // 320 inputs x 50ms = 16s of movement requested within ~0.5s of real time.
  assert.ok(moved < 14, `moved ${moved.toFixed(1)}m — budget should cap this`);
  a.close();
});

test('weapon switching does not refill the magazine', async () => {
  const gs = new VelocityGameServer();
  const a = client(gs);
  a.say({ ...base, roomId: 'FOUNDRY', joinCode: 'FOUNDRY', preferredWeapon: 'rifle', createIfMissing: false });
  const id = a.last('welcome')!.playerId;
  const me = () => a.last('snapshot')!.snapshot.players.find((p) => p.id === id)!;
  await sleep(100);
  let seq = 0;
  const mk = (over: Record<string, unknown>) => ({
    seq: ++seq, dt: 0.016, forward: 0, strafe: 0, yaw: 0, pitch: 0, jump: false, slide: false,
    fire: false, reload: false, weaponSlot: 0, timestamp: 0, ...over,
  });
  a.say({ type: 'input', input: mk({ fire: true }) });
  await sleep(200);
  const afterShot = me().ammo;
  assert.ok(afterShot < 30, 'rifle should have fired');
  a.say({ type: 'input', input: mk({ weaponSlot: 4 }) });
  await sleep(100);
  assert.equal(me().weaponId, 'sniper');
  a.say({ type: 'input', input: mk({ weaponSlot: 1 }) });
  await sleep(100);
  assert.equal(me().weaponId, 'rifle');
  assert.equal(me().ammo, afterShot, 'ammo must be preserved across a weapon switch');
  a.close();
});

test('disconnect removes player; empty quick-play rooms are pruned, dedicated rooms stay', async () => {
  const gs = new VelocityGameServer();
  const a = client(gs);
  a.say({ ...base, roomId: 'tmp-room-1', createIfMissing: true, botCount: 2 });
  assert.ok(a.last('welcome'));
  a.close();
  // private pruning hook (TTL is 30s in production; force it here)
  (gs as unknown as { pruneEmptyRooms(now: number, force: boolean): void }).pruneEmptyRooms(Date.now(), true);
  const b = client(gs);
  b.say({ ...base, roomId: 'tmp-room-1', joinCode: 'tmp-room-1', createIfMissing: false });
  assert.match(b.last('error')?.message ?? '', /not found/i);
  const c = client(gs);
  c.say({ ...base, roomId: 'FOUNDRY', joinCode: 'FOUNDRY', createIfMissing: false });
  assert.ok(c.last('welcome'), 'dedicated room must survive pruning');
});

test('dead sockets are terminated by the heartbeat', () => {
  const gs = new VelocityGameServer();
  const a = client(gs);
  a.say({ ...base, roomId: 'FOUNDRY', joinCode: 'FOUNDRY', createIfMissing: false });
  const hb = gs as unknown as { heartbeat(): void };
  hb.heartbeat(); // marks as pending
  assert.equal(a.terminated, false);
  hb.heartbeat(); // never answered with pong/message -> terminated
  assert.equal(a.terminated, true);
});

test('quick-play rooms with different ids never merge, even if their derived codes collide', () => {
  const gs = new VelocityGameServer();
  const a = client(gs);
  const b = client(gs);
  a.say({ ...base, roomId: 'custom-ffa-aaaaaa', createIfMissing: true });
  b.say({ ...base, roomId: 'custom-ffa-bbbbbb', createIfMissing: true });
  const wa = a.last('welcome')!;
  const wb = b.last('welcome')!;
  assert.notEqual(wa.roomId, wb.roomId);
  assert.notEqual(wa.joinCode, wb.joinCode);
});

test('shuffle room rotates to a different map between matches and tells clients', () => {
  const gs = new VelocityGameServer();
  const a = client(gs);
  a.say({ ...base, roomId: 'SHUFFLE', joinCode: 'SHUFFLE', createIfMissing: false });
  const first = a.last('welcome')!.map.id;
  const internals = gs as unknown as {
    rooms: Map<string, unknown>;
    finishRoomMatch(room: unknown, text: string): void;
    resetRoomMatch(room: unknown): void;
  };
  const room = internals.rooms.get('shuffle-ffa');
  internals.finishRoomMatch(room, 'test');
  // while waiting, clients can be told what is next
  internals.resetRoomMatch(room);
  const change = a.last('map_change');
  assert.ok(change, 'client must receive map_change');
  assert.notEqual(change!.map.id, first);
  assert.ok(change!.map.spawns.length >= 8);
});

test('hosted rooms only shuffle when the host asks for it', () => {
  const gs = new VelocityGameServer();
  const a = client(gs);
  a.say({ ...base, roomId: '', isFriendsRoom: true, shuffleMaps: true });
  const b = client(gs);
  b.say({ ...base, roomId: '', isFriendsRoom: true });
  const list = gs.getRoomsSummary();
  assert.equal(list.find((r) => r.joinCode === a.last('welcome')!.joinCode)?.shuffleMaps, true);
  assert.equal(list.find((r) => r.joinCode === b.last('welcome')!.joinCode)?.shuffleMaps, false);
});

test.after(() => {
  setTimeout(() => process.exit(0), 50);
});


test('sanitised room ids cannot collide with or replace a dedicated room', () => {
  const gs = new VelocityGameServer();
  const a = client(gs);
  a.say({ ...base, roomId: 'foundry-ffa!', createIfMissing: true, botCount: 0 });
  const created = a.last('welcome');
  assert.ok(created);
  assert.notEqual(created.roomId, 'foundry-ffa');
  const dedicated = client(gs);
  dedicated.say({ ...base, roomId: 'FOUNDRY', joinCode: 'FOUNDRY', createIfMissing: false });
  assert.equal(dedicated.last('welcome')?.roomId, 'foundry-ffa');
  a.close();
  dedicated.close();
});

test('custom map sanitisation keeps geometry inside bounds and rejects blocked spawns', () => {
  const safe = sanitizeCustomMap({
    bounds: { halfW: 20, halfD: 20 },
    blocks: [{ id: 'crate', x: 999, y: 1, z: 999, w: 4, h: 2, d: 4, material: 'crate' }],
    spawns: [{ x: 0, y: 0, z: 0, yaw: 0 }],
  });
  assert.ok(safe);
  const block = safe!.blocks.find((b) => b.id === 'crate')!;
  assert.ok(Math.abs(block.x) + block.w / 2 <= safe!.bounds.halfW + 2);
  assert.ok(Math.abs(block.z) + block.d / 2 <= safe!.bounds.halfD + 2);

  const blocked = sanitizeCustomMap({
    bounds: { halfW: 20, halfD: 20 },
    blocks: [{ id: 'spawn_block', x: 0, y: 1, z: 0, w: 4, h: 2, d: 4, material: 'crate' }],
    spawns: [{ x: 0, y: 0, z: 0, yaw: 0 }],
  });
  assert.equal(blocked, null);
});

test('per-connection message flood is rate limited', () => {
  const gs = new VelocityGameServer();
  const a = client(gs);
  for (let i = 0; i < 241; i++) a.say({ type: 'ping', clientTime: i });
  assert.match(a.last('error')?.message ?? '', /too many messages/i);
  assert.equal(a.readyState, 3);
});
