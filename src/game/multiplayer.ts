import { supabase } from '@/lib/supabase';
import type { Team, MapId } from './types';
import * as THREE from 'three';

export interface RemotePlayerState {
  id: string;
  username: string;
  team: Team;
  position: { x: number; y: number; z: number };
  yaw: number;
  pitch: number;
  health: number;
  alive: boolean;
  skinId: string;
  currentWeapon: string;
  isShooting: boolean;
  lastUpdate: number;
}

export interface ShotEvent {
  shooterId: string;
  origin: { x: number; y: number; z: number };
  dir: { x: number; y: number; z: number };
  weapon: string;
  timestamp: number;
}

export interface HitEvent {
  targetId: string;
  shooterId: string;
  damage: number;
  timestamp: number;
}

type Listener = (players: Map<string, RemotePlayerState>) => void;
type ShotListener = (shot: ShotEvent) => void;
type HitListener = (hit: HitEvent) => void;
type StateListener = (state: 'lobby' | 'playing' | 'ended') => void;
type VoteListener = (votes: Record<string, MapId>) => void;
type MapChosenListener = (mapId: MapId) => void;

export class MultiplayerManager {
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private roomId: string;
  private userId: string;
  private username: string;
  private team: Team;
  private skinId: string;
  private remotePlayers = new Map<string, RemotePlayerState>();
  private listeners = new Set<Listener>();
  private shotListeners = new Set<ShotListener>();
  private hitListeners = new Set<HitListener>();
  private stateListeners = new Set<StateListener>();
  private voteListeners = new Set<VoteListener>();
  private mapChosenListeners = new Set<MapChosenListener>();
  private chatListeners = new Set<(text: string, team: boolean, sender: string) => void>();

  onChatMessage(l: (text: string, team: boolean, sender: string) => void) { this.chatListeners.add(l); return () => this.chatListeners.delete(l); }

  private bombListeners = new Set<(action: string, pos: { x: number; y: number; z: number }, site?: string) => void>();
  onBombEvent(l: (action: string, pos: { x: number; y: number; z: number }, site?: string) => void) { this.bombListeners.add(l); return () => this.bombListeners.delete(l); }

  broadcastBomb(action: string, pos: THREE.Vector3, site?: string) {
    if (!this.channel) return;
    this.channel.send({ type: 'broadcast', event: 'bomb', payload: { action, pos: { x: pos.x, y: pos.y, z: pos.z }, site, userId: this.userId } });
  }

  private votes: Record<string, MapId> = {};
  private state: 'lobby' | 'playing' | 'ended' = 'lobby';

  private notifyListeners() {
    const copy = new Map(this.remotePlayers);
    this.listeners.forEach((l) => l(copy));
  }
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(roomId: string, userId: string, username: string, team: Team, skinId: string) {
    this.roomId = roomId;
    this.userId = userId;
    this.username = username;
    this.team = team;
    this.skinId = skinId;
  }

