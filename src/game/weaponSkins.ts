import type { WeaponId } from './types';

export interface WeaponSkinDef {
  id: string;
  weaponId: WeaponId;
  name: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  colors: {
    body: number;
    accent: number;
    metalness: number;
    roughness: number;
    emissive?: number;
    emissiveIntensity?: number;
  };
}

export const WEAPON_SKINS: WeaponSkinDef[] = [
  // AK-47 skins
  { id: 'ak47_default', weaponId: 'ak47', name: 'Standard', rarity: 'common', colors: { body: 0x4a4a4a, accent: 0x6a6a6a, metalness: 0.5, roughness: 0.6 } },
  { id: 'ak47_dragon', weaponId: 'ak47', name: 'Red Dragon', rarity: 'rare', colors: { body: 0x8b0000, accent: 0xd4af37, metalness: 0.4, roughness: 0.5, emissive: 0x330000, emissiveIntensity: 0.2 } },
  { id: 'ak47_neon', weaponId: 'ak47', name: 'Neon Rider', rarity: 'epic', colors: { body: 0x1a0033, accent: 0x00ff88, metalness: 0.6, roughness: 0.3, emissive: 0x00ff88, emissiveIntensity: 0.15 } },
  { id: 'ak47_fire', weaponId: 'ak47', name: 'Fire Serpent', rarity: 'legendary', colors: { body: 0x1a0a00, accent: 0xff4400, metalness: 0.7, roughness: 0.25, emissive: 0xff2200, emissiveIntensity: 0.2 } },
  { id: 'ak47_case', weaponId: 'ak47', name: 'Hard Case', rarity: 'rare', colors: { body: 0x5a3a1a, accent: 0x8a6a3a, metalness: 0.4, roughness: 0.7 } },
  { id: 'ak47_ice', weaponId: 'ak47', name: 'Ice Pulse', rarity: 'rare', colors: { body: 0x1a4a6a, accent: 0x80c0ff, metalness: 0.5, roughness: 0.4 } },
  { id: 'ak47_toxic', weaponId: 'ak47', name: 'Toxic Waste', rarity: 'epic', colors: { body: 0x1a3a0a, accent: 0x88ff00, metalness: 0.6, roughness: 0.3, emissive: 0x44ff00, emissiveIntensity: 0.1 } },
  { id: 'ak47_gold', weaponId: 'ak47', name: 'Golden Vortex', rarity: 'legendary', colors: { body: 0xd4af37, accent: 0xfff0a0, metalness: 0.9, roughness: 0.15, emissive: 0x442200, emissiveIntensity: 0.08 } },
  { id: 'ak47_vulcan', weaponId: 'ak47', name: 'Vulcan', rarity: 'epic', colors: { body: 0x2a2a3a, accent: 0xff6600, metalness: 0.7, roughness: 0.25, emissive: 0xff4400, emissiveIntensity: 0.12 } },
  { id: 'ak47_slate', weaponId: 'ak47', name: 'Slate', rarity: 'rare', colors: { body: 0x3a3a4a, accent: 0x5a5a6a, metalness: 0.5, roughness: 0.55 } },
  { id: 'ak47_forest', weaponId: 'ak47', name: 'Forest DPM', rarity: 'uncommon', colors: { body: 0x2a3a1a, accent: 0x4a5a2a, metalness: 0.4, roughness: 0.6 } },
  { id: 'ak47_urban', weaponId: 'ak47', name: 'Urban Camo', rarity: 'uncommon', colors: { body: 0x5a5a4a, accent: 0x7a7a6a, metalness: 0.4, roughness: 0.6 } },
  { id: 'ak47_sunset', weaponId: 'ak47', name: 'Sunset Storm', rarity: 'rare', colors: { body: 0x4a2a1a, accent: 0xff8844, metalness: 0.5, roughness: 0.4 } },
  { id: 'ak47_plasma', weaponId: 'ak47', name: 'Plasma Cell', rarity: 'epic', colors: { body: 0x0a2a3a, accent: 0x00ddff, metalness: 0.7, roughness: 0.25, emissive: 0x00aacc, emissiveIntensity: 0.12 } },

  // M4 skins
  { id: 'm4_default', weaponId: 'm4', name: 'Standard', rarity: 'common', colors: { body: 0x3a3a3a, accent: 0x5a5a5a, metalness: 0.5, roughness: 0.6 } },
  { id: 'm4_ice', weaponId: 'm4', name: 'Ice Storm', rarity: 'rare', colors: { body: 0x1a3a5a, accent: 0x80c0ff, metalness: 0.6, roughness: 0.35 } },
  { id: 'm4_howl', weaponId: 'm4', name: 'Howling Dawn', rarity: 'epic', colors: { body: 0x2a1a00, accent: 0xffaa00, metalness: 0.5, roughness: 0.4, emissive: 0xff8800, emissiveIntensity: 0.1 } },
  { id: 'm4_asimov', weaponId: 'm4', name: 'Asimov', rarity: 'legendary', colors: { body: 0x1a1a1a, accent: 0xff6600, metalness: 0.7, roughness: 0.2, emissive: 0xff4400, emissiveIntensity: 0.15 } },
  { id: 'm4_desert', weaponId: 'm4', name: 'Desert Storm', rarity: 'rare', colors: { body: 0xc4a850, accent: 0xa48838, metalness: 0.4, roughness: 0.65 } },
  { id: 'm4_emerald', weaponId: 'm4', name: 'Emerald Ruin', rarity: 'epic', colors: { body: 0x0a3a2a, accent: 0x20ff80, metalness: 0.6, roughness: 0.3, emissive: 0x10cc60, emissiveIntensity: 0.1 } },
  { id: 'm4_neon', weaponId: 'm4', name: 'Neon Squall', rarity: 'epic', colors: { body: 0x0a1a3a, accent: 0x00aaff, metalness: 0.6, roughness: 0.3, emissive: 0x0088ff, emissiveIntensity: 0.12 } },
  { id: 'm4_royal', weaponId: 'm4', name: 'Royal Paladin', rarity: 'legendary', colors: { body: 0x2a1a4a, accent: 0xd4af37, metalness: 0.7, roughness: 0.2, emissive: 0x6600ff, emissiveIntensity: 0.1 } },
  { id: 'm4_cyber', weaponId: 'm4', name: 'Cyber Hex', rarity: 'rare', colors: { body: 0x1a2a3a, accent: 0x00ffaa, metalness: 0.5, roughness: 0.4 } },
  { id: 'm4_jungle', weaponId: 'm4', name: 'Jungle Camo', rarity: 'uncommon', colors: { body: 0x2a4a1a, accent: 0x4a6a2a, metalness: 0.4, roughness: 0.6 } },
  { id: 'm4_arctic', weaponId: 'm4', name: 'Arctic Camo', rarity: 'uncommon', colors: { body: 0x9a9a9a, accent: 0xc0c0c0, metalness: 0.4, roughness: 0.55 } },
  { id: 'm4_vineyard', weaponId: 'm4', name: 'Vineyard', rarity: 'rare', colors: { body: 0x3a1a2a, accent: 0x8a3a5a, metalness: 0.5, roughness: 0.45 } },
  { id: 'm4_hyperbeast', weaponId: 'm4', name: 'Hyper Beast', rarity: 'epic', colors: { body: 0x3a1a1a, accent: 0xff44aa, metalness: 0.6, roughness: 0.3, emissive: 0xff2288, emissiveIntensity: 0.1 } },
  { id: 'm4_crimson', weaponId: 'm4', name: 'Crimson Web', rarity: 'legendary', colors: { body: 0x4a0a0a, accent: 0xff0044, metalness: 0.7, roughness: 0.2, emissive: 0xcc0022, emissiveIntensity: 0.12 } },

  // AWP skins
  { id: 'awp_default', weaponId: 'awp', name: 'Standard', rarity: 'common', colors: { body: 0x2a2a2a, accent: 0x4a4a4a, metalness: 0.5, roughness: 0.6 } },
  { id: 'awp_dragon', weaponId: 'awp', name: 'Dragon Lore', rarity: 'legendary', colors: { body: 0x2a5a2a, accent: 0xd4af37, metalness: 0.6, roughness: 0.3, emissive: 0x1a3a1a, emissiveIntensity: 0.05 } },
  { id: 'awp_neon', weaponId: 'awp', name: 'Neo-Noir', rarity: 'epic', colors: { body: 0x1a0033, accent: 0xff00ff, metalness: 0.7, roughness: 0.25, emissive: 0xff00aa, emissiveIntensity: 0.12 } },
  { id: 'awp_lightning', weaponId: 'awp', name: 'Lightning Strike', rarity: 'legendary', colors: { body: 0x0a0a1a, accent: 0x00ffff, metalness: 0.8, roughness: 0.15, emissive: 0x00ffff, emissiveIntensity: 0.25 } },
  { id: 'awp_asiimov', weaponId: 'awp', name: 'Asiimov', rarity: 'epic', colors: { body: 0x1a1a1a, accent: 0xff4400, metalness: 0.7, roughness: 0.25, emissive: 0xff3300, emissiveIntensity: 0.1 } },
  { id: 'awp_thunder', weaponId: 'awp', name: 'Thunder Strike', rarity: 'rare', colors: { body: 0x2a2a4a, accent: 0x6080ff, metalness: 0.6, roughness: 0.35 } },
  { id: 'awp_cortex', weaponId: 'awp', name: 'Cortex', rarity: 'rare', colors: { body: 0x3a2a1a, accent: 0xffaa44, metalness: 0.5, roughness: 0.45 } },
  { id: 'awp_hypnotic', weaponId: 'awp', name: 'Hypnotic', rarity: 'epic', colors: { body: 0x0a2a4a, accent: 0x00ddff, metalness: 0.6, roughness: 0.3, emissive: 0x00aacc, emissiveIntensity: 0.1 } },
  { id: 'awp_sage', weaponId: 'awp', name: 'Sage Spray', rarity: 'uncommon', colors: { body: 0x3a5a3a, accent: 0x5a7a5a, metalness: 0.4, roughness: 0.55 } },
  { id: 'awp_desert', weaponId: 'awp', name: 'Desert Lace', rarity: 'uncommon', colors: { body: 0xa48838, accent: 0xc4a850, metalness: 0.4, roughness: 0.6 } },
  { id: 'awp_ellis', weaponId: 'awp', name: 'Ellis', rarity: 'rare', colors: { body: 0x1a4a1a, accent: 0x4a8a4a, metalness: 0.5, roughness: 0.4 } },
  { id: 'awp_phase', weaponId: 'awp', name: 'Phase Reactor', rarity: 'epic', colors: { body: 0x1a1a3a, accent: 0x4040ff, metalness: 0.7, roughness: 0.25, emissive: 0x3030cc, emissiveIntensity: 0.1 } },
  { id: 'awp_gold', weaponId: 'awp', name: 'Gilded Cage', rarity: 'legendary', colors: { body: 0xd4af37, accent: 0xfff0a0, metalness: 0.9, roughness: 0.15, emissive: 0x442200, emissiveIntensity: 0.08 } },
  { id: 'awp_doppler', weaponId: 'awp', name: 'Doppler', rarity: 'legendary', colors: { body: 0x1a0a3a, accent: 0xaa00ff, metalness: 0.8, roughness: 0.15, emissive: 0x6600cc, emissiveIntensity: 0.15 } },

  // Deagle skins
  { id: 'deagle_default', weaponId: 'deagle', name: 'Standard', rarity: 'common', colors: { body: 0x4a4a4a, accent: 0x6a6a6a, metalness: 0.6, roughness: 0.5 } },
  { id: 'deagle_gold', weaponId: 'deagle', name: 'Golden Koi', rarity: 'rare', colors: { body: 0xd4af37, accent: 0xffaa00, metalness: 0.9, roughness: 0.2, emissive: 0x442200, emissiveIntensity: 0.1 } },
  { id: 'deagle_blaze', weaponId: 'deagle', name: 'Blaze', rarity: 'epic', colors: { body: 0x8b0000, accent: 0xff6600, metalness: 0.5, roughness: 0.35, emissive: 0xff3300, emissiveIntensity: 0.15 } },
  { id: 'deagle_code', weaponId: 'deagle', name: 'Code Red', rarity: 'legendary', colors: { body: 0x1a0000, accent: 0xff0044, metalness: 0.7, roughness: 0.2, emissive: 0xff0044, emissiveIntensity: 0.2 } },
  { id: 'deagle_metal', weaponId: 'deagle', name: 'Brushed Steel', rarity: 'rare', colors: { body: 0x8a8a90, accent: 0x6a6a70, metalness: 0.8, roughness: 0.4 } },
  { id: 'deagle_aqua', weaponId: 'deagle', name: 'Aqua Marine', rarity: 'epic', colors: { body: 0x0a4a6a, accent: 0x40c0ff, metalness: 0.6, roughness: 0.3, emissive: 0x0088cc, emissiveIntensity: 0.1 } },
  { id: 'deagle_cobalt', weaponId: 'deagle', name: 'Cobalt Core', rarity: 'rare', colors: { body: 0x1a3a8a, accent: 0x4080ff, metalness: 0.6, roughness: 0.35 } },
  { id: 'deagle_olive', weaponId: 'deagle', name: 'Olive Branch', rarity: 'uncommon', colors: { body: 0x4a5a2a, accent: 0x6a7a4a, metalness: 0.4, roughness: 0.55 } },
  { id: 'deagle_concrete', weaponId: 'deagle', name: 'Concrete', rarity: 'uncommon', colors: { body: 0x6a6a6a, accent: 0x8a8a8a, metalness: 0.5, roughness: 0.5 } },
  { id: 'deagle_rose', weaponId: 'deagle', name: 'Rose Gold', rarity: 'rare', colors: { body: 0xb07070, accent: 0xe0a0a0, metalness: 0.8, roughness: 0.3 } },
  { id: 'deagle_pulse', weaponId: 'deagle', name: 'Pulse', rarity: 'epic', colors: { body: 0x2a0a2a, accent: 0xff44ff, metalness: 0.7, roughness: 0.25, emissive: 0xcc22cc, emissiveIntensity: 0.12 } },
  { id: 'deagle_night', weaponId: 'deagle', name: 'Night Terror', rarity: 'legendary', colors: { body: 0x0a0a1a, accent: 0xaa00ff, metalness: 0.8, roughness: 0.15, emissive: 0x8800cc, emissiveIntensity: 0.18 } },

  // Glock skins
  { id: 'glock_default', weaponId: 'glock', name: 'Standard', rarity: 'common', colors: { body: 0x3a3a3a, accent: 0x5a5a5a, metalness: 0.5, roughness: 0.6 } },
  { id: 'glock_water', weaponId: 'glock', name: 'Water Elemental', rarity: 'rare', colors: { body: 0x1a4a8a, accent: 0x40a0ff, metalness: 0.6, roughness: 0.35 } },
  { id: 'glock_neon', weaponId: 'glock', name: 'Neon Pulse', rarity: 'epic', colors: { body: 0x0a0a2a, accent: 0x00ffaa, metalness: 0.7, roughness: 0.25, emissive: 0x00ffaa, emissiveIntensity: 0.12 } },
  { id: 'glock_twilight', weaponId: 'glock', name: 'Twilight Galaxy', rarity: 'legendary', colors: { body: 0x1a0033, accent: 0xaa00ff, metalness: 0.8, roughness: 0.15, emissive: 0x6600ff, emissiveIntensity: 0.18 } },
  { id: 'glock_sand', weaponId: 'glock', name: 'Sand Dune', rarity: 'rare', colors: { body: 0xa48838, accent: 0xc4a850, metalness: 0.4, roughness: 0.6 } },
  { id: 'glock_fade', weaponId: 'glock', name: 'Fade', rarity: 'epic', colors: { body: 0xff0088, accent: 0xffaa00, metalness: 0.7, roughness: 0.25, emissive: 0xff4488, emissiveIntensity: 0.1 } },
  { id: 'glock_reactor', weaponId: 'glock', name: 'Reactor', rarity: 'rare', colors: { body: 0x2a4a0a, accent: 0x88ff00, metalness: 0.5, roughness: 0.4 } },
  { id: 'glock_grass', weaponId: 'glock', name: 'Grassland', rarity: 'uncommon', colors: { body: 0x3a5a2a, accent: 0x5a7a4a, metalness: 0.4, roughness: 0.6 } },
  { id: 'glock_steel', weaponId: 'glock', name: 'Carbon Steel', rarity: 'uncommon', colors: { body: 0x3a3a3e, accent: 0x5a5a5e, metalness: 0.7, roughness: 0.45 } },
  { id: 'glock_amber', weaponId: 'glock', name: 'Amber Fade', rarity: 'rare', colors: { body: 0x8a4a00, accent: 0xffaa44, metalness: 0.6, roughness: 0.35 } },
  { id: 'glock_cyber', weaponId: 'glock', name: 'Cyber Shell', rarity: 'epic', colors: { body: 0x1a2a3a, accent: 0x00aaff, metalness: 0.7, roughness: 0.25, emissive: 0x0088cc, emissiveIntensity: 0.12 } },
  { id: 'glock_bunsen', weaponId: 'glock', name: 'Bunsen Burner', rarity: 'legendary', colors: { body: 0x4a1a00, accent: 0xff6600, metalness: 0.7, roughness: 0.2, emissive: 0xff4400, emissiveIntensity: 0.15 } },

  // MP7 skins
  { id: 'mp7_default', weaponId: 'mp7', name: 'Standard', rarity: 'common', colors: { body: 0x3a3a3a, accent: 0x5a5a5a, metalness: 0.5, roughness: 0.6 } },
  { id: 'mp7_urban', weaponId: 'mp7', name: 'Urban Camo', rarity: 'rare', colors: { body: 0x3a3a4a, accent: 0x5a5a6a, metalness: 0.4, roughness: 0.6 } },
  { id: 'mp7_neon', weaponId: 'mp7', name: 'Neon Rush', rarity: 'epic', colors: { body: 0x0a0a2a, accent: 0x00ffaa, metalness: 0.7, roughness: 0.25, emissive: 0x00ffaa, emissiveIntensity: 0.12 } },
  { id: 'mp7_volt', weaponId: 'mp7', name: 'Volt', rarity: 'legendary', colors: { body: 0x1a0a3a, accent: 0x00ffff, metalness: 0.8, roughness: 0.15, emissive: 0x00ffff, emissiveIntensity: 0.2 } },
  { id: 'mp7_sand', weaponId: 'mp7', name: 'Sandstorm', rarity: 'rare', colors: { body: 0xa48838, accent: 0xc4a850, metalness: 0.4, roughness: 0.6 } },
  { id: 'mp7_toxic', weaponId: 'mp7', name: 'Toxic Shock', rarity: 'epic', colors: { body: 0x1a3a0a, accent: 0x88ff00, metalness: 0.6, roughness: 0.3, emissive: 0x44ff00, emissiveIntensity: 0.1 } },
  { id: 'mp7_olive', weaponId: 'mp7', name: 'Olive Drab', rarity: 'uncommon', colors: { body: 0x3a4a2a, accent: 0x5a6a4a, metalness: 0.4, roughness: 0.6 } },
  { id: 'mp7_tan', weaponId: 'mp7', name: 'Desert Tan', rarity: 'uncommon', colors: { body: 0x8a7a4a, accent: 0xaa9a6a, metalness: 0.4, roughness: 0.55 } },
  { id: 'mp7_ocean', weaponId: 'mp7', name: 'Ocean Wave', rarity: 'rare', colors: { body: 0x1a4a6a, accent: 0x40a0cc, metalness: 0.5, roughness: 0.4 } },
  { id: 'mp7_chroma', weaponId: 'mp7', name: 'Chroma Cat', rarity: 'epic', colors: { body: 0x2a1a3a, accent: 0xaa44ff, metalness: 0.7, roughness: 0.25, emissive: 0x8822cc, emissiveIntensity: 0.1 } },

  // MP5 skins
  { id: 'mp5_default', weaponId: 'mp5', name: 'Standard', rarity: 'common', colors: { body: 0x2a2a2a, accent: 0x4a4a4a, metalness: 0.5, roughness: 0.6 } },
  { id: 'mp5_navy', weaponId: 'mp5', name: 'Navy SEAL', rarity: 'rare', colors: { body: 0x1a2a4a, accent: 0x4080ff, metalness: 0.5, roughness: 0.4 } },
  { id: 'mp5_steel', weaponId: 'mp5', name: 'Blue Steel', rarity: 'rare', colors: { body: 0x4a5a6a, accent: 0x6a8aaa, metalness: 0.7, roughness: 0.35 } },
  { id: 'mp5_inferno', weaponId: 'mp5', name: 'Inferno', rarity: 'epic', colors: { body: 0x2a0a00, accent: 0xff4400, metalness: 0.6, roughness: 0.3, emissive: 0xff3300, emissiveIntensity: 0.12 } },
  { id: 'mp5_phantom', weaponId: 'mp5', name: 'Phantom', rarity: 'legendary', colors: { body: 0x0a0a1a, accent: 0xaa00ff, metalness: 0.8, roughness: 0.15, emissive: 0x8800cc, emissiveIntensity: 0.18 } },
  { id: 'mp5_crimson', weaponId: 'mp5', name: 'Crimson Web', rarity: 'epic', colors: { body: 0x4a0a0a, accent: 0xff0044, metalness: 0.6, roughness: 0.3, emissive: 0xcc0022, emissiveIntensity: 0.1 } },
  { id: 'mp5_forest', weaponId: 'mp5', name: 'Forest Camo', rarity: 'uncommon', colors: { body: 0x2a3a1a, accent: 0x4a5a2a, metalness: 0.4, roughness: 0.6 } },
  { id: 'mp5_grey', weaponId: 'mp5', name: 'Gunmetal', rarity: 'uncommon', colors: { body: 0x4a4a4e, accent: 0x6a6a6e, metalness: 0.6, roughness: 0.5 } },
  { id: 'mp5_amber', weaponId: 'mp5', name: 'Amber Spiral', rarity: 'rare', colors: { body: 0x4a2a00, accent: 0xffaa44, metalness: 0.5, roughness: 0.4 } },
  { id: 'mp5_neon', weaponId: 'mp5', name: 'Neon Flux', rarity: 'epic', colors: { body: 0x0a1a2a, accent: 0x00ffcc, metalness: 0.7, roughness: 0.25, emissive: 0x00ccaa, emissiveIntensity: 0.12 } },
];

