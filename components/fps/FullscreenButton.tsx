'use client';

import React from 'react';
import { Maximize, Minimize } from 'lucide-react';

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function currentFullscreenElement(): Element | null {
  const d = document as FsDocument;
  return document.fullscreenElement || d.webkitFullscreenElement || null;
}

function isFullscreenSupported(): boolean {
  const el = document.documentElement as FsElement;
  return Boolean(el.requestFullscreen || el.webkitRequestFullscreen);
}

async function enterFullscreen() {
  const el = document.documentElement as FsElement;
  if (el.requestFullscreen) {
    await el.requestFullscreen({ navigationUI: 'hide' });
  } else if (el.webkitRequestFullscreen) {
    await el.webkitRequestFullscreen();
  }
  // Phones: lock to landscape once fullscreen (ignored where unsupported, e.g. iOS / desktop).
  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
    };
    if (window.matchMedia('(pointer: coarse)').matches) {
      await orientation.lock?.('landscape');
    }
  } catch {
    // Orientation lock is best-effort.
  }
}

async function exitFullscreen() {
  const d = document as FsDocument;
  try {
    screen.orientation?.unlock?.();
  } catch {
    // ignore
  }
  if (document.exitFullscreen) {
    await document.exitFullscreen();
  } else if (d.webkitExitFullscreen) {
    await d.webkitExitFullscreen();
  }
}

/**
 * Always-visible fullscreen toggle pinned to the top-centre of the screen.
 * On browsers without the Fullscreen API (iPhone Safari) it explains the Add-to-Home-Screen route instead.
 */
export default function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [supported, setSupported] = React.useState(true);
  const [hint, setHint] = React.useState<string | null>(null);
  const hintTimer = React.useRef<number | null>(null);

  React.useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(currentFullscreenElement()));
    setSupported(isFullscreenSupported());
    sync();
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
      if (hintTimer.current !== null) window.clearTimeout(hintTimer.current);
    };
  }, []);

  const showHint = (text: string) => {
    setHint(text);
    if (hintTimer.current !== null) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(null), 5000);
  };

  const toggle = async () => {
    if (!supported) {
      showHint('Fullscreen is not available in this browser. On iPhone: Share → Add to Home Screen, then launch Velocity from your home screen.');
      return;
    }
    try {
      if (currentFullscreenElement()) await exitFullscreen();
      else await enterFullscreen();
    } catch {
      showHint('The browser blocked fullscreen. Tap the button again, or use your browser menu.');
    }
  };

  const label = isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen';

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[70] flex flex-col items-center gap-2 pointer-events-none"
      style={{ top: 'max(0.5rem, env(safe-area-inset-top))' }}
    >
      <button
        type="button"
        data-testid="fullscreen-toggle"
        aria-label={label}
        aria-pressed={isFullscreen}
        title={label}
        onClick={toggle}
        onPointerDown={(e) => e.stopPropagation()}
        className="pointer-events-auto w-10 h-10 sm:w-9 sm:h-9 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-white/20 text-slate-100 flex items-center justify-center cursor-pointer hover:bg-[#192234] hover:border-amber-400/60 active:scale-95 transition"
      >
        {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
      </button>
      {hint && (
        <div
          role="status"
          className="pointer-events-none max-w-[min(86vw,320px)] px-3 py-2 rounded-lg bg-[#0B0F17]/95 border border-amber-400/40 text-[11px] leading-snug text-amber-100 text-center shadow-xl"
        >
          {hint}
        </div>
      )}
    </div>
  );
}
