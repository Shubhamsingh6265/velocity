'use client';

import React from 'react';
import {
  Check,
  Copy,
  Crosshair,
  Globe,
  Hammer,
  KeyRound,
  Lock,
  Play,
  Settings,
  Shield,
  Shuffle,
  Sparkles,
  Trophy,
  UserCog,
  Users,
  Wifi,
} from 'lucide-react';
import { MAP_LIST } from '@/lib/fps/maps';
import { buildInviteUrl, formatPlayerDisplayName, INVITE_BASE_URL } from '@/lib/fps/profile';
import {
  GameMode,
  GraphicsQuality,
  LeaderboardEntry,
  PlayerProfile,
  RoomSummary,
  RoomVisibility,
  TouchMode,
} from '@/lib/fps/types';
import { WEAPONS } from '@/lib/fps/weapons';
import PlayerProfilePanel from './PlayerProfilePanel';

export type TitleTab = 'deploy' | 'room' | 'rooms' | 'profile' | 'ranks';

interface TitleOverlayProps {
  profile: PlayerProfile;
  onUpdateProfile: (partial: Partial<PlayerProfile>) => void;
  onResetCareerStats: () => void;
  selectedMode: GameMode;
  onModeChange: (mode: GameMode) => void;
  selectedMapId: string;
  onMapChange: (mapId: string) => void;
  selectedRoomId: string;
  onRoomSelect: (room: RoomSummary) => void;
  rooms: RoomSummary[];
  leaderboard: LeaderboardEntry[];
  quality: GraphicsQuality;
  onQualityChange: (q: GraphicsQuality) => void;
  touchMode: TouchMode;
  onTouchModeChange: (m: TouchMode) => void;
  hasCustomMap: boolean;
  roomVisibility: RoomVisibility;
  onRoomVisibilityChange: (v: RoomVisibility) => void;
  hostPassword: string;
  onHostPasswordChange: (pw: string) => void;
  joinCode: string;
  onJoinCodeChange: (code: string) => void;
  joinPassword: string;
  onJoinPasswordChange: (pw: string) => void;
  roomListPassword: string;
  onRoomListPasswordChange: (pw: string) => void;
  friendsMaxPlayers: number;
  onFriendsMaxPlayersChange: (n: number) => void;
  friendsBotCount: number;
  onFriendsBotCountChange: (n: number) => void;
  shuffleMaps: boolean;
  onShuffleMapsChange: (v: boolean) => void;
  onShuffleMap: () => void;
  activeTab: TitleTab;
  onTabChange: (tab: TitleTab) => void;
  serverError: string | null;
  onDeploy: () => void;
  onJoinListedRoom: () => void;
  onHostRoom: () => void;
  onJoinRoom: () => void;
  onOpenEditor: () => void;
  lastHostedCode?: string;
}

const MODES: Array<{ id: GameMode; label: string; desc: string }> = [
  { id: 'FFA', label: 'Free-For-All', desc: '15 Kills · Solo' },
  { id: 'TDM', label: 'Team DM', desc: '25 Kills · 2 Teams' },
  { id: 'GUN_GAME', label: 'Gun Game', desc: '5-Tier Arsenal' },
];

