'use client';

import React from 'react';
import { cloneCustomMap, MAP_LIST, MAPS } from '@/lib/fps/maps';
import {
  DEFAULT_PROFILE,
  formatPlayerDisplayName,
  loadPlayerProfile,
  savePlayerProfile,
} from '@/lib/fps/profile';
import {
  DeployOptions,
  EngineSettings,
  GamePhase,
  HudSnapshot,
  VelocityClientEngine,
} from '@/lib/fps/renderer';
import {
  GameMode,
  LeaderboardEntry,
  MapBlock,
  MapData,
  PlayerProfile,
  RoomSummary,
  RoomVisibility,
  TouchMode,
} from '@/lib/fps/types';
import GameHud from './GameHud';
import MapEditorModal from './MapEditorModal';
import MatchModals from './MatchModals';
import PostGameSummary from './PostGameSummary';
import FullscreenButton from './FullscreenButton';
import TitleOverlay, { TitleTab } from './TitleOverlay';
import TouchOverlay from './TouchOverlay';

const INITIAL_HUD: HudSnapshot = {
  hp: 100,
  maxHp: 100,
  shield: 50,
  maxShield: 50,
  ammo: 30,
  magSize: 30,
  reloading: false,
  reloadProgress: 1,
  weaponId: 'rifle',
  speed: 0,
  sliding: false,
  alive: true,
  respawnTimer: 0,
  kills: 0,
  deaths: 0,
  score: 0,
  streak: 0,
  gunGameTier: 0,
  timeRemaining: 180,
  scoreLimit: 15,
  redScore: 0,
  blueScore: 0,
  mode: 'FFA',
  team: 'NONE',
  fps: 60,
  pingMs: 18,
  renderScale: 100,
  hitmarkerActive: false,
  hitmarkerHeadshot: false,
  damageFlash: 0,
  pointerLocked: false,
  players: [],
  killFeed: [],
  winnerText: '',
  nextMapName: '',
  damageHits: [],
  winnerId: '',
  selfId: '',
  isHost: false,
  matchEnded: false,
  localYaw: 0,
  localX: 0,
  localZ: 0,
  mapId: MAPS.foundry.id,
  mapName: MAPS.foundry.name,
  mapHalfW: MAPS.foundry.bounds.halfW,
  mapHalfD: MAPS.foundry.bounds.halfD,
  mapBlocks: MAPS.foundry.blocks,
  adsBlend: 0,
  scoped: false,
  medicateActive: false,
  medicateHp: 0,
  medicateShield: 0,
  roomJoinCode: 'FOUNDRY',
  maxPlayers: 18,
  botCount: 4,
  roomVisibility: 'public',
  roomHasPassword: false,
  matchPhase: 'active',
  countdownRemaining: 0,
  goBannerActive: false,
  characterStyle: 'vanguard',
  accentColor: '#38BDF8',
};

/** Random built-in arena, never the one passed in `exclude` (so Shuffle always changes something). */
function pickRandomMapId(exclude?: string): string {
  const pool = MAP_LIST.filter((m) => m.id !== exclude);
  return pool[Math.floor(Math.random() * pool.length)].id;
}

function resolveMapId(id: string): string {
  return id === 'random' ? pickRandomMapId() : id;
}

const DEFAULT_CUSTOM_BLOCKS: MapBlock[] = [
  { id: 'cb_1', x: -4.5, y: 1.0, z: -4.5, w: 3, h: 2, d: 3, material: 'crate' },
  { id: 'cb_2', x: 4.5, y: 1.0, z: 4.5, w: 3, h: 2, d: 3, material: 'crate' },
  { id: 'cb_3', x: -4.5, y: 1.0, z: 4.5, w: 3, h: 2, d: 3, material: 'hazard' },
  { id: 'cb_4', x: 4.5, y: 1.0, z: -4.5, w: 3, h: 2, d: 3, material: 'hazard' },
];