  async join(): Promise<void> {
    this.channel = supabase.channel(`room:${this.roomId}`, {
      config: { broadcast: { self: false }, presence: { key: this.userId } },
    });

    this.channel
      .on('presence', { event: 'sync' }, () => {
        const state = this.channel!.presenceState();
        const seen = new Set<string>();
        for (const [key, metas] of Object.entries(state)) {
          seen.add(key);
          const meta = metas[metas.length - 1] as unknown as {
            id: string;
            username: string;
            team: Team;
            skinId: string;
          };
          if (key !== this.userId && !this.remotePlayers.has(key)) {
            this.remotePlayers.set(key, {
              id: key,
              username: meta.username,
              team: meta.team,
              position: { x: 0, y: 1, z: 0 },
              yaw: 0,
              pitch: 0,
              health: 100,
              alive: true,
              skinId: meta.skinId,
              currentWeapon: 'glock',
              isShooting: false,
              lastUpdate: Date.now(),
            });
            this.notifyListeners();
          }
        }
        for (const id of [...this.remotePlayers.keys()]) {
          if (!seen.has(id)) {
            this.remotePlayers.delete(id);
            this.notifyListeners();
          }
        }
      })
      .on('broadcast', { event: 'move' }, (payload: { payload: Partial<RemotePlayerState> & { id: string } }) => {
        const p = payload.payload;
        if (p.id === this.userId) return;
        const existing = this.remotePlayers.get(p.id);
        if (existing) {
          if (p.position) existing.position = p.position;
          if (p.yaw !== undefined) existing.yaw = p.yaw;
          if (p.pitch !== undefined) existing.pitch = p.pitch;
          if (p.health !== undefined) existing.health = p.health;
          if (p.alive !== undefined) existing.alive = p.alive;
          if (p.currentWeapon) existing.currentWeapon = p.currentWeapon;
          if (p.isShooting !== undefined) existing.isShooting = p.isShooting;
          existing.lastUpdate = Date.now();
          this.notifyListeners();
        }
      })
      .on('broadcast', { event: 'shot' }, (payload: { payload: ShotEvent }) => {
        if (payload.payload.shooterId === this.userId) return;
        this.shotListeners.forEach((l) => l(payload.payload));
      })
      .on('broadcast', { event: 'hit' }, (payload: { payload: HitEvent }) => {
        if (payload.payload.targetId !== this.userId) return;
        this.hitListeners.forEach((l) => l(payload.payload));
      })
      .on('broadcast', { event: 'state' }, (payload: { payload: { state: 'lobby' | 'playing' | 'ended' } }) => {
        this.setState(payload.payload.state);
      })
      .on('broadcast', { event: 'mapvote' }, (payload: { payload: { voterId: string; mapId: MapId } }) => {
        this.votes[payload.payload.voterId] = payload.payload.mapId;
        this.voteListeners.forEach((l) => l({ ...this.votes }));
      })
      .on('broadcast', { event: 'mapchosen' }, (payload: { payload: { mapId: MapId } }) => {
        this.mapChosenListeners.forEach((l) => l(payload.payload.mapId));
      })
      .on('broadcast', { event: 'chat' }, (payload: { payload: { text: string; team: boolean; sender: string; senderId: string } }) => {
        if (payload.payload.senderId === this.userId) return;
        this.chatListeners.forEach((l) => l(payload.payload.text, payload.payload.team, payload.payload.sender));
      })
      .on('broadcast', { event: 'bomb' }, (payload: { payload: { action: string; pos: { x: number; y: number; z: number }; site?: string; userId: string } }) => {
        if (payload.payload.userId === this.userId) return;
        this.bombListeners.forEach((l) => l(payload.payload.action, payload.payload.pos, payload.payload.site));
      });

    await this.channel.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await this.channel!.track({
          id: this.userId,
          username: this.username,
          team: this.team,
          skinId: this.skinId,
        });
      }
    });

    this.syncInterval = setInterval(() => {
      this.broadcastMove();
    }, 50);

    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, p] of this.remotePlayers) {
        if (now - p.lastUpdate > 10000) {
          this.remotePlayers.delete(id);
          changed = true;
        }
      }
      if (changed) this.notifyListeners();
    }, 2000);
  }

  private broadcastMove() {
    // called by engine via updateLocalState
  }

  updateLocalState(
    position: { x: number; y: number; z: number },
    yaw: number,
    pitch: number,
    health: number,
    alive: boolean,
    currentWeapon: string,
    isShooting: boolean,
  ) {
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: 'move',
      payload: {
        id: this.userId,
        position,
        yaw,
        pitch,
        health,
        alive,
        currentWeapon,
        isShooting,
      },
    });
  }

  broadcastShot(origin: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }, weapon: string) {
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: 'shot',
      payload: { shooterId: this.userId, origin, dir, weapon, timestamp: Date.now() },
    });
  }

  broadcastHit(targetId: string, damage: number) {
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: 'hit',
      payload: { targetId, shooterId: this.userId, damage, timestamp: Date.now() },
    });
  }

  broadcastState(state: 'lobby' | 'playing' | 'ended') {
    if (!this.channel) return;
    this.channel.send({ type: 'broadcast', event: 'state', payload: { state } });
    this.setState(state);
  }

  voteMap(mapId: MapId) {
    if (!this.channel) return;
    this.votes[this.userId] = mapId;
    this.channel.send({ type: 'broadcast', event: 'mapvote', payload: { voterId: this.userId, mapId } });
    this.voteListeners.forEach((l) => l({ ...this.votes }));
  }

  broadcastMapChosen(mapId: MapId) {
    if (!this.channel) return;
    this.channel.send({ type: 'broadcast', event: 'mapchosen', payload: { mapId } });
  }

  getVotes() { return { ...this.votes }; }

  tallyVotes(): MapId {
    const counts: Record<string, number> = {};
    for (const mapId of Object.values(this.votes)) {
      counts[mapId] = (counts[mapId] ?? 0) + 1;
    }
    let best: MapId = 'dust';
    let bestCount = 0;
    for (const [mapId, count] of Object.entries(counts)) {
      if (count > bestCount) {
        best = mapId as MapId;
        bestCount = count;
      }
    }
    return best;
  }

  private setState(s: 'lobby' | 'playing' | 'ended') {
    if (this.state === s) return;
    this.state = s;
    this.stateListeners.forEach((l) => l(s));
  }

  getState() { return this.state; }
  getRemotePlayers() { return this.remotePlayers; }
  getPlayerCount() { return this.remotePlayers.size + 1; }

  onPlayersUpdate(l: Listener) { this.listeners.add(l); return () => this.listeners.delete(l); }
  onShot(l: ShotListener) { this.shotListeners.add(l); return () => this.shotListeners.delete(l); }
  onHit(l: HitListener) { this.hitListeners.add(l); return () => this.hitListeners.delete(l); }
  onStateChange(l: StateListener) { this.stateListeners.add(l); return () => this.stateListeners.delete(l); }
  onVotesUpdate(l: VoteListener) { this.voteListeners.add(l); return () => this.voteListeners.delete(l); }
  onMapChosen(l: MapChosenListener) { this.mapChosenListeners.add(l); return () => this.mapChosenListeners.delete(l); }

  broadcastChat(text: string, mode: 'global' | 'team') {
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: 'chat',
      payload: { senderId: this.userId, sender: this.username, text, team: mode === 'team', timestamp: Date.now() },
    });
  }

  onChat(cb: (text: string, team: boolean, sender: string) => void) {
    const handler = (payload: { payload: { text: string; team: boolean; sender: string; senderId: string } }) => {
      if (payload.payload.senderId === this.userId) return;
      cb(payload.payload.text, payload.payload.team, payload.payload.sender);
    };
    this.channel?.on('broadcast', { event: 'chat' }, handler);
    return () => this.channel?.unsubscribe();
  }

  leave() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.channel) {
      this.channel.untrack();
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.listeners.clear();
    this.shotListeners.clear();
    this.hitListeners.clear();
    this.stateListeners.clear();
    this.voteListeners.clear();
    this.mapChosenListeners.clear();
    this.bombListeners.clear();
    this.remotePlayers.clear();
    this.votes = {};
  }
}

