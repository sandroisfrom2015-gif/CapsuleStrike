import * as THREE from 'three';
import { WEAPONS } from './weapons';
import type { WeaponId, GameMode, GameType, HudState, MatchResult, Team, CrosshairSettings, PlayerHudInfo } from './types';
import { buildMap, buildRangeMap, type MapDef, type BombSite } from './map';
import {
  createCapsulePlayer,
  applySkin,
  flashHit,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  EYE_HEIGHT,
  type CapsulePlayer,
} from './player';
import { getSkin } from './skins';
import { getWeaponSkin, type WeaponSkinDef } from './weaponSkins';
import type { MultiplayerManager, RemotePlayerState } from './multiplayer';
import type { MapId } from './types';

interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  shoot: boolean;
  reload: boolean;
  zoom: boolean;
  crouch: boolean;
  rightClick: boolean;
}

interface Bullet {
  from: THREE.Vector3;
  to: THREE.Vector3;
  life: number;
}

interface TargetMesh {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  alive: boolean;
  respawnTimer: number;
}

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private map!: MapDef;
  private mode: GameMode;
  private gameType: GameType;
  private username = 'Player';
  private skinId: string;

  private players: CapsulePlayer[] = [];
  private localPlayer!: CapsulePlayer;
  private bullets: Bullet[] = [];
  private bulletLines: THREE.Line[] = [];
  private targetMeshes: TargetMesh[] = [];
  private muzzleFlash?: THREE.PointLight;

  // input
  private input: InputState = {
    forward: false, back: false, left: false, right: false,
    jump: false, shoot: false, reload: false, zoom: false, crouch: false, rightClick: false,
  };
  private mouseDelta = { x: 0, y: 0 };
  private yaw = 0;
  private pitch = 0;
  private isPointerLocked = false;

  // weapon state (local)
  private currentWeapon: WeaponId = 'glock';
  private ownedWeapons: WeaponId[] = ['knife', 'glock'];
  private ammo: Record<WeaponId, number> = {} as Record<WeaponId, number>;
  private reserve: Record<WeaponId, number> = {} as Record<WeaponId, number>;
  private fireCooldown = 0;
  private reloadTimer = 0;
  private isReloading = false;
  private isZoomed = false;
  private isCrouched = false;
  private currentEyeHeight = EYE_HEIGHT;
  private money = 800;
  private baseFov = 75;

  // weapon viewmodel (attached to camera)
  private viewmodel = new THREE.Group();
  private viewmodelRecoil = 0;
  private viewmodelBob = 0;

  // match state
  private roundsToWin = 7;
  private roundsWon = 0;
  private roundsLost = 0;
  private round = 1;
  private buyPhase = true;
  private buyTimer = 8;
  private roundTimer = 0;
  private roundActive = false;
  private matchOver = false;
  private matchWon = false;
  private kills = 0;
  private deaths = 0;
  private teamKills = 0;
  private enemyKills = 0;
  private killTarget = 50;
  private message = '';
  private messageTimer = 0;
  private roundEndTimer = 0;
  private coinsEarned = 0;
  private respawnTimer = 0;
  private killStreak = 0;
  private spectating = false;
  private spectateIndex = 0;
  private spectateName = '';
  private droppedWeapons: { mesh: THREE.Group; pos: THREE.Vector3; weaponId: WeaponId; life: number }[] = [];
  // bomb state
  private bombPlanted = false;
  private bombSite: string = '';
  private bombTimer = 0;
  private bombDefuseTimer = 0;
  private defusing = false;
  private bombMesh: THREE.Mesh | null = null;
  private bombCarrier: CapsulePlayer | null = null;
  private bombPlantedPos: THREE.Vector3 | null = null;
  private planting = false;
  private plantProgress = 0;
  private droppedBomb: { mesh: THREE.Group; pos: THREE.Vector3; label: THREE.Sprite } | null = null;
  private bombPulseTime = 0;
  private bombTickAccum = 0;
  private inspecting = false;
  private inspectTimer = 0;
  private chatOpenState = false;
  private chatModeState: 'global' | 'team' = 'global';
  private chatInputState = '';
  private chatMessages: { text: string; team: boolean; sender: string; time: number }[] = [];
  private onChatUpdate?: () => void;
  private armsRaceLevel = 0;
  private armsRaceKillsAtLevel = 0;
  private static readonly ARMS_RACE_PROGRESS: WeaponId[] = ['glock', 'mp5', 'mp7', 'm4', 'ak47', 'awp', 'deagle', 'knife'];

  private bhopVelocity = 0;
  private hideSeekTimer = 0;
  private hideSeekPhase = '';
  private hideSeekBoxOpen = false;

  private container: HTMLElement;
  private rafId = 0;
  private onHud: (hud: HudState) => void;
  private onMatchEnd: (result: MatchResult) => void;
  private onExit: () => void;
  private onMenuToggle: () => void;
  private menuOpen = false;
  private playerTeam: Team;
  private settings: { sensitivity: number; volume: number; controlMode: 'pc' | 'mobile'; crosshair: CrosshairSettings };

  private audioCtx?: AudioContext;

  // multiplayer
  private mp: MultiplayerManager | null = null;
  private remoteMeshes = new Map<string, CapsulePlayer>();
  private mpSyncTimer = 0;
  private pendingHitDamage = 0;

  private mapId: MapId;
  private equippedWeaponSkins: Partial<Record<WeaponId, string>>;

  constructor(opts: {
    container: HTMLElement;
    mode: GameMode;
    skinId: string;
    playerTeam: Team;
    settings: { sensitivity: number; volume: number; controlMode: 'pc' | 'mobile'; crosshair: CrosshairSettings };
    onHud: (hud: HudState) => void;
    onMatchEnd: (result: MatchResult) => void;
    onExit: () => void;
    onMenuToggle: () => void;
    multiplayer?: MultiplayerManager;
    mapId?: MapId;
    equippedWeaponSkins?: Partial<Record<WeaponId, string>>;
    gameType?: GameType;
    username?: string;
  }) {
    this.container = opts.container;
    this.mode = opts.mode;
    this.gameType = opts.gameType ?? 'defusal';
    this.skinId = opts.skinId;
    this.playerTeam = opts.playerTeam;
    this.username = opts.username ?? 'Player';
    this.onHud = opts.onHud;
    this.onMatchEnd = opts.onMatchEnd;
    this.onExit = opts.onExit;
    this.onMenuToggle = opts.onMenuToggle;
    this.settings = opts.settings;
    this.mp = opts.multiplayer ?? null;
    this.mapId = opts.mapId ?? 'dust';
    this.equippedWeaponSkins = opts.equippedWeaponSkins ?? {};

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.baseFov, window.innerWidth / window.innerHeight, 0.05, 500);

    this.muzzleFlash = new THREE.PointLight(0xffcc66, 0, 8);
    this.scene.add(this.muzzleFlash);

    // camera must be in the scene so its child (viewmodel) renders
    this.scene.add(this.camera);
    this.camera.add(this.viewmodel);

    this.init();
  }

  private init() {
    if (this.mode === 'range') {
      this.map = buildRangeMap(this.scene);
      this.setupRange();
    } else {
      this.map = buildMap(this.scene, this.mapId);
      this.setupMatch();
    }

    this.initAmmo();
    this.buildViewmodel();
    this.bindEvents();
    this.emitHud();
    this.loop();
  }

  private initAmmo() {
    for (const id of Object.keys(WEAPONS) as WeaponId[]) {
      this.ammo[id] = WEAPONS[id].magSize;
      this.reserve[id] = WEAPONS[id].reserveAmmo;
    }
  }

  private setupRange() {
    this.localPlayer = createCapsulePlayer('local', this.playerTeam, false, getSkin(this.skinId));
    this.localPlayer.position.copy(this.map.spawnCT[0]);
    this.scene.add(this.localPlayer.mesh);
    this.players = [this.localPlayer];

    // Targets
    const targetMat = new THREE.MeshStandardMaterial({ color: 0xe07050, roughness: 0.6 });
    for (const pos of this.map.targets) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), targetMat.clone());
      mesh.position.copy(pos);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.targetMeshes.push({ mesh, pos: pos.clone(), alive: true, respawnTimer: 0 });
    }
    this.money = 99999;
    this.buyPhase = false;
    this.roundActive = true;
    this.message = 'Shooting Range — practice freely';
    this.messageTimer = 3;
  }

  private setupMatch() {
    const skin = getSkin(this.skinId);
    // FFA: everyone is on their own "team" — assign unique team per player
    if (this.gameType === 'ffa') {
      this.localPlayer = createCapsulePlayer('local', this.playerTeam, false, skin);
      this.scene.add(this.localPlayer.mesh);
      this.players = [this.localPlayer];
      if (this.mode === 'online') {
        this.startDeathmatch();
        return;
      }
      // Bots in FFA — each gets a unique team label
      const botTeams: Team[] = ['ct', 't'];
      for (let i = 0; i < 7; i++) {
        const botTeam = botTeams[i % 2];
        const bot = createCapsulePlayer(`ffa_bot_${i}`, botTeam, true, getSkin('default'));
        this.scene.add(bot.mesh);
        this.players.push(bot);
      }
      this.startDeathmatch();
      return;
    }

    // TDM and Defusal both use teams
    this.localPlayer = createCapsulePlayer('local', this.playerTeam, false, skin);
    this.scene.add(this.localPlayer.mesh);
    this.players = [this.localPlayer];

    if (this.mode === 'online') {
      if (this.gameType === 'tdm') this.startDeathmatch();
      else this.startRound(true);
      return;
    }

    const teamSize = 4;
    const enemyTeam: Team = this.playerTeam === 'ct' ? 't' : 'ct';
    for (let i = 0; i < teamSize - 1; i++) {
      const bot = createCapsulePlayer(`ally_bot_${i}`, this.playerTeam, true, getSkin('default'));
      this.scene.add(bot.mesh);
      this.players.push(bot);
    }
    for (let i = 0; i < teamSize; i++) {
      const bot = createCapsulePlayer(`enemy_bot_${i}`, enemyTeam, true, getSkin('default'));
      this.scene.add(bot.mesh);
      this.players.push(bot);
    }

    if (this.gameType === 'armsrace') {
      this.startArmsRace();
      return;
    }
    if (this.gameType === 'tdm') this.startDeathmatch();
    else this.startRound(true);
  }

  private startArmsRace() {
    this.buyPhase = false;
    this.roundActive = true;
    this.roundTimer = 0;
    this.round = 1;
    this.money = 99999;
    this.armsRaceLevel = 0;
    this.armsRaceKillsAtLevel = 0;
    this.respawnAllPlayers();
    this.currentWeapon = Game.ARMS_RACE_PROGRESS[0];
    this.ownedWeapons = ['knife', this.currentWeapon];
    this.buildViewmodel();
    this.message = 'Arms Race — 2 kills upgrade your weapon. Gold knife kill wins!';
    this.messageTimer = 4;
    this.emitHud();
  }

  private updateArmsRace(dt: number) {
    if (this.matchOver) return;
    this.roundTimer += dt;
    // Check win condition
    if (this.armsRaceLevel >= Game.ARMS_RACE_PROGRESS.length - 1) {
      // On gold knife level — first kill wins
      if (this.kills > 0 && this.kills > this.armsRaceKillsAtLevel) {
        this.matchOver = true;
        this.matchWon = true;
        this.endMatch();
        return;
      }
    }
    // Check for level up
    const killsAtLevel = this.kills - this.armsRaceKillsAtLevel;
    if (killsAtLevel >= 2 && this.armsRaceLevel < Game.ARMS_RACE_PROGRESS.length - 1) {
      this.armsRaceLevel++;
      this.armsRaceKillsAtLevel = this.kills;
      const newWeapon = Game.ARMS_RACE_PROGRESS[this.armsRaceLevel];
      this.currentWeapon = newWeapon;
      if (!this.ownedWeapons.includes(newWeapon)) this.ownedWeapons.push(newWeapon);
      this.ammo[newWeapon] = WEAPONS[newWeapon].magSize;
      this.reserve[newWeapon] = WEAPONS[newWeapon].reserveAmmo;
      this.buildViewmodel();
      const isLast = this.armsRaceLevel === Game.ARMS_RACE_PROGRESS.length - 1;
      this.message = isLast ? 'GOLD KNIFE! Get a kill to win!' : `Upgraded to ${WEAPONS[newWeapon].name}!`;
      this.messageTimer = 2;
    }
    // Check if any bot reached gold knife kill
    for (const p of this.players) {
      if (p.isBot && p.aiArmsRaceLevel >= Game.ARMS_RACE_PROGRESS.length - 1 && p.aiKills > p.aiArmsRaceKillsAtLevel) {
        this.matchOver = true;
        this.matchWon = false;
        this.endMatch();
        return;
      }
    }
    // Respawn dead players after delay
    for (const p of this.players) {
      if (!p.alive && p.respawnTimer > 0) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) this.respawnPlayer(p);
      }
    }
  }

  private startDeathmatch() {
    this.buyPhase = false;
    this.roundActive = true;
    this.roundTimer = 0;
    this.round = 1;
    this.money = 99999;
    this.respawnAllPlayers();
    this.message = this.gameType === 'ffa' ? 'Free For All — First to 50 kills!' : 'Team Deathmatch — First to 50 kills!';
    this.messageTimer = 3;
    this.emitHud();
  }

  private respawnAllPlayers() {
    const ctSpawns = this.map.spawnCT.filter((s) => !this.isOnBombSite(s));
    const tSpawns = this.map.spawnT.filter((s) => !this.isOnBombSite(s));
    const ffaSpawns = this.map.ffaSpawns.filter((s) => !this.isOnBombSite(s));
    const ctPool = ctSpawns.length > 0 ? ctSpawns : this.map.spawnCT;
    const tPool = tSpawns.length > 0 ? tSpawns : this.map.spawnT;
    const ffaPool = ffaSpawns.length > 0 ? ffaSpawns : this.map.ffaSpawns;
    let ci = 0, ti = 0, fi = 0;
    for (const p of this.players) {
      p.alive = true;
      p.health = 100;
      p.armor = 0;
      p.hasHelmet = false;
      p.hasVest = false;
      p.velocity.set(0, 0, 0);
      if (this.gameType === 'ffa' && ffaPool.length > 0) {
        p.position.copy(ffaPool[fi % ffaPool.length]);
        fi++;
      } else if (p.team === 'ct') {
        p.position.copy(ctPool[ci % ctPool.length]);
        ci++;
      } else {
        p.position.copy(tPool[ti % tPool.length]);
        ti++;
      }
      p.mesh.visible = true;
      if (p.isBot) {
        const bw = this.pickBotWeapon();
        p.aiWeapon = bw;
        p.aiAmmo = WEAPONS[bw as WeaponId].magSize;
        p.aiMagSize = WEAPONS[bw as WeaponId].magSize;
        p.aiReloadTimer = 0;
        p.aiState = 'roam';
        p.aiRetargetTimer = 0;
      }
    }
  }

  private isOnBombSite(pos: THREE.Vector3): boolean {
    for (const site of this.map.bombSites) {
      if (pos.distanceTo(site.center) < site.radius + 3) return true;
    }
    return false;
  }

  private pickSafeSpawn(spawns: THREE.Vector3[]): THREE.Vector3 {
    const safe = spawns.filter((s) => !this.isOnBombSite(s));
    const pool = safe.length > 0 ? safe : spawns;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private respawnPlayer(p: CapsulePlayer) {
    p.alive = true;
    p.health = 100;
    p.armor = 0;
    p.hasHelmet = false;
    p.hasVest = false;
    p.velocity.set(0, 0, 0);
    if (this.gameType === 'ffa' && this.map.ffaSpawns.length > 0) {
      let bestSpawn = this.map.ffaSpawns[0];
      let bestDist = 0;
      for (const s of this.map.ffaSpawns) {
        if (this.isOnBombSite(s)) continue;
        const d = s.distanceTo(this.localPlayer.position);
        if (d > bestDist) { bestDist = d; bestSpawn = s; }
      }
      p.position.copy(bestSpawn);
    } else if (p.team === 'ct') {
      p.position.copy(this.pickSafeSpawn(this.map.spawnCT));
    } else {
      p.position.copy(this.pickSafeSpawn(this.map.spawnT));
    }
    p.mesh.visible = true;
    if (p.isBot) {
      if (this.gameType === 'armsrace') {
        p.aiWeapon = Game.ARMS_RACE_PROGRESS[p.aiArmsRaceLevel];
      } else {
        const bw = this.pickBotWeapon();
        p.aiWeapon = bw;
      }
      p.aiAmmo = WEAPONS[p.aiWeapon as WeaponId].magSize;
      p.aiMagSize = WEAPONS[p.aiWeapon as WeaponId].magSize;
      p.aiReloadTimer = 0;
      p.aiState = 'roam';
      p.aiRetargetTimer = 0;
    } else if (p === this.localPlayer && this.gameType === 'armsrace') {
      this.currentWeapon = Game.ARMS_RACE_PROGRESS[this.armsRaceLevel];
      this.ownedWeapons = ['knife', this.currentWeapon];
      this.ammo[this.currentWeapon] = WEAPONS[this.currentWeapon].magSize;
      this.reserve[this.currentWeapon] = WEAPONS[this.currentWeapon].reserveAmmo;
      this.exitSpectator();
      this.buildViewmodel();
    }
  }

  private startRound(first = false) {
    this.round = this.roundsWon + this.roundsLost + 1;
    this.buyPhase = true;
    this.buyTimer = first ? 8 : 6;
    this.roundActive = false;
    this.roundEndTimer = 0;
    this.bombPlanted = false;
    this.bombSite = '';
    this.bombTimer = 0;
    this.defusing = false;
    this.bombDefuseTimer = 0;
    this.bombCarrier = null;
    this.bombPlantedPos = null;
    this.exitSpectator();
    if (this.bombMesh) {
      this.scene.remove(this.bombMesh);
      this.bombMesh.geometry.dispose();
      (this.bombMesh.material as THREE.Material).dispose();
      this.bombMesh = null;
    }
    this.removeDroppedBomb();

    // Hide & Seek: no buy phase, special setup
    if (this.gameType === 'hideseek') {
      this.buyPhase = false;
      this.buyTimer = 0;
      this.roundActive = true;
      this.hideSeekTimer = 40; // 40 seconds hiding phase
      this.hideSeekPhase = 'Hiding';
      this.hideSeekBoxOpen = false;
      this.money = 0;
      // Give everyone knives only
      this.ownedWeapons = ['knife'];
      this.currentWeapon = 'knife';
      this.ammo['knife'] = 0;
      this.reserve['knife'] = 0;
      this.buildViewmodel();
      // Spawn players
      let ci = 0, ti = 0;
      for (const p of this.players) {
        p.alive = true;
        p.health = 100;
        p.armor = 0;
        p.hasHelmet = false;
        p.hasVest = false;
        p.velocity.set(0, 0, 0);
        if (p.team === 'ct') {
          // SWAT spawn in random map positions (hiding)
          p.position.set(
            (Math.random() - 0.5) * 80,
            1,
            (Math.random() - 0.5) * 80
          );
          ci++;
        } else {
          // Terrorists spawn at T spawn points
          p.position.copy(this.map.spawnT[ti % this.map.spawnT.length]);
          ti++;
        }
        p.mesh.visible = true;
        if (p.isBot) {
          p.aiWeapon = 'knife';
          p.aiAmmo = 0;
          p.aiMagSize = 0;
          p.aiReloadTimer = 0;
          p.aiState = 'roam';
          p.aiRetargetTimer = 0;
        }
      }
      this.message = 'Hide & Seek — SWAT hide! Terrorists wait...';
      this.messageTimer = 3;
      this.emitHud();
      return;
    }

    // Reset players — never spawn on bomb sites
    const ctSpawns = this.map.spawnCT.filter((s) => !this.isOnBombSite(s));
    const tSpawns = this.map.spawnT.filter((s) => !this.isOnBombSite(s));
    const ctPool = ctSpawns.length > 0 ? ctSpawns : this.map.spawnCT;
    const tPool = tSpawns.length > 0 ? tSpawns : this.map.spawnT;
    let ci = 0;
    let ti = 0;
    for (const p of this.players) {
      p.alive = true;
      p.health = 100;
      p.armor = 0;
      p.hasHelmet = false;
      p.hasVest = false;
      p.velocity.set(0, 0, 0);
      if (p.team === 'ct') {
        p.position.copy(ctPool[ci % ctPool.length]);
        ci++;
      } else {
        p.position.copy(tPool[ti % tPool.length]);
        ti++;
      }
      p.mesh.visible = true;
      if (p.isBot) {
        const bw = this.pickBotWeapon();
        p.aiWeapon = bw;
        p.aiAmmo = WEAPONS[bw as WeaponId].magSize;
        p.aiMagSize = WEAPONS[bw as WeaponId].magSize;
        p.aiReloadTimer = 0;
        p.aiState = 'roam';
        p.aiRetargetTimer = 0;
      }
    }
    // Give bomb to the local player if on T team (bots mode), otherwise random T
    const tPlayers = this.players.filter((p) => p.team === 't');
    if (tPlayers.length > 0) {
      if (this.mode === 'bots' && this.localPlayer.team === 't') {
        this.bombCarrier = this.localPlayer;
      } else {
        this.bombCarrier = tPlayers[Math.floor(Math.random() * tPlayers.length)];
      }
    }
    if (this.round > 1) {
      this.money = Math.min(this.money + 1400, 16000);
    }
    this.message = `Round ${this.round} — Buy phase`;
    this.messageTimer = 2;
    this.emitHud();
  }

  private pickBotWeapon(): WeaponId {
    const pool: WeaponId[] = ['glock', 'deagle', 'ak47', 'm4', 'awp', 'mp7', 'mp5'];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ---------- Input ----------

  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.addEventListener('click', this.onCanvasClick);
  }

  private onCanvasClick = () => {
    if (!this.isPointerLocked) {
      this.renderer.domElement.requestPointerLock();
    }
  };

  private onPointerLockChange = () => {
    this.isPointerLocked = document.pointerLockElement === this.renderer.domElement;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.chatOpenState) {
      if (e.code === 'Enter') { e.preventDefault(); this.submitChat(); }
      else if (e.code === 'Escape') { e.preventDefault(); this.cancelChat(); }
      else if (e.code === 'Backspace') { e.preventDefault(); this.setChatInput(this.chatInputState.slice(0, -1)); }
      else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { e.preventDefault(); this.setChatInput(this.chatInputState + e.key); }
      return;
    }
    if (this.buyOpen) {
      if (e.code === 'KeyB' || e.code === 'Escape') { e.preventDefault(); this.closeBuyMenu(); }
      return;
    }
    if (this.matchOver) {
      if (e.code === 'Enter') this.onExit();
      return;
    }
    switch (e.code) {
      case 'KeyW': this.input.forward = true; break;
      case 'KeyS': this.input.back = true; break;
      case 'KeyA': this.input.left = true; break;
      case 'KeyD': this.input.right = true; break;
      case 'Space': this.input.jump = true; break;
      case 'KeyR': this.input.reload = true; break;
      case 'ShiftLeft': case 'ShiftRight': this.input.crouch = true; break;
      case 'Tab': e.preventDefault(); this.toggleMenu(); break;
      case 'Digit1': this.switchWeapon('knife'); break;
      case 'Digit2': this.switchWeapon('glock'); break;
      case 'Digit3': this.switchWeapon('deagle'); break;
      case 'Digit4': this.switchWeapon('ak47'); break;
      case 'Digit5': this.switchWeapon('m4'); break;
      case 'Digit6': this.switchWeapon('awp'); break;
      case 'Digit7': this.switchWeapon('mp7'); break;
      case 'Digit8': this.switchWeapon('mp5'); break;
      case 'KeyB': if (this.buyPhase || this.mode === 'range' || this.gameType === 'ffa' || this.gameType === 'tdm') this.toggleBuy(); break;
      case 'KeyE': if ((this.gameType === 'defusal' || this.gameType === 'hideseek') && this.roundActive) this.tryDefuse(); break;
      case 'KeyF': this.onPlantKeyDown(); break;
      case 'KeyG': this.inspectWeapon(); break;
      case 'KeyT': e.preventDefault(); this.openChat('global'); break;
      case 'KeyU': e.preventDefault(); this.openChat('team'); break;
      case 'Escape': this.toggleMenu(); break;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'KeyW': this.input.forward = false; break;
      case 'KeyS': this.input.back = false; break;
      case 'KeyA': this.input.left = false; break;
      case 'KeyD': this.input.right = false; break;
      case 'Space': this.input.jump = false; break;
      case 'KeyR': this.input.reload = false; break;
      case 'ShiftLeft': case 'ShiftRight': this.input.crouch = false; break;
      case 'KeyF': this.onPlantKeyUp(); break;
      case 'KeyE': this.stopDefuse(); break;
    }
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isPointerLocked || this.menuOpen) return;
    // Clamp movement delta to prevent jitter from high-DPI / gaming mice
    // (e.g. Bloody brand) that report large or erratic values in a single event
    const maxDelta = 150;
    const mx = Math.max(-maxDelta, Math.min(maxDelta, e.movementX));
    const my = Math.max(-maxDelta, Math.min(maxDelta, e.movementY));
    const s = this.settings.sensitivity * 0.002;
    this.yaw -= mx * s;
    this.pitch -= my * s;
    this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));
  };

  private onContextMenu = (e: Event) => {
    e.preventDefault();
  };

  private onMouseDown = (e: MouseEvent) => {
    if (!this.isPointerLocked || this.menuOpen || this.chatOpenState || this.buyOpen) return;
    if (e.button === 0) this.input.shoot = true;
    if (e.button === 2) {
      if (this.currentWeapon === 'knife') {
        this.input.rightClick = true;
      } else {
        this.input.zoom = true;
      }
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.input.shoot = false;
    if (e.button === 2) {
      this.input.zoom = false;
      this.input.rightClick = false;
    }
  };

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  // ---------- Buy ----------

  private buyOpen = false;
  private toggleBuy() {
    this.buyOpen = !this.buyOpen;
    if (this.buyOpen && document.pointerLockElement) document.exitPointerLock();
    this.emitHud();
  }
  closeBuyMenu() {
    this.buyOpen = false;
    this.emitHud();
  }

  private toggleMenu() {
    if (this.matchOver) return;
    this.menuOpen = !this.menuOpen;
    if (this.menuOpen) {
      if (document.pointerLockElement) document.exitPointerLock();
    }
    this.onMenuToggle();
  }

  isMenuOpen() { return this.menuOpen; }
  closeMenu() {
    this.menuOpen = false;
    this.onMenuToggle();
  }

  buyWeapon(id: WeaponId) {
    const w = WEAPONS[id];
    const infiniteMoney = this.mode === 'range' || this.gameType === 'ffa' || this.gameType === 'tdm';
    if (!infiniteMoney && this.money < w.price) return;
    // Enforce inventory limits: max 2 pistols, max 2 primaries (rifle/smg/sniper)
    if (!this.ownedWeapons.includes(id)) {
      if (w.category === 'pistol') {
        const pistols = this.ownedWeapons.filter((ow) => WEAPONS[ow].category === 'pistol');
        if (pistols.length >= 2) return;
      } else if (w.category === 'rifle' || w.category === 'smg' || w.category === 'sniper') {
        const primaries = this.ownedWeapons.filter((ow) => {
          const c = WEAPONS[ow].category;
          return c === 'rifle' || c === 'smg' || c === 'sniper';
        });
        if (primaries.length >= 2) return;
      }
      this.ownedWeapons.push(id);
    }
    if (!infiniteMoney) this.money -= w.price;
    this.ammo[id] = w.magSize;
    this.reserve[id] = w.reserveAmmo;
    this.currentWeapon = id;
    this.fireCooldown = 0;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.buildViewmodel();
    this.emitHud();
  }

  buyVest() {
    const cost = 350;
    const infiniteMoney = this.mode === 'range' || this.gameType === 'ffa' || this.gameType === 'tdm' || this.gameType === 'armsrace';
    if (!infiniteMoney && this.money < cost) return;
    if (!infiniteMoney) this.money -= cost;
    this.localPlayer.armor = 100;
    this.localPlayer.hasVest = true;
    this.emitHud();
  }

  buyHelmet() {
    const cost = 650;
    const infiniteMoney = this.mode === 'range' || this.gameType === 'ffa' || this.gameType === 'tdm' || this.gameType === 'armsrace';
    if (!infiniteMoney && this.money < cost) return;
    if (!infiniteMoney) this.money -= cost;
    this.localPlayer.hasHelmet = true;
    if (this.localPlayer.armor < 100) this.localPlayer.armor = 100;
    this.localPlayer.hasVest = true;
    this.emitHud();
  }

  closeBuy() {
    this.buyOpen = false;
    this.emitHud();
  }

  private switchWeapon(id: WeaponId) {
    if (!this.ownedWeapons.includes(id)) return;
    this.currentWeapon = id;
    this.isZoomed = false;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0.2;
    this.buildViewmodel();
    this.emitHud();
  }

  // ---------- Viewmodel ----------

  private buildViewmodel() {
    while (this.viewmodel.children.length > 0) {
      const c = this.viewmodel.children[0];
      this.viewmodel.remove(c);
      c.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    }
    const w = WEAPONS[this.currentWeapon];
    const skinId = this.equippedWeaponSkins[this.currentWeapon];
    const skin = skinId ? getWeaponSkin(skinId) : undefined;
    const playerSkin = getSkin(this.skinId);
    const group = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({
      color: skin?.colors.body ?? playerSkin.colors.body,
      roughness: skin?.colors.roughness ?? 0.5,
      metalness: skin?.colors.metalness ?? 0.7,
      emissive: skin?.colors.emissive ?? 0x000000,
      emissiveIntensity: skin?.colors.emissiveIntensity ?? 0,
    });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.7 });
    const accentMat = new THREE.MeshStandardMaterial({
      color: skin?.colors.accent ?? playerSkin.colors.top,
      roughness: 0.4,
      metalness: 0.8,
    });

    if (this.currentWeapon === 'knife') {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.35), metalMat);
      blade.position.set(0, 0, -0.18);
      group.add(blade);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.12), woodMat);
      handle.position.set(0, 0, 0.02);
      group.add(handle);
    } else if (w.category === 'pistol') {
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.22), metalMat);
      slide.position.set(0, 0, -0.08);
      group.add(slide);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.07), accentMat);
      grip.position.set(0, -0.1, 0.04);
      grip.rotation.x = -0.25;
      group.add(grip);
      if (this.currentWeapon === 'deagle') {
        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.08), metalMat);
        barrel.position.set(0, 0.01, -0.2);
        group.add(barrel);
      }
    } else if (w.category === 'rifle') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.42), metalMat);
      body.position.set(0, 0, -0.12);
      group.add(body);
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.2), metalMat);
      barrel.position.set(0, 0.02, -0.34);
      group.add(barrel);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.06), accentMat);
      mag.position.set(0, -0.1, -0.05);
      mag.rotation.x = -0.15;
      group.add(mag);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.12), woodMat);
      stock.position.set(0, -0.01, 0.12);
      group.add(stock);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.05), accentMat);
      grip.position.set(0, -0.08, 0.06);
      grip.rotation.x = -0.3;
      group.add(grip);
      if (this.currentWeapon === 'ak47') {
        const fore = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.14), woodMat);
        fore.position.set(0, -0.02, -0.22);
        group.add(fore);
      }
    } else if (w.category === 'smg') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.3), metalMat);
      body.position.set(0, 0, -0.1);
      group.add(body);
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.14), metalMat);
      barrel.position.set(0, 0.01, -0.24);
      group.add(barrel);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.1, 0.05), accentMat);
      mag.position.set(0, -0.08, -0.02);
      mag.rotation.x = -0.1;
      group.add(mag);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.1), accentMat);
      stock.position.set(0, -0.01, 0.1);
      group.add(stock);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.09, 0.045), accentMat);
      grip.position.set(0, -0.07, 0.05);
      grip.rotation.x = -0.25;
      group.add(grip);
    } else if (w.category === 'sniper') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.5), metalMat);
      body.position.set(0, 0, -0.15);
      group.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 8), metalMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, -0.4);
      group.add(barrel);
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 8), accentMat);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.08, -0.1);
      group.add(scope);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.05), accentMat);
      mag.position.set(0, -0.07, -0.05);
      group.add(mag);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.14), accentMat);
      stock.position.set(0, -0.01, 0.16);
      group.add(stock);
    }

    group.position.set(0.22, -0.18, -0.45);
    group.rotation.y = -0.08;
    group.rotation.x = 0.04;
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) { o.castShadow = false; o.renderOrder = 999; }
    });
    this.viewmodel.add(group);
  }

  private updateViewmodel(dt: number) {
    if (this.spectating || this.viewmodel.children.length === 0) {
      this.viewmodel.visible = false;
      return;
    }
    this.viewmodel.visible = true;
    const g = this.viewmodel.children[0] as THREE.Group;
    const targetCrouchY = this.isCrouched ? -0.28 : -0.18;
    const moving = this.localPlayer.velocity.lengthSq() > 1;
    if (moving) this.viewmodelBob += dt * 10;
    const bobX = moving ? Math.sin(this.viewmodelBob) * 0.008 : 0;
    const bobY = moving ? Math.abs(Math.cos(this.viewmodelBob)) * 0.006 : 0;
    this.viewmodelRecoil = Math.max(0, this.viewmodelRecoil - dt * 6);
    let targetX = 0.22 + bobX;
    let targetY = targetCrouchY + bobY - this.viewmodelRecoil * 0.05;
    let targetZ = -0.45 + this.viewmodelRecoil * 0.06;
    let targetRotX = 0.04 + this.viewmodelRecoil * 0.3;
    if (this.inspecting) {
      const phase = 1 - (this.inspectTimer / 2.5);
      targetX = 0.05 + Math.sin(phase * Math.PI * 2) * 0.03;
      targetY = -0.12 + Math.sin(phase * Math.PI) * 0.04;
      targetZ = -0.35;
      targetRotX = 0.15 + Math.sin(phase * Math.PI * 2) * 0.15;
    }
    g.position.x += (targetX - g.position.x) * Math.min(1, dt * 10);
    g.position.y += (targetY - g.position.y) * Math.min(1, dt * 10);
    g.position.z += (targetZ - g.position.z) * Math.min(1, dt * 10);
    g.rotation.x += (targetRotX - g.rotation.x) * Math.min(1, dt * 10);
  }

  // ---------- Loop ----------

  private loop = () => {
    this.rafId = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number) {
    if (this.matchOver || this.menuOpen) {
      this.updateMessage(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.mode === 'range') {
      this.updateRange(dt);
    } else {
      this.updateMatch(dt);
    }

    this.updatePlanting(dt);
    this.updateInspect(dt);
    this.updateLocalPlayer(dt);
    this.updateBots(dt);
    this.updateRemotePlayers(dt);
    this.updateBullets(dt);
    this.updateDroppedWeapons(dt);
    this.updateBomb(dt);
    this.updateCamera();
    this.updateViewmodel(dt);
    this.updateMessage(dt);
    this.syncMultiplayer(dt);
    this.emitHud();
  }

  private updateMessage(dt: number) {
    if (this.messageTimer > 0) this.messageTimer -= dt;
  }

  private updateRange(dt: number) {
    // Targets respawn
    for (const t of this.targetMeshes) {
      if (!t.alive) {
        t.respawnTimer -= dt;
        if (t.respawnTimer <= 0) {
          t.alive = true;
          t.mesh.visible = true;
        }
      }
    }
  }

  private updateMatch(dt: number) {
    if (this.gameType === 'armsrace') {
      this.updateArmsRace(dt);
      return;
    }
    if (this.gameType === 'hideseek') {
      this.updateHideSeek(dt);
      return;
    }
    if (this.gameType === 'tdm' || this.gameType === 'ffa') {
      this.updateDeathmatch(dt);
      return;
    }
    // Defusal mode
    if (this.buyPhase) {
      this.buyTimer -= dt;
      if (this.buyTimer <= 0) {
        this.buyPhase = false;
        this.roundActive = true;
        this.roundTimer = 115;
        this.buyOpen = false;
        this.message = 'Fight!';
        this.messageTimer = 2;
      }
    } else if (this.roundActive) {
      this.roundTimer -= dt;
      // Bomb logic
      if (this.bombPlanted) {
        this.bombTimer -= dt;
        if (this.defusing) {
          this.bombDefuseTimer -= dt;
          if (this.bombDefuseTimer <= 0) {
            // Bomb defused — CT wins
            this.bombPlanted = false;
            this.defusing = false;
            if (this.mp && this.mode === 'online') this.mp.broadcastBomb('defuse', this.bombPlantedPos ?? new THREE.Vector3());
            this.endRound(true);
            return;
          }
        }
        if (this.bombTimer <= 0) {
          // Bomb exploded — kill nearby players, T wins
          this.bombPlanted = false;
          if (this.bombPlantedPos) {
            for (const p of this.players) {
              if (p.alive && p.position.distanceTo(this.bombPlantedPos) < 15) {
                p.alive = false;
                p.deaths = (p.deaths ?? 0) + 1;
                if (p.mesh) p.mesh.visible = false;
              }
            }
          }
          if (this.mp && this.mode === 'online') this.mp.broadcastBomb('explode', this.bombPlantedPos ?? new THREE.Vector3());
          this.endRound(false);
          return;
        }
      }
      // When bomb is planted, round only ends by: bomb explode (T wins),
      // bomb defused (CT wins), or all CT dead (T wins — no one left to defuse).
      // If all T are dead but bomb is still ticking, nobody wins yet — wait for explode/defuse.
      const ctAlive = this.players.filter((p) => p.team === 'ct' && p.alive).length;
      const tAlive = this.players.filter((p) => p.team === 't' && p.alive).length;
      if (this.bombPlanted) {
        if (ctAlive === 0) {
          this.bombPlanted = false;
          this.endRound(false); // T wins
        }
        // All T dead but bomb planted: no round end — bomb must explode or be defused
      } else if (ctAlive === 0 || tAlive === 0 || this.roundTimer <= 0) {
        const ctWon = tAlive === 0 && ctAlive > 0;
        this.endRound(ctWon);
      }
    } else if (this.roundEndTimer > 0) {
      this.roundEndTimer -= dt;
      if (this.roundEndTimer <= 0) {
        if (this.roundsWon >= this.roundsToWin || this.roundsLost >= this.roundsToWin) {
          this.endMatch();
        } else {
          this.startRound();
        }
      }
    }
  }

  private updateHideSeek(dt: number) {
    if (!this.roundActive) {
      if (this.roundEndTimer > 0) {
        this.roundEndTimer -= dt;
        if (this.roundEndTimer <= 0) {
          if (this.roundsWon >= this.roundsToWin || this.roundsLost >= this.roundsToWin) {
            this.endMatch();
          } else {
            this.startRound();
          }
        }
      }
      return;
    }

    this.hideSeekTimer -= dt;

    // Phase transition: hiding -> seeking
    if (this.hideSeekPhase === 'Hiding' && this.hideSeekTimer <= 0) {
      this.hideSeekPhase = 'Seeking';
      this.hideSeekTimer = 300; // 5 minutes to find all SWAT
      this.hideSeekBoxOpen = true;
      this.message = 'Terrorists released! Find all SWAT!';
      this.messageTimer = 3;
      this.emitHud();
      return;
    }

    // Seeking phase: check win conditions
    if (this.hideSeekPhase === 'Seeking') {
      const ctAlive = this.players.filter((p) => p.team === 'ct' && p.alive).length;
      const tAlive = this.players.filter((p) => p.team === 't' && p.alive).length;
      if (ctAlive === 0) {
        // All SWAT found — Terrorists win
        this.roundActive = false;
        this.roundEndTimer = 4;
        this.endRound(false);
        return;
      }
      if (this.hideSeekTimer <= 0) {
        // Time ran out — SWAT wins
        this.roundActive = false;
        this.roundEndTimer = 4;
        this.endRound(true);
        return;
      }
      if (tAlive === 0) {
        // All terrorists dead — SWAT wins
        this.roundActive = false;
        this.roundEndTimer = 4;
        this.endRound(true);
        return;
      }
    }
  }

  private updateDeathmatch(dt: number) {
    this.roundTimer += dt;
    // Handle respawns
    if (!this.localPlayer.alive && this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawnPlayer(this.localPlayer);
        this.exitSpectator();
      }
    }
    // Respawn dead bots
    for (const p of this.players) {
      if (p.isBot && !p.alive) {
        if (!p.aiRespawnTimer || p.aiRespawnTimer <= 0) {
          p.aiRespawnTimer = 2;
        }
        p.aiRespawnTimer -= dt;
        if (p.aiRespawnTimer <= 0) {
          this.respawnPlayer(p);
        }
      }
    }
    // Check win condition
    if (this.gameType === 'ffa') {
      if (this.kills >= this.killTarget) {
        this.endMatch();
      }
    } else {
      // TDM — check team kills
      const myTeamKills = this.players.filter((p) => p.team === this.playerTeam).reduce((sum, p) => sum + (p.kills ?? 0), 0);
      const enemyTeamKills = this.players.filter((p) => p.team !== this.playerTeam).reduce((sum, p) => sum + (p.kills ?? 0), 0);
      if (myTeamKills >= this.killTarget || enemyTeamKills >= this.killTarget) {
        this.endMatch();
      }
    }
  }

  private plantBomb(site: BombSite) {
    this.bombPlanted = true;
    this.bombSite = site.id;
    this.bombTimer = 40; // 40 seconds to defuse
    this.bombPlantedPos = site.center.clone();
    this.bombCarrier = null;
    this.message = `Bomb planted at Site ${site.id}!`;
    this.messageTimer = 3;
    // T gets a money bonus for planting
    if (this.playerTeam === 't') {
      this.money = Math.min(this.money + 800, 16000);
    }
    // Create bomb mesh
    const bombGeo = new THREE.BoxGeometry(0.4, 0.4, 0.6);
    const bombMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.7, emissive: 0xff0000, emissiveIntensity: 0.3 });
    this.bombMesh = new THREE.Mesh(bombGeo, bombMat);
    this.bombMesh.position.copy(site.center);
    this.bombMesh.position.y = 0.2;
    this.bombMesh.castShadow = true;
    this.scene.add(this.bombMesh);
    this.playSound('hit');
    if (this.mp && this.mode === 'online') {
      this.mp.broadcastBomb('plant', site.center, site.id);
    }
  }

  private dropBomb(pos: THREE.Vector3) {
    // Remove any existing dropped bomb
    if (this.droppedBomb) {
      this.scene.remove(this.droppedBomb.mesh);
      this.droppedBomb.mesh.traverse((o) => {
        if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); }
      });
      this.droppedBomb = null;
    }

    const group = new THREE.Group();
    // Bomb body
    const bodyGeo = new THREE.BoxGeometry(0.4, 0.4, 0.6);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.7, emissive: 0xff0000, emissiveIntensity: 0.3 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    group.add(body);

    // TNT label sprite
    const label = this.makeTextSprite('TNT', '#ff3333');
    label.position.set(0, 0.6, 0);
    label.scale.set(1.2, 0.4, 1);
    group.add(label);

    group.position.copy(pos);
    group.position.y = 0.3;
    this.scene.add(group);
    this.droppedBomb = { mesh: group, pos: group.position.clone(), label };
  }

  private pickupBomb() {
    if (!this.droppedBomb || this.bombCarrier || this.bombPlanted) return;
    if (this.localPlayer.team !== 't' || !this.localPlayer.alive) return;
    if (this.localPlayer.position.distanceTo(this.droppedBomb.pos) < 2.5) {
      this.bombCarrier = this.localPlayer;
      this.scene.remove(this.droppedBomb.mesh);
      this.droppedBomb.mesh.traverse((o) => {
        if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); }
      });
      this.droppedBomb = null;
      this.playSound('hit');
      if (this.mp && this.mode === 'online') {
        this.mp.broadcastBomb('pickup', this.localPlayer.position);
      }
    }
  }

  private removeDroppedBomb() {
    if (this.droppedBomb) {
      this.scene.remove(this.droppedBomb.mesh);
      this.droppedBomb.mesh.traverse((o) => {
        if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); }
      });
      this.droppedBomb = null;
    }
  }

  private updateBomb(dt: number) {
    // Pulse the planted bomb glow — faster as time runs out
    if (this.bombMesh && this.bombPlanted) {
      this.bombPulseTime += dt;
      const fractionLeft = Math.max(0, this.bombTimer / 40);
      const pulseSpeed = 2 + (1 - fractionLeft) * 12;
      const pulse = 0.3 + 0.4 * Math.sin(this.bombPulseTime * pulseSpeed * Math.PI);
      (this.bombMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;

      // Tick sound — frequency increases as time runs out
      this.bombTickAccum += dt;
      const tickInterval = Math.max(0.15, fractionLeft * 1.0);
      if (this.bombTickAccum >= tickInterval) {
        this.bombTickAccum = 0;
        this.playSound('hit');
      }
    }

    // Pulse the dropped bomb glow — red tick tick tick
    if (this.droppedBomb) {
      this.bombPulseTime += dt;
      const pulse = 0.3 + 0.5 * Math.sin(this.bombPulseTime * 6 * Math.PI);
      const body = this.droppedBomb.mesh.children[0] as THREE.Mesh;
      if (body && body.material) {
        (body.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
      }
      this.droppedBomb.mesh.rotation.y += dt * 0.5;
    }
  }

  private makeTextSprite(text: string, color: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = 'bold 40px sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.strokeText(text, 128, 32);
    ctx.fillText(text, 128, 32);
    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    return sprite;
  }

  private tryDefuse() {
    if (!this.bombPlanted || !this.bombPlantedPos) return;
    if (this.localPlayer.team !== 'ct') return;
    if (this.localPlayer.position.distanceTo(this.bombPlantedPos) > 3) return;
    if (!this.defusing) {
      this.defusing = true;
      // Faster defuse if holding the knife (3s vs 5s)
      this.bombDefuseTimer = this.currentWeapon === 'knife' ? 3 : 5;
    }
  }
  private stopDefuse() {
    this.defusing = false;
    this.bombDefuseTimer = 0;
  }

  private onPlantKeyDown() {
    if (this.gameType !== 'defusal' || !this.roundActive) return;
    // If not the carrier and a dropped bomb exists, try to pick it up
    if (this.bombCarrier !== this.localPlayer && this.droppedBomb) {
      this.pickupBomb();
      return;
    }
    if (this.bombPlanted || this.bombCarrier !== this.localPlayer) return;
    if (this.localPlayer.team !== 't') return;
    for (const site of this.map.bombSites) {
      if (this.localPlayer.position.distanceTo(site.center) < site.radius) {
        this.planting = true;
        this.plantProgress = 0;
        return;
      }
    }
  }

  private onPlantKeyUp() {
    if (this.planting && !this.bombPlanted) {
      this.planting = false;
      this.plantProgress = 0;
    }
  }

  private updatePlanting(dt: number) {
    if (!this.planting || this.bombPlanted) return;
    if (this.bombCarrier !== this.localPlayer) { this.planting = false; this.plantProgress = 0; return; }
    let nearSite = false;
    for (const site of this.map.bombSites) {
      if (this.localPlayer.position.distanceTo(site.center) < site.radius) { nearSite = true; break; }
    }
    if (!nearSite) { this.planting = false; this.plantProgress = 0; return; }
    this.plantProgress += dt;
    if (this.plantProgress >= 3) {
      for (const site of this.map.bombSites) {
        if (this.localPlayer.position.distanceTo(site.center) < site.radius) {
          this.planting = false;
          this.plantProgress = 0;
          this.plantBomb(site);
          return;
        }
      }
    }
  }

  inspectWeapon() {
    if (this.inspecting) return;
    this.inspecting = true;
    this.inspectTimer = 2.5;
  }

  private updateInspect(dt: number) {
    if (!this.inspecting) return;
    this.inspectTimer -= dt;
    if (this.inspectTimer <= 0) this.inspecting = false;
  }

  getInspecting() { return this.inspecting; }
  getPlantProgress() { return this.planting ? this.plantProgress / 3 : 0; }

  private openChat(mode: 'global' | 'team') {
    if (this.matchOver) return;
    this.chatOpenState = true;
    this.chatModeState = mode;
    this.chatInputState = '';
    if (document.pointerLockElement) document.exitPointerLock();
  }

  setChatInput(text: string) {
    this.chatInputState = text;
  }

  submitChat() {
    if (!this.chatOpenState) return;
    const text = this.chatInputState.trim();
    if (text) {
      this.chatMessages.push({ text, team: this.chatModeState === 'team', sender: this.username, time: Date.now() });
      if (this.chatMessages.length > 50) this.chatMessages.shift();
      if (this.onChatUpdate) this.onChatUpdate();
      if (this.mp) {
        this.mp.broadcastChat(text, this.chatModeState);
      }
    }
    this.chatOpenState = false;
    this.chatInputState = '';
    this.renderer.domElement.requestPointerLock();
  }

  cancelChat() {
    this.chatOpenState = false;
    this.chatInputState = '';
    this.renderer.domElement.requestPointerLock();
  }

  isChatOpen() { return this.chatOpenState; }
  getChatMode() { return this.chatModeState; }
  getChatInput() { return this.chatInputState; }
  getChatMessages() { return this.chatMessages; }
  setOnChatUpdate(cb: () => void) { this.onChatUpdate = cb; }

  receiveChatMessage(text: string, team: boolean, sender: string) {
    this.chatMessages.push({ text, team, sender, time: Date.now() });
    if (this.chatMessages.length > 50) this.chatMessages.shift();
    if (this.onChatUpdate) this.onChatUpdate();
  }

  private endRound(ctWon: boolean) {
    this.roundActive = false;
    this.roundEndTimer = 3;
    if (this.bombMesh) {
      this.scene.remove(this.bombMesh);
      this.bombMesh.geometry.dispose();
      (this.bombMesh.material as THREE.Material).dispose();
      this.bombMesh = null;
    }
    this.removeDroppedBomb();
    const playerWon = ctWon === (this.playerTeam === 'ct');
    if (playerWon) {
      this.roundsWon++;
      this.message = 'You won the round!';
    } else {
      this.roundsLost++;
      this.message = 'You lost the round';
    }
    this.messageTimer = 3;
  }

  private endMatch() {
    this.matchOver = true;
    if (this.gameType === 'tdm' || this.gameType === 'ffa') {
      if (this.gameType === 'ffa') {
        this.matchWon = this.kills >= this.killTarget;
      } else {
        const myTeamKills = this.players.filter((p) => p.team === this.playerTeam).reduce((sum, p) => sum + (p.kills ?? 0), 0);
        const enemyTeamKills = this.players.filter((p) => p.team !== this.playerTeam).reduce((sum, p) => sum + (p.kills ?? 0), 0);
        this.matchWon = myTeamKills >= this.killTarget && myTeamKills > enemyTeamKills;
      }
    } else {
      this.matchWon = this.roundsWon >= this.roundsToWin;
    }
    let coins = 0;
    if (this.gameType === 'armsrace') {
      coins = 5;
    } else if (this.mode === 'bots' && this.matchWon) coins = 1;
    else if (this.mode === 'online' && this.matchWon) coins = 10;
    if (this.mp) this.mp.broadcastState('ended');
    this.coinsEarned = coins;
    if (document.pointerLockElement) document.exitPointerLock();
    this.onMatchEnd({
      won: this.matchWon,
      roundsWon: this.roundsWon,
      roundsLost: this.roundsLost,
      kills: this.kills,
      deaths: this.deaths,
      coinsEarned: coins,
      mode: this.mode,
    });
  }

  // ---------- Local player movement ----------

  private updateLocalPlayer(dt: number) {
    const p = this.localPlayer;
    if (!p.alive && this.mode !== 'range') {
      // Spectator mode: allow looking around and cycling through players
      if (this.spectating) {
        if (this.input.jump || this.input.shoot) {
          this.cycleSpectator();
          this.input.jump = false;
          this.input.shoot = false;
        }
      }
      return;
    }

    // crouch toggle
    this.isCrouched = this.input.crouch;
    const targetEye = this.isCrouched ? EYE_HEIGHT * 0.6 : EYE_HEIGHT;
    this.currentEyeHeight += (targetEye - this.currentEyeHeight) * Math.min(1, dt * 12);

    // During buy phase, everything is frozen — no movement, no shooting
    if (this.buyPhase && this.mode !== 'range') {
      p.velocity.set(0, 0, 0);
      p.mesh.position.copy(p.position);
      p.mesh.rotation.y = this.yaw;
      return;
    }

    // Knife makes you faster
    const baseSpeed = this.currentWeapon === 'knife' ? 8.5 : 6.5;
    const speed = this.isCrouched ? 3.2 : baseSpeed;
    const dir = new THREE.Vector3();
    if (this.input.forward) dir.z -= 1;
    if (this.input.back) dir.z += 1;
    if (this.input.left) dir.x -= 1;
    if (this.input.right) dir.x += 1;
    dir.normalize().applyEuler(new THREE.Euler(0, this.yaw, 0));

    // Bhop: preserve horizontal speed when landing from a jump if moving forward
    const isGrounded = p.position.y <= 1.01;
    if (isGrounded && this.input.jump) {
      if (this.bhopVelocity > speed) {
        // maintain bhop speed
        p.velocity.x = dir.x * this.bhopVelocity;
        p.velocity.z = dir.z * this.bhopVelocity;
      } else {
        p.velocity.x = dir.x * speed;
        p.velocity.z = dir.z * speed;
      }
    } else if (isGrounded) {
      // decay bhop velocity when not jumping
      this.bhopVelocity = Math.max(speed, this.bhopVelocity - 15 * dt);
      p.velocity.x = dir.x * Math.max(speed, this.bhopVelocity);
      p.velocity.z = dir.z * Math.max(speed, this.bhopVelocity);
    } else {
      // in air: maintain momentum
      p.velocity.x = dir.x * Math.max(speed, this.bhopVelocity);
      p.velocity.z = dir.z * Math.max(speed, this.bhopVelocity);
    }

    // gravity & jump
    p.velocity.y -= 22 * dt;
    if (this.input.jump && isGrounded) {
      p.velocity.y = 7;
      // accelerate bhop chain
      this.bhopVelocity = Math.min(15, Math.max(speed, this.bhopVelocity) + 1.2);
    }

    const next = p.position.clone();
    next.x += p.velocity.x * dt;
    next.z += p.velocity.z * dt;
    next.y += p.velocity.y * dt;

    // collisions with solids (simple AABB push-out for x/z)
    this.collideMove(p, next);
    if (next.y < 1) {
      next.y = 1;
      p.velocity.y = 0;
    }
    // bounds
    next.x = Math.max(this.map.bounds.minX, Math.min(this.map.bounds.maxX, next.x));
    next.z = Math.max(this.map.bounds.minZ, Math.min(this.map.bounds.maxZ, next.z));
    p.position.copy(next);
    p.mesh.position.copy(p.position);
    p.mesh.rotation.y = this.yaw;

    // weapon firing
    this.updateWeapon(dt);
  }

  private collideMove(p: CapsulePlayer, next: THREE.Vector3) {
    const r = PLAYER_RADIUS + 0.1;
    for (const s of this.map.walls) {
      const minx = s.pos.x - s.size.x / 2 - r;
      const maxx = s.pos.x + s.size.x / 2 + r;
      const minz = s.pos.z - s.size.z / 2 - r;
      const maxz = s.pos.z + s.size.z / 2 + r;
      const miny = s.pos.y - s.size.y / 2;
      const maxy = s.pos.y + s.size.y / 2;
      if (next.x > minx && next.x < maxx && next.z > minz && next.z < maxz && p.position.y < maxy && p.position.y + PLAYER_HEIGHT > miny) {
        // push out on the smaller penetration axis
        const dxLeft = Math.abs(next.x - minx);
        const dxRight = Math.abs(next.x - maxx);
        const dzTop = Math.abs(next.z - minz);
        const dzBot = Math.abs(next.z - maxz);
        const m = Math.min(dxLeft, dxRight, dzTop, dzBot);
        if (m === dxLeft) next.x = minx;
        else if (m === dxRight) next.x = maxx;
        else if (m === dzTop) next.z = minz;
        else next.z = maxz;
      }
    }
  }

  // ---------- Weapon ----------

  private updateWeapon(dt: number) {
    const w = WEAPONS[this.currentWeapon];
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const need = w.magSize - this.ammo[this.currentWeapon];
        const take = Math.min(need, this.reserve[this.currentWeapon]);
        this.ammo[this.currentWeapon] += take;
        this.reserve[this.currentWeapon] -= take;
        this.isReloading = false;
      }
    }

    // zoom
    const wantZoom = !!(this.input.zoom && w.zoom);
    if (wantZoom !== this.isZoomed) {
      this.isZoomed = wantZoom;
    }
    const targetFov = this.isZoomed ? 25 : this.baseFov;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 12);
    this.camera.updateProjectionMatrix();

    // reload
    if (this.input.reload && !this.isReloading && this.ammo[this.currentWeapon] < w.magSize && this.reserve[this.currentWeapon] > 0) {
      this.isReloading = true;
      this.reloadTimer = w.reloadTime;
      this.playSound('reload');
    }

    // shoot (blocked during buy phase in defusal; in deathmatch/range, close buy menu instead)
    if (this.input.shoot && this.fireCooldown <= 0 && !this.isReloading) {
      if (this.buyPhase && this.mode !== 'range') {
        // frozen during defusal buy phase
      } else {
        if (this.buyOpen) { this.buyOpen = false; this.emitHud(); }
        if (this.ammo[this.currentWeapon] <= 0) {
          // auto reload
          if (this.reserve[this.currentWeapon] > 0) {
            this.isReloading = true;
            this.reloadTimer = w.reloadTime;
            this.playSound('reload');
          }
          this.input.shoot = false;
        } else if (this.currentWeapon === 'knife') {
          this.fireCooldown = 0.5;
          this.knifeAttack(false);
        } else {
          this.fire();
          this.ammo[this.currentWeapon]--;
          this.fireCooldown = 60 / w.fireRate;
          if (!w.auto) this.input.shoot = false;
        }
      }
    }

    // Right-click knife: heavy slash (more damage, slower cooldown)
    if (this.input.rightClick && this.currentWeapon === 'knife' && this.fireCooldown <= 0) {
      this.fireCooldown = 1.0;
      this.knifeAttack(true);
      this.input.rightClick = false;
    }
  }

  private getAimOrigin(): THREE.Vector3 {
    return new THREE.Vector3(
      this.localPlayer.position.x,
      this.localPlayer.position.y + this.currentEyeHeight,
      this.localPlayer.position.z,
    );
  }

  private getAimDir(): THREE.Vector3 {
    const dir = new THREE.Vector3(0, 0, -1);
    const e = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    dir.applyEuler(e);
    return dir.normalize();
  }

  private fire() {
    const w = WEAPONS[this.currentWeapon];
    const origin = this.getAimOrigin();
    const dir = this.getAimDir();
    // spread
    const spread = w.spread * (this.isZoomed ? 0.3 : 1) * (this.localPlayer.velocity.lengthSq() > 0.1 ? 2 : 1);
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread;
    dir.z += (Math.random() - 0.5) * spread;
    dir.normalize();

    // recoil kick to camera
    this.pitch += w.recoil * (this.isZoomed ? 0.4 : 1);
    this.yaw += (Math.random() - 0.5) * w.recoil * 0.5;

    this.muzzleFlash!.position.copy(origin).add(dir.clone().multiplyScalar(0.5));
    this.muzzleFlash!.intensity = 4;
    this.viewmodelRecoil = 1;
    setTimeout(() => { if (this.muzzleFlash) this.muzzleFlash.intensity = 0; }, 50);

    this.playSound('shoot', w.category);

    this.raycastShot(origin, dir, w.damage, w.range, true);
    this.spawnBullet(origin, dir, w.range);
    if (this.mp) {
      this.mp.broadcastShot(
        { x: origin.x, y: origin.y, z: origin.z },
        { x: dir.x, y: dir.y, z: dir.z },
        this.currentWeapon,
      );
    }
  }

  private knifeAttack(heavy: boolean) {
    const origin = this.getAimOrigin();
    const dir = this.getAimDir();
    this.playSound('knife');
    const dmg = heavy ? WEAPONS.knife.damage * 2 : WEAPONS.knife.damage;
    this.raycastShot(origin, dir, dmg, WEAPONS.knife.range, true);
  }

  private raycastShot(origin: THREE.Vector3, dir: THREE.Vector3, damage: number, range: number, fromLocal: boolean): CapsulePlayer | null {
    const end = origin.clone().add(dir.clone().multiplyScalar(range));
    // Check targets (range mode)
    if (this.mode === 'range') {
      for (const t of this.targetMeshes) {
        if (!t.alive) continue;
        const hit = this.raySphere(origin, dir, t.pos, 0.5);
        if (hit) {
          t.alive = false;
          t.mesh.visible = false;
          t.respawnTimer = 1.5;
          this.playSound('hit');
        }
      }
    }
    // Check players (capsule body + head)
    let closestDist = range;
    let hitPlayer: CapsulePlayer | null = null;
    let isHeadshot = false;
    for (const p of this.players) {
      if (!p.alive) continue;
      if (fromLocal && p === this.localPlayer) continue;
      // In FFA, everyone is an enemy. In team modes, don't hit allies.
      if (fromLocal && this.gameType !== 'ffa' && p.team === this.localPlayer.team && this.mode !== 'range') continue;
      // Head hitbox (small sphere at top)
      const headCenter = p.position.clone().add(new THREE.Vector3(0, PLAYER_HEIGHT - 0.15, 0));
      const dHead = this.raySphere(origin, dir, headCenter, 0.18);
      if (dHead !== null && dHead < closestDist) {
        closestDist = dHead;
        hitPlayer = p;
        isHeadshot = true;
      }
      // Body hitbox
      const bodyCenter = p.position.clone().add(new THREE.Vector3(0, PLAYER_HEIGHT / 2, 0));
      const dBody = this.raySphere(origin, dir, bodyCenter, PLAYER_RADIUS + 0.15);
      if (dBody !== null && dBody < closestDist) {
        closestDist = dBody;
        hitPlayer = p;
        isHeadshot = false;
      }
    }
    // Check walls (block shots)
    const wallDist = this.rayWalls(origin, dir, range);
    if (wallDist !== null && wallDist < closestDist) {
      hitPlayer = null;
    }
    if (hitPlayer) {
      const wasAlive = hitPlayer.alive;
      const dmg = isHeadshot ? damage * 2 : damage;
      this.damagePlayer(hitPlayer, dmg, fromLocal, isHeadshot);
      if (wasAlive && !hitPlayer.alive) return hitPlayer;
    }
    return null;
  }

  private raySphere(origin: THREE.Vector3, dir: THREE.Vector3, center: THREE.Vector3, radius: number): number | null {
    const oc = origin.clone().sub(center);
    const b = oc.dot(dir);
    const c = oc.dot(oc) - radius * radius;
    const disc = b * b - c;
    if (disc < 0) return null;
    const t = -b - Math.sqrt(disc);
    return t > 0 ? t : null;
  }

  private rayWalls(origin: THREE.Vector3, dir: THREE.Vector3, range: number): number | null {
    let closest: number | null = null;
    for (const s of this.map.walls) {
      const min = new THREE.Vector3(s.pos.x - s.size.x / 2, s.pos.y - s.size.y / 2, s.pos.z - s.size.z / 2);
      const max = new THREE.Vector3(s.pos.x + s.size.x / 2, s.pos.y + s.size.y / 2, s.pos.z + s.size.z / 2);
      const t = this.rayAABB(origin, dir, min, max);
      if (t !== null && (closest === null || t < closest)) closest = t;
    }
    return closest !== null && closest < range ? closest : null;
  }

  private rayAABB(origin: THREE.Vector3, dir: THREE.Vector3, min: THREE.Vector3, max: THREE.Vector3): number | null {
    let tmin = -Infinity;
    let tmax = Infinity;
    for (const ax of ['x', 'y', 'z'] as const) {
      const o = origin[ax];
      const d = dir[ax];
      if (Math.abs(d) < 1e-6) {
        if (o < min[ax] || o > max[ax]) return null;
      } else {
        let t1 = (min[ax] - o) / d;
        let t2 = (max[ax] - o) / d;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return null;
      }
    }
    return tmin > 0 ? tmin : (tmax > 0 ? tmax : null);
  }

  private damagePlayer(p: CapsulePlayer, dmg: number, fromLocal: boolean, isHeadshot = false) {
    if (p.armor > 0) {
      const armorFactor = p.hasHelmet && isHeadshot ? 0.7 : 0.5;
      const absorbed = Math.min(p.armor, dmg * armorFactor);
      p.armor -= absorbed;
      p.health -= dmg - absorbed;
    } else {
      p.health -= dmg;
    }
    flashHit(p);
    this.playSound('hit');
    if (p.health <= 0 && p.alive) {
      p.alive = false;
      p.mesh.visible = false;
      // Drop weapons as physical objects in the world
      this.dropPlayerWeapons(p);
      if (fromLocal) {
        this.kills++;
        this.killStreak++;
        this.showKillStreakMessage();
        if (p !== this.localPlayer) {
          this.localPlayer.kills = (this.localPlayer.kills ?? 0) + 1;
        }
        if (this.gameType === 'ffa') {
          this.enemyKills++;
        } else if (p.team !== this.playerTeam) {
          this.enemyKills++;
        } else {
          this.teamKills++;
        }
      }
      if (p === this.localPlayer) {
        this.deaths++;
        this.killStreak = 0;
        if (this.gameType === 'tdm' || this.gameType === 'ffa') {
          this.respawnTimer = 3;
          this.enterSpectator();
        } else if (this.gameType === 'armsrace') {
          this.respawnTimer = 3;
          this.localPlayer.respawnTimer = 3;
          this.enterSpectator();
        } else if (this.gameType === 'defusal') {
          // Lose all purchased weapons on death — keep only knife and glock
          this.ownedWeapons = ['knife', 'glock'];
          this.currentWeapon = 'glock';
          this.isZoomed = false;
          this.isReloading = false;
          this.reloadTimer = 0;
          this.buildViewmodel();
          this.enterSpectator();
        }
      } else if (p.isBot && this.gameType === 'armsrace') {
        // Bot was killed — track arms race for the killer if it's a bot
        if (!fromLocal) {
          // A bot killed another bot — track bot's arms race progress
          // (simplified: just give the kill to the bot)
        }
        p.respawnTimer = 3;
      }
      // Drop bomb if carrier dies
      if (p === this.bombCarrier) {
        this.bombCarrier = null;
        this.dropBomb(p.position);
        if (this.mp && this.mode === 'online') {
          this.mp.broadcastBomb('drop', p.position);
        }
      }
      // In online mode, notify the remote player they died
      if (this.mp && fromLocal && p !== this.localPlayer && this.remoteMeshes.has(p.id)) {
        this.mp.broadcastHit(p.id, dmg);
      }
    }
  }

  private dropPlayerWeapons(p: CapsulePlayer) {
    const dropList = p === this.localPlayer
      ? this.ownedWeapons.filter((w) => w !== 'knife' && w !== 'glock')
      : p.aiWeapon ? [p.aiWeapon] : [];
    for (const wid of dropList) {
      const w = WEAPONS[wid as WeaponId];
      if (!w) continue;
      const group = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.5, metalness: 0.7 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), mat);
      body.castShadow = true;
      group.add(body);
      group.position.copy(p.position);
      group.position.y = 0.3;
      group.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(group);
      this.droppedWeapons.push({ mesh: group, pos: group.position.clone(), weaponId: wid as WeaponId, life: 10 });
    }
  }

  private updateDroppedWeapons(dt: number) {
    for (let i = this.droppedWeapons.length - 1; i >= 0; i--) {
      const dw = this.droppedWeapons[i];
      dw.life -= dt;
      dw.mesh.rotation.y += dt * 0.5;
      if (dw.life <= 0) {
        this.scene.remove(dw.mesh);
        dw.mesh.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
        this.droppedWeapons.splice(i, 1);
      }
    }
  }

  private enterSpectator() {
    this.spectating = true;
    this.spectateIndex = 0;
    this.updateSpectateTarget();
  }

  private updateSpectateTarget() {
    if (!this.spectating) return;
    // Find alive teammates (or any alive player in FFA) to spectate
    const candidates = this.players.filter((p) => p !== this.localPlayer && p.alive);
    if (candidates.length === 0) {
      this.spectateName = '';
      return;
    }
    if (this.spectateIndex >= candidates.length) this.spectateIndex = 0;
    const target = candidates[this.spectateIndex];
    this.spectateName = target.id === this.localPlayer.id ? '' : `Spectating ${target.id}`;
  }

  private cycleSpectator() {
    if (!this.spectating) return;
    this.spectateIndex++;
    this.updateSpectateTarget();
  }

  private exitSpectator() {
    this.spectating = false;
    this.spectateName = '';
  }

  private showKillStreakMessage() {
    if (this.killStreak === 2) { this.message = 'Double Kill!'; this.messageTimer = 2; }
    else if (this.killStreak === 3) { this.message = 'Triple Kill!'; this.messageTimer = 2; }
    else if (this.killStreak === 4) { this.message = 'Quad Kill!'; this.messageTimer = 2; }
    else if (this.killStreak === 5) { this.message = 'Penta Kill!'; this.messageTimer = 3; }
    else if (this.killStreak >= 6 && this.killStreak % 5 === 0) { this.message = `${this.killStreak} Kill Streak!`; this.messageTimer = 3; }
  }

  private spawnBullet(origin: THREE.Vector3, dir: THREE.Vector3, range: number) {
    const end = origin.clone().add(dir.clone().multiplyScalar(range));
    const geo = new THREE.BufferGeometry().setFromPoints([origin.clone(), end.clone()]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffeeaa, transparent: true, opacity: 0.7 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.bullets.push({ from: origin.clone(), to: end.clone(), life: 0.05 });
    this.bulletLines.push(line);
  }

  private updateBullets(dt: number) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      this.bullets[i].life -= dt;
      if (this.bullets[i].life <= 0) {
        this.scene.remove(this.bulletLines[i]);
        this.bulletLines[i].geometry.dispose();
        (this.bulletLines[i].material as THREE.Material).dispose();
        this.bullets.splice(i, 1);
        this.bulletLines.splice(i, 1);
      } else {
        (this.bulletLines[i].material as THREE.LineBasicMaterial).opacity = this.bullets[i].life / 0.05 * 0.7;
      }
    }
  }

  // ---------- Bots ----------

  private updateBots(dt: number) {
    if (this.mode === 'range') return;
    // During buy phase, bots are frozen too
    if (this.buyPhase) {
      for (const bot of this.players) {
        if (!bot.isBot) continue;
        bot.velocity.set(0, 0, 0);
      }
      return;
    }
    for (const bot of this.players) {
      if (!bot.isBot) continue;
      if (!bot.alive) {
        if (this.gameType === 'armsrace' && bot.respawnTimer > 0) {
          bot.respawnTimer -= dt;
          if (bot.respawnTimer <= 0) this.respawnPlayer(bot);
        }
        continue;
      }
      this.updateBotAI(bot, dt);
      bot.mesh.position.copy(bot.position);
      bot.mesh.rotation.y = bot.yaw;
      // hit flash
      if (bot.hitFlash && bot.hitFlash > 0) {
        bot.hitFlash -= dt;
        const f = Math.max(0, bot.hitFlash / 0.12);
        bot.bodyMat.emissive.setRGB(f, 0, 0);
      } else {
        bot.bodyMat.emissive.setRGB(0, 0, 0);
      }
    }
  }

  private updateBotAI(bot: CapsulePlayer, dt: number) {
    // Hide & Seek: CT bots flee from enemies, T bots hunt
    if (this.gameType === 'hideseek') {
      if (bot.team === 'ct' && this.hideSeekPhase === 'Hiding') {
        // Run to a random far corner and stay still
        if (!bot.aiTarget || bot.aiRetargetTimer! <= 0) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 30 + Math.random() * 20;
          bot.aiTarget = new THREE.Vector3(Math.cos(angle) * dist, 1, Math.sin(angle) * dist);
          bot.aiRetargetTimer = 5;
        }
        bot.aiRetargetTimer! -= dt;
        const to = bot.aiTarget.clone().sub(bot.position);
        to.y = 0;
        if (to.length() > 2) {
          to.normalize();
          const speed = 7;
          const next = bot.position.clone();
          next.x += to.x * speed * dt;
          next.z += to.z * speed * dt;
          this.collideMove(bot, next);
          next.y = 1;
          bot.position.copy(next);
          bot.velocity.set(to.x * speed, 0, to.z * speed);
          bot.yaw = Math.atan2(to.x, to.z) + Math.PI;
        } else {
          bot.velocity.set(0, 0, 0);
        }
        return;
      }
      if (bot.team === 'ct' && this.hideSeekPhase === 'Seeking') {
        // Run away from nearest enemy
        const nearest = this.findNearestEnemy(bot);
        if (nearest) {
          const away = bot.position.clone().sub(nearest.position);
          away.y = 0;
          away.normalize();
          const speed = 7.5;
          const next = bot.position.clone();
          next.x += away.x * speed * dt;
          next.z += away.z * speed * dt;
          this.collideMove(bot, next);
          next.y = 1;
          next.x = Math.max(this.map.bounds.minX, Math.min(this.map.bounds.maxX, next.x));
          next.z = Math.max(this.map.bounds.minZ, Math.min(this.map.bounds.maxZ, next.z));
          bot.position.copy(next);
          bot.velocity.set(away.x * speed, 0, away.z * speed);
          bot.yaw = Math.atan2(away.x, away.z) + Math.PI;
        }
        return;
      }
      if (bot.team === 't' && this.hideSeekPhase === 'Hiding') {
        // Stay still in spawn area
        bot.velocity.set(0, 0, 0);
        return;
      }
      // T bots in seeking phase: use normal seek-and-attack AI (falls through)
    }

    // T bot (not carrier): seek dropped bomb if it exists
    if (this.gameType === 'defusal' && bot.team === 't' && !this.bombPlanted && bot !== this.bombCarrier && this.droppedBomb && this.roundActive) {
      const distToBomb = bot.position.distanceTo(this.droppedBomb.pos);
      if (distToBomb < 2.5) {
        // Pick up the bomb
        this.bombCarrier = bot;
        this.removeDroppedBomb();
        bot.aiPlantProgress = 0;
        if (this.mp && this.mode === 'online') this.mp.broadcastBomb('pickup', bot.position);
        return;
      } else {
        // Move toward dropped bomb
        bot.aiState = 'roam';
        const to = this.droppedBomb.pos.clone().sub(bot.position);
        to.y = 0;
        to.normalize();
        const speed = 5.0;
        const next = bot.position.clone();
        next.x += to.x * speed * dt;
        next.z += to.z * speed * dt;
        this.collideMove(bot, next);
        next.y = 1;
        next.x = Math.max(this.map.bounds.minX, Math.min(this.map.bounds.maxX, next.x));
        next.z = Math.max(this.map.bounds.minZ, Math.min(this.map.bounds.maxZ, next.z));
        bot.position.copy(next);
        bot.velocity.set(to.x * speed, 0, to.z * speed);
        bot.yaw = Math.atan2(to.x, to.z) + Math.PI;
        return;
      }
    }

    // Bomb carrier bot: seek nearest bomb site and plant
    if (this.gameType === 'defusal' && bot.team === 't' && bot === this.bombCarrier && !this.bombPlanted && this.roundActive) {      const site = this.findNearestBombSite(bot.position);
      if (site) {
        const distToSite = bot.position.distanceTo(site.center);
        if (distToSite < site.radius) {
          // At site — plant the bomb
          bot.velocity.set(0, 0, 0);
          bot.aiPlantProgress = (bot.aiPlantProgress ?? 0) + dt;
          if (bot.aiPlantProgress >= 3) {
            bot.aiPlantProgress = 0;
            this.plantBomb(site);
          }
          return;
        } else {
          // Move toward bomb site
          bot.aiState = 'roam';
          const to = site.center.clone().sub(bot.position);
          to.y = 0;
          to.normalize();
          const speed = 5.0;
          const next = bot.position.clone();
          next.x += to.x * speed * dt;
          next.z += to.z * speed * dt;
          this.collideMove(bot, next);
          next.y = 1;
          next.x = Math.max(this.map.bounds.minX, Math.min(this.map.bounds.maxX, next.x));
          next.z = Math.max(this.map.bounds.minZ, Math.min(this.map.bounds.maxZ, next.z));
          bot.position.copy(next);
          bot.velocity.set(to.x * speed, 0, to.z * speed);
          bot.yaw = Math.atan2(to.x, to.z) + Math.PI;
          return;
        }
      }
    }

    // CT bot: defuse the bomb if close enough
    if (this.gameType === 'defusal' && bot.team === 'ct' && this.bombPlanted && this.bombPlantedPos && bot.alive) {
      const distToBomb = bot.position.distanceTo(this.bombPlantedPos);
      if (distToBomb < 3) {
        bot.velocity.set(0, 0, 0);
        bot.aiDefuseProgress = (bot.aiDefuseProgress ?? 0) + dt;
        if (bot.aiDefuseProgress >= 5) {
          bot.aiDefuseProgress = 0;
          this.bombPlanted = false;
          this.defusing = false;
          this.endRound(true);
        }
        return;
      } else if (distToBomb < 30) {
        // Move toward the planted bomb
        bot.aiState = 'roam';
        const to = this.bombPlantedPos.clone().sub(bot.position);
        to.y = 0;
        to.normalize();
        const speed = 5.0;
        const next = bot.position.clone();
        next.x += to.x * speed * dt;
        next.z += to.z * speed * dt;
        this.collideMove(bot, next);
        next.y = 1;
        next.x = Math.max(this.map.bounds.minX, Math.min(this.map.bounds.maxX, next.x));
        next.z = Math.max(this.map.bounds.minZ, Math.min(this.map.bounds.maxZ, next.z));
        bot.position.copy(next);
        bot.velocity.set(to.x * speed, 0, to.z * speed);
        bot.yaw = Math.atan2(to.x, to.z) + Math.PI;
        return;
      }
    }

    // T bot (not carrier, bomb not planted): move toward a bomb site to support
    let targetSite: BombSite | null = null;
    if (this.gameType === 'defusal' && bot.team === 't' && !this.bombPlanted && bot !== this.bombCarrier) {
      targetSite = this.findNearestBombSite(bot.position);
    }

    // Find nearest enemy
    let target: CapsulePlayer | null = null;
    let bestDist = Infinity;
    for (const p of this.players) {
      if (p === bot || !p.alive) continue;
      // In FFA, everyone is an enemy. In team modes, only target the other team.
      if (this.gameType !== 'ffa' && p.team === bot.team) continue;
      const d = bot.position.distanceTo(p.position);
      if (d < bestDist) {
        bestDist = d;
        target = p;
      }
    }

    const w = WEAPONS[bot.aiWeapon as WeaponId];
    const canSee = target && this.botHasLineOfSight(bot, target);

    if (target && canSee && bestDist < 50) {
      bot.aiState = 'engage';
      // face target
      const to = target.position.clone().sub(bot.position);
      bot.yaw = Math.atan2(to.x, to.z) + Math.PI;
      // stop moving, shoot
      bot.velocity.x *= 0.6;
      bot.velocity.z *= 0.6;

      // fire
      if (bot.aiReloadTimer && bot.aiReloadTimer > 0) {
        bot.aiReloadTimer -= dt;
        if (bot.aiReloadTimer <= 0) {
          bot.aiAmmo = bot.aiMagSize;
        }
        return;
      }
      if (bot.aiAmmo! <= 0) {
        bot.aiReloadTimer = w.reloadTime;
        return;
      }
      bot.aiFireTimer = (bot.aiFireTimer ?? 0) - dt;
      if (bot.aiFireTimer <= 0) {
        bot.aiFireTimer = 60 / w.fireRate * (0.8 + Math.random() * 0.6);
        bot.aiAmmo!--;
        // accuracy depends on distance + some randomness
        const acc = Math.max(0.25, 1 - bestDist / 60) * (this.mode === 'online' ? 0.85 : 0.7);
        if (Math.random() < acc) {
          const origin = bot.position.clone().add(new THREE.Vector3(0, EYE_HEIGHT, 0));
          const dir = target.position.clone().add(new THREE.Vector3(0, EYE_HEIGHT * 0.7, 0)).sub(origin).normalize();
          // add spread
          dir.x += (Math.random() - 0.5) * w.spread * 2;
          dir.y += (Math.random() - 0.5) * w.spread * 2;
          dir.z += (Math.random() - 0.5) * w.spread * 2;
          dir.normalize();
          this.spawnBullet(origin, dir, w.range);
          const killed = this.raycastShot(origin, dir, w.damage, w.range, false);
          if (killed && killed !== bot) {
            bot.kills = (bot.kills ?? 0) + 1;
            if (this.gameType === 'armsrace') {
              bot.aiKills++;
              const killsAtLevel = bot.aiKills - bot.aiArmsRaceKillsAtLevel;
              if (killsAtLevel >= 2 && bot.aiArmsRaceLevel < Game.ARMS_RACE_PROGRESS.length - 1) {
                bot.aiArmsRaceLevel++;
                bot.aiArmsRaceKillsAtLevel = bot.aiKills;
                bot.aiWeapon = Game.ARMS_RACE_PROGRESS[bot.aiArmsRaceLevel];
                bot.aiMagSize = WEAPONS[bot.aiWeapon as WeaponId].magSize;
                bot.aiAmmo = bot.aiMagSize;
              }
            }
          }
        }
      }
    } else {
      // roam toward a target point
      bot.aiState = 'roam';
      bot.aiRetargetTimer = (bot.aiRetargetTimer ?? 0) - dt;
      if (!bot.aiTarget || bot.aiRetargetTimer <= 0) {
        bot.aiTarget = this.pickRoamPoint(bot);
        bot.aiRetargetTimer = 3 + Math.random() * 3;
      }
      const to = bot.aiTarget.clone().sub(bot.position);
      to.y = 0;
      const dist = to.length();
      if (dist < 1.5) {
        bot.aiTarget = this.pickRoamPoint(bot);
      } else {
        to.normalize();
        const speed = 4.5;
        const next = bot.position.clone();
        next.x += to.x * speed * dt;
        next.z += to.z * speed * dt;
        this.collideMove(bot, next);
        next.y = 1;
        next.x = Math.max(this.map.bounds.minX, Math.min(this.map.bounds.maxX, next.x));
        next.z = Math.max(this.map.bounds.minZ, Math.min(this.map.bounds.maxZ, next.z));
        bot.position.copy(next);
        bot.velocity.set(to.x * speed, 0, to.z * speed);
        bot.yaw = Math.atan2(to.x, to.z) + Math.PI;
      }
    }
  }

  private pickRoamPoint(bot: CapsulePlayer): THREE.Vector3 {
    let toward: THREE.Vector3;
    if (this.gameType === 'ffa') {
      // Roam toward center or random points
      toward = new THREE.Vector3((Math.random() - 0.5) * 50, 0, (Math.random() - 0.5) * 50);
    } else {
      toward = bot.team === 'ct' ? new THREE.Vector3(20, 0, 20) : new THREE.Vector3(-20, 0, -20);
    }
    toward.x += (Math.random() - 0.5) * 30;
    toward.z += (Math.random() - 0.5) * 30;
    toward.x = Math.max(this.map.bounds.minX + 2, Math.min(this.map.bounds.maxX - 2, toward.x));
    toward.z = Math.max(this.map.bounds.minZ + 2, Math.min(this.map.bounds.maxZ - 2, toward.z));
    return toward;
  }

  private findNearestBombSite(pos: THREE.Vector3): BombSite | null {
    if (this.map.bombSites.length === 0) return null;
    let nearest = this.map.bombSites[0];
    let bestDist = pos.distanceTo(nearest.center);
    for (const site of this.map.bombSites) {
      const d = pos.distanceTo(site.center);
      if (d < bestDist) { bestDist = d; nearest = site; }
    }
    return nearest;
  }

  private findNearestEnemy(bot: CapsulePlayer): CapsulePlayer | null {
    let target: CapsulePlayer | null = null;
    let bestDist = Infinity;
    for (const p of this.players) {
      if (p === bot || !p.alive) continue;
      if (this.gameType !== 'ffa' && p.team === bot.team) continue;
      const d = bot.position.distanceTo(p.position);
      if (d < bestDist) { bestDist = d; target = p; }
    }
    return target;
  }

  private botHasLineOfSight(a: CapsulePlayer, b: CapsulePlayer): boolean {
    const origin = a.position.clone().add(new THREE.Vector3(0, EYE_HEIGHT, 0));
    const dir = b.position.clone().add(new THREE.Vector3(0, EYE_HEIGHT, 0)).sub(origin).normalize();
    const dist = origin.distanceTo(b.position);
    const wallDist = this.rayWalls(origin, dir, dist);
    return wallDist === null || wallDist >= dist;
  }

  // ---------- Multiplayer ----------

  private updateRemotePlayers(dt: number) {
    if (!this.mp) return;
    const remotes = this.mp.getRemotePlayers();
    // Add new remote players
    for (const [id, state] of remotes) {
      if (!this.remoteMeshes.has(id)) {
        const skin = getSkin(state.skinId);
        const rp = createCapsulePlayer(id, state.team, false, skin);
        this.scene.add(rp.mesh);
        this.remoteMeshes.set(id, rp);
        this.players.push(rp);
      }
      const rp = this.remoteMeshes.get(id)!;
      // Interpolate position
      const target = new THREE.Vector3(state.position.x, state.position.y, state.position.z);
      rp.position.lerp(target, Math.min(1, dt * 10));
      rp.yaw = state.yaw;
      rp.health = state.health;
      rp.alive = state.alive;
      rp.mesh.visible = state.alive;
      rp.mesh.position.copy(rp.position);
      rp.mesh.rotation.y = rp.yaw;
      // hit flash
      if (rp.hitFlash && rp.hitFlash > 0) {
        rp.hitFlash -= dt;
        const f = Math.max(0, rp.hitFlash / 0.12);
        rp.bodyMat.emissive.setRGB(f, 0, 0);
      } else {
        rp.bodyMat.emissive.setRGB(0, 0, 0);
      }
    }
    // Remove disconnected players
    for (const [id, rp] of this.remoteMeshes) {
      if (!remotes.has(id)) {
        this.scene.remove(rp.mesh);
        this.players = this.players.filter((p) => p !== rp);
        this.remoteMeshes.delete(id);
      }
    }
  }

  private syncMultiplayer(dt: number) {
    if (!this.mp) return;
    this.mpSyncTimer -= dt;
    if (this.mpSyncTimer <= 0) {
      this.mpSyncTimer = 0.05;
      this.mp.updateLocalState(
        { x: this.localPlayer.position.x, y: this.localPlayer.position.y, z: this.localPlayer.position.z },
        this.yaw,
        this.pitch,
        Math.max(0, Math.round(this.localPlayer.health)),
        this.localPlayer.alive,
        this.currentWeapon,
        this.input.shoot,
      );
    }
    // Apply pending hit damage from remote players
    if (this.pendingHitDamage > 0 && this.localPlayer.alive) {
      this.damagePlayer(this.localPlayer, this.pendingHitDamage, false);
      this.pendingHitDamage = 0;
    }
  }

  setupMultiplayerCallbacks() {
    if (!this.mp) return;
    this.mp.onChatMessage((text, team, sender) => {
      this.receiveChatMessage(text, team, sender);
    });
    this.mp.onShot((shot) => {
      // Spawn a bullet tracer for the remote shot
      const origin = new THREE.Vector3(shot.origin.x, shot.origin.y, shot.origin.z);
      const dir = new THREE.Vector3(shot.dir.x, shot.dir.y, shot.dir.z);
      const w = WEAPONS[shot.weapon as WeaponId] ?? WEAPONS.glock;
      // Check if this shot hits the local player
      if (this.localPlayer.alive) {
        const bodyCenter = this.localPlayer.position.clone().add(new THREE.Vector3(0, PLAYER_HEIGHT / 2, 0));
        const d = this.raySphere(origin, dir, bodyCenter, PLAYER_RADIUS + 0.15);
        const wallDist = this.rayWalls(origin, dir, w.range);
        if (d !== null && d < w.range && (wallDist === null || wallDist > d)) {
          this.pendingHitDamage += w.damage;
        }
      }
      this.spawnBullet(origin, dir, w.range);
    });
    this.mp.onBombEvent((action, pos, site) => {
      const v = new THREE.Vector3(pos.x, pos.y, pos.z);
      if (action === 'drop') {
        this.bombCarrier = null;
        this.dropBomb(v);
      } else if (action === 'pickup') {
        this.removeDroppedBomb();
      } else if (action === 'plant') {
        this.removeDroppedBomb();
        const siteObj = this.map.bombSites.find((s) => s.id === site);
        if (siteObj) this.plantBomb(siteObj);
      } else if (action === 'defuse') {
        this.bombPlanted = false;
        this.defusing = false;
      } else if (action === 'explode') {
        this.bombPlanted = false;
      }
    });
  }

  // ---------- Camera ----------

  private updateCamera() {
    if (this.spectating) {
      // Follow a teammate/other player
      const candidates = this.players.filter((p) => p !== this.localPlayer && p.alive);
      if (candidates.length > 0 && this.spectateIndex < candidates.length) {
        const target = candidates[this.spectateIndex];
        const eyeY = target.position.y + 1.6;
        this.camera.position.set(target.position.x, eyeY, target.position.z);
        const e = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(e);
      } else {
        // No one to spectate — float above death position
        const p = this.localPlayer;
        this.camera.position.set(p.position.x, p.position.y + 3, p.position.z);
        const e = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(e);
      }
      return;
    }
    const p = this.localPlayer;
    const eyeY = p.position.y + this.currentEyeHeight;
    this.camera.position.set(p.position.x, eyeY, p.position.z);
    const e = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(e);
  }

  // ---------- HUD ----------

  private emitHud() {
    const w = WEAPONS[this.currentWeapon];
    const enemyTeam: Team = this.playerTeam === 'ct' ? 't' : 'ct';
    const enemiesAlive = this.mode === 'range' ? 0 : this.players.filter((p) => p.team === enemyTeam && p.alive).length;
    const alliesAlive = this.mode === 'range' ? 1 : this.players.filter((p) => p.team === this.playerTeam && p.alive).length;
    const myTeamKills = this.gameType === 'tdm' ? this.players.filter((p) => p.team === this.playerTeam).reduce((sum, p) => sum + (p.kills ?? 0), 0) : 0;
    const enemyTeamKills = this.gameType === 'tdm' ? this.players.filter((p) => p.team !== this.playerTeam).reduce((sum, p) => sum + (p.kills ?? 0), 0) : 0;
    this.onHud({
      health: Math.max(0, Math.round(this.localPlayer.health)),
      hasHelmet: this.localPlayer.hasHelmet,
      hasVest: this.localPlayer.hasVest,
      armor: Math.max(0, Math.round(this.localPlayer.armor)),
      ammo: this.ammo[this.currentWeapon],
      reserve: this.reserve[this.currentWeapon],
      money: this.money,
      weapon: w.name,
      roundsWon: this.gameType === 'tdm' ? myTeamKills : this.roundsWon,
      roundsLost: this.gameType === 'tdm' ? enemyTeamKills : this.roundsLost,
      round: this.round,
      enemiesAlive,
      alliesAlive,
      message: this.messageTimer > 0 ? this.message : '',
      buyPhase: this.buyPhase,
      matchOver: this.matchOver,
      matchWon: this.matchWon,
      kills: this.kills,
      deaths: this.deaths,
      teamKills: myTeamKills,
      enemyKills: enemyTeamKills,
      killTarget: this.killTarget,
      gameType: this.gameType,
      bombPlanted: this.bombPlanted,
      bombSite: this.bombSite,
      bombTimer: Math.max(0, Math.ceil(this.bombTimer)),
      defusing: this.defusing,
      killStreak: this.killStreak,
      spectating: this.spectating,
      spectateName: this.spectateName,
      plantProgress: this.planting ? this.plantProgress / 3 : 0,
      hasBomb: this.bombCarrier === this.localPlayer,
      bombDropped: this.droppedBomb !== null,
      players: this.players.map(p => ({
        name: p.name || (p.isBot ? `Bot${this.players.indexOf(p) + 1}` : 'Player'),
        team: p.team,
        alive: p.alive,
        hasBomb: p === this.bombCarrier,
        isLocal: p === this.localPlayer,
      })),
      hideSeekTimer: Math.max(0, Math.ceil(this.hideSeekTimer)),
      hideSeekPhase: this.hideSeekPhase,
      inspecting: this.inspecting,
      armsRaceLevel: this.armsRaceLevel,
      armsRaceMaxLevel: Game.ARMS_RACE_PROGRESS.length - 1,
      armsRaceWeapon: this.gameType === 'armsrace' ? WEAPONS[Game.ARMS_RACE_PROGRESS[this.armsRaceLevel]].name : '',
    });
  }

  // ---------- Audio ----------

  private noiseBuffer?: AudioBuffer;

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      const len = ctx.sampleRate * 0.3;
      this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuffer;
  }

  private playSound(type: 'shoot' | 'reload' | 'hit' | 'knife', cat?: string) {
    if (this.settings.volume <= 0) return;
    try {
      if (!this.audioCtx) this.audioCtx = new AudioContext();
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const vol = this.settings.volume;

      if (type === 'shoot') {
        // Noise burst through a bandpass filter = gunshot crack
        const noise = ctx.createBufferSource();
        noise.buffer = this.getNoiseBuffer(ctx);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        const isPistol = cat === 'pistol';
        const isRifle = cat === 'rifle';
        const isSniper = cat === 'sniper';
        bp.frequency.setValueAtTime(isSniper ? 1200 : isRifle ? 1800 : isPistol ? 2500 : 2000, now);
        bp.frequency.exponentialRampToValueAtTime(isSniper ? 200 : 300, now + (isSniper ? 0.25 : 0.12));
        bp.Q.value = 0.7;
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol * 0.45, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + (isSniper ? 0.3 : isRifle ? 0.15 : 0.1));
        noise.connect(bp).connect(g).connect(ctx.destination);
        noise.start(now);
        noise.stop(now + (isSniper ? 0.3 : 0.15));

        // Low-frequency thump for body
        const osc = ctx.createOscillator();
        const og = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(isSniper ? 120 : isRifle ? 100 : 180, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);
        og.gain.setValueAtTime(vol * 0.3, now);
        og.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(og).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
        return;
      }

      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      const osc = ctx.createOscillator();
      osc.connect(gain);
      if (type === 'hit') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
        gain.gain.value = vol * 0.15;
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'reload') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        gain.gain.value = vol * 0.15;
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        gain.gain.value = vol * 0.15;
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      }
    } catch {
      // ignore audio errors
    }
  }

  // ---------- Public ----------

  isBuyOpen() { return this.buyOpen; }
  getMoney() { return this.money; }
  getOwnedWeapons() { return this.ownedWeapons; }

  dispose() {
    if (this.mp) this.mp.leave();
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    if (document.pointerLockElement) document.exitPointerLock();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else (obj.material as THREE.Material).dispose();
      }
    });
  }
}