export default function TitleOverlay({
  profile,
  onUpdateProfile,
  onResetCareerStats,
  selectedMode,
  onModeChange,
  selectedMapId,
  onMapChange,
  selectedRoomId,
  onRoomSelect,
  rooms,
  leaderboard,
  quality,
  onQualityChange,
  touchMode,
  onTouchModeChange,
  hasCustomMap,
  roomVisibility,
  onRoomVisibilityChange,
  hostPassword,
  onHostPasswordChange,
  joinCode,
  onJoinCodeChange,
  joinPassword,
  onJoinPasswordChange,
  roomListPassword,
  onRoomListPasswordChange,
  friendsMaxPlayers,
  onFriendsMaxPlayersChange,
  friendsBotCount,
  onFriendsBotCountChange,
  shuffleMaps,
  onShuffleMapsChange,
  onShuffleMap,
  activeTab,
  onTabChange,
  serverError,
  onDeploy,
  onJoinListedRoom,
  onHostRoom,
  onJoinRoom,
  onOpenEditor,
  lastHostedCode,
}: TitleOverlayProps) {
  const [copiedUrl, setCopiedUrl] = React.useState(false);
  const displayName = formatPlayerDisplayName(profile.callsign, profile.clanTag);
  const selectedListedRoom = rooms.find((r) => r.id === selectedRoomId) || rooms[0];
  const activeCode = joinCode.trim() || lastHostedCode || '';
  const roomInviteUrl = activeCode ? buildInviteUrl(activeCode) : `${INVITE_BASE_URL}/?r=`;

  const handleCopyRoomUrl = async () => {
    try {
      await navigator.clipboard?.writeText(roomInviteUrl);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 1800);
    } catch {
      // Ignore clipboard failures in restricted contexts
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-none">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(10,14,22,0.94) 0%, rgba(10,14,22,0.82) 48%, rgba(10,14,22,0.18) 100%)',
        }}
      />

      <div className="relative z-10 flex-1 flex items-center px-4 sm:px-10 py-5 overflow-y-auto">
        <div className="w-full max-w-[540px] pointer-events-auto flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <svg
              viewBox="0 0 360 54"
              className="w-72 sm:w-80 h-auto"
              role="img"
              aria-label="Project Velocity"
            >
              <polygon points="0,8 22,27 0,46 10,46 32,27 10,8" fill="#F59E0B" />
              <polygon points="18,14 34,27 18,40 25,40 41,27 25,14" fill="#F8FAFC" opacity="0.9" />
              <text
                x="52"
                y="24"
                fill="#94A3B8"
                fontSize="11"
                fontWeight="600"
                letterSpacing="4"
                fontFamily="var(--font-mono)"
              >
                LOW-SPEC ARENA ENGINE
              </text>
              <text
                x="50"
                y="47"
                fill="#F8FAFC"
                fontSize="26"
                fontWeight="700"
                letterSpacing="1.5"
                fontFamily="var(--font-display)"
              >
                PROJECT VELOCITY
              </text>
            </svg>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-[44ch]">
              Authoritative 30Hz WebSocket netcode, optical ADS scopes, kill-medicate siphons, and up to 18-player local friends lobbies.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#111827] border border-white/10 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => onTabChange('deploy')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'deploy'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Quick Deploy
            </button>
            <button
              type="button"
              data-testid="tab-room"
              onClick={() => onTabChange('room')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'room'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              Room
            </button>
            <button
              type="button"
              onClick={() => onTabChange('rooms')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'rooms'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Rooms ({rooms.length})
            </button>
            <button
              type="button"
              data-testid="tab-player-profile"
              onClick={() => onTabChange('profile')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'profile'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <UserCog className="w-3.5 h-3.5" />
              Player
            </button>
            <button
              type="button"
              onClick={() => onTabChange('ranks')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'ranks'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              Ranks
            </button>
          </div>

          {serverError && (
            <div className="px-3.5 py-2 rounded-lg bg-red-950/90 border border-red-500/40 text-xs text-red-200 font-medium">
              {serverError}
            </div>
          )}

          {activeTab === 'deploy' && (
            <div className="bg-[#0F1623]/95 border border-white/12 rounded-xl p-4 sm:p-5 flex flex-col gap-3.5 shadow-2xl">
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#090D16] border border-white/10">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 border border-white/40"
                    style={{ backgroundColor: profile.accentColor }}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{displayName}</div>
                    <div className="text-[11px] text-slate-400 capitalize truncate">
                      {profile.characterStyle} · {WEAPONS[profile.preferredWeapon]?.name}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onTabChange('profile')}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 shrink-0 cursor-pointer"
                >
                  Edit Operator
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-300">Game Mode</span>
                <div className="grid grid-cols-3 gap-2">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onModeChange(m.id)}
                      className={`px-2.5 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                        selectedMode === m.id
                          ? 'bg-amber-500/15 border-amber-500 text-white'
                          : 'bg-[#090D16] border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <div className="text-xs font-bold leading-tight whitespace-nowrap truncate">
                        {m.label}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 truncate">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">
                    Arena Map ({MAP_LIST.length} Presets)
                  </span>
                  <button
                    type="button"
                    data-testid="shuffle-map-btn"
                    onClick={onShuffleMap}
                    title="Pick a random arena"
                    className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer ml-auto mr-3"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    Shuffle
                  </button>
                  <button
                    type="button"
                    onClick={onOpenEditor}
                    className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Hammer className="w-3.5 h-3.5" />
                    Map Builder
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    data-testid="map-option-random"
                    onClick={() => onMapChange('random')}
                    className={`px-2.5 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                      selectedMapId === 'random'
                        ? 'bg-sky-500/15 border-sky-400 text-white'
                        : 'bg-[#090D16] border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <div className="text-xs font-bold truncate flex items-center gap-1">
                      <Shuffle className="w-3 h-3" /> Random Map
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">A new arena every deploy</div>
                  </button>
                  {MAP_LIST.map((map) => (
                    <button
                      key={map.id}
                      type="button"
                      data-testid={`map-option-${map.id}`}
                      onClick={() => onMapChange(map.id)}
                      className={`px-2.5 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                        selectedMapId === map.id
                          ? 'bg-amber-500/15 border-amber-500 text-white'
                          : 'bg-[#090D16] border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <div className="text-xs font-bold truncate">{map.name}</div>
                      <div className="text-[11px] text-slate-400 capitalize truncate">
                        {map.theme} · {map.bounds.halfW * 2}x{map.bounds.halfD * 2}m
                      </div>
                    </button>
                  ))}
                </div>
                {hasCustomMap && (
                  <button
                    type="button"
                    onClick={() => onMapChange('custom')}
                    className={`mt-1 px-3 py-1.5 rounded-lg border text-xs font-semibold text-left transition-colors cursor-pointer ${
                      selectedMapId === 'custom'
                        ? 'bg-amber-500/15 border-amber-500 text-white'
                        : 'bg-[#090D16] border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    Custom Arena · User Map Ready
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-0.5">
                <div className="flex flex-col gap-1">
                  <label htmlFor="quality-select" className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                    <Settings className="w-3 h-3" />
                    Graphics Scale
                  </label>
                  <select
                    id="quality-select"
                    value={quality}
                    onChange={(e) => onQualityChange(e.target.value as GraphicsQuality)}
                    className="px-2.5 py-2 bg-[#090D16] border border-white/12 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="auto">Adaptive Auto (60+ FPS)</option>
                    <option value="low">Low-Spec (0.68x)</option>
                    <option value="medium">Balanced (0.85x)</option>
                    <option value="high">High (1.0x)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="touch-select" className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Touch Controls
                  </label>
                  <select
                    id="touch-select"
                    value={touchMode}
                    onChange={(e) => onTouchModeChange(e.target.value as TouchMode)}
                    className="px-2.5 py-2 bg-[#090D16] border border-white/12 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="auto">Auto Detect</option>
                    <option value="on">Always Show</option>
                    <option value="off">Desktop Only</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                data-start="true"
                onClick={onDeploy}
                className="w-full py-3.5 px-5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-display font-bold text-base tracking-wide rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <Play className="w-4 h-4 fill-current" />
                Deploy to Arena
              </button>
            </div>
          )}

          {activeTab === 'room' && (
            <div
              data-testid="room-panel"
              className="bg-[#0F1623]/95 border border-white/12 rounded-xl p-4 sm:p-5 flex flex-col gap-4 shadow-2xl"
            >
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white">Host Custom Room</h2>
                  <span className="text-[11px] font-mono text-amber-400">Up to 18 Players</span>
                </div>

                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#090D16] border border-amber-500/25 text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-300 min-w-0">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate font-mono text-amber-300" data-testid="room-invite-preview">
                      {roomInviteUrl}
                    </span>
                  </div>
                  <button
                    type="button"
                    data-testid="room-copy-url-btn"
                    onClick={handleCopyRoomUrl}
                    className="px-2.5 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-300 font-mono text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy URL
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-6 flex flex-col gap-1">
                    <span className="text-[11px] text-slate-400">Room Visibility</span>
                    <div className="grid grid-cols-2 gap-1 p-0.5 bg-[#090D16] border border-white/15 rounded-lg">
                      <button
                        type="button"
                        data-testid="visibility-public"
                        onClick={() => onRoomVisibilityChange('public')}
                        className={`py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                          roomVisibility === 'public'
                            ? 'bg-sky-500 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <Globe className="w-3 h-3" />
                        Public
                      </button>
                      <button
                        type="button"
                        data-testid="visibility-private"
                        onClick={() => onRoomVisibilityChange('private')}
                        className={`py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                          roomVisibility === 'private'
                            ? 'bg-purple-500 text-white'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <Lock className="w-3 h-3" />
                        Private
                      </button>
                    </div>
                  </div>

                  <div className="col-span-3 flex flex-col gap-1">
                    <label htmlFor="friends-max-players" className="text-[11px] text-slate-400">
                      Max ({friendsMaxPlayers}P)
                    </label>
                    <select
                      id="friends-max-players"
                      value={friendsMaxPlayers}
                      onChange={(e) => onFriendsMaxPlayersChange(parseInt(e.target.value, 10))}
                      className="px-2 py-2 bg-[#090D16] border border-white/15 rounded-lg text-xs text-white"
                    >
                      {[2, 4, 6, 8, 10, 12, 16, 18].map((n) => (
                        <option key={n} value={n}>
                          {n} Players
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-3 flex flex-col gap-1">
                    <label htmlFor="friends-bots" className="text-[11px] text-slate-400">
                      AI Bots
                    </label>
                    <select
                      id="friends-bots"
                      value={friendsBotCount}
                      onChange={(e) => onFriendsBotCountChange(parseInt(e.target.value, 10))}
                      className="px-2 py-2 bg-[#090D16] border border-white/15 rounded-lg text-xs text-white"
                    >
                      {[0, 2, 4, 6, 8, 10, 14, 17].map((n) => (
                        <option key={n} value={n}>
                          {n} Bots
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    aria-label="Room Mode"
                    value={selectedMode}
                    onChange={(e) => onModeChange(e.target.value as GameMode)}
                    className="px-2.5 py-2 bg-[#090D16] border border-white/15 rounded-lg text-xs text-white"
                  >
                    {MODES.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Room Map"
                    value={selectedMapId}
                    onChange={(e) => onMapChange(e.target.value)}
                    className="px-2.5 py-2 bg-[#090D16] border border-white/15 rounded-lg text-xs text-white"
                  >
                    <option value="random">Random Map</option>
                    {MAP_LIST.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.bounds.halfW * 2}x{m.bounds.halfD * 2}m)
                      </option>
                    ))}
                    {hasCustomMap && <option value="custom">Custom Arena</option>}
                  </select>
                </div>

                <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="host-shuffle-maps"
                    checked={shuffleMaps}
                    onChange={(e) => onShuffleMapsChange(e.target.checked)}
                    className="w-4 h-4 accent-sky-500"
                  />
                  <Shuffle className="w-3.5 h-3.5 text-sky-400" />
                  Switch to a random new map after every match
                </label>

                <div className="flex items-center gap-2">
                  {roomVisibility === 'private' && (
                    <div className="relative flex-1">
                      <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="password"
                        data-testid="host-room-password"
                        maxLength={24}
                        value={hostPassword}
                        onChange={(e) => onHostPasswordChange(e.target.value)}
                        placeholder="Password (Optional)"
                        className="w-full pl-8 pr-3 py-2 bg-[#090D16] border border-white/15 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    data-testid="host-room-btn"
                    onClick={onHostRoom}
                    className={`${
                      roomVisibility === 'public' ? 'w-full' : ''
                    } py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm rounded-lg flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap`}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Host {friendsMaxPlayers}P Room
                  </button>
                </div>
              </div>

              <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
                <span className="text-xs font-bold text-white">Join Room by Code / Invite Link</span>
                <div className="grid grid-cols-12 gap-2">
                  <input
                    type="text"
                    data-testid="join-room-code"
                    maxLength={12}
                    value={joinCode}
                    onChange={(e) =>
                      onJoinCodeChange(
                        e.target.value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase(),
                      )
                    }
                    placeholder="Room Code"
                    className="col-span-5 px-3 py-2 bg-[#090D16] border border-white/15 rounded-lg text-xs font-mono uppercase text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="password"
                    data-testid="join-room-password"
                    maxLength={24}
                    value={joinPassword}
                    onChange={(e) => onJoinPasswordChange(e.target.value)}
                    placeholder="Password (If locked)"
                    className="col-span-4 px-2.5 py-2 bg-[#090D16] border border-white/15 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    data-testid="join-room-btn"
                    onClick={onJoinRoom}
                    disabled={!joinCode.trim()}
                    className="col-span-3 py-2 px-3 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-display font-bold text-xs rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    Join
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rooms' && (
            <div className="bg-[#0F1623]/95 border border-white/12 rounded-xl p-5 flex flex-col gap-3 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">Public Arenas & Hosted Rooms</h2>
                <span className="text-xs text-slate-400">Up to 18P · 30Hz</span>
              </div>
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                {rooms.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    data-testid={`room-row-${r.joinCode}`}
                    onClick={() => onRoomSelect(r)}
                    className={`p-3 rounded-lg border text-left transition-colors flex items-center justify-between cursor-pointer ${
                      selectedRoomId === r.id
                        ? 'bg-amber-500/15 border-amber-500'
                        : 'bg-[#090D16] border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-white truncate">{r.name}</span>
                        <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-amber-300 shrink-0">
                          {r.joinCode}
                        </span>
                        {r.isFriendsRoom && (
                          <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-[10px] font-mono text-sky-300 shrink-0">
                            PUBLIC
                          </span>
                        )}
                        {r.hasPassword && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-[10px] font-mono text-amber-300 flex items-center gap-0.5 shrink-0">
                            <Lock className="w-2.5 h-2.5" />
                            LOCKED
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {r.mode} · {r.humanCount} Humans · {r.totalPlayers}/{r.maxPlayers} Combatants
                      </div>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-amber-400 shrink-0">
                      {Math.floor(r.timeRemaining / 60)}:{String(r.timeRemaining % 60).padStart(2, '0')}
                    </span>
                  </button>
                ))}
              </div>
              {selectedListedRoom?.hasPassword && (
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    data-testid="rooms-list-password"
                    maxLength={24}
                    value={roomListPassword}
                    onChange={(e) => onRoomListPasswordChange(e.target.value)}
                    placeholder={`Enter password for room ${selectedListedRoom.joinCode}`}
                    className="w-full pl-9 pr-3 py-2 bg-[#090D16] border border-amber-500/40 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}
              <button
                type="button"
                data-start="true"
                onClick={onJoinListedRoom}
                className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Crosshair className="w-4 h-4" />
                Join Selected Room
              </button>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="bg-[#0F1623]/95 border border-white/12 rounded-xl p-4 sm:p-5 flex flex-col gap-3 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">Operator & Loadout Manager</h2>
                <span className="text-[11px] text-slate-400">Saved Locally</span>
              </div>
              <PlayerProfilePanel
                profile={profile}
                onUpdateProfile={onUpdateProfile}
                onResetCareerStats={onResetCareerStats}
              />
            </div>
          )}

          {activeTab === 'ranks' && (
            <div className="bg-[#0F1623]/95 border border-white/12 rounded-xl p-5 flex flex-col gap-3 shadow-2xl">
              <h2 className="text-sm font-bold text-white">Arena Top Operators</h2>
              <div className="flex flex-col divide-y divide-white/10 max-h-64 overflow-y-auto">
                {leaderboard.slice(0, 8).map((entry, idx) => (
                  <div key={entry.name} className="py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono tabular-nums text-slate-400 w-5">{idx + 1}.</span>
                      <span className="font-semibold text-white truncate">{entry.name}</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono tabular-nums text-slate-300 shrink-0">
                      <span>{entry.kills}K</span>
                      <span>{entry.wins}W</span>
                      <span className="text-amber-400 font-bold">{entry.bestScore}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 px-6 pb-4 pt-3 bg-gradient-to-t from-[#090D16]/85 via-[#090D16]/40 to-transparent flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
        <span>
          WASD Move · Space Jump · Shift Slide · RMB / F Scope · R Reload · 1-5 Weapons · Esc Pause
        </span>
        <span className="hidden sm:inline font-mono tabular-nums text-slate-300">
          Gamepad & Mobile Touch · +HP Kill Medicate
        </span>
      </div>
    </div>
  );
}
