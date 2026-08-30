export type WeaponId = 'glock' | 'deagle' | 'ak47' | 'm4' | 'awp' | 'mp7' | 'mp5' | 'knife';

export type Team = 'ct' | 't';

export type GameMode = 'range' | 'bots' | 'online';

export type GameType = 'defusal' | 'tdm' | 'ffa' | 'armsrace' | 'hideseek';

export interface GameTypeInfo {
  id: GameType;
  name: string;
  description: string;
  icon: string;
}

export const GAME_TYPES: GameTypeInfo[] = [
  { id: 'defusal', name: 'Bomb Defusal', description: 'Terrorists plant the bomb, SWAT defuses it. Best of 13 rounds.', icon: 'bomb' },
  { id: 'tdm', name: 'Team Deathmatch', description: 'First team to 50 kills wins. Respawn on death.', icon: 'tdm' },
  { id: 'ffa', name: 'Free For All', description: 'Everyone is your enemy. First to 50 kills wins. Respawn on death.', icon: 'ffa' },
  { id: 'armsrace', name: 'Arms Race', description: '2 kills upgrade your weapon. Get the gold knife kill to win. 5 coins reward.', icon: 'armsrace' },
  { id: 'hideseek', name: 'Hide & Seek', description: '3v3. Terrorists hunt SWAT who hide. Find all SWAT before time runs out.', icon: 'hideseek' },
];

export type MapId = 'dust' | 'mirage' | 'nuke';

export interface MapInfo {
  id: MapId;
  name: string;
  description: string;
}

export const MAPS: MapInfo[] = [
  { id: 'dust', name: 'Dust', description: 'Open desert arena with crates and platforms' },
  { id: 'mirage', name: 'Mirage', description: 'Urban compound with tight corridors' },
  { id: 'nuke', name: 'Nuke', description: 'Industrial facility with vertical play' },
];

export interface WeaponDef {
  id: WeaponId;
  name: string;
  category: 'pistol' | 'rifle' | 'sniper' | 'smg' | 'melee';
  price: number;
  damage: number;
  fireRate: number; // rounds per minute
  magSize: number;
  reserveAmmo: number;
  reloadTime: number; // seconds
  spread: number; // radians of inaccuracy
  recoil: number; // vertical kick
  auto: boolean;
  zoom?: boolean;
  range: number; // effective range in world units
}

export interface SkinDef {
  id: string;
  name: string;
  price: number; // in coins
  colors: {
    body: number;
    top: number;
    bottom: number;
  };
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface PlayerData {
  coins: number;
  equippedSkin: string;
  ownedSkins: string[];
  gamesPlayed: number;
  cases: number;
  keys: number;
  ownedWeaponSkins: string[];
  equippedWeaponSkins: Partial<Record<WeaponId, string>>;
}

export interface CrosshairSettings {
  color: string;
  thickness: number;
  length: number;
  gap: number;
  dot: boolean;
  outline: boolean;
}

export interface PlayerHudInfo {
  name: string;
  team: Team;
  alive: boolean;
  hasBomb: boolean;
  isLocal: boolean;
}

export interface HudState {
  health: number;
  hasHelmet: boolean;
  hasVest: boolean;
  armor: number;
  ammo: number;
  reserve: number;
  money: number;
  weapon: string;
  roundsWon: number;
  roundsLost: number;
  round: number;
  enemiesAlive: number;
  alliesAlive: number;
  message: string;
  buyPhase: boolean;
  matchOver: boolean;
  matchWon: boolean;
  kills: number;
  deaths: number;
  teamKills: number;
  enemyKills: number;
  killTarget: number;
  gameType: GameType;
  bombPlanted: boolean;
  bombSite: string;
  bombTimer: number;
  defusing: boolean;
  killStreak: number;
  plantProgress: number;
  inspecting: boolean;
  armsRaceLevel: number;
  armsRaceMaxLevel: number;
  armsRaceWeapon: string;
  spectating: boolean;
  spectateName: string;
  hasBomb: boolean;
  bombDropped: boolean;
  players: PlayerHudInfo[];
  hideSeekTimer: number;
  hideSeekPhase: string;
}

export interface MatchResult {
  won: boolean;
  roundsWon: number;
  roundsLost: number;
  kills: number;
  deaths: number;
  coinsEarned: number;
  mode: GameMode;
}
