import type { SkinDef } from './types';

export const SKINS: SkinDef[] = [
  { id: 'default', name: 'Standard Issue', price: 0, colors: { body: 0x4a90d9, top: 0x357abd, bottom: 0x2c6ca0 }, rarity: 'common' },
  { id: 'crimson', name: 'Crimson Heat', price: 25, colors: { body: 0xd9344a, top: 0xbd1f35, bottom: 0xa01828 }, rarity: 'rare' },
  { id: 'emerald', name: 'Emerald Viper', price: 40, colors: { body: 0x1ec870, top: 0x14a85a, bottom: 0x0d8a47 }, rarity: 'rare' },
  { id: 'sapphire', name: 'Sapphire Wave', price: 50, colors: { body: 0x3060e0, top: 0x2048c0, bottom: 0x1838a0 }, rarity: 'rare' },
  { id: 'amber', name: 'Amber Glow', price: 60, colors: { body: 0xf0a020, top: 0xd08010, bottom: 0xb06008 }, rarity: 'rare' },
  { id: 'gold', name: 'Golden Elite', price: 75, colors: { body: 0xf0c040, top: 0xe0a820, bottom: 0xc89010 }, rarity: 'epic' },
  { id: 'phantom', name: 'Phantom Black', price: 100, colors: { body: 0x2a2a2a, top: 0x1a1a1a, bottom: 0x0a0a0a }, rarity: 'epic' },
  { id: 'ocean', name: 'Ocean Depth', price: 120, colors: { body: 0x0a4a6a, top: 0x083a5a, bottom: 0x062a4a }, rarity: 'epic' },
  { id: 'forest', name: 'Forest Camo', price: 120, colors: { body: 0x2a4a2a, top: 0x1a3a1a, bottom: 0x0a2a0a }, rarity: 'epic' },
  { id: 'desert', name: 'Desert Storm', price: 130, colors: { body: 0xc4a850, top: 0xa48838, bottom: 0x846828 }, rarity: 'epic' },
  { id: 'inferno', name: 'Inferno Flame', price: 150, colors: { body: 0xff5a1e, top: 0xe0380e, bottom: 0xb02808 }, rarity: 'legendary' },
  { id: 'arctic', name: 'Arctic Frost', price: 175, colors: { body: 0xa0e8f0, top: 0x70c8e0, bottom: 0x50a8c8 }, rarity: 'legendary' },
  { id: 'violet', name: 'Violet Nebula', price: 200, colors: { body: 0x7a30d0, top: 0x5a20b0, bottom: 0x3a1090 }, rarity: 'legendary' },
  { id: 'rose', name: 'Rose Gold', price: 220, colors: { body: 0xe070a0, top: 0xc05080, bottom: 0xa03060 }, rarity: 'legendary' },
  { id: 'cyber', name: 'Cyber Lime', price: 250, colors: { body: 0xa0ff20, top: 0x80d010, bottom: 0x60a008 }, rarity: 'legendary' },
  { id: 'plasma', name: 'Plasma Blue', price: 280, colors: { body: 0x20a0ff, top: 0x1080e0, bottom: 0x0060c0 }, rarity: 'legendary' },
  { id: 'titanium', name: 'Titanium White', price: 300, colors: { body: 0xe8e8e8, top: 0xc8c8c8, bottom: 0xa8a8a8 }, rarity: 'legendary' },
  { id: 'obsidian', name: 'Obsidian Dark', price: 350, colors: { body: 0x1a1a2a, top: 0x0a0a1a, bottom: 0x05050f }, rarity: 'legendary' },
  { id: 'sunset', name: 'Sunset Mirage', price: 400, colors: { body: 0xff6030, top: 0xe04010, bottom: 0xc02008 }, rarity: 'legendary' },
  { id: 'aurora', name: 'Aurora Borealis', price: 450, colors: { body: 0x20ffa0, top: 0x10d080, bottom: 0x00a060 }, rarity: 'legendary' },
  { id: 'chrome', name: 'Chrome Burner', price: 500, colors: { body: 0xb0b0c0, top: 0x9090a0, bottom: 0x707080 }, rarity: 'legendary' },
  { id: 'galaxy', name: 'Galaxy Swirl', price: 600, colors: { body: 0x2a0a4a, top: 0x1a0530, bottom: 0x0a0210 }, rarity: 'legendary' },
  { id: 'volcano', name: 'Volcanic Ash', price: 700, colors: { body: 0x4a2a1a, top: 0x3a1a0a, bottom: 0x2a0a05 }, rarity: 'legendary' },
  { id: 'diamond', name: 'Diamond Back', price: 800, colors: { body: 0xa0f0f0, top: 0x80d0d0, bottom: 0x60b0b0 }, rarity: 'legendary' },
  { id: 'dragonlore', name: 'Dragon Lore', price: 1000, colors: { body: 0x2a5a2a, top: 0xd4af37, bottom: 0x1a3a1a }, rarity: 'legendary' },
];

export function getSkin(id: string): SkinDef {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}