export default function VelocityArenaApp() {
  const mountRef = React.useRef<HTMLDivElement>(null);
  const engineRef = React.useRef<VelocityClientEngine | null>(null);
  const matchRecordedRef = React.useRef(false);

  const [phase, setPhase] = React.useState<GamePhase>('title');
  const phaseRef = React.useRef<GamePhase>('title');
  const [editorOpen, setEditorOpen] = React.useState(false);

  const [profile, setProfile] = React.useState<PlayerProfile>(DEFAULT_PROFILE);
  const profileRef = React.useRef<PlayerProfile>(DEFAULT_PROFILE);

  const [selectedMode, setSelectedMode] = React.useState<GameMode>('FFA');
  const [selectedMapId, setSelectedMapId] = React.useState('foundry');
  const [selectedRoomId, setSelectedRoomId] = React.useState('foundry-ffa');
  const [customBlocks, setCustomBlocks] = React.useState<MapBlock[]>(DEFAULT_CUSTOM_BLOCKS);
  const [customMap, setCustomMap] = React.useState<MapData | null>(null);

  const [roomVisibility, setRoomVisibility] = React.useState<RoomVisibility>('public');
  const [hostPassword, setHostPassword] = React.useState('');
  const [joinCode, setJoinCode] = React.useState('');
  const [joinPassword, setJoinPassword] = React.useState('');
  const [roomListPassword, setRoomListPassword] = React.useState('');
  const [friendsMaxPlayers, setFriendsMaxPlayers] = React.useState(18);
  const [friendsBotCount, setFriendsBotCount] = React.useState(4);
  const [shuffleMaps, setShuffleMaps] = React.useState(false);
  const [titleTab, setTitleTab] = React.useState<TitleTab>('deploy');
  const [serverError, setServerError] = React.useState<string | null>(null);

  const [rooms, setRooms] = React.useState<RoomSummary[]>([]);
  const [leaderboard, setLeaderboard] = React.useState<LeaderboardEntry[]>([]);
  const [hud, setHud] = React.useState<HudSnapshot>(INITIAL_HUD);
  const [touchMode, setTouchMode] = React.useState<TouchMode>('auto');
  const [isCoarseDevice, setIsCoarseDevice] = React.useState(false);
  const [isPortrait, setIsPortrait] = React.useState(false);

  const [settings, setSettings] = React.useState<EngineSettings>({
    sensitivity: 0.0022,
    fov: 78,
    quality: 'auto',
    autoFire: false,
    muted: false,
    volume: 0.7,
    music: true,
  });

  const syncPhase = React.useCallback((next: GamePhase) => {
    phaseRef.current = next;
    setPhase(next);
    if (typeof document !== 'undefined') {
      document.body.dataset.state = next;
    }
    engineRef.current?.setPhase(next);
  }, []);

  const refreshServerLists = React.useCallback(async () => {
    try {
      const [rRes, lRes] = await Promise.all([
        fetch('/api/rooms'),
        fetch('/api/leaderboard'),
      ]);
      if (rRes.ok) {
        const data = (await rRes.json()) as { rooms: RoomSummary[] };
        setRooms(data.rooms || []);
      }
      if (lRes.ok) {
        const data = (await lRes.json()) as { entries: LeaderboardEntry[] };
        setLeaderboard(data.entries || []);
      }
    } catch {
      // Ignore transient network errors
    }
  }, []);

  const handleUpdateProfile = React.useCallback((partial: Partial<PlayerProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...partial };
      profileRef.current = next;
      savePlayerProfile(next);
      if (phaseRef.current === 'playing' || phaseRef.current === 'paused') {
        engineRef.current?.updateProfile({
          name: next.callsign.trim() || 'Vanguard-01',
          clanTag: next.clanTag,
          characterStyle: next.characterStyle,
          accentColor: next.accentColor,
          preferredWeapon: next.preferredWeapon,
        });
      }
      return next;
    });
  }, []);

  const handleResetCareerStats = React.useCallback(() => {
    handleUpdateProfile({
      careerKills: 0,
      careerDeaths: 0,
      careerWins: 0,
      careerMatches: 0,
      bestScore: 0,
    });
  }, [handleUpdateProfile]);

  const deployWithOptions = React.useCallback(
    (opts: DeployOptions) => {
      const engine = engineRef.current;
      if (!engine) return;
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setServerError(null);
      matchRecordedRef.current = false;
      setEditorOpen(false);
      syncPhase('playing');
      engine.connectAndDeploy(opts);
    },
    [syncPhase],
  );

  const deployMatch = React.useCallback(
    (overrideMap?: MapData, overrideMapId?: string) => {
      const p = profileRef.current;
      const mapId = resolveMapId(overrideMapId || selectedMapId);
      // Custom maps are private to the player who built them: never share a room id with another
      // player's (different) custom map.
      const roomId =
        mapId === 'custom'
          ? `custom-${selectedMode.toLowerCase().replace('_', '')}-${Math.random().toString(36).slice(2, 8)}`
          : `${mapId}-${selectedMode.toLowerCase().replace('_', '')}`;

      deployWithOptions({
        roomId,
        name: p.callsign.trim() || 'Vanguard-01',
        clanTag: p.clanTag,
        characterStyle: p.characterStyle,
        accentColor: p.accentColor,
        preferredWeapon: p.preferredWeapon,
        mode: selectedMode,
        mapId,
        maxPlayers: 18,
        botCount: mapId === 'neon_grid' ? 10 : 4,
        isFriendsRoom: false,
        customMap:
          overrideMap || (mapId === 'custom' ? customMap || cloneCustomMap(customBlocks) : undefined),
      });
    },
    [customBlocks, customMap, deployWithOptions, selectedMapId, selectedMode],
  );

  const handleJoinListedRoom = React.useCallback(() => {
    const p = profileRef.current;
    const chosen = rooms.find((r) => r.id === selectedRoomId) || rooms[0];
    if (!chosen) {
      deployMatch();
      return;
    }

    deployWithOptions({
      roomId: chosen.id,
      joinCode: chosen.joinCode,
      name: p.callsign.trim() || 'Vanguard-01',
      clanTag: p.clanTag,
      characterStyle: p.characterStyle,
      accentColor: p.accentColor,
      preferredWeapon: p.preferredWeapon,
      mode: chosen.mode,
      mapId: chosen.mapId,
      maxPlayers: chosen.maxPlayers,
      botCount: chosen.botTarget,
      isFriendsRoom: chosen.isFriendsRoom,
      password: roomListPassword.trim() || undefined,
      createIfMissing: chosen.isFriendsRoom ? false : true,
    });
  }, [deployMatch, deployWithOptions, roomListPassword, rooms, selectedRoomId]);

  const handleHostRoom = React.useCallback(() => {
    const p = profileRef.current;
    const displayName = formatPlayerDisplayName(p.callsign, p.clanTag);
    const hostMapId = resolveMapId(selectedMapId);
    const mapName =
      hostMapId === 'custom'
        ? 'Custom Arena'
        : MAPS[hostMapId]?.name || MAPS.foundry.name;

    deployWithOptions({
      roomId: '',
      roomName: `${displayName}'s Room · ${mapName}`,
      name: p.callsign.trim() || 'Vanguard-01',
      clanTag: p.clanTag,
      characterStyle: p.characterStyle,
      accentColor: p.accentColor,
      preferredWeapon: p.preferredWeapon,
      mode: selectedMode,
      mapId: hostMapId,
      shuffleMaps: shuffleMaps && hostMapId !== 'custom',
      maxPlayers: friendsMaxPlayers,
      botCount: friendsBotCount,
      isFriendsRoom: true,
      visibility: roomVisibility,
      password: roomVisibility === 'private' ? hostPassword.trim() || undefined : undefined,
      customMap: hostMapId === 'custom' ? customMap || cloneCustomMap(customBlocks) : undefined,
    });
  }, [
    customBlocks,
    customMap,
    deployWithOptions,
    friendsBotCount,
    friendsMaxPlayers,
    hostPassword,
    roomVisibility,
    selectedMapId,
    selectedMode,
    shuffleMaps,
  ]);

  const handleJoinRoom = React.useCallback(() => {
    const p = profileRef.current;
    const cleanCode = joinCode.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase().slice(0, 10);
    if (!cleanCode) return;

    deployWithOptions({
      roomId: cleanCode,
      joinCode: cleanCode,
      name: p.callsign.trim() || 'Vanguard-01',
      clanTag: p.clanTag,
      characterStyle: p.characterStyle,
      accentColor: p.accentColor,
      preferredWeapon: p.preferredWeapon,
      mode: selectedMode,
      mapId: selectedMapId,
      maxPlayers: friendsMaxPlayers,
      botCount: 0,
      isFriendsRoom: true,
      password: joinPassword.trim() || undefined,
      createIfMissing: false,
    });
  }, [
    deployWithOptions,
    friendsMaxPlayers,
    joinCode,
    joinPassword,
    selectedMapId,
    selectedMode,
  ]);

  const deployRef = React.useRef(deployMatch);
  React.useEffect(() => {
    deployRef.current = deployMatch;
  }, [deployMatch]);

  React.useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const loaded = loadPlayerProfile();
      profileRef.current = loaded;
      setProfile(loaded);

      const params = new URLSearchParams(window.location.search);
      const paramMap = params.get('map');
      if (paramMap && MAPS[paramMap]) {
        setSelectedMapId(paramMap);
        setSelectedRoomId(`${paramMap}-ffa`);
      }
      const paramRoom = params.get('r') || params.get('room');
      if (paramRoom) {
        setJoinCode(paramRoom.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase());
        setTitleTab('room');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!mountRef.current) return;

    const engine = new VelocityClientEngine(
      mountRef.current,
      (snap) => {
        setHud(snap);
        if (snap.matchEnded && phaseRef.current === 'playing') {
          if (!matchRecordedRef.current) {
            matchRecordedRef.current = true;
            // The server names the winner by id (FFA / Gun Game); TDM is decided by team.
            const won =
              snap.mode === 'TDM'
                ? snap.team !== 'NONE' && snap.winnerText.startsWith(snap.team)
                : Boolean(snap.winnerId) && snap.winnerId === snap.selfId;
            setProfile((prev) => {
              const next: PlayerProfile = {
                ...prev,
                careerKills: prev.careerKills + snap.kills,
                careerDeaths: prev.careerDeaths + snap.deaths,
                careerWins: prev.careerWins + (won ? 1 : 0),
                careerMatches: prev.careerMatches + 1,
                bestScore: Math.max(prev.bestScore, snap.score),
              };
              profileRef.current = next;
              savePlayerProfile(next);
              return next;
            });
          }
          syncPhase('gameover');
          refreshServerLists();
        }
      },
      (reqPhase) => {
        syncPhase(reqPhase);
      },
      (errMsg) => {
        setServerError(errMsg);
        syncPhase('title');
      },
    );
    engineRef.current = engine;
    document.body.dataset.state = 'title';

    refreshServerLists();

    const checkTouch = () => {
      const coarse =
        window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820;
      setIsCoarseDevice(coarse);
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);
    window.addEventListener('orientationchange', checkTouch);

    let autostartTimer: number | null = null;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      const paramMap = params.get('map');
      const overrideMap = paramMap && MAPS[paramMap] ? paramMap : undefined;
      autostartTimer = window.setTimeout(() => {
        deployRef.current(undefined, overrideMap);
      }, 80);
    }

    return () => {
      if (autostartTimer !== null) clearTimeout(autostartTimer);
      window.removeEventListener('resize', checkTouch);
      window.removeEventListener('orientationchange', checkTouch);
      engine.dispose();
      engineRef.current = null;
    };
  }, [refreshServerLists, syncPhase]);

  React.useEffect(() => {
    if (phase === 'title' && engineRef.current) {
      if (selectedMapId === 'custom' && customMap) {
        engineRef.current.loadMapScene(customMap);
      } else if (MAPS[selectedMapId]) {
        engineRef.current.loadMapScene(MAPS[selectedMapId]);
      }
    }
  }, [selectedMapId, customMap, phase]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (phaseRef.current === 'title' && !editorOpen && !isTyping) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          deployRef.current();
        }
      } else if (phaseRef.current === 'playing') {
        if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Tab') {
          e.preventDefault();
          syncPhase('paused');
        } else if (e.code === 'KeyM') {
          setSettings((prev) => {
            const next = { ...prev, muted: !prev.muted };
            engineRef.current?.updateSettings({ muted: next.muted });
            return next;
          });
        }
      } else if (phaseRef.current === 'paused') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          syncPhase('playing');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editorOpen, syncPhase]);

  const handleModeChange = (mode: GameMode) => {
    setSelectedMode(mode);
    if (selectedMapId !== 'random') {
      setSelectedRoomId(`${selectedMapId}-${mode.toLowerCase().replace('_', '')}`);
    }
  };

  const handleMapChange = (mapId: string) => {
    setSelectedMapId(mapId);
    if (mapId !== 'random') {
      setSelectedRoomId(`${mapId}-${selectedMode.toLowerCase().replace('_', '')}`);
    }
  };

  /** Picks a different random arena right now and previews it behind the menu. */
  const handleShuffleMap = () => {
    const current = selectedMapId;
    handleMapChange(pickRandomMapId(current));
  };

  const handleUpdateSettings = React.useCallback((partial: Partial<EngineSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      engineRef.current?.updateSettings(partial);
      return next;
    });
  }, []);

  const handleToggleMute = React.useCallback(() => {
    setSettings((prev) => {
      const nextMuted = !prev.muted;
      engineRef.current?.updateSettings({ muted: nextMuted });
      return { ...prev, muted: nextMuted };
    });
  }, []);

  const handlePause = React.useCallback(() => {
    syncPhase('paused');
  }, [syncPhase]);

  const handleSelectWeapon = React.useCallback((slot: number) => {
    engineRef.current?.selectWeaponSlot(slot);
  }, []);

  const handleRequestPointerLock = React.useCallback(() => {
    engineRef.current?.requestPointerLock();
  }, []);

  const showTouchControls =
    phase === 'playing' &&
    (touchMode === 'on' || (touchMode === 'auto' && isCoarseDevice));

  return (
    <main
      className="relative w-full h-dvh overflow-hidden bg-[#0B0F17]"
      onPointerDownCapture={() => engineRef.current?.unlockAudio()}
      onClickCapture={(e) => {
        if ((e.target as HTMLElement).closest?.('button')) engineRef.current?.playUiClick();
      }}
    >
      <div
        ref={mountRef}
        data-testid="fps-viewport"
        className="fixed inset-0 z-0 w-full h-full"
      />

      <FullscreenButton />

      {phase === 'playing' && showTouchControls && isPortrait && (
        <div className="fixed left-1/2 -translate-x-1/2 top-16 z-[65] px-3 py-1.5 rounded-lg bg-amber-500/95 text-slate-950 text-xs font-bold pointer-events-none shadow-lg">
          Rotate your phone to landscape for the best controls
        </div>
      )}

      {phase === 'title' && !editorOpen && (
        <TitleOverlay
          profile={profile}
          onUpdateProfile={handleUpdateProfile}
          onResetCareerStats={handleResetCareerStats}
          selectedMode={selectedMode}
          onModeChange={handleModeChange}
          selectedMapId={selectedMapId}
          onMapChange={handleMapChange}
          shuffleMaps={shuffleMaps}
          onShuffleMapsChange={setShuffleMaps}
          onShuffleMap={handleShuffleMap}
          selectedRoomId={selectedRoomId}
          onRoomSelect={(r) => {
            setSelectedRoomId(r.id);
            setSelectedMode(r.mode);
            setSelectedMapId(r.mapId);
            setRoomListPassword('');
            setServerError(null);
          }}
          rooms={rooms}
          leaderboard={leaderboard}
          quality={settings.quality}
          onQualityChange={(q) => handleUpdateSettings({ quality: q })}
          touchMode={touchMode}
          onTouchModeChange={setTouchMode}
          hasCustomMap={Boolean(customMap)}
          roomVisibility={roomVisibility}
          onRoomVisibilityChange={(v) => {
            setRoomVisibility(v);
            if (v === 'public') setHostPassword('');
          }}
          hostPassword={hostPassword}
          onHostPasswordChange={setHostPassword}
          joinCode={joinCode}
          onJoinCodeChange={(code) => {
            setJoinCode(code);
            if (serverError) setServerError(null);
          }}
          joinPassword={joinPassword}
          onJoinPasswordChange={(pw) => {
            setJoinPassword(pw);
            if (serverError) setServerError(null);
          }}
          roomListPassword={roomListPassword}
          onRoomListPasswordChange={(pw) => {
            setRoomListPassword(pw);
            if (serverError) setServerError(null);
          }}
          friendsMaxPlayers={friendsMaxPlayers}
          onFriendsMaxPlayersChange={setFriendsMaxPlayers}
          friendsBotCount={friendsBotCount}
          onFriendsBotCountChange={setFriendsBotCount}
          activeTab={titleTab}
          onTabChange={(tab) => {
            setTitleTab(tab);
            setServerError(null);
            if (tab === 'rooms' || tab === 'ranks') {
              refreshServerLists();
            }
          }}
          serverError={serverError}
          onDeploy={() => deployMatch()}
          onJoinListedRoom={handleJoinListedRoom}
          onHostRoom={handleHostRoom}
          onJoinRoom={handleJoinRoom}
          onOpenEditor={() => setEditorOpen(true)}
          lastHostedCode={
            hud.roomJoinCode && !['FOUNDRY', 'SKYLINE', 'DEPOT', 'CYBER18'].includes(hud.roomJoinCode)
              ? hud.roomJoinCode
              : undefined
          }
        />
      )}

      {editorOpen && (
        <MapEditorModal
          initialBlocks={customBlocks}
          onClose={() => setEditorOpen(false)}
          onPlayCustomMap={(blocks, map) => {
            setCustomBlocks(blocks);
            setCustomMap(map);
            setSelectedMapId('custom');
            deployMatch(map, 'custom');
          }}
        />
      )}

      {phase === 'playing' && (
        <>
          <GameHud
            hud={hud}
            muted={settings.muted}
            fov={settings.fov}
            showTouchControls={showTouchControls}
            onToggleMute={handleToggleMute}
            onPause={handlePause}
            onSelectWeapon={handleSelectWeapon}
            onRequestPointerLock={handleRequestPointerLock}
            onShowScoreboard={handlePause}
          />
          {showTouchControls && (
            <TouchOverlay
              hud={hud}
              adsActive={hud.adsBlend > 0.4}
              onMove={(x, y) => engineRef.current?.setTouchMove(x, y)}
              onLookDelta={(dx, dy) => engineRef.current?.addTouchLook(dx, dy)}
              onFire={(held) => engineRef.current?.setTouchFire(held)}
              onJump={() => engineRef.current?.triggerJump()}
              onSlide={(held) => engineRef.current?.setSlide(held)}
              onReload={() => engineRef.current?.triggerReload()}
              onToggleAds={() => engineRef.current?.toggleAds()}
              onSelectWeapon={(slot) => engineRef.current?.selectWeaponSlot(slot)}
            />
          )}
        </>
      )}

      <MatchModals
        phase={phase}
        hud={hud}
        settings={settings}
        touchMode={touchMode}
        leaderboard={leaderboard}
        profile={profile}
        onUpdateProfile={handleUpdateProfile}
        onResetCareerStats={handleResetCareerStats}
        onResume={() => {
          syncPhase('playing');
          engineRef.current?.requestPointerLock();
        }}
        onRestart={() => {
          matchRecordedRef.current = false;
          engineRef.current?.requestRestartMatch();
          syncPhase('playing');
          engineRef.current?.requestPointerLock();
        }}
        onExitToTitle={() => {
          engineRef.current?.disconnect();
          syncPhase('title');
          refreshServerLists();
        }}
        onUpdateSettings={handleUpdateSettings}
        onTouchModeChange={setTouchMode}
      />

      <PostGameSummary
        phase={phase}
        hud={hud}
        playerName={formatPlayerDisplayName(profile.callsign, profile.clanTag)}
        onPlayAgain={() => {
          matchRecordedRef.current = false;
          engineRef.current?.requestRestartMatch();
          syncPhase('playing');
          engineRef.current?.requestPointerLock();
        }}
        onExitToLobby={() => {
          engineRef.current?.disconnect();
          syncPhase('title');
          refreshServerLists();
        }}
      />
    </main>
  );
}
