import { useState } from 'react';
import { Crosshair, Settings, BookOpen, Store, Play, Coins, ChevronLeft, Volume2, MousePointer, Check, Lock, Shield, Skull, LogOut, Users, Package, Sparkles, Key, X, Bomb, Swords, User, Zap, Smartphone, Gift, Eye } from 'lucide-react';
import type { GameMode, PlayerData, Team, WeaponId, MapId, GameType, CrosshairSettings } from '@/game/types';
import { SKINS, getSkin } from '@/game/skins';
import { WEAPON_SKINS, getWeaponSkin, getDefaultWeaponSkin, RARITY_COLORS, RARITY_GLOW } from '@/game/weaponSkins';
import { WEAPONS, BUYABLE_WEAPONS } from '@/game/weapons';
import { MAPS, GAME_TYPES } from '@/game/types';

type Screen = 'main' | 'play' | 'settings' | 'howto' | 'shop' | 'redeem';

interface Props {
  playerData: PlayerData;
  username: string;
  onSignOut: () => void;
  onPlay: (mode: GameMode, team: Team, mapId?: MapId, gameType?: GameType) => void;
  onBuySkin: (skinId: string) => void;
  onBuyCase: (cost?: number) => Promise<boolean>;
  onEquipSkin: (skinId: string) => void;
  onOpenCase: () => Promise<{ skinId: string } | null>;
  onEquipWeaponSkin: (weaponId: WeaponId, skinId: string) => void;
  onEquipSkinToWeapon: (skinId: string, weaponId: WeaponId) => void;
  settings: { sensitivity: number; volume: number; controlMode: 'pc' | 'mobile'; crosshair: CrosshairSettings };
  onSaveSettings: (s: { sensitivity: number; volume: number; controlMode: 'pc' | 'mobile'; crosshair: CrosshairSettings }) => void;
  onRedeemCode: (code: string) => Promise<{ ok: boolean; message: string }>;
  rewardAwarded: { key: boolean; case: boolean } | null;
  onDismissCaseAwarded: () => void;
}

