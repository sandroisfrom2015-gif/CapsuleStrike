import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { PlayerData, WeaponId } from '@/game/types';
import { SKINS } from '@/game/skins';
import { rollCaseSkin } from '@/game/weaponSkins';

const DEFAULT_DATA: PlayerData = {
  coins: 0,
  equippedSkin: 'default',
  ownedSkins: ['default'],
  gamesPlayed: 0,
  cases: 0,
  keys: 0,
  ownedWeaponSkins: [],
  equippedWeaponSkins: {},
};

export function usePlayerData(userId: string | null) {
  const [data, setData] = useState<PlayerData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setData(DEFAULT_DATA);
      setLoading(false);
      return;
    }
    const { data: row, error } = await supabase
      .from('player_profiles')
      .select('coins, equipped_skin, owned_skins, games_played, cases, keys, owned_weapon_skins, equipped_weapon_skins')
      .eq('id', userId)
      .maybeSingle();

    if (error || !row) {
      setLoading(false);
      return;
    }
    setData({
      coins: row.coins as number,
      equippedSkin: row.equipped_skin as string,
      ownedSkins: row.owned_skins as string[],
      gamesPlayed: row.games_played as number,
      cases: row.cases as number,
      keys: row.keys as number,
      ownedWeaponSkins: row.owned_weapon_skins as string[],
      equippedWeaponSkins: row.equipped_weapon_skins as Partial<Record<WeaponId, string>>,
    });
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const addCoins = useCallback(async (amount: number) => {
    if (!userId) return false;
    const newCoins = Math.max(0, data.coins + amount);
    const { error } = await supabase
      .from('player_profiles')
      .update({ coins: newCoins })
      .eq('id', userId);
    if (!error) setData((d) => ({ ...d, coins: newCoins }));
    return !error;
  }, [userId, data.coins]);

  const buySkin = useCallback(async (skinId: string) => {
    if (!userId) return false;
    if (data.ownedSkins.includes(skinId)) return false;
    const skin = SKINS.find((s) => s.id === skinId);
    if (!skin) return false;
    if (data.coins < skin.price) return false;
    const newCoins = data.coins - skin.price;
    const newOwned = [...data.ownedSkins, skinId];
    const { error } = await supabase
      .from('player_profiles')
      .update({ coins: newCoins, owned_skins: newOwned })
      .eq('id', userId);
    if (!error) setData((d) => ({ ...d, coins: newCoins, ownedSkins: newOwned }));
    return !error;
  }, [userId, data.coins, data.ownedSkins]);

  const equipSkin = useCallback(async (skinId: string) => {
    if (!userId) return false;
    if (!data.ownedSkins.includes(skinId)) return false;
    const { error } = await supabase
      .from('player_profiles')
      .update({ equipped_skin: skinId })
      .eq('id', userId);
    if (!error) setData((d) => ({ ...d, equippedSkin: skinId }));
    return !error;
  }, [userId, data.ownedSkins]);

  const recordGamePlayed = useCallback(async (mode: 'bots' | 'online' = 'bots') => {
    if (!userId) return { caseAwarded: false, keyAwarded: false, newGamesPlayed: 0 };
    const newGamesPlayed = data.gamesPlayed + 1;
    const updates: Record<string, number> = { games_played: newGamesPlayed };
    let newKeys = data.keys;
    let newCases = data.cases;

    if (mode === 'online') {
      // 1 online match = 1 key + 1 case
      newKeys += 1;
      newCases += 1;
      updates.keys = newKeys;
      updates.cases = newCases;
    } else {
      // bots: every 3 matches = key, every 5 matches = case
      if (newGamesPlayed % 3 === 0) {
        newKeys += 1;
        updates.keys = newKeys;
      }
      if (newGamesPlayed % 5 === 0) {
        newCases += 1;
        updates.cases = newCases;
      }
    }

    const { error } = await supabase
      .from('player_profiles')
      .update(updates)
      .eq('id', userId);
    if (!error) {
      setData((d) => ({
        ...d,
        gamesPlayed: newGamesPlayed,
        keys: newKeys,
        cases: newCases,
      }));
    }
    return { caseAwarded: newCases > data.cases, keyAwarded: newKeys > data.keys, newGamesPlayed };
  }, [userId, data.gamesPlayed, data.cases, data.keys]);

  const openCase = useCallback(async (): Promise<{ skinId: string } | null> => {
    if (!userId) return null;
    if (data.cases < 1 || data.keys < 1) return null;
    const skin = rollCaseSkin();
    const newCases = data.cases - 1;
    const newKeys = data.keys - 1;
    const newOwned = data.ownedWeaponSkins.includes(skin.id)
      ? data.ownedWeaponSkins
      : [...data.ownedWeaponSkins, skin.id];
    const { error } = await supabase
      .from('player_profiles')
      .update({ cases: newCases, keys: newKeys, owned_weapon_skins: newOwned })
      .eq('id', userId);
    if (error) return null;
    setData((d) => ({
      ...d,
      cases: newCases,
      keys: newKeys,
      ownedWeaponSkins: newOwned,
    }));
    return { skinId: skin.id };
  }, [userId, data.cases, data.keys, data.ownedWeaponSkins]);

  const equipWeaponSkin = useCallback(async (weaponId: WeaponId, skinId: string) => {
    if (!userId) return false;
    if (!data.ownedWeaponSkins.includes(skinId)) return false;
    const newEquipped = { ...data.equippedWeaponSkins, [weaponId]: skinId };
    const { error } = await supabase
      .from('player_profiles')
      .update({ equipped_weapon_skins: newEquipped })
      .eq('id', userId);
    if (!error) setData((d) => ({ ...d, equippedWeaponSkins: newEquipped }));
    return !error;
  }, [userId, data.ownedWeaponSkins, data.equippedWeaponSkins]);

  const equipSkinToWeapon = useCallback(async (skinId: string, weaponId: WeaponId) => {
    if (!userId) return false;
    if (!data.ownedSkins.includes(skinId)) return false;
    const prefixedId = `player:${skinId}`;
    const newEquipped = { ...data.equippedWeaponSkins, [weaponId]: prefixedId };
    const { error } = await supabase
      .from('player_profiles')
      .update({ equipped_weapon_skins: newEquipped })
      .eq('id', userId);
    if (!error) setData((d) => ({ ...d, equippedWeaponSkins: newEquipped }));
    return !error;
  }, [userId, data.ownedSkins, data.equippedWeaponSkins]);

  const buyCase = useCallback(async (cost = 10) => {
    if (!userId) return false;
    if (data.coins < cost) return false;
    const newCoins = data.coins - cost;
    const newCases = data.cases + 1;
    const { error } = await supabase
      .from('player_profiles')
      .update({ coins: newCoins, cases: newCases })
      .eq('id', userId);
    if (!error) setData((d) => ({ ...d, coins: newCoins, cases: newCases }));
    return !error;
  }, [userId, data.coins, data.cases]);

  const redeemCode = useCallback(async (code: string): Promise<{ ok: boolean; message: string }> => {
    if (!userId) return { ok: false, message: 'Not signed in' };
    const normalized = code.trim().toLowerCase();
    const REWARDS: Record<string, { coins?: number; cases?: number; keys?: number; label: string }> = {
      beta1: { cases: 10, label: '10 crates' },
      freekeys: { keys: 10, label: '10 keys' },
      somecoins: { coins: 10, label: '10 coins' },
      welcome: { coins: 5, cases: 2, keys: 2, label: '5 coins, 2 crates, 2 keys' },
      bigspender: { coins: 25, label: '25 coins' },
      cratestack: { cases: 15, label: '15 crates' },
      keymaster: { keys: 15, label: '15 keys' },
      luckydrop: { cases: 5, keys: 5, label: '5 crates, 5 keys' },
      jackpot: { coins: 50, cases: 10, keys: 10, label: '50 coins, 10 crates, 10 keys' },
    };
    const reward = REWARDS[normalized];
    if (!reward) return { ok: false, message: 'Invalid code' };

    const { data: existing } = await supabase
      .from('redeemed_codes')
      .select('id')
      .eq('user_id', userId)
      .eq('code', normalized)
      .maybeSingle();
    if (existing) return { ok: false, message: 'Code already redeemed' };

    const { error: insertErr } = await supabase
      .from('redeemed_codes')
      .insert({ user_id: userId, code: normalized });
    if (insertErr) return { ok: false, message: 'Could not redeem code' };

    const updates: Record<string, number> = {};
    const newCoins = reward.coins ? data.coins + reward.coins : data.coins;
    const newCases = reward.cases ? data.cases + reward.cases : data.cases;
    const newKeys = reward.keys ? data.keys + reward.keys : data.keys;
    if (reward.coins) updates.coins = newCoins;
    if (reward.cases) updates.cases = newCases;
    if (reward.keys) updates.keys = newKeys;

    const { error: updateErr } = await supabase
      .from('player_profiles')
      .update(updates)
      .eq('id', userId);
    if (updateErr) return { ok: false, message: 'Reward failed to apply' };

    setData((d) => ({
      ...d,
      coins: reward.coins ? newCoins : d.coins,
      cases: reward.cases ? newCases : d.cases,
      keys: reward.keys ? newKeys : d.keys,
    }));
    return { ok: true, message: `Redeemed ${reward.label}!` };
  }, [userId, data.coins, data.cases, data.keys]);

  return { data, loading, addCoins, buySkin, buyCase, equipSkin, recordGamePlayed, openCase, equipWeaponSkin, equipSkinToWeapon, redeemCode, reload: load };
}
