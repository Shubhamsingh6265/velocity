'use client';

import React from 'react';
import { HudSnapshot } from '@/lib/fps/renderer';
import { WEAPONS } from '@/lib/fps/weapons';

interface TouchOverlayProps {
  hud: HudSnapshot;
  adsActive: boolean;
  onMove: (x: number, y: number) => void;
  onLookDelta: (dx: number, dy: number) => void;
  onFire: (held: boolean) => void;
  onJump: () => void;
  onSlide: (held: boolean) => void;
  onReload: () => void;
  onToggleAds: () => void;
  onSelectWeapon: (slot: number) => void;
}

const WEAPON_SLOTS: Array<{ slot: number; label: string; id: keyof typeof WEAPONS }> = [
  { slot: 1, label: 'AR', id: 'rifle' },
  { slot: 2, label: 'SMG', id: 'smg' },
  { slot: 3, label: 'SG', id: 'shotgun' },
  { slot: 4, label: 'SNP', id: 'sniper' },
  { slot: 5, label: 'KNF', id: 'knife' },
];

const LOOK_GAIN = 1.4;
const JOY_RADIUS = 52;

function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // vibration is optional
  }
}

export default function TouchOverlay({
  hud,
  adsActive,
  onMove,
  onLookDelta,
  onFire,
  onJump,
  onSlide,
  onReload,
  onToggleAds,
  onSelectWeapon,
}: TouchOverlayProps) {
  const joyPointerId = React.useRef<number | null>(null);
  const lookPointerId = React.useRef<number | null>(null);
  const firePointerId = React.useRef<number | null>(null);
  const lastLook = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastFireLook = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [joyBase, setJoyBase] = React.useState<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [fireDown, setFireDown] = React.useState(false);
  const gunGame = hud.mode === 'GUN_GAME';

  // Never leave the player running / firing if the overlay unmounts mid-touch.
  React.useEffect(() => {
    return () => {
      onMove(0, 0);
      onFire(false);
      onSlide(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const releaseJoystick = () => {
    joyPointerId.current = null;
    setJoyBase(null);
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };

  const updateJoystick = (clientX: number, clientY: number, base: { x: number; y: number }) => {
    let dx = clientX - base.x;
    let dy = clientY - base.y;
    const dist = Math.hypot(dx, dy);
    if (dist > JOY_RADIUS) {
      dx = (dx / dist) * JOY_RADIUS;
      dy = (dy / dist) * JOY_RADIUS;
    }
    setKnob({ x: dx, y: dy });
    // Small dead-zone so the character does not drift while the thumb rests.
    const nx = Math.abs(dx) < 4 ? 0 : dx / JOY_RADIUS;
    const ny = Math.abs(dy) < 4 ? 0 : -dy / JOY_RADIUS;
    onMove(nx, ny);
  };

  const actionBtn =
    'rounded-full bg-[#0B0F17]/70 backdrop-blur-sm border border-white/30 text-white font-bold select-none touch-none flex items-center justify-center active:bg-amber-500 active:text-slate-950 active:scale-95 transition-transform';

  const holdProps = (onHold: (held: boolean) => void) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      // Capture so the release is delivered even if the thumb slides off the button.
      e.currentTarget.setPointerCapture(e.pointerId);
      onHold(true);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      onHold(false);
    },
    onPointerCancel: () => onHold(false),
    onLostPointerCapture: () => onHold(false),
  });

  return (
    <div className="fixed inset-0 z-15 pointer-events-none select-none touch-none">
      {/* Compact status strip */}
      <div
        className="absolute left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg bg-[#0B0F17]/80 border border-white/15 flex items-center gap-3 text-xs font-mono tabular-nums"
        style={{ bottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <span className="text-emerald-400 font-bold">HP {hud.hp}</span>
        <span className="text-sky-400">SH {hud.shield}</span>
        <span className="text-amber-400 font-bold">
          {WEAPONS[hud.weaponId]?.isMelee ? 'MELEE' : hud.reloading ? 'RLD' : `${hud.ammo}/${hud.magSize}`}
        </span>
      </div>

      {/* Floating joystick zone: the stick appears wherever the left thumb lands. */}
      <div
        aria-label="Movement Joystick"
        onPointerDown={(e) => {
          if (joyPointerId.current !== null) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          joyPointerId.current = e.pointerId;
          const base = { x: e.clientX, y: e.clientY };
          setJoyBase(base);
          updateJoystick(e.clientX, e.clientY, base);
        }}
        onPointerMove={(e) => {
          if (joyPointerId.current === e.pointerId && joyBase) {
            updateJoystick(e.clientX, e.clientY, joyBase);
          }
        }}
        onPointerUp={(e) => {
          if (joyPointerId.current === e.pointerId) releaseJoystick();
        }}
        onPointerCancel={(e) => {
          if (joyPointerId.current === e.pointerId) releaseJoystick();
        }}
        onLostPointerCapture={(e) => {
          if (joyPointerId.current === e.pointerId) releaseJoystick();
        }}
        className="pointer-events-auto absolute left-0 bottom-0 touch-none"
        style={{ width: '42%', top: '5rem' }}
      >
        {!joyBase && (
          <div
            className="absolute w-24 h-24 rounded-full border-2 border-white/15 bg-white/5 flex items-center justify-center"
            style={{
              left: 'max(1.5rem, env(safe-area-inset-left))',
              bottom: 'max(3rem, calc(env(safe-area-inset-bottom) + 2rem))',
            }}
          >
            <div className="w-9 h-9 rounded-full bg-white/15" />
          </div>
        )}
      </div>
      {joyBase && (
        <div
          className="absolute w-[104px] h-[104px] rounded-full bg-[#0B0F17]/55 border-2 border-white/30 flex items-center justify-center pointer-events-none"
          style={{ left: joyBase.x - 52, top: joyBase.y - 52 }}
        >
          <div
            className="w-11 h-11 rounded-full bg-amber-500/90 border border-white/50"
            style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
          />
        </div>
      )}

      {/* Look area (right half) */}
      <div
        aria-label="Aim Look Area"
        onPointerDown={(e) => {
          if (lookPointerId.current !== null) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          lookPointerId.current = e.pointerId;
          lastLook.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (lookPointerId.current === e.pointerId) {
            const dx = e.clientX - lastLook.current.x;
            const dy = e.clientY - lastLook.current.y;
            lastLook.current = { x: e.clientX, y: e.clientY };
            onLookDelta(dx * LOOK_GAIN, dy * LOOK_GAIN);
          }
        }}
        onPointerUp={(e) => {
          if (lookPointerId.current === e.pointerId) lookPointerId.current = null;
        }}
        onPointerCancel={(e) => {
          if (lookPointerId.current === e.pointerId) lookPointerId.current = null;
        }}
        onLostPointerCapture={(e) => {
          if (lookPointerId.current === e.pointerId) lookPointerId.current = null;
        }}
        className="pointer-events-auto absolute right-0 bottom-0 touch-none"
        style={{ left: '46%', top: '5rem' }}
      />

      {/* Weapon switcher (hidden in Gun Game where weapons are forced) */}
      {!gunGame && (
        <div
          className="pointer-events-auto absolute flex flex-col gap-1.5"
          style={{
            right: 'max(0.75rem, env(safe-area-inset-right))',
            top: '5.5rem',
          }}
        >
          {WEAPON_SLOTS.map(({ slot, label, id }) => {
            const active = hud.weaponId === id;
            return (
              <button
                key={slot}
                type="button"
                aria-label={`Switch to ${WEAPONS[id].name}`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  buzz(8);
                  onSelectWeapon(slot);
                }}
                className={`w-11 h-8 rounded-md border text-[10px] font-bold tracking-wide touch-none select-none ${
                  active
                    ? 'bg-amber-500 text-slate-950 border-amber-300'
                    : 'bg-[#0B0F17]/70 text-slate-200 border-white/25 active:bg-white/20'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Action buttons */}
      <div
        className="pointer-events-none absolute flex flex-col items-end gap-3"
        style={{
          right: 'max(1.25rem, env(safe-area-inset-right))',
          bottom: 'max(2.75rem, calc(env(safe-area-inset-bottom) + 2rem))',
        }}
      >
        <div className="pointer-events-auto flex items-center gap-2.5">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onToggleAds();
            }}
            className={`${actionBtn} w-12 h-12 text-xs ${adsActive ? '!bg-sky-500 !text-slate-950 !border-sky-300' : ''}`}
          >
            ADS
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onReload();
            }}
            className={`${actionBtn} w-12 h-12 text-xs`}
          >
            RLD
          </button>
          <button type="button" {...holdProps(onSlide)} className={`${actionBtn} w-12 h-12 text-xs`}>
            SLD
          </button>
        </div>

        <div className="pointer-events-auto flex items-end gap-3">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              buzz(10);
              onJump();
            }}
            className={`${actionBtn} w-14 h-14 text-xs`}
          >
            JUMP
          </button>
          <button
            type="button"
            aria-label="Fire"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              firePointerId.current = e.pointerId;
              lastFireLook.current = { x: e.clientX, y: e.clientY };
              setFireDown(true);
              onFire(true);
            }}
            onPointerMove={(e) => {
              // Dragging while the fire button is held also aims, so you can spray and turn with one thumb.
              if (firePointerId.current !== e.pointerId) return;
              const dx = e.clientX - lastFireLook.current.x;
              const dy = e.clientY - lastFireLook.current.y;
              lastFireLook.current = { x: e.clientX, y: e.clientY };
              onLookDelta(dx * LOOK_GAIN, dy * LOOK_GAIN);
            }}
            onPointerUp={(e) => {
              e.currentTarget.releasePointerCapture?.(e.pointerId);
              firePointerId.current = null;
              setFireDown(false);
              onFire(false);
            }}
            onPointerCancel={() => {
              firePointerId.current = null;
              setFireDown(false);
              onFire(false);
            }}
            onLostPointerCapture={() => {
              firePointerId.current = null;
              setFireDown(false);
              onFire(false);
            }}
            className={`w-[72px] h-[72px] rounded-full border-2 border-white/50 text-xs font-extrabold touch-none select-none transition-transform ${
              fireDown ? 'bg-red-500 text-white scale-95' : 'bg-amber-500/90 text-slate-950'
            }`}
          >
            FIRE
          </button>
        </div>
      </div>
    </div>
  );
}