export function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function quickJoinRoom(userId: string, username: string, team: Team, skinId: string): Promise<{ manager: MultiplayerManager; roomId: string; isHost: boolean }> {
  const { data: rooms, error } = await supabase
    .from('quick_join_rooms')
    .select('room_id, host_id')
    .eq('status', 'lobby')
    .neq('host_id', userId)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) throw error;

  if (rooms && rooms.length > 0) {
    const roomId = rooms[0].room_id as string;
    const manager = new MultiplayerManager(roomId, userId, username, team, skinId);
    await manager.join();
    return { manager, roomId, isHost: false };
  }

  const roomId = generateRoomId();
  const { error: insertError } = await supabase
    .from('quick_join_rooms')
    .insert({ room_id: roomId, host_id: userId, host_username: username, status: 'lobby' });

  if (insertError) throw insertError;

  const manager = new MultiplayerManager(roomId, userId, username, team, skinId);
  await manager.join();
  return { manager, roomId, isHost: true };
}

export async function setQuickJoinRoomStatus(roomId: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('quick_join_rooms')
    .update({ status })
    .eq('room_id', roomId);
  if (error) throw error;
}

export async function removeQuickJoinRoom(roomId: string): Promise<void> {
  const { error } = await supabase
    .from('quick_join_rooms')
    .delete()
    .eq('room_id', roomId);
  if (error) throw error;
}
