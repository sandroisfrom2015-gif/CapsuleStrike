import { useEffect, useRef, useState, useCallback } from 'react';
import { Game } from '@/game/engine';
import type { GameMode, HudState, MatchResult, PlayerData, Team, MapId, WeaponId, GameType, CrosshairSettings, PlayerHudInfo } from '@/game/types';
import { WEAPONS, BUYABLE_WEAPONS } from '@/game/weapons';
import { SKINS, getSkin } from '@/game/skins';
import { MAPS } from '@/game/types';
import { supabase } from '@/lib/supabase';
import { MultiplayerManager, generateRoomId, quickJoinRoom, setQuickJoinRoomStatus, removeQuickJoinRoom, type RemotePlayerState } from '@/game/multiplayer';
import { Crosshair, ShoppingBag, X, LogOut, Play, Shirt, Check, Lock, Coins, Users, Wifi, Map as MapIcon, Zap, Bomb, Shield, HardHat, Eye, MessageSquare, Send } from 'lucide-react';

interface Props {
  mode: GameMode;
  skinId: string;
  playerTeam: Team;
  settings: { sensitivity: number; volume: number; controlMode: 'pc' | 'mobile'; crosshair: CrosshairSettings };
  playerData: PlayerData;
  userId: string;
  username: string;
  mapId: MapId;
  gameType: GameType;
  equippedWeaponSkins: Partial<Record<WeaponId, string>>;
  onMatchEnd: (result: MatchResult) => void;
  onExit: () => void;
  onEquipSkin: (skinId: string) => void;
}