export function MainMenu({ playerData, username, onSignOut, onPlay, onBuySkin, onBuyCase, onEquipSkin, onOpenCase, onEquipWeaponSkin, onEquipSkinToWeapon, settings, onSaveSettings, rewardAwarded, onDismissCaseAwarded, onRedeemCode }: Props) {
  const [screen, setScreen] = useState<Screen>('main');

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white relative overflow-hidden">
      {rewardAwarded && <RewardBanner reward={rewardAwarded} onDismiss={onDismissCaseAwarded} />}
      {/* Background grid */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      {/* Glow accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-5xl font-extrabold tracking-tight">
              <span className="text-amber-400">CAPSULE</span> STRIKE
            </h1>
            <p className="text-zinc-500 text-sm mt-1 tracking-widest uppercase">3D Tactical FPS</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-zinc-800/80 px-4 py-2 rounded-full border border-zinc-700">
              <span className="text-zinc-400 text-sm hidden sm:inline">{username}</span>
              <button onClick={onSignOut} className="text-zinc-400 hover:text-red-400 transition" title="Sign out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 bg-zinc-800/80 px-4 py-2 rounded-full border border-zinc-700">
              <Coins className="w-5 h-5 text-amber-400" />
              <span className="font-bold text-amber-400">{playerData.coins}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center">
          {screen === 'main' && <MainPanel onPlay={() => setScreen('play')} onSettings={() => setScreen('settings')} onHowTo={() => setScreen('howto')} onShop={() => setScreen('shop')} onRedeem={() => setScreen('redeem')} equippedSkin={playerData.equippedSkin} equippedWeaponSkins={playerData.equippedWeaponSkins} />}
          {screen === 'play' && <PlayPanel onPlay={onPlay} onBack={() => setScreen('main')} />}
          {screen === 'settings' && <SettingsPanel settings={settings} onSave={onSaveSettings} onBack={() => setScreen('main')} />}
          {screen === 'howto' && <HowToPanel onBack={() => setScreen('main')} />}
          {screen === 'shop' && <ShopPanel playerData={playerData} onBuy={onBuySkin} onBuyCase={onBuyCase} onEquip={onEquipSkin} onOpenCase={onOpenCase} onEquipWeaponSkin={onEquipWeaponSkin} onEquipSkinToWeapon={onEquipSkinToWeapon} onBack={() => setScreen('main')} />}
          {screen === 'redeem' && <RedeemPanel onRedeem={onRedeemCode} onBack={() => setScreen('main')} />}
        </div>

        <footer className="text-center text-zinc-600 text-xs mt-8">
          Capsule Strike · Built with Three.js
        </footer>
      </div>
    </div>
  );
}

function MainPanel({ onPlay, onSettings, onHowTo, onShop, onRedeem, equippedSkin, equippedWeaponSkins }: {
  onPlay: () => void;
  onSettings: () => void;
  onHowTo: () => void;
  onShop: () => void;
  onRedeem: () => void;
  equippedSkin: string;
  equippedWeaponSkins: Partial<Record<WeaponId, string>>;
}) {
  const skin = getSkin(equippedSkin);
  // Find the first equipped non-default weapon skin for display
  const equippedEntries = (Object.entries(equippedWeaponSkins) as [WeaponId, string][])
    .filter(([wid, sid]) => wid !== 'knife' && sid && !sid.endsWith('_default'));
  const displayWeaponId: WeaponId = equippedEntries.length > 0 ? equippedEntries[0][0] : 'ak47';
  const displaySkinId = equippedEntries.length > 0 ? equippedEntries[0][1] : `${displayWeaponId}_default`;
  const weaponSkin = getWeaponSkin(displaySkinId) ?? getDefaultWeaponSkin(displayWeaponId);
  const weaponDef = WEAPONS[displayWeaponId];
  const skinColorHex = '#' + weaponSkin.colors.body.toString(16).padStart(6, '0');
  const accentColorHex = '#' + weaponSkin.colors.accent.toString(16).padStart(6, '0');
  const rarityColor = RARITY_COLORS[weaponSkin.rarity];
  return (
    <div className="grid md:grid-cols-2 gap-8 items-center w-full">
      {/* Capsule + weapon preview */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          {/* Character capsule */}
          <div className="w-40 h-60 rounded-full flex items-end justify-center pb-8 relative" style={{
            background: `linear-gradient(to bottom, #${skin.colors.top.toString(16).padStart(6, '0')}, #${skin.colors.body.toString(16).padStart(6, '0')}, #${skin.colors.bottom.toString(16).padStart(6, '0')})`,
            boxShadow: `0 0 60px #${skin.colors.body.toString(16).padStart(6, '0')}40`,
          }}>
            {/* Weapon held in front */}
            <div className="absolute -right-6 bottom-16 rotate-[15deg]" style={{ filter: `drop-shadow(0 4px 8px rgba(0,0,0,0.5))` }}>
              {weaponDef.category === 'pistol' ? (
                <div className="relative">
                  <div className="w-6 h-16 rounded-sm" style={{ background: skinColorHex, border: `2px solid ${accentColorHex}` }} />
                  <div className="w-4 h-8 rounded-sm absolute -bottom-6 left-1" style={{ background: skinColorHex, border: `2px solid ${accentColorHex}` }} />
                </div>
              ) : weaponDef.category === 'sniper' ? (
                <div className="relative">
                  <div className="w-5 h-24 rounded-sm" style={{ background: skinColorHex, border: `2px solid ${accentColorHex}` }} />
                  <div className="w-10 h-3 rounded-sm absolute top-6 -left-3" style={{ background: accentColorHex }} />
                  <div className="w-3 h-6 rounded-sm absolute -bottom-4 left-1" style={{ background: skinColorHex }} />
                </div>
              ) : (
                <div className="relative">
                  <div className="w-5 h-28 rounded-sm" style={{ background: skinColorHex, border: `2px solid ${accentColorHex}` }} />
                  <div className="w-3 h-8 rounded-sm absolute -bottom-6 left-1" style={{ background: skinColorHex, border: `2px solid ${accentColorHex}` }} />
                  <div className="w-3 h-5 rounded-sm absolute top-2 -left-3 rotate-12" style={{ background: accentColorHex }} />
                </div>
              )}
            </div>
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-zinc-800 px-4 py-1 rounded-full text-xs text-zinc-300 border border-zinc-700">
            {skin.name}
          </div>
        </div>
        {/* Weapon skin name plate */}
        <div className="bg-zinc-800/80 border rounded-lg px-4 py-2 flex items-center gap-3" style={{ borderColor: rarityColor + '80' }}>
          <div className="w-3 h-3 rounded-full" style={{ background: rarityColor, boxShadow: `0 0 8px ${rarityColor}` }} />
          <div>
            <div className="text-white font-bold text-sm">{weaponDef.name} · {weaponSkin.name}</div>
            <div className="text-xs capitalize" style={{ color: rarityColor }}>{weaponSkin.rarity}</div>
          </div>
        </div>
      </div>

      {/* Menu buttons */}
      <div className="space-y-4">
        <MenuButton icon={<Play className="w-6 h-6" />} label="Play" desc="Choose a game mode" onClick={onPlay} primary />
        <MenuButton icon={<Store className="w-6 h-6" />} label="Skin Shop" desc="Spend coins on capsule skins" onClick={onShop} />
        <MenuButton icon={<Gift className="w-6 h-6" />} label="Redeem Code" desc="Enter a code for free rewards" onClick={onRedeem} />
        <MenuButton icon={<Settings className="w-6 h-6" />} label="Settings" desc="Sensitivity and volume" onClick={onSettings} />
        <MenuButton icon={<BookOpen className="w-6 h-6" />} label="How to Play" desc="Controls and rules" onClick={onHowTo} />
      </div>
    </div>
  );
}

function MenuButton({ icon, label, desc, onClick, primary }: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition group ${
        primary
          ? 'bg-amber-500 hover:bg-amber-400 border-amber-400 text-black'
          : 'bg-zinc-800/80 hover:bg-zinc-700 border-zinc-700 text-white'
      }`}
    >
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${primary ? 'bg-black/20' : 'bg-zinc-900'}`}>
        {icon}
      </div>
      <div className="text-left flex-1">
        <div className="font-bold text-lg">{label}</div>
        <div className={`text-sm ${primary ? 'text-black/70' : 'text-zinc-400'}`}>{desc}</div>
      </div>
    </button>
  );
}

