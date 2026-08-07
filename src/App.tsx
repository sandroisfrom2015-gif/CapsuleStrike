import { useEffect, useState } from 'react';
import { MainMenu } from '@/components/MainMenu';
import { GameScreen } from '@/components/GameScreen';
import { AuthScreen } from '@/components/AuthScreen';
import { useAuth } from '@/hooks/useAuth';
import { usePlayerData } from '@/hooks/usePlayerData';
import type { GameMode, MatchResult, Team, MapId, GameType, CrosshairSettings } from '@/game/types';

type View = 'menu' | 'game';

const SETTINGS_KEY = 'cs_settings';

function loadSettings(): { sensitivity: number; volume: number; controlMode: 'pc' | 'mobile'; crosshair: CrosshairSettings } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
 const parsed = JSON.parse(raw);
      return { sensitivity: parsed.sensitivity ?? 1, volume: parsed.volume ?? 0.5, controlMode: parsed.controlMode ?? 'pc', crosshair: parsed.crosshair ?? defaultCrosshair };
    }
  } catch {
    // ignore
  }
  return { sensitivity: 1, volume: 0.5, controlMode: 'pc', crosshair: defaultCrosshair };
}

const defaultCrosshair: CrosshairSettings = { color: '#00ff00', thickness: 2, length: 8, gap: 4, dot: false, outline: true };

export default function App() {
  const auth = useAuth();
  const { data, loading, addCoins, buySkin, buyCase, equipSkin, recordGamePlayed, openCase, equipWeaponSkin, equipSkinToWeapon, redeemCode } = usePlayerData(auth.user?.id ?? null);
  const [view, setView] = useState<View>('menu');
  const [mode, setMode] = useState<GameMode>('range');
  const [playerTeam, setPlayerTeam] = useState<Team>('ct');
  const [mapId, setMapId] = useState<MapId>('dust');
  const [gameType, setGameType] = useState<GameType>('defusal');
  const [settings, setSettings] = useState(loadSettings);
  const [lastResult, setLastResult] = useState<MatchResult | null>(null);
  const [rewardAwarded, setRewardAwarded] = useState<{ key: boolean; case: boolean } | null>(null);

  useEffect(() => {
    if (lastResult) {
      (async () => {
        if (lastResult.coinsEarned > 0) {
          await addCoins(lastResult.coinsEarned);
        }
        const { caseAwarded: ca, keyAwarded: ka } = await recordGamePlayed(lastResult.mode === 'online' ? 'online' : 'bots');
        if (ca || ka) setRewardAwarded({ key: ka, case: ca });
        setLastResult(null);
      })();
    }
  }, [lastResult, addCoins, recordGamePlayed]);

  const handlePlay = (m: GameMode, team: Team, map: MapId = 'dust', gt: GameType = 'defusal') => {
    setMode(m);
    setPlayerTeam(team);
    setMapId(map);
    setGameType(gt);
    setView('game');
  };

  const handleMatchEnd = (result: MatchResult) => {
    setLastResult(result);
  };

  const handleExit = () => {
    setView('menu');
  };

  const handleSaveSettings = (s: { sensitivity: number; volume: number; controlMode: 'pc' | 'mobile'; crosshair: CrosshairSettings }) => {
    setSettings(s);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  };

  if (auth.loading || loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">
        Loading...
      </div>
    );
  }

  if (!auth.user) {
    return <AuthScreen auth={auth} />;
  }

  if (view === 'game') {
    return (
      <GameScreen
        mode={mode}
        skinId={data.equippedSkin}
        playerTeam={playerTeam}
        settings={settings}
        playerData={data}
        userId={auth.user.id}
        username={auth.user.username}
        mapId={mapId}
        gameType={gameType}
        equippedWeaponSkins={data.equippedWeaponSkins}
        onMatchEnd={handleMatchEnd}
        onExit={handleExit}
        onEquipSkin={equipSkin}
      />
    );
  }

  return (
    <MainMenu
      playerData={data}
      username={auth.user.username}
      onSignOut={auth.signOut}
      onPlay={handlePlay}
      onBuySkin={buySkin}
      onBuyCase={buyCase}
      onEquipSkin={equipSkin}
      onOpenCase={openCase}
      onEquipWeaponSkin={equipWeaponSkin}
      onEquipSkinToWeapon={equipSkinToWeapon}
      settings={settings}
      onSaveSettings={handleSaveSettings}
      rewardAwarded={rewardAwarded}
      onDismissCaseAwarded={() => setRewardAwarded(null)}
      onRedeemCode={redeemCode}
    />
  );
}