export function GameScreen({ mode, skinId, playerTeam, settings, playerData, userId, username, mapId, gameType, equippedWeaponSkins, onMatchEnd, onExit, onEquipSkin }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [showBuy, setShowBuy] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTab, setMenuTab] = useState<'main' | 'skins'>('main');
  const [localSkin, setLocalSkin] = useState(skinId);

  // online lobby state
  const [mp, setMp] = useState<MultiplayerManager | null>(null);
  const [lobbyState, setLobbyState] = useState<'lobby' | 'playing' | 'ended'>('lobby');
  const [remotePlayers, setRemotePlayers] = useState<Map<string, RemotePlayerState>>(new Map());
  const [roomId, setRoomId] = useState<string>('');
  const [joinInput, setJoinInput] = useState('');
  const [lobbyError, setLobbyError] = useState('');
  const [mpStarted, setMpStarted] = useState(false);
  const [votes, setVotes] = useState<Record<string, MapId>>({});
  const [myVote, setMyVote] = useState<MapId | null>(null);
  const [chosenMap, setChosenMap] = useState<MapId>('dust');
  const [isHost, setIsHost] = useState(false);
  const [quickJoining, setQuickJoining] = useState(false);

  const createRoom = useCallback(async () => {
    const id = generateRoomId();
    const manager = new MultiplayerManager(id, userId, username, playerTeam, skinId);
    setRoomId(id);
    setMp(manager);
    setIsHost(true);
    await manager.join();
    const { error } = await supabase.from('quick_join_rooms').insert({ room_id: id, host_id: userId, host_username: username, status: 'lobby' });
    if (error) setLobbyError(error.message);
    const unsub = manager.onPlayersUpdate((players) => {
      setRemotePlayers(new Map(players));
    });
    const unsubState = manager.onStateChange((s) => setLobbyState(s));
    const unsubVotes = manager.onVotesUpdate((v) => setVotes(v));
    const unsubMap = manager.onMapChosen((m) => setChosenMap(m));
    return () => { unsub(); unsubState(); unsubVotes(); unsubMap(); };
  }, [userId, username, playerTeam, skinId]);

  const joinRoom = useCallback(async (id: string) => {
    const manager = new MultiplayerManager(id.toUpperCase(), userId, username, playerTeam, skinId);
    setRoomId(id.toUpperCase());
    setMp(manager);
    setIsHost(false);
    await manager.join();
    const unsub = manager.onPlayersUpdate((players) => {
      setRemotePlayers(new Map(players));
    });
    const unsubState = manager.onStateChange((s) => setLobbyState(s));
    const unsubVotes = manager.onVotesUpdate((v) => setVotes(v));
    const unsubMap = manager.onMapChosen((m) => setChosenMap(m));
    return () => { unsub(); unsubState(); unsubVotes(); unsubMap(); };
  }, [userId, username, playerTeam, skinId]);

  const quickJoin = useCallback(async () => {
    setQuickJoining(true);
    setLobbyError('');
    try {
      const { manager, roomId: rid, isHost: host } = await quickJoinRoom(userId, username, playerTeam, skinId);
      setRoomId(rid);
      setMp(manager);
      setIsHost(host);
      const unsub = manager.onPlayersUpdate((players) => {
        setRemotePlayers(new Map(players));
      });
      const unsubState = manager.onStateChange((s) => setLobbyState(s));
      const unsubVotes = manager.onVotesUpdate((v) => setVotes(v));
      const unsubMap = manager.onMapChosen((m) => setChosenMap(m));
      // store cleanup in ref-like manner via manager
      (manager as unknown as { _cleanup?: () => void })._cleanup = () => { unsub(); unsubState(); unsubVotes(); unsubMap(); };
    } catch (e) {
      setLobbyError(e instanceof Error ? e.message : 'Quick join failed');
    } finally {
      setQuickJoining(false);
    }
  }, [userId, username, playerTeam, skinId]);

  const castVote = useCallback((mapId: MapId) => {
    if (!mp) return;
    setMyVote(mapId);
    mp.voteMap(mapId);
  }, [mp]);

  const startOnlineMatch = useCallback(() => {
    if (!mp) return;
    const winningMap = mp.tallyVotes();
    mp.broadcastMapChosen(winningMap);
    setChosenMap(winningMap);
    mp.broadcastState('playing');
    setLobbyState('playing');
    setMpStarted(true);
    if (isHost) {
      setQuickJoinRoomStatus(roomId, 'playing').catch(() => {});
    }
  }, [mp, isHost, roomId]);

  const handleExit = useCallback(() => {
    if (isHost && roomId) {
      removeQuickJoinRoom(roomId).catch(() => {});
    }
    if (mp) {
      (mp as unknown as { _cleanup?: () => void })._cleanup?.();
      mp.leave();
    }
    onExit();
  }, [isHost, roomId, mp, onExit]);

  useEffect(() => {
    if (mode !== 'online' || !mpStarted || !mp) return;
    if (!containerRef.current) return;
    const game = new Game({
      container: containerRef.current,
      mode,
      skinId,
      playerTeam,
      settings,
      multiplayer: mp,
      mapId: chosenMap,
      gameType,
      equippedWeaponSkins,
      onHud: setHud,
      onMatchEnd: (r) => {
        setResult(r);
        onMatchEnd(r);
      },
      onExit: onExit,
      onMenuToggle: () => setMenuOpen((g) => gameRef.current?.isMenuOpen() ?? g),
    });
    gameRef.current = game;
    game.setupMultiplayerCallbacks();
    return () => {
      game.dispose();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, mpStarted, mp]);

  useEffect(() => {
    if (mode === 'online') return;
    if (!containerRef.current) return;
    const game = new Game({
      container: containerRef.current,
      mode,
      skinId,
      playerTeam,
      settings,
      mapId,
      gameType,
      equippedWeaponSkins,
      onHud: setHud,
      onMatchEnd: (r) => {
        setResult(r);
        onMatchEnd(r);
      },
      onExit: onExit,
      onMenuToggle: () => setMenuOpen((g) => gameRef.current?.isMenuOpen() ?? g),
    });
    gameRef.current = game;
    return () => {
      game.dispose();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sync buy menu visibility with engine
  useEffect(() => {
    const id = setInterval(() => {
      if (gameRef.current) {
        setShowBuy(gameRef.current.isBuyOpen());
        setChatOpen(gameRef.current.isChatOpen());
        setChatMode(gameRef.current.getChatMode());
        setChatInput(gameRef.current.getChatInput());
        setChatMessages([...gameRef.current.getChatMessages()]);
      } else {
        setShowBuy(false);
        setChatOpen(false);
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  const buyWeapon = (id: Parameters<Game['buyWeapon']>[0]) => {
    gameRef.current?.buyWeapon(id);
  };
  const buyVest = () => gameRef.current?.buyVest();
  const buyHelmet = () => gameRef.current?.buyHelmet();
  const closeBuy = () => gameRef.current?.closeBuyMenu();
  const inspectGun = () => gameRef.current?.inspectWeapon();
  const [chatMessages, setChatMessages] = useState<{ text: string; team: boolean; sender: string; time: number }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMode, setChatMode] = useState<'global' | 'team'>('global');

  const resume = () => {
    gameRef.current?.closeMenu();
    setMenuOpen(false);
    containerRef.current?.querySelector('canvas')?.click();
  };

  const equipSkinInGame = (id: string) => {
    onEquipSkin(id);
    setLocalSkin(id);
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none">
      {/* Online lobby — shown before match starts */}
      {mode === 'online' && !mpStarted && (
        <OnlineLobby
          roomId={roomId}
          remotePlayers={remotePlayers}
          username={username}
          playerTeam={playerTeam}
          joinInput={joinInput}
          setJoinInput={setJoinInput}
          lobbyError={lobbyError}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onQuickJoin={quickJoin}
          quickJoining={quickJoining}
          isHost={isHost}
          onStartMatch={startOnlineMatch}
          onExit={handleExit}
          mp={mp}
          votes={votes}
          myVote={myVote}
          onVote={castVote}
          gameType={gameType}
        />
      )}

      <div ref={containerRef} className="absolute inset-0" />

      {/* Custom crosshair */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <CustomCrosshair crosshair={settings.crosshair} />
      </div>

      {/* HUD */}
      {hud && !result && !menuOpen && (
        <Hud hud={hud} mode={mode} playerTeam={playerTeam} />
      )}

      {/* Buy menu */}
      {showBuy && hud && !menuOpen && (
        <BuyMenu money={hud.money} onBuy={buyWeapon} onBuyVest={buyVest} onBuyHelmet={buyHelmet} owned={gameRef.current?.getOwnedWeapons() ?? []} hasVest={hud.hasVest} hasHelmet={hud.hasHelmet} onClose={closeBuy} onInspect={inspectGun} />
      )}

      {/* Chat overlay */}
      {chatOpen && (
        <ChatInputBox mode={chatMode} value={chatInput} onSubmit={() => gameRef.current?.submitChat()} onCancel={() => gameRef.current?.cancelChat()} />
      )}
      {!chatOpen && chatMessages.length > 0 && !menuOpen && !result && (
        <ChatMessages messages={chatMessages} playerTeam={playerTeam} />
      )}

      {/* Inspect button */}
      {hud && !result && !menuOpen && !showBuy && !chatOpen && (
        <button onClick={inspectGun} className="absolute bottom-4 left-1/2 -translate-x-1/2 ml-32 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-600 text-zinc-300 px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition pointer-events-auto">
          <Eye className="w-4 h-4" /> Inspect (G)
        </button>
      )}

      {/* Plant progress bar */}
      {hud && hud.plantProgress > 0 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-8 text-center">
          <div className="text-amber-400 font-bold text-lg mb-2 drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">Planting bomb...</div>
          <div className="w-48 h-3 bg-zinc-800 rounded-full overflow-hidden mx-auto">
            <div className="h-full bg-amber-500 transition-all" style={{ width: `${hud.plantProgress * 100}%` }} />
          </div>
        </div>
      )}

      {/* Arms Race progress */}
      {hud && hud.gameType === 'armsrace' && !result && !menuOpen && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-2 rounded-lg flex items-center gap-3">
          <span className="text-zinc-400 text-xs uppercase">Level {hud.armsRaceLevel + 1}/{hud.armsRaceMaxLevel + 1}</span>
          <span className="text-amber-400 font-bold text-sm">{hud.armsRaceWeapon}</span>
          {hud.armsRaceLevel === hud.armsRaceMaxLevel && <Zap className="w-4 h-4 text-amber-400" />}
        </div>
      )}

      {/* Tab game menu */}
      {menuOpen && !result && (
        <GameMenu
          tab={menuTab}
          setTab={setMenuTab}
          playerData={playerData}
          onEquip={equipSkinInGame}
          onResume={resume}
          onLeave={handleExit}
        />
      )}

      {/* Match result */}
      {result && (
        <ResultOverlay result={result} mode={mode} gameType={gameType} onExit={handleExit} />
      )}

      {/* Click to play prompt */}
      {hud && !result && !menuOpen && (
        <ClickPrompt />
      )}
    </div>
  );
}

function ClickPrompt() {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 text-white/90 text-sm px-4 py-2 rounded-full pointer-events-none animate-pulse">
      Click to lock mouse · WASD move · Shift crouch · Mouse aim · Click shoot · R reload · B buy · Tab menu · 1-5 weapons
    </div>
  );
}

function Hud({ hud, mode, playerTeam }: { hud: HudState; mode: GameMode; playerTeam: Team }) {
  const allyColor = playerTeam === 'ct' ? 'text-blue-400' : 'text-red-400';
  const enemyColor = playerTeam === 'ct' ? 'text-red-400' : 'text-blue-400';
  const allyLabel = playerTeam === 'ct' ? 'SWAT' : 'T';
  const enemyLabel = playerTeam === 'ct' ? 'T' : 'SWAT';
  const isDeathmatch = hud.gameType === 'tdm' || hud.gameType === 'ffa';
  return (
    <>
      {/* Bottom-left: health/armor */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 font-bold text-sm">
            {hud.health}
          </div>
          <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-red-500 transition-all" style={{ width: `${hud.health}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-blue-500/20 border border-blue-500/50 flex items-center justify-center text-blue-400 font-bold text-sm">
            {hud.armor}
          </div>
          <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${hud.armor}%` }} />
          </div>
        </div>
      </div>

      {/* Bottom-right: ammo */}
      <div className="absolute bottom-12 right-4 text-right">
        <div className="text-white font-bold text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)]">
          {hud.weapon}
        </div>
        <div className="text-amber-400 font-bold text-3xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)]">
          {hud.ammo} <span className="text-zinc-400 text-lg">/ {hud.reserve}</span>
        </div>
      </div>

      {/* Top-center: score info */}
      {mode !== 'range' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/50 px-6 py-2 rounded-lg">
          {isDeathmatch ? (
            <>
              <span className={`${allyColor} font-bold`}>{allyLabel} {hud.roundsWon}</span>
              <span className="text-zinc-500 text-sm">to {hud.killTarget}</span>
              <span className={`${enemyColor} font-bold`}>{hud.roundsLost} {enemyLabel}</span>
            </>
          ) : (
            <>
              <span className={`${allyColor} font-bold`}>{allyLabel} {hud.roundsWon}</span>
              <span className="text-zinc-500 text-sm">Round {hud.round}</span>
              <span className={`${enemyColor} font-bold`}>{hud.roundsLost} {enemyLabel}</span>
            </>
          )}
        </div>
      )}

      {/* Bomb carrier indicator */}
      {hud.gameType === 'defusal' && hud.hasBomb && !hud.bombPlanted && !hud.buyPhase && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-orange-900/70 px-4 py-2 rounded-lg border border-orange-500/50">
          <Bomb className="w-5 h-5 text-orange-400" />
          <span className="text-orange-300 font-bold">You have the bomb — press F at a bomb site</span>
        </div>
      )}

      {/* Dropped bomb hint */}
      {hud.gameType === 'defusal' && hud.bombDropped && !hud.bombPlanted && !hud.buyPhase && playerTeam === 't' && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-900/70 px-4 py-2 rounded-lg border border-red-500/50 animate-pulse">
          <Bomb className="w-5 h-5 text-red-400" />
          <span className="text-red-300 font-bold">Bomb dropped — press F to pick it up</span>
        </div>
      )}

      {/* Bomb timer */}
      {hud.bombPlanted && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-900/70 px-4 py-2 rounded-lg border border-red-500/50">
          <Bomb className="w-5 h-5 text-red-400 animate-bounce" />
          <span className="text-red-300 font-bold">Bomb at Site {hud.bombSite} — {hud.bombTimer}s</span>
        </div>
      )}

      {/* Defusing indicator */}
      {hud.defusing && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-8 text-center">
          <div className="text-amber-400 font-bold text-xl drop-shadow-[0_2px_4px_rgba(0,0,0,1)] animate-pulse">
            Defusing bomb... {Math.ceil(hud.bombTimer)}s
          </div>
        </div>
      )}

      {/* Top-left: money (defusal only) */}
      {mode !== 'range' && !isDeathmatch && (
        <div className="absolute top-4 left-4 bg-black/50 px-4 py-2 rounded-lg">
          <div className="text-green-400 font-bold text-xl">${hud.money}</div>
          <div className="text-zinc-400 text-xs">K {hud.kills} / D {hud.deaths}</div>
        </div>
      )}

      {/* Top-left: kills (deathmatch) */}
      {mode !== 'range' && isDeathmatch && (
        <div className="absolute top-4 left-4 bg-black/50 px-4 py-2 rounded-lg">
          <div className="text-amber-400 font-bold text-xl">{hud.kills} / {hud.killTarget}</div>
          <div className="text-zinc-400 text-xs">K {hud.kills} / D {hud.deaths}</div>
        </div>
      )}

      {/* Top-right: alive counts + timers underneath */}
      {mode !== 'range' && !isDeathmatch && (
        <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
          <div className={`bg-black/50 px-3 py-1 rounded font-bold text-sm ${allyColor}`}>
            Allies: {hud.alliesAlive}
          </div>
          <div className={`bg-black/50 px-3 py-1 rounded font-bold text-sm ${enemyColor}`}>
            Enemies: {hud.enemiesAlive}
          </div>
          {/* Bomb timer underneath alive counts */}
          {hud.bombPlanted && (
            <div className="flex items-center gap-1.5 bg-red-900/70 px-3 py-1 rounded border border-red-500/50">
              <Bomb className="w-4 h-4 text-red-400 animate-bounce" />
              <span className="text-red-300 font-bold text-sm">{hud.bombTimer}s</span>
            </div>
          )}
          {/* Hide & Seek timer underneath alive counts */}
          {hud.gameType === 'hideseek' && hud.hideSeekTimer > 0 && (
            <div className="bg-purple-900/70 px-3 py-1 rounded border border-purple-500/50">
              <span className="text-purple-200 font-bold text-sm">{hud.hideSeekPhase}: {Math.ceil(hud.hideSeekTimer)}s</span>
            </div>
          )}
        </div>
      )}

      {/* Scoreboard with player list */}
      {mode !== 'range' && !isDeathmatch && hud.gameType !== 'armsrace' && (
        <Scoreboard hud={hud} playerTeam={playerTeam} />
      )}

      {/* Center message */}
      {hud.message && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 text-center">
          <div className="text-white font-bold text-3xl drop-shadow-[0_2px_4px_rgba(0,0,0,1)] animate-pulse">
            {hud.message}
          </div>
        </div>
      )}

      {/* Buy phase hint */}
      {(hud.buyPhase && mode !== 'range' && !isDeathmatch && hud.gameType !== 'armsrace') || (isDeathmatch && mode !== 'range') ? (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-amber-500/20 border border-amber-500/50 px-4 py-2 rounded-lg text-amber-300 text-sm font-semibold">
          Press B to open buy menu
        </div>
      ) : null}
      {mode === 'range' && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-amber-500/20 border border-amber-500/50 px-4 py-2 rounded-lg text-amber-300 text-sm font-semibold">
          Press B to open buy menu — infinite money
        </div>
      )}

      {/* Bomb hint for T */}
      {hud.gameType === 'defusal' && !hud.bombPlanted && !hud.buyPhase && !hud.hasBomb && !hud.bombDropped && (
        <div className="absolute bottom-20 right-4 bg-zinc-900/70 border border-zinc-700 px-3 py-1.5 rounded-lg text-zinc-400 text-xs">
          Press F at a bomb site to plant
        </div>
      )}
      {hud.gameType === 'defusal' && !hud.bombPlanted && !hud.buyPhase && hud.hasBomb && (
        <div className="absolute bottom-20 right-4 bg-orange-900/70 border border-orange-700 px-3 py-1.5 rounded-lg text-orange-400 text-xs">
          Press F at a bomb site to plant the bomb
        </div>
      )}

      {/* Defuse hint for CT near bomb */}
      {hud.gameType === 'defusal' && hud.bombPlanted && playerTeam === 'ct' && (
        <div className="absolute bottom-20 right-4 bg-zinc-900/70 border border-zinc-700 px-3 py-1.5 rounded-lg text-zinc-400 text-xs">
          Press E near bomb to defuse
        </div>
      )}

      {/* Respawn timer for deathmatch and arms race */}
      {(isDeathmatch || hud.gameType === 'armsrace') && hud.health <= 0 && !hud.matchOver && !hud.spectating && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="text-white font-bold text-4xl drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
            Respawning...
          </div>
        </div>
      )}

      {/* Spectator mode */}
      {hud.spectating && !hud.matchOver && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="text-zinc-300 font-bold text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
            {hud.spectateName || 'Spectating'}
          </div>
          <div className="text-zinc-500 text-sm mt-2">Click or Space to cycle players</div>
        </div>
      )}

      {/* Kill streak indicator */}
      {hud.killStreak >= 2 && !hud.spectating && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-orange-900/60 border border-orange-500/50 px-4 py-2 rounded-lg">
          <span className="text-orange-400 font-bold text-lg flex items-center gap-2">
            <Zap className="w-5 h-5" /> {hud.killStreak} Kill Streak
          </span>
        </div>
      )}
    </>
  );
}

function CustomCrosshair({ crosshair }: { crosshair: CrosshairSettings }) {
  const { color, thickness, length, gap, dot, outline } = crosshair;
  const shadow = outline ? '0 0 1px #000, 0 0 2px #000' : 'none';
  return (
    <div className="relative" style={{ width: 40, height: 40 }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, calc(-100% - ${gap}px))`, width: thickness, height: length, background: color, boxShadow: shadow }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, ${gap}px)`, width: thickness, height: length, background: color, boxShadow: shadow }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(calc(-100% - ${gap}px), -50%)`, width: length, height: thickness, background: color, boxShadow: shadow }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(${gap}px, -50%)`, width: length, height: thickness, background: color, boxShadow: shadow }} />
      {dot && <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: thickness, height: thickness, background: color, boxShadow: shadow }} />}
    </div>
  );
}

function Scoreboard({ hud, playerTeam }: { hud: HudState; playerTeam: Team }) {
  if (!hud.players || hud.players.length === 0) return null;
  const tPlayers = hud.players.filter(p => p.team === 't');
  const ctPlayers = hud.players.filter(p => p.team === 'ct');
  return (
    <div className="absolute top-16 left-4 space-y-2 pointer-events-none">
      <div className="bg-blue-900/60 border border-blue-700/50 rounded-lg p-2 min-w-[140px]">
        <div className="text-blue-400 font-bold text-xs mb-1 flex items-center gap-1"><Shield className="w-3 h-3" />SWAT</div>
        {ctPlayers.map((p, i) => (
          <div key={i} className={`flex items-center gap-1.5 text-xs ${p.alive ? 'text-blue-200' : 'text-blue-800 line-through'} ${p.isLocal ? 'font-bold' : ''}`}>
            <div className={`w-2 h-2 rounded-full ${p.alive ? 'bg-blue-400' : 'bg-blue-900'}`} />
            {p.name}
          </div>
        ))}
      </div>
      <div className="bg-red-900/60 border border-red-700/50 rounded-lg p-2 min-w-[140px]">
        <div className="text-red-400 font-bold text-xs mb-1 flex items-center gap-1"><Bomb className="w-3 h-3" />Terrorists</div>
        {tPlayers.map((p, i) => (
          <div key={i} className={`flex items-center gap-1.5 text-xs ${p.alive ? 'text-red-200' : 'text-red-800 line-through'} ${p.isLocal ? 'font-bold' : ''}`}>
            <div className={`w-2 h-2 rounded-full ${p.alive ? 'bg-red-400' : 'bg-red-900'}`} />
            {p.hasBomb && p.alive && <Bomb className="w-3 h-3 text-orange-400" />}
            {p.name}
          </div>
        ))}
      </div>
    </div>
  );
}

function BuyMenu({ money, onBuy, onBuyVest, onBuyHelmet, owned, hasVest, hasHelmet, onClose, onInspect }: {
  money: number;
  onBuy: (id: Parameters<Game['buyWeapon']>[0]) => void;
  onBuyVest: () => void;
  onBuyHelmet: () => void;
  owned: WeaponIdShort[];
  hasVest: boolean;
  hasHelmet: boolean;
  onClose: () => void;
  onInspect: () => void;
}) {
  const infinite = money >= 99999;
  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-2xl w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-400" /> Buy Menu
          </h2>
          <div className={infinite ? 'text-amber-400 font-bold' : 'text-green-400 font-bold'}>{infinite ? '∞' : `${money}`}</div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {BUYABLE_WEAPONS.map((id) => {
            const w = WEAPONS[id];
            const ownedIt = owned.includes(id as WeaponIdShort);
            const canAfford = infinite || money >= w.price;
            return (
              <button
                key={id}
                onClick={() => onBuy(id)}
                disabled={!canAfford}
                className={`p-3 rounded-lg border text-left transition ${
                  canAfford ? 'border-zinc-600 hover:border-amber-500 bg-zinc-800 hover:bg-zinc-700' : 'border-zinc-800 bg-zinc-900 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="text-white font-semibold">{w.name}</div>
                <div className="text-zinc-400 text-xs capitalize">{w.category}{w.auto ? ' · auto' : ''}</div>
                <div className="flex justify-between mt-2 text-xs">
                  <span className="text-zinc-500">DMG {w.damage}</span>
                  <span className={ownedIt ? 'text-green-400' : 'text-amber-400 font-bold'}>${w.price}</span>
                </div>
              </button>
            );
          })}
        </div>
        {/* Armor section */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <button
            onClick={onBuyVest}
            disabled={hasVest || (!infinite && money < 350)}
            className={`p-3 rounded-lg border text-left transition flex items-center gap-3 ${
              hasVest ? 'border-green-600 bg-green-900/30' : (!infinite && money < 350) ? 'border-zinc-800 bg-zinc-900 opacity-50 cursor-not-allowed' : 'border-zinc-600 hover:border-blue-500 bg-zinc-800 hover:bg-zinc-700'
            }`}
          >
            <Shield className="w-8 h-8 text-blue-400 flex-shrink-0" />
            <div>
              <div className="text-white font-semibold">Kevlar Vest</div>
              <div className="text-zinc-400 text-xs">100 armor</div>
              <div className={`text-xs font-bold mt-1 ${hasVest ? 'text-green-400' : 'text-amber-400'}`}>{hasVest ? 'Purchased' : '$350'}</div>
            </div>
          </button>
          <button
            onClick={onBuyHelmet}
            disabled={hasHelmet || (!infinite && money < 650)}
            className={`p-3 rounded-lg border text-left transition flex items-center gap-3 ${
              hasHelmet ? 'border-green-600 bg-green-900/30' : (!infinite && money < 650) ? 'border-zinc-800 bg-zinc-900 opacity-50 cursor-not-allowed' : 'border-zinc-600 hover:border-blue-500 bg-zinc-800 hover:bg-zinc-700'
            }`}
          >
            <HardHat className="w-8 h-8 text-blue-400 flex-shrink-0" />
            <div>
              <div className="text-white font-semibold">Helmet + Vest</div>
              <div className="text-zinc-400 text-xs">Reduces headshot dmg</div>
              <div className={`text-xs font-bold mt-1 ${hasHelmet ? 'text-green-400' : 'text-amber-400'}`}>{hasHelmet ? 'Purchased' : '$650'}</div>
            </div>
          </button>
        </div>
        <p className="text-zinc-500 text-xs mt-4">Max 2 pistols + 2 primaries (rifle/SMG/sniper). Weapons and armor reset each round. You keep your knife and Glock always.</p>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold rounded-lg transition text-sm">Close (B)</button>
          <button onClick={onInspect} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-300 font-semibold rounded-lg transition text-sm flex items-center gap-2">
            <Eye className="w-4 h-4" /> View Gun
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatInputBox({ mode, value, onSubmit, onCancel }: { mode: 'global' | 'team'; value: string; onSubmit: () => void; onCancel: () => void; }) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-96 max-w-[90%]">
      <div className="bg-zinc-900/95 border border-zinc-600 rounded-lg p-3 shadow-2xl">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-4 h-4 text-zinc-500" />
          <span className={`text-xs font-bold uppercase ${mode === 'team' ? 'text-blue-400' : 'text-zinc-400'}`}>
            {mode === 'team' ? 'Team Chat' : 'Global Chat'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={value}
            readOnly
            autoFocus
            className="flex-1 bg-zinc-800 text-white px-3 py-2 rounded border border-zinc-700 text-sm outline-none"
            placeholder="Type and press Enter..."
          />
          <button onClick={onSubmit} className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded font-semibold text-sm flex items-center gap-1">
            <Send className="w-4 h-4" />
          </button>
          <button onClick={onCancel} className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-zinc-500 text-xs mt-2">Enter to send · Esc to cancel</p>
      </div>
    </div>
  );
}

function ChatMessages({ messages }: { messages: { text: string; team: boolean; sender: string; time: number }[]; playerTeam: string }) {
  const recent = messages.slice(-6);
  return (
    <div className="absolute bottom-20 left-4 z-30 w-80 max-w-[70%] space-y-1 pointer-events-none">
      {recent.map((m, i) => (
        <div key={i} className={`text-sm px-2 py-1 rounded bg-black/50 ${m.team ? 'text-blue-300' : 'text-zinc-300'}`}>
          <span className="font-bold mr-1">{m.sender}:</span>
          {m.text}
        </div>
      ))}
    </div>
  );
}

type WeaponIdShort = Parameters<Game['buyWeapon']>[0];

function GameMenu({ tab, setTab, playerData, onEquip, onResume, onLeave }: {
  tab: 'main' | 'skins';
  setTab: (t: 'main' | 'skins') => void;
  playerData: PlayerData;
  onEquip: (id: string) => void;
  onResume: () => void;
  onLeave: () => void;
}) {
  return (
    <div className="absolute inset-0 bg-black/85 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-3xl w-full mx-4">
        <div className="flex items-center gap-2 mb-6 border-b border-zinc-700 pb-4">
          <button
            onClick={() => setTab('main')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${tab === 'main' ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
          >
            Menu
          </button>
          <button
            onClick={() => setTab('skins')}
            className={`px-4 py-2 rounded-lg font-semibold transition flex items-center gap-1 ${tab === 'skins' ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
          >
            <Shirt className="w-4 h-4" /> Change Skin
          </button>
          <div className="ml-auto flex items-center gap-2 bg-zinc-800 px-3 py-2 rounded-lg">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-amber-400">{playerData.coins}</span>
          </div>
        </div>

        {tab === 'main' && (
          <div className="space-y-3">
            <button
              onClick={onResume}
              className="w-full flex items-center gap-3 p-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold transition"
            >
              <Play className="w-5 h-5" /> Resume Match
            </button>
            <button
              onClick={onLeave}
              className="w-full flex items-center gap-3 p-4 rounded-lg bg-zinc-800 hover:bg-red-900 border border-zinc-700 hover:border-red-700 text-white font-semibold transition"
            >
              <LogOut className="w-5 h-5" /> Leave Match
            </button>
            <p className="text-zinc-500 text-sm text-center pt-2">Press Tab to resume · Esc to toggle this menu</p>
          </div>
        )}

        {tab === 'skins' && (
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SKINS.map((skin) => {
                const owned = playerData.ownedSkins.includes(skin.id);
                const equipped = playerData.equippedSkin === skin.id;
                return (
                  <div key={skin.id} className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 flex flex-col">
                    <div className="flex justify-center mb-2">
                      <div className="w-14 h-24 rounded-full" style={{
                        background: `linear-gradient(to bottom, #${skin.colors.top.toString(16).padStart(6, '0')}, #${skin.colors.body.toString(16).padStart(6, '0')}, #${skin.colors.bottom.toString(16).padStart(6, '0')})`,
                      }} />
                    </div>
                    <div className="text-white text-sm font-bold">{skin.name}</div>
                    {equipped ? (
                      <div className="mt-auto px-3 py-1.5 bg-green-500/20 text-green-400 font-semibold rounded text-center text-xs flex items-center justify-center gap-1">
                        <Check className="w-3 h-3" /> Equipped
                      </div>
                    ) : owned ? (
                      <button onClick={() => onEquip(skin.id)} className="mt-auto px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold rounded text-xs transition">
                        Equip
                      </button>
                    ) : (
                      <div className="mt-auto px-3 py-1.5 bg-zinc-900 text-zinc-500 rounded text-center text-xs flex items-center justify-center gap-1">
                        <Lock className="w-3 h-3" /> {skin.price} coins
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-zinc-500 text-xs mt-3 text-center">Buy new skins from the main menu shop with coins earned from matches.</p>
          </div>
        )}
      </div>
    </div>
  );
}



function ResultOverlay({ result, mode, gameType, onExit }: { result: MatchResult; mode: GameMode; gameType: GameType; onExit: () => void }) {
  const isDeathmatch = gameType === 'tdm' || gameType === 'ffa';
  const modeLabel = mode === 'bots' ? 'Bot Match' : mode === 'online' ? 'Online Match' : 'Range';
  const typeLabel = gameType === 'defusal' ? 'Bomb Defusal' : gameType === 'tdm' ? 'Team Deathmatch' : gameType === 'ffa' ? 'Free For All' : 'Arms Race';
  return (
    <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-8 max-w-md w-full mx-4 text-center">
        <h2 className={`text-4xl font-extrabold mb-2 ${result.won ? 'text-green-400' : 'text-red-400'}`}>
          {result.won ? 'VICTORY' : 'DEFEAT'}
        </h2>
        <p className="text-zinc-400 mb-6">
          {modeLabel} · {typeLabel}
        </p>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Stat label="Kills" value={result.kills} />
          <Stat label="Deaths" value={result.deaths} />
          {isDeathmatch ? (
            <Stat label="Target" value={50} />
          ) : (
            <Stat label="Rounds Won" value={result.roundsWon} />
          )}
          <Stat label="Coins Earned" value={result.coinsEarned} accent />
        </div>
        <button
          onClick={onExit}
          className="w-full px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg transition"
        >
          Back to Menu
        </button>
      </div>
    </div>
  );
}



function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-zinc-800 rounded-lg p-3">
      <div className="text-zinc-400 text-xs uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold ${accent ? 'text-amber-400' : 'text-white'}`}>{value}</div>
    </div>
  );
}

function OnlineLobby({
  roomId,
  remotePlayers,
  username,
  playerTeam,
  joinInput,
  setJoinInput,
  lobbyError,
  onCreateRoom,
  onJoinRoom,
  onQuickJoin,
  quickJoining,
  isHost,
  onStartMatch,
  onExit,
  mp,
  votes,
  myVote,
  onVote,
  gameType,
}: {
  roomId: string;
  remotePlayers: Map<string, RemotePlayerState>;
  username: string;
  playerTeam: Team;
  joinInput: string;
  setJoinInput: (v: string) => void;
  lobbyError: string;
  onCreateRoom: () => void;
  onJoinRoom: (id: string) => void;
  onQuickJoin: () => void;
  quickJoining: boolean;
  isHost: boolean;
  onStartMatch: () => void;
  onExit: () => void;
  mp: MultiplayerManager | null;
  votes: Record<string, MapId>;
  myVote: MapId | null;
  onVote: (mapId: MapId) => void;
  gameType: GameType;
}) {
  const playerCount = remotePlayers.size + 1;
  const ctCount = [...remotePlayers.values()].filter((p) => p.team === 'ct').length + (playerTeam === 'ct' ? 1 : 0);
  const tCount = [...remotePlayers.values()].filter((p) => p.team === 't').length + (playerTeam === 't' ? 1 : 0);

  return (
    <div className="absolute inset-0 z-50 bg-zinc-950 flex items-center justify-center">
      <div className="max-w-lg w-full mx-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 mb-4">
            <Wifi className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-3xl font-extrabold text-white">Online Match</h1>
          <p className="text-amber-400 mt-2 font-semibold">
            {gameType === 'defusal' ? 'Bomb Defusal' : gameType === 'tdm' ? 'Team Deathmatch' : gameType === 'ffa' ? 'Free For All' : 'Arms Race'}
          </p>
          <p className="text-zinc-400 mt-1 text-sm">Create or join a room. No bots — real players only.</p>
        </div>

        {!mp && (
          <div className="space-y-4">
            <button
              onClick={onQuickJoin}
              disabled={quickJoining}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold transition disabled:opacity-50"
            >
              <Zap className="w-5 h-5" /> {quickJoining ? 'Finding a room...' : 'Quick Join'}
            </button>
            <div className="flex items-center gap-3 text-zinc-600 text-sm">
              <div className="flex-1 h-px bg-zinc-800" /> or <div className="flex-1 h-px bg-zinc-800" />
            </div>
            <button
              onClick={onCreateRoom}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition border border-zinc-700"
            >
              <Users className="w-5 h-5" /> Create Room
            </button>
            <div className="flex gap-2">
              <input
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                placeholder="ROOM CODE"
                maxLength={6}
                className="flex-1 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-center font-mono text-lg tracking-widest uppercase focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={() => joinInput.length >= 4 && onJoinRoom(joinInput)}
                disabled={joinInput.length < 4}
                className="px-6 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Join
              </button>
            </div>
            {lobbyError && <p className="text-red-400 text-sm text-center">{lobbyError}</p>}
          </div>
        )}

        {mp && (
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
              <div className="text-center mb-4">
                <div className="text-zinc-400 text-xs uppercase tracking-widest mb-1">Room Code</div>
                <div className="text-4xl font-mono font-bold text-amber-400 tracking-[0.3em]">{roomId}</div>
                <div className="text-zinc-500 text-xs mt-2">Share this code with friends to invite them</div>
              </div>

              <div className="flex justify-center gap-8 mb-4">
                <div className="text-center">
                  <div className="text-blue-400 font-bold text-lg">{ctCount}</div>
                  <div className="text-zinc-500 text-xs uppercase">SWAT</div>
                </div>
                <div className="text-center">
                  <div className="text-red-400 font-bold text-lg">{tCount}</div>
                  <div className="text-zinc-500 text-xs uppercase">T</div>
                </div>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg">
                  <div className={`w-2 h-2 rounded-full ${playerTeam === 'ct' ? 'bg-blue-400' : 'bg-red-400'}`} />
                  <span className="text-white text-sm font-semibold">{username}</span>
                  <span className="text-zinc-500 text-xs ml-auto">You</span>
                </div>
                {[...remotePlayers.values()].map((p) => (
                  <div key={p.id} className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg">
                    <div className={`w-2 h-2 rounded-full ${p.team === 'ct' ? 'bg-blue-400' : 'bg-red-400'}`} />
                    <span className="text-white text-sm font-semibold">{p.username}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Map voting */}
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapIcon className="w-5 h-5 text-amber-400" />
                <h3 className="text-white font-bold">Vote for Map</h3>
                <span className="text-zinc-500 text-sm ml-auto">{Object.keys(votes).length} votes</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MAPS.map((m) => {
                  const voteCount = Object.values(votes).filter((v) => v === m.id).length;
                  const selected = myVote === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => onVote(m.id)}
                      className={`p-3 rounded-lg border text-left transition ${selected ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-700 bg-zinc-800 hover:border-zinc-500'}`}
                    >
                      <div className="text-white font-bold text-sm">{m.name}</div>
                      <div className="text-zinc-500 text-xs mt-0.5">{voteCount} {voteCount === 1 ? 'vote' : 'votes'}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              {isHost ? (
                <button
                  onClick={onStartMatch}
                  disabled={playerCount < 2}
                  className="flex-1 flex items-center justify-center gap-2 p-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play className="w-5 h-5" /> {playerCount < 2 ? 'Waiting for players...' : 'Start Match'}
                </button>
              ) : (
                <div className="flex-1 flex items-center justify-center gap-2 p-4 rounded-xl bg-zinc-800 text-zinc-400 font-semibold border border-zinc-700">
                  <Wifi className="w-5 h-5 animate-pulse text-amber-400" /> Waiting for host to start...
                </div>
              )}
              <button
                onClick={onExit}
                className="px-4 py-4 rounded-xl bg-zinc-800 hover:bg-red-900 text-white font-semibold transition border border-zinc-700"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
            {playerCount < 2 && isHost && (
              <p className="text-zinc-500 text-sm text-center">At least 2 players are needed to start. Share the room code or wait for someone to Quick Join!</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