function PlayPanel({ onPlay, onBack }: { onPlay: (m: GameMode, team: Team, mapId?: MapId, gameType?: GameType) => void; onBack: () => void }) {
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [gameType, setGameType] = useState<GameType | null>(null);
  const [team, setTeam] = useState<Team>('ct');
  const [mapId, setMapId] = useState<MapId>('dust');

  // Step 3: Team selection (only for defusal and tdm) + map selection + deploy
  if (selectedMode && gameType) {
    const needsTeam = gameType !== 'ffa';
    return (
      <div className="w-full max-w-2xl">
        <BackBar onBack={() => { setGameType(null); }} title={needsTeam ? 'Choose Your Side' : 'Ready to Deploy'} />
        {needsTeam && (
          <div className="grid md:grid-cols-2 gap-4">
            <TeamCard
              icon={<Shield className="w-10 h-10" />}
              name="SWAT"
              desc="Counter-Terrorist unit. Blue team."
              color="blue"
              selected={team === 'ct'}
              onClick={() => setTeam('ct')}
            />
            <TeamCard
              icon={<Skull className="w-10 h-10" />}
              name="Terrorist"
              desc="Insurgent force. Red team."
              color="red"
              selected={team === 't'}
              onClick={() => setTeam('t')}
            />
          </div>
        )}
        {!needsTeam && (
          <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-6 text-center mb-4">
            <User className="w-12 h-12 mx-auto text-amber-400 mb-2" />
            <h3 className="text-white font-bold text-lg">Free For All</h3>
            <p className="text-zinc-400 text-sm">Everyone is your enemy. Show off your skins. First to 50 kills wins!</p>
          </div>
        )}
        {selectedMode === 'bots' && (
          <div className="mt-6">
            <h3 className="text-white font-bold mb-3">Select Map</h3>
            <div className="grid grid-cols-3 gap-3">
              {MAPS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMapId(m.id)}
                  className={`p-4 rounded-xl border text-left transition ${mapId === m.id ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-700 bg-zinc-800 hover:border-zinc-500'}`}
                >
                  <div className="text-white font-bold">{m.name}</div>
                  <div className="text-zinc-500 text-xs mt-1">{m.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={() => onPlay(selectedMode, team, mapId, gameType)}
          className="w-full mt-6 px-6 py-4 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition flex items-center justify-center gap-2"
        >
          <Play className="w-5 h-5" /> Deploy{needsTeam ? ` as ${team === 'ct' ? 'SWAT' : 'Terrorist'}` : ''}
        </button>
      </div>
    );
  }

  // Step 2: Game type selection
  if (selectedMode) {
    return (
      <div className="w-full max-w-3xl">
        <BackBar onBack={() => setSelectedMode(null)} title="Select Game Mode" />
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {GAME_TYPES.map((gt) => (
            <button
              key={gt.id}
              onClick={() => setGameType(gt.id)}
              className="text-left p-6 rounded-xl border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700 hover:border-amber-500/50 transition group hover:scale-[1.02]"
            >
              <div className="w-14 h-14 rounded-lg flex items-center justify-center mb-4 bg-amber-500/20 text-amber-400">
                {gt.id === 'defusal' ? <Bomb className="w-7 h-7" /> : gt.id === 'tdm' ? <Swords className="w-7 h-7" /> : gt.id === 'ffa' ? <User className="w-7 h-7" /> : gt.id === 'hideseek' ? <Eye className="w-7 h-7" /> : <Zap className="w-7 h-7" />}
              </div>
              <h3 className="font-bold text-xl mb-1">{gt.name}</h3>
              <p className="text-zinc-400 text-sm">{gt.description}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Step 1: Mode selection
  return (
    <div className="w-full max-w-3xl">
      <BackBar onBack={onBack} title="Play" />
      <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
        <ModeCard
          icon={<Crosshair className="w-8 h-8" />}
          title="Shooting Range"
          desc="Practice aim against targets. No coins earned."
          tag="No rewards"
          onClick={() => onPlay('range', 'ct')}
        />
        <ModeCard
          icon={<Play className="w-8 h-8" />}
          title="Bot Match"
          desc="Play against AI bots. Choose your game mode and map."
          tag="Win = 1 coin"
          onClick={() => setSelectedMode('bots')}
          highlight
        />
        <ModeCard
          icon={<Users className="w-8 h-8" />}
          title="Online Match"
          desc="Play against real people. No bots. Choose your game mode."
          tag="Win = 10 coins"
          onClick={() => setSelectedMode('online')}
        />
      </div>
      <p className="text-zinc-500 text-sm mt-6 text-center">
        Pick a mode, then choose your game type: Bomb Defusal, Team Deathmatch, Free For All, or Arms Race.
      </p>
    </div>
  );
}

function TeamCard({ icon, name, desc, color, selected, onClick }: {
  icon: React.ReactNode;
  name: string;
  desc: string;
  color: 'blue' | 'red';
  selected: boolean;
  onClick: () => void;
}) {
  const styles = color === 'blue'
    ? { border: selected ? 'border-blue-500 bg-blue-500/20' : 'border-zinc-700 hover:border-blue-500/50', glow: 'bg-blue-500/10', text: 'text-blue-400', ring: selected ? 'ring-2 ring-blue-500' : '' }
    : { border: selected ? 'border-red-500 bg-red-500/20' : 'border-zinc-700 hover:border-red-500/50', glow: 'bg-red-500/10', text: 'text-red-400', ring: selected ? 'ring-2 ring-red-500' : '' };
  return (
    <button
      onClick={onClick}
      className={`relative text-left p-6 rounded-xl border transition hover:scale-[1.02] ${styles.border} ${styles.ring}`}
    >
      <div className={`absolute top-0 right-0 w-32 h-32 ${styles.glow} rounded-full blur-2xl -mr-8 -mt-8`} />
      <div className="relative">
        <div className={`w-16 h-16 rounded-xl flex items-center justify-center mb-4 ${styles.text} bg-black/30`}>
          {icon}
        </div>
        <h3 className="font-bold text-2xl mb-1">{name}</h3>
        <p className="text-zinc-400 text-sm">{desc}</p>
        {selected && (
          <div className="absolute top-0 right-0 w-6 h-6 rounded-full bg-white flex items-center justify-center">
            <Check className="w-4 h-4 text-black" />
          </div>
        )}
      </div>
    </button>
  );
}

function ModeCard({ icon, title, desc, tag, onClick, highlight }: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  tag: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-6 rounded-xl border transition group hover:scale-[1.02] ${
        highlight ? 'bg-zinc-800 hover:bg-zinc-700 border-amber-500/50' : 'bg-zinc-800/60 hover:bg-zinc-700 border-zinc-700'
      }`}
    >
      <div className={`w-14 h-14 rounded-lg flex items-center justify-center mb-4 ${highlight ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-900 text-zinc-400'}`}>
        {icon}
      </div>
      <h3 className="font-bold text-xl mb-1">{title}</h3>
      <p className="text-zinc-400 text-sm mb-3">{desc}</p>
      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${highlight ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-700 text-zinc-300'}`}>
        {tag}
      </span>
    </button>
  );
}

function SettingsPanel({ settings, onSave, onBack }: {
  settings: { sensitivity: number; volume: number; controlMode: 'pc' | 'mobile'; crosshair: CrosshairSettings };
  onSave: (s: { sensitivity: number; volume: number; controlMode: 'pc' | 'mobile'; crosshair: CrosshairSettings }) => void;
  onBack: () => void;
}) {
  const [sens, setSens] = useState(settings.sensitivity);
  const [vol, setVol] = useState(settings.volume);
  const [controlMode, setControlMode] = useState<'pc' | 'mobile'>(settings.controlMode);
  const [crosshair, setCrosshair] = useState<CrosshairSettings>(settings.crosshair);

  return (
    <div className="w-full max-w-md">
      <BackBar onBack={onBack} title="Settings" />
      <div className="bg-zinc-800/80 border border-zinc-700 rounded-xl p-6 space-y-6">
        <div>
          <label className="flex items-center gap-2 text-zinc-300 font-semibold mb-2">
            <MousePointer className="w-4 h-4" /> Control Mode
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setControlMode('pc')}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                controlMode === 'pc' ? 'bg-amber-500 text-black' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              }`}
            >
              <MousePointer className="w-4 h-4" /> PC
            </button>
            <button
              onClick={() => setControlMode('mobile')}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                controlMode === 'mobile' ? 'bg-amber-500 text-black' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              }`}
            >
              <Smartphone className="w-4 h-4" /> Mobile
            </button>
          </div>
          <div className="text-zinc-500 text-sm mt-1">Default is PC. This is a browser game — mobile is optional.</div>
        </div>
        <div>
          <label className="flex items-center gap-2 text-zinc-300 font-semibold mb-2">
            <MousePointer className="w-4 h-4" /> Mouse Sensitivity
          </label>
          <input type="range" min={0.2} max={3} step={0.1} value={sens} onChange={(e) => setSens(parseFloat(e.target.value))} className="w-full accent-amber-500" />
          <div className="text-zinc-500 text-sm mt-1">{sens.toFixed(1)}</div>
        </div>
        <div>
          <label className="flex items-center gap-2 text-zinc-300 font-semibold mb-2">
            <Volume2 className="w-4 h-4" /> Volume
          </label>
          <input type="range" min={0} max={1} step={0.05} value={vol} onChange={(e) => setVol(parseFloat(e.target.value))} className="w-full accent-amber-500" />
          <div className="text-zinc-500 text-sm mt-1">{Math.round(vol * 100)}%</div>
        </div>
        <button
          onClick={() => onSave({ sensitivity: sens, volume: vol, controlMode, crosshair })}
          className="w-full px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg transition"
        >
          Save Settings
        </button>
      </div>
      <CrosshairEditor crosshair={crosshair} onChange={setCrosshair} />
    </div>
  );
}

function CrosshairEditor({ crosshair, onChange }: { crosshair: CrosshairSettings; onChange: (c: CrosshairSettings) => void }) {
  const update = (patch: Partial<CrosshairSettings>) => onChange({ ...crosshair, ...patch });
  return (
    <div className="bg-zinc-800/80 border border-zinc-700 rounded-xl p-6 space-y-4 mt-4">
      <label className="flex items-center gap-2 text-zinc-300 font-semibold">
        <Crosshair className="w-4 h-4" /> Custom Crosshair
      </label>
      <div className="flex items-center gap-6">
        <div className="relative w-32 h-32 bg-zinc-900 rounded-lg border border-zinc-700 flex items-center justify-center">
          <CrosshairPreview crosshair={crosshair} />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <label className="text-zinc-400 text-sm">Color</label>
            <input type="color" value={crosshair.color} onChange={(e) => update({ color: e.target.value })} className="w-full h-8 rounded cursor-pointer bg-zinc-700 border border-zinc-600" />
          </div>
          <div>
            <label className="text-zinc-400 text-sm">Thickness: {crosshair.thickness}px</label>
            <input type="range" min={1} max={6} step={1} value={crosshair.thickness} onChange={(e) => update({ thickness: parseInt(e.target.value) })} className="w-full accent-amber-500" />
          </div>
          <div>
            <label className="text-zinc-400 text-sm">Length: {crosshair.length}px</label>
            <input type="range" min={2} max={20} step={1} value={crosshair.length} onChange={(e) => update({ length: parseInt(e.target.value) })} className="w-full accent-amber-500" />
          </div>
          <div>
            <label className="text-zinc-400 text-sm">Gap: {crosshair.gap}px</label>
            <input type="range" min={0} max={15} step={1} value={crosshair.gap} onChange={(e) => update({ gap: parseInt(e.target.value) })} className="w-full accent-amber-500" />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-zinc-300 text-sm cursor-pointer">
              <input type="checkbox" checked={crosshair.dot} onChange={(e) => update({ dot: e.target.checked })} className="accent-amber-500" />
              Center dot
            </label>
            <label className="flex items-center gap-2 text-zinc-300 text-sm cursor-pointer">
              <input type="checkbox" checked={crosshair.outline} onChange={(e) => update({ outline: e.target.checked })} className="accent-amber-500" />
              Outline
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function CrosshairPreview({ crosshair }: { crosshair: CrosshairSettings }) {
  const { color, thickness, length, gap, dot, outline } = crosshair;
  const outlineStyle = outline ? `1px solid rgba(0,0,0,0.8)` : 'none';
  return (
    <div className="relative" style={{ width: 64, height: 64 }}>
      {/* top */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, calc(-100% - ${gap}px))`, width: thickness, height: length, background: color, boxShadow: outline ? '0 0 1px #000' : 'none' }} />
      {/* bottom */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, ${gap}px)`, width: thickness, height: length, background: color, boxShadow: outline ? '0 0 1px #000' : 'none' }} />
      {/* left */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(calc(-100% - ${gap}px), -50%)`, width: length, height: thickness, background: color, boxShadow: outline ? '0 0 1px #000' : 'none' }} />
      {/* right */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(${gap}px, -50%)`, width: length, height: thickness, background: color, boxShadow: outline ? '0 0 1px #000' : 'none' }} />
      {/* dot */}
      {dot && <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: thickness, height: thickness, background: color, boxShadow: outline ? '0 0 1px #000' : 'none' }} />}
    </div>
  );
}

function HowToPanel({ onBack }: { onBack: () => void }) {
  const controls = [
    ['WASD', 'Move around'],
    ['Mouse', 'Look / aim'],
    ['Left Click', 'Shoot'],
    ['Right Click', 'Zoom (AWP only)'],
    ['Shift', 'Crouch'],
    ['R', 'Reload weapon'],
    ['B', 'Open buy menu (during buy phase)'],
    ['Tab', 'Game menu (resume, change skin, leave)'],
    ['1-7', 'Switch weapons (Glock, Deagle, AK, M4, AWP, MP7, MP5)'],
    ['Space', 'Jump / Bunny hop (jump repeatedly to build speed)'],
    ['F', 'Hold to plant bomb (defusal mode)'],
    ['E', 'Hold to defuse bomb (defusal mode)'],
    ['G', 'Inspect weapon'],
    ['T', 'Global chat'],
    ['U', 'Team chat'],
    ['Esc', 'Toggle game menu'],
  ];
  const rules = [
    'Each match is first to 7 round wins.',
    'At the start of each round there is a buy phase — the whole map freezes (you and bots) so you can spend your in-match dollars on weapons.',
    'You always have a knife and a Glock. Rifles and the AWP must be bought each round.',
    'Eliminate the enemy team or let the timer run out to win a round.',
    'Arms Race: 2 kills upgrade your weapon. Get a kill with the gold knife to win. Worth 5 coins!',
    'Hide & Seek: 3v3. SWAT hides while terrorists wait in a box. After 40s the box opens and terrorists hunt. Find all SWAT to win — if time runs out, SWAT wins. Knife only, no money!',
    'Bunny hopping: jump the moment you land to preserve and build speed. Hold W + Space repeatedly.',
    'Shooting Range gives no coins. Bot Match wins give 1 coin.',
    'Spend coins in the Skin Shop to unlock capsule skins.',
  ];
  return (
    <div className="w-full max-w-2xl">
      <BackBar onBack={onBack} title="How to Play" />
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-zinc-800/80 border border-zinc-700 rounded-xl p-6">
          <h3 className="font-bold text-amber-400 mb-3">Controls</h3>
          <ul className="space-y-2">
            {controls.map(([k, v]) => (
              <li key={k} className="flex justify-between text-sm">
                <span className="font-mono bg-zinc-900 px-2 py-0.5 rounded text-amber-300">{k}</span>
                <span className="text-zinc-400">{v}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-zinc-800/80 border border-zinc-700 rounded-xl p-6">
          <h3 className="font-bold text-amber-400 mb-3">Rules</h3>
          <ul className="space-y-2 text-sm text-zinc-300 list-disc list-inside">
            {rules.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ShopPanel({ playerData, onBuy, onBuyCase, onEquip, onOpenCase, onEquipWeaponSkin, onEquipSkinToWeapon, onBack }: {
  playerData: PlayerData;
  onBuy: (id: string) => void;
  onBuyCase: (cost?: number) => Promise<boolean>;
  onEquip: (id: string) => void;
  onOpenCase: () => Promise<{ skinId: string } | null>;
  onEquipWeaponSkin: (weaponId: WeaponId, skinId: string) => void;
  onEquipSkinToWeapon: (skinId: string, weaponId: WeaponId) => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<'player' | 'cases'>('player');
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [equipTarget, setEquipTarget] = useState<string | null>(null);
  const [buyingCase, setBuyingCase] = useState(false);

  const handleOpenCase = async () => {
    setOpening(true);
    setResult(null);
    const res = await onOpenCase();
    setOpening(false);
    if (res) setResult(res.skinId);
  };

  return (
    <div className="w-full max-w-4xl">
      <BackBar onBack={onBack} title="Shop" />
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setTab('player')} className={`px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2 ${tab === 'player' ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>
          <Shield className="w-4 h-4" /> Player Skins
        </button>
        <button onClick={() => setTab('cases')} className={`px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2 ${tab === 'cases' ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>
          <Package className="w-4 h-4" /> Cases
        </button>
        <div className="ml-auto flex items-center gap-2 bg-zinc-800 px-3 py-2 rounded-lg">
          <Coins className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-amber-400">{playerData.coins}</span>
        </div>
      </div>

      {tab === 'player' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {SKINS.map((skin) => {
            const owned = playerData.ownedSkins.includes(skin.id);
            const equipped = playerData.equippedSkin === skin.id;
            const canAfford = playerData.coins >= skin.price;
            const isEquipTarget = equipTarget === skin.id;
            return (
              <div key={skin.id} className="bg-zinc-800/80 border border-zinc-700 rounded-xl p-4 flex flex-col">
                <div className="flex justify-center mb-3">
                  <div className="w-20 h-32 rounded-full" style={{
                    background: `linear-gradient(to bottom, #${skin.colors.top.toString(16).padStart(6, '0')}, #${skin.colors.body.toString(16).padStart(6, '0')}, #${skin.colors.bottom.toString(16).padStart(6, '0')})`,
                    boxShadow: `0 0 30px #${skin.colors.body.toString(16).padStart(6, '0')}50`,
                  }} />
                </div>
                <div className="text-white font-bold">{skin.name}</div>
                <div className={`text-xs font-semibold uppercase mb-3 ${rarityColor(skin.rarity)}`}>{skin.rarity}</div>
                {equipped ? (
                  <div className="mt-auto px-4 py-2 bg-green-500/20 text-green-400 font-semibold rounded-lg text-center text-sm flex items-center justify-center gap-1">
                    <Check className="w-4 h-4" /> Equipped
                  </div>
                ) : owned ? (
                  <div className="mt-auto space-y-2">
                    <button onClick={() => onEquip(skin.id)} className="w-full px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold rounded-lg transition text-sm">Equip Character</button>
                    <button onClick={() => setEquipTarget(isEquipTarget ? null : skin.id)} className="w-full px-4 py-2 bg-zinc-700/70 hover:bg-zinc-600 text-zinc-200 font-semibold rounded-lg transition text-sm flex items-center justify-center gap-1">
                      <Crosshair className="w-4 h-4" /> Equip to Gun
                    </button>
                    {isEquipTarget && (
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        {BUYABLE_WEAPONS.map((wid) => (
                          <button key={wid} onClick={() => { onEquipSkinToWeapon(skin.id, wid); setEquipTarget(null); }} className="px-2 py-1.5 bg-zinc-900 hover:bg-amber-500 hover:text-black text-zinc-300 text-xs font-semibold rounded transition">
                            {WEAPONS[wid].name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <button onClick={() => onBuy(skin.id)} disabled={!canAfford} className={`mt-auto px-4 py-2 font-semibold rounded-lg transition text-sm flex items-center justify-center gap-1 ${canAfford ? 'bg-amber-500 hover:bg-amber-400 text-black' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}>
                    {canAfford ? <><Coins className="w-4 h-4" /> {skin.price}</> : <><Lock className="w-4 h-4" /> {skin.price} coins</>}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'cases' && (
        <div className="space-y-6">
          <div className="bg-zinc-800/80 border border-zinc-700 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                <Package className="w-7 h-7 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">Weapon Case</h3>
                <p className="text-zinc-400 text-sm">Open to get a random gun skin. Earn a key every 3 bot matches, a case every 5 bot matches, or both every online match.</p>
              </div>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2 bg-zinc-900 px-4 py-2 rounded-lg">
                <Package className="w-5 h-5 text-amber-400" />
                <span className="text-white font-bold">{playerData.cases}</span>
                <span className="text-zinc-500 text-sm">cases</span>
              </div>
              <div className="flex items-center gap-2 bg-zinc-900 px-4 py-2 rounded-lg">
                <Key className="w-5 h-5 text-amber-400" />
                <span className="text-white font-bold">{playerData.keys}</span>
                <span className="text-zinc-500 text-sm">keys</span>
              </div>
            </div>
            <div className="space-y-3">
              <button
                onClick={async () => { setBuyingCase(true); await onBuyCase(10); setBuyingCase(false); }}
                disabled={buyingCase || playerData.coins < 10}
                className={`w-full px-6 py-3 font-bold rounded-xl transition flex items-center justify-center gap-2 ${
                  playerData.coins >= 10 && !buyingCase
                    ? 'bg-zinc-700 hover:bg-zinc-600 text-white border border-zinc-600'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                {buyingCase ? (
                  <><Package className="w-5 h-5 animate-bounce" /> Buying...</>
                ) : playerData.coins < 10 ? (
                  <><Lock className="w-5 h-5" /> Need 10 coins</>
                ) : (
                  <><Package className="w-5 h-5" /> Buy Crate · 10 coins</>
                )}
              </button>
              <button
                onClick={handleOpenCase}
                disabled={opening || playerData.cases < 1 || playerData.keys < 1}
                className={`w-full px-6 py-4 font-bold rounded-xl transition flex items-center justify-center gap-2 ${
                  playerData.cases >= 1 && playerData.keys >= 1 && !opening
                    ? 'bg-amber-500 hover:bg-amber-400 text-black'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                {opening ? (
                  <><Sparkles className="w-5 h-5 animate-spin" /> Opening...</>
                ) : playerData.cases < 1 || playerData.keys < 1 ? (
                  <><Lock className="w-5 h-5" /> Need a case and a key</>
                ) : (
                  <><Sparkles className="w-5 h-5" /> Open Case</>
                )}
              </button>
            </div>
            {result && (
              <div className="mt-4 p-4 rounded-xl text-center" style={{ background: RARITY_GLOW[getWeaponSkin(result)?.rarity ?? 'common'] }}>
                <div className="text-sm text-zinc-300 mb-1">You unboxed:</div>
                <div className={`text-2xl font-bold ${rarityColor(getWeaponSkin(result)?.rarity ?? 'common')}`}>
                  {getWeaponSkin(result)?.name}
                </div>
                <div className="text-zinc-400 text-sm">{WEAPONS[getWeaponSkin(result)?.weaponId ?? 'glock'].name} skin</div>
                <button onClick={() => setResult(null)} className="mt-3 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition">Dismiss</button>
              </div>
            )}
          </div>

          <div>
            <h3 className="font-bold text-white text-lg mb-3">Your Weapon Skins</h3>
            {playerData.ownedWeaponSkins.length === 0 ? (
              <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-8 text-center text-zinc-500">
                No weapon skins yet. Play matches to earn keys and cases!
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {playerData.ownedWeaponSkins.map((skinId) => {
                  const skin = getWeaponSkin(skinId);
                  if (!skin) return null;
                  const weapon = WEAPONS[skin.weaponId];
                  const equipped = playerData.equippedWeaponSkins[skin.weaponId] === skinId;
                  return (
                    <div key={skinId} className="bg-zinc-800/80 border rounded-xl p-3 flex flex-col" style={{ borderColor: RARITY_COLORS[skin.rarity] + '60' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `#${skin.colors.body.toString(16).padStart(6, '0')}` }}>
                          <Crosshair className="w-4 h-4 text-white/70" />
                        </div>
                        <div>
                          <div className="text-white text-sm font-bold">{skin.name}</div>
                          <div className="text-zinc-500 text-xs">{weapon.name}</div>
                        </div>
                      </div>
                      <div className={`text-xs font-semibold uppercase mb-2 ${rarityColor(skin.rarity)}`}>{skin.rarity}</div>
                      {equipped ? (
                        <div className="mt-auto px-3 py-1.5 bg-green-500/20 text-green-400 font-semibold rounded text-center text-xs flex items-center justify-center gap-1">
                          <Check className="w-3 h-3" /> Equipped
                        </div>
                      ) : (
                        <button onClick={() => onEquipWeaponSkin(skin.weaponId, skinId)} className="mt-auto px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold rounded text-xs transition">Equip</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function rarityColor(r: string): string {
  switch (r) {
    case 'common': return 'text-zinc-400';
    case 'rare': return 'text-blue-400';
    case 'epic': return 'text-purple-400';
    case 'legendary': return 'text-amber-400';
    default: return 'text-zinc-400';
  }
}

function RewardBanner({ reward, onDismiss }: { reward: { key: boolean; case: boolean }; onDismiss: () => void }) {
  const items: string[] = [];
  if (reward.key) items.push('a key');
  if (reward.case) items.push('a case');
  const text = items.length === 2 ? 'a key and a case' : items[0] ?? 'a reward';
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 border border-amber-500/50 rounded-xl p-4 shadow-2xl animate-[fadeIn_0.3s_ease-out]">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
          <Package className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <div className="text-white font-bold">You earned {text}!</div>
          <div className="text-zinc-400 text-sm">Open it in the Shop under the Cases tab.</div>
        </div>
        <button onClick={onDismiss} className="ml-4 text-zinc-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function RedeemPanel({ onRedeem, onBack }: { onRedeem: (code: string) => Promise<{ ok: boolean; message: string }>; onBack: () => void }) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const handleRedeem = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    const res = await onRedeem(code);
    setStatus(res);
    setBusy(false);
    if (res.ok) setCode('');
  };

  return (
    <div className="w-full max-w-md">
      <BackBar onBack={onBack} title="Redeem Code" />
      <div className="bg-zinc-800/80 border border-zinc-700 rounded-xl p-6 space-y-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-3">
            <Gift className="w-8 h-8 text-amber-400" />
          </div>
          <p className="text-zinc-400 text-sm">Enter a code below to claim free crates, keys, or coins. Each code can only be used once per account.</p>
        </div>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleRedeem(); }}
          placeholder="Enter code..."
          className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none transition"
        />
        <button
          onClick={handleRedeem}
          disabled={busy || !code.trim()}
          className={`w-full px-6 py-3 font-bold rounded-lg transition flex items-center justify-center gap-2 ${
            busy || !code.trim()
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-400 text-black'
          }`}
        >
          {busy ? <><Sparkles className="w-5 h-5 animate-spin" /> Redeeming...</> : <><Gift className="w-5 h-5" /> Redeem</>}
        </button>
        {status && (
          <div className={`p-3 rounded-lg text-center text-sm font-semibold ${status.ok ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
}

function BackBar({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <button onClick={onBack} className="flex items-center gap-1 text-zinc-400 hover:text-white transition">
        <ChevronLeft className="w-5 h-5" /> Back
      </button>
      <h2 className="text-2xl font-bold">{title}</h2>
    </div>
  );
}
