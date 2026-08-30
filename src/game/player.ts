import * as THREE from 'three';
import type { SkinDef, Team } from './types';

export const PLAYER_HEIGHT = 1.8;
export const PLAYER_RADIUS = 0.4;
export const EYE_HEIGHT = 1.6;

export const TEAM_COLORS: Record<Team, { primary: number; ring: number; name: string }> = {
  ct: { primary: 0x3b82f6, ring: 0x3b82f6, name: 'SWAT' },
  t: { primary: 0xef4444, ring: 0xef4444, name: 'Terrorist' },
};

export interface CapsulePlayer {
  id: string;
  team: Team;
  aiArmsRaceLevel: number;
  aiKills: number;
  aiArmsRaceKillsAtLevel: number;
  respawnTimer: number;
  isBot: boolean;
  alive: boolean;
  health: number;
  armor: number;
  hasHelmet: boolean;
  hasVest: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;
  mesh: THREE.Group;
  bodyMat: THREE.MeshStandardMaterial;
  topMat: THREE.MeshStandardMaterial;
  bottomMat: THREE.MeshStandardMaterial;
  bandMat: THREE.MeshStandardMaterial;
  nameTag?: THREE.Sprite;
  // bot ai state
  aiTarget?: THREE.Vector3;
  aiRetargetTimer?: number;
  aiFireTimer?: number;
  aiWeapon?: string;
  aiReloadTimer?: number;
  aiAmmo?: number;
  aiMagSize?: number;
  aiState?: 'roam' | 'engage' | 'retreat';
  aiRespawnTimer?: number;
  kills?: number;
  hitFlash?: number;
}

export function createCapsulePlayer(
  id: string,
  team: Team,
  isBot: boolean,
  skin: SkinDef,
): CapsulePlayer {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: skin.colors.body, roughness: 0.6 });
  const topMat = new THREE.MeshStandardMaterial({ color: skin.colors.top, roughness: 0.6 });
  const bottomMat = new THREE.MeshStandardMaterial({ color: skin.colors.bottom, roughness: 0.6 });
  const bandMat = new THREE.MeshStandardMaterial({
    color: TEAM_COLORS[team].primary,
    roughness: 0.5,
    emissive: TEAM_COLORS[team].primary,
    emissiveIntensity: 0.3,
  });

  // Capsule body (cylinder + two hemispheres) — no head
  const bodyHeight = 1.0;
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(PLAYER_RADIUS, bodyHeight, 6, 12),
    bodyMat,
  );
  body.position.y = PLAYER_HEIGHT / 2;
  body.castShadow = true;
  group.add(body);

  // Team-colored band around the upper body
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(PLAYER_RADIUS + 0.03, PLAYER_RADIUS + 0.03, 0.22, 16),
    bandMat,
  );
  band.position.y = PLAYER_HEIGHT * 0.72;
  group.add(band);

  // Team indicator ring at feet
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.7, 24),
    new THREE.MeshBasicMaterial({ color: TEAM_COLORS[team].ring, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  group.add(ring);

  return {
    id,
    team,
    isBot,
    alive: true,
    health: 100,
    armor: 0,
    hasHelmet: false,
    hasVest: false,
    aiArmsRaceLevel: 0,
    aiKills: 0,
    aiArmsRaceKillsAtLevel: 0,
    respawnTimer: 0,
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    yaw: 0,
    mesh: group,
    bodyMat,
    topMat,
    bottomMat,
    bandMat,
  };
}

export function applySkin(player: CapsulePlayer, skin: SkinDef) {
  player.bodyMat.color.setHex(skin.colors.body);
  player.topMat.color.setHex(skin.colors.top);
  player.bottomMat.color.setHex(skin.colors.bottom);
}

export function flashHit(player: CapsulePlayer) {
  player.hitFlash = 0.12;
}