export function getWeaponSkin(id: string): WeaponSkinDef | undefined {
  return WEAPON_SKINS.find((s) => s.id === id);
}

export function getWeaponSkinsForWeapon(weaponId: WeaponId): WeaponSkinDef[] {
  return WEAPON_SKINS.filter((s) => s.weaponId === weaponId);
}

export function getDefaultWeaponSkin(weaponId: WeaponId): WeaponSkinDef {
  return WEAPON_SKINS.find((s) => s.weaponId === weaponId && s.id === `${weaponId}_default`) ?? WEAPON_SKINS[0];
}

// Case opening: weighted random skin (excluding default skins)
const RARITY_WEIGHTS: Record<string, number> = {
  common: 0,
  uncommon: 0.45,
  rare: 0.35,
  epic: 0.20,
  legendary: 0,
};

export function rollCaseSkin(): WeaponSkinDef {
  const pool = WEAPON_SKINS.filter((s) => s.rarity !== 'common' && s.rarity !== 'legendary');
  const roll = Math.random();
  let rarity: string;
  if (roll < RARITY_WEIGHTS.epic) rarity = 'epic';
  else if (roll < RARITY_WEIGHTS.epic + RARITY_WEIGHTS.rare) rarity = 'rare';
  else rarity = 'uncommon';

  const rarityPool = pool.filter((s) => s.rarity === rarity);
  if (rarityPool.length === 0) return pool[Math.floor(Math.random() * pool.length)];
  return rarityPool[Math.floor(Math.random() * rarityPool.length)];
}

export const RARITY_COLORS: Record<string, string> = {
  common: '#a1a1aa',
  uncommon: '#4ade80',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

export const RARITY_GLOW: Record<string, string> = {
  common: 'rgba(161, 161, 170, 0.3)',
  uncommon: 'rgba(74, 222, 128, 0.35)',
  rare: 'rgba(59, 130, 246, 0.4)',
  epic: 'rgba(168, 85, 247, 0.4)',
  legendary: 'rgba(245, 158, 11, 0.5)',
};
