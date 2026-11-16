import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { VelocityAudio } from './audio';
import { MAPS } from './maps';
import { buildPlayerRig, buildWeaponViewmodel, PlayerRig, WeaponViewmodel } from './models';
import {
  PLAYER_EYE_HEIGHT,
  SLIDE_EYE_HEIGHT,
  stepPlayerMovement,
} from './physics';
import { ArenaMaterialSet, createArenaMaterials } from './textures';
import {
  CharacterStyle,
  ClientMessage,
  GameMode,
  GraphicsQuality,
  KillFeedItem,
  MapBlock,
  MapData,
  MatchSnapshot,
  PlayerInput,
  PlayerState,
  RoomVisibility,
  ServerMessage,
  ShotEvent,
  WeaponId,
} from './types';
import { parseHexColor } from './profile';
import { getWeaponBySlot, WEAPONS } from './weapons';

export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover' | 'editor';

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  ammo: number;
  magSize: number;
  reloading: boolean;
  reloadProgress: number;
  weaponId: WeaponId;
  speed: number;
  sliding: boolean;
  alive: boolean;
  respawnTimer: number;
  kills: number;
  deaths: number;
  score: number;
  streak: number;
  gunGameTier: number;
  timeRemaining: number;
  scoreLimit: number;
  redScore: number;
  blueScore: number;
  mode: GameMode;
  team: string;
  fps: number;
  pingMs: number;
  renderScale: number;
  hitmarkerActive: boolean;
  hitmarkerHeadshot: boolean;
  damageFlash: number;
  pointerLocked: boolean;
  players: Array<{
    id: string;
    name: string;
    team: string;
    x: number;
    z: number;
    yaw: number;
    alive: boolean;
    kills: number;
    deaths: number;
    score: number;
    isBot: boolean;
    isSelf: boolean;
  }>;
  killFeed: KillFeedItem[];
  winnerText: string;
  nextMapName: string;
  /** Recent incoming hits as attacker offset from the player + age (0..1) for the direction indicator */
  damageHits: Array<{ dx: number; dz: number; age: number }>;
  winnerId: string;
  selfId: string;
  isHost: boolean;
  matchEnded: boolean;
  localYaw: number;
  localX: number;
  localZ: number;
  mapId: string;
  mapName: string;
  mapHalfW: number;
  mapHalfD: number;
  mapBlocks: MapBlock[];
  adsBlend: number;
  scoped: boolean;
  medicateActive: boolean;
  medicateHp: number;
  medicateShield: number;
  roomJoinCode: string;
  maxPlayers: number;
  botCount: number;
  roomVisibility: RoomVisibility;
  roomHasPassword: boolean;
  matchPhase: 'countdown' | 'active' | 'ended';
  countdownRemaining: number;
  goBannerActive: boolean;
  characterStyle: CharacterStyle;
  accentColor: string;
}

export interface EngineSettings {
  sensitivity: number;
  fov: number;
  quality: GraphicsQuality;
  autoFire: boolean;
  muted: boolean;
  volume: number;
  music?: boolean;
}

export interface DeployOptions {
  roomId: string;
  joinCode?: string;
  roomName?: string;
  name: string;
  clanTag?: string;
  characterStyle?: CharacterStyle;
  accentColor?: string;
  preferredWeapon?: WeaponId;
  mode: GameMode;
  mapId: string;
  maxPlayers?: number;
  botCount?: number;
  shuffleMaps?: boolean;
  isFriendsRoom?: boolean;
  visibility?: RoomVisibility;
  password?: string;
  createIfMissing?: boolean;
  customMap?: MapData;
}

interface RemoteInterp {
  rig: PlayerRig;
  buffer: Array<{ time: number; x: number; y: number; z: number; yaw: number; pitch: number; alive: boolean; sliding: boolean }>;
  walkPhase: number;
  lastX: number;
  lastZ: number;
  hitFlashTimer: number;
  deathTilt: number;
  stepAccum: number;
  team: string;
  characterStyle: CharacterStyle;
  accentColor: string;
}

interface TracerSlot {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  length: number;
}

interface ImpactBurstSlot {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
}

interface ShellSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  life: number;
}

interface SparkSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

// Pre-allocated scratch math helpers (zero GC inside render loop)
const _v3A = new THREE.Vector3();
const _v3B = new THREE.Vector3();
const _v3C = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class VelocityClientEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private audio = new VelocityAudio();
  private materials: ArenaMaterialSet | null = null;
  private mapGroup = new THREE.Group();
  private exteriorGroup = new THREE.Group();
  private currentMap: MapData = MAPS.foundry;

  // Viewmodel
  private viewmodelAnchor = new THREE.Group();
  private viewmodels = new Map<WeaponId, WeaponViewmodel>();
  private muzzleLight = new THREE.PointLight(0xfbbf24, 0, 14, 1.4);
  private sun: THREE.DirectionalLight | null = null;
  private dust: THREE.Points | null = null;
  private activeWeaponId: WeaponId = 'rifle';
  private recoilKick = 0;
  private recoilRoll = 0;
  private muzzleTimer = 0;
  private muzzleFramesLeft = 0;
  private localLastFireMs = 0;
  private lastPredictedShotTime = 0;
  private walkBobPhase = 0;
  private weaponSwitchDip = 0;
  private weaponSwitchRoll = 0;
  private weaponSwitchZ = 0;
  private meleeSlashTimer = 0;

  // Pooled volumetric tracers, impact bursts, ejected shells & sparks
  private tracers: TracerSlot[] = [];
  private tracerIndex = 0;
  private impactBursts: ImpactBurstSlot[] = [];
  private impactBurstCursor = 0;
  private shellMesh: THREE.InstancedMesh;
  private shells: ShellSlot[] = [];
  private shellCursor = 0;
  private sparkMesh: THREE.InstancedMesh;
  private sparks: SparkSlot[] = [];
  private sparkCursor = 0;

  // Remote players
  private remoteRigs = new Map<string, RemoteInterp>();
  private colorIndex = 0;
  private readonly ffaPalette = [0xe11d48, 0x0284c7, 0x16a34a, 0xd97706, 0x9333ea, 0x0d9488];

  // Networking & Prediction
  private ws: WebSocket | null = null;
  private selfId = '';
  private currentMode: GameMode = 'FFA';
  private roomJoinCode = 'FOUNDRY';
  private roomMaxPlayers = 18;
  private roomVisibility: RoomVisibility = 'public';
  private roomHasPassword = false;
  private lastCountdownSec = 0;
  private goBannerTimer = 0;
  private pendingInputs: PlayerInput[] = [];
  private inputSeq = 0;
  private localState: PlayerState;
  private lastSnapshot: MatchSnapshot | null = null;
  private killFeed: KillFeedItem[] = [];
  private pingMs = 18;
  private pingInterval: number | null = null;
  private lastInputSendTime = 0;
  private localStepDist = 0;
  private damageHitLog: Array<{ dx: number; dz: number; t: number }> = [];
  private lastEmptyClickMs = 0;
  private lastImpactSoundMs = 0;
  private outgoingInputs: PlayerInput[] = [];
  private connectTimer: number | null = null;
  private ammoBank: Partial<Record<WeaponId, number>> = {};

  // Game phase & lifecycle
  private phase: GamePhase = 'title';
  private frameId = 0;
  private lastResizeW = 0;
  private lastResizeH = 0;
  private disposed = false;
  private lastFrameTime = performance.now();
  private titleOrbitAngle = 0.6;
  private resizeObserver: ResizeObserver;
  private onHudUpdate: (hud: HudSnapshot) => void;
  private onPhaseRequest: (phase: GamePhase) => void;
  private onServerError?: (msg: string) => void;
  private lastHudEmit = 0;

  // Adaptive graphics & FPS
  private settings: EngineSettings = {
    sensitivity: 0.0022,
    fov: 78,
    quality: 'auto',
    autoFire: false,
    muted: false,
    volume: 0.7,
  };
  private renderScale = 1.0;
  private fpsSamples: number[] = [];
  private currentFps = 60;
  private lastAdaptiveCheck = performance.now();
  private peakFps = 60;
  private goodChecks = 0;

  // Input states & combat feedback
  private keys = new Set<string>();
  private mouseDown = false;
  private fireQueued = false;
  private adsHeld = false;
  private adsToggled = false;
  private adsBlend = 0;
  private jumpQueued = false;
  private slideHeld = false;
  private reloadQueued = false;
  private pendingWeaponSlot = 0;
  private pendingWeaponTarget: WeaponId | null = null;
  private pendingWeaponUntil = 0;
  private touchMoveX = 0;
  private touchMoveY = 0;
  private touchFireHeld = false;
  private hitmarkerTimer = 0;
  private hitmarkerHead = false;
  private damageFlash = 0;
  private medicateTimer = 0;
  private medicateHp = 0;
  private medicateShield = 0;
  private trauma = 0;
  private hitstopTimer = 0;

  constructor(
    container: HTMLElement,
    onHudUpdate: (hud: HudSnapshot) => void,
    onPhaseRequest: (phase: GamePhase) => void,
    onServerError?: (msg: string) => void,
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onPhaseRequest = onPhaseRequest;
    this.onServerError = onServerError;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Only static map blocks cast shadows, so the shadow map is rendered once per map instead of every frame.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const width = Math.max(320, container.clientWidth || window.innerWidth);
    const height = Math.max(240, container.clientHeight || window.innerHeight);
    this.lastResizeW = width;
    this.lastResizeH = height;
    this.renderer.setSize(width, height, false);

    this.camera = new THREE.PerspectiveCamera(this.settings.fov, width / height, 0.08, 420);
    this.scene.add(this.camera);

    // Environment reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Lighting rig (warm sun key + cool hemisphere fill)
    const hemi = new THREE.HemisphereLight(0x9bd0f5, 0x2a323d, 0.92);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff1d6, 2.0);
    sun.position.set(28, 46, 22);
    if (!this.isSoftwareGl) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.near = 5;
      sun.shadow.camera.far = 110;
      const d = 34;
      sun.shadow.camera.left = -d;
      sun.shadow.camera.right = d;
      sun.shadow.camera.top = d;
      sun.shadow.camera.bottom = -d;
      sun.shadow.bias = -0.0005;
      sun.shadow.normalBias = 0.02;
    }
    this.scene.add(sun);
    this.sun = sun;

    this.scene.add(this.exteriorGroup);
    this.scene.add(this.mapGroup);

    // First-person viewmodel anchor on camera
    this.camera.add(this.viewmodelAnchor);
    this.muzzleLight.position.set(0.18, -0.1, -0.85);
    this.viewmodelAnchor.add(this.muzzleLight);
    for (const wid of ['rifle', 'smg', 'shotgun', 'sniper', 'pistol', 'knife'] as WeaponId[]) {
      const vm = buildWeaponViewmodel(wid);
      vm.group.visible = wid === 'rifle';
      vm.group.position.set(...vm.hipPos);
      this.viewmodelAnchor.add(vm.group);
      this.viewmodels.set(wid, vm);
    }

    // Pooled volumetric glowing bullet tracers
    const tracerGeo = new THREE.CylinderGeometry(0.032, 0.02, 1, 6);
    for (let i = 0; i < 28; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(tracerGeo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.tracers.push({ mesh, mat, life: 0, maxLife: 0.11, length: 1 });
    }

    // Pooled additive impact starbursts
    const burstGeo = new THREE.OctahedronGeometry(0.16, 0);
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(burstGeo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.impactBursts.push({ mesh, mat, life: 0, maxLife: 0.12 });
    }

    // Pooled InstancedMesh ejected brass shell casings
    const shellGeo = new THREE.BoxGeometry(0.016, 0.016, 0.045);
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.28,
      metalness: 0.85,
    });
    this.shellMesh = new THREE.InstancedMesh(shellGeo, shellMat, 32);
    this.shellMesh.frustumCulled = false;
    this.shellMesh.count = 32;
    _mat4.makeScale(0, 0, 0);
    for (let i = 0; i < 32; i++) {
      this.shellMesh.setMatrixAt(i, _mat4);
      this.shells.push({ active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, life: 0 });
    }
    this.shellMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.shellMesh);

    // Pooled InstancedMesh impact sparks
    const sparkGeo = new THREE.BoxGeometry(0.075, 0.075, 0.075);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    this.sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, 64);
    this.sparkMesh.frustumCulled = false;
    this.sparkMesh.count = 64;
    _mat4.makeScale(0, 0, 0);
    for (let i = 0; i < 64; i++) {
      this.sparkMesh.setMatrixAt(i, _mat4);
      this.sparks.push({ active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.sparkMesh);

    this.localState = this.createEmptyState();
    this.loadMapScene(MAPS.foundry);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    this.bindEvents();
    this.startLoop();
  }

  private createEmptyState(): PlayerState {
    const sp = this.currentMap.spawns[0];
    return {
      id: 'local',
      name: 'Vanguard-01',
      isBot: false,
      team: 'NONE',
      characterStyle: 'vanguard',
      accentColor: '#38BDF8',
      x: sp.x,
      y: sp.y,
      z: sp.z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: sp.yaw,
      pitch: 0,
      hp: 100,
      maxHp: 100,
      shield: 50,
      maxShield: 50,
      grounded: true,
      sliding: false,
      slideTimer: 0,
      coyoteTimer: 0.1,
      alive: true,
      respawnTimer: 0,
      weaponId: 'rifle',
      ammo: 30,
      reloading: false,
      reloadTimer: 0,
      lastFireTime: 0,
      kills: 0,
      deaths: 0,
      score: 0,
      gunGameTier: 0,
      streak: 0,
      shotsFired: 0,
      shotsHit: 0,
      lastProcessedSeq: 0,
    };
  }

  public loadMapScene(map: MapData) {
    this.currentMap = map;
    if (this.phase !== 'playing' && map.spawns[0]) {
      this.localState.x = map.spawns[0].x;
      this.localState.y = map.spawns[0].y;
      this.localState.z = map.spawns[0].z;
      this.localState.yaw = map.spawns[0].yaw;
    }
    this.scene.background = new THREE.Color(map.skyHorizon);
    this.scene.fog = new THREE.FogExp2(map.fogColor, 0.011);

    while (this.mapGroup.children.length > 0) {
      const child = this.mapGroup.children[0] as THREE.Mesh;
      child.geometry?.dispose();
      this.mapGroup.remove(child);
    }
    while (this.exteriorGroup.children.length > 0) {
      const child = this.exteriorGroup.children[0] as THREE.Mesh;
      child.geometry?.dispose();
      this.exteriorGroup.remove(child);
    }
    this.materials?.dispose();

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.materials = createArenaMaterials(maxAniso, map.floorColor);

    const floorGeo = new THREE.PlaneGeometry(map.bounds.halfW * 2, map.bounds.halfD * 2, 1, 1);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMesh = new THREE.Mesh(floorGeo, this.materials.floor);
    floorMesh.receiveShadow = !this.isSoftwareGl;
    this.mapGroup.add(floorMesh);

    for (const b of map.blocks) {
      const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
      const mat = this.materials.blocks[b.material] || this.materials.blocks.concrete;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(b.x, b.y, b.z);
      mesh.castShadow = !this.isSoftwareGl;
      mesh.receiveShadow = !this.isSoftwareGl;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.mapGroup.add(mesh);
    }

    const extGroundGeo = new THREE.PlaneGeometry(340, 340, 1, 1);
    extGroundGeo.rotateX(-Math.PI / 2);
    const extGroundMat = new THREE.MeshStandardMaterial({
      color: map.theme === 'rooftop' ? 0x1e2530 : 0x2b323b,
      roughness: 0.95,
      metalness: 0.05,
    });
    const extGround = new THREE.Mesh(extGroundGeo, extGroundMat);
    extGround.position.y = -0.08;
    this.exteriorGroup.add(extGround);

    const skylineMat = new THREE.MeshStandardMaterial({
      color: map.theme === 'rooftop' ? 0x334155 : 0x475569,
      roughness: 0.85,
      metalness: 0.15,
    });
    const pillarGeo = new THREE.BoxGeometry(1, 1, 1);
    const ringCount = 28;
    const skylineInst = new THREE.InstancedMesh(pillarGeo, skylineMat, ringCount);
    for (let i = 0; i < ringCount; i++) {
      const angle = (i / ringCount) * Math.PI * 2;
      const dist = 56 + (i % 3) * 22;
      const h = 14 + ((i * 17) % 28);
      const w = 8 + ((i * 7) % 10);
      _v3A.set(Math.cos(angle) * dist, h * 0.5 - 0.1, Math.sin(angle) * dist);
      _quat.identity();
      _scale.set(w, h, w);
      _mat4.compose(_v3A, _quat, _scale);
      skylineInst.setMatrixAt(i, _mat4);
    }
    skylineInst.instanceMatrix.needsUpdate = true;
    skylineInst.computeBoundingSphere();
    this.exteriorGroup.add(skylineInst);
    this.renderer.shadowMap.needsUpdate = true;

    // Gradient sky dome with a soft sun glow (replaces the flat background colour)
    const horizon = new THREE.Color(map.skyHorizon);
    const zenith = horizon.clone().lerp(new THREE.Color(0x3a6fb0), 0.62).multiplyScalar(0.88);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uHorizon: { value: horizon },
        uZenith: { value: zenith },
        uSunDir: { value: new THREE.Vector3(28, 46, 22).normalize() },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uHorizon;
        uniform vec3 uZenith;
        uniform vec3 uSunDir;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));
          float sun = max(dot(d, uSunDir), 0.0);
          col += vec3(1.0, 0.86, 0.62) * (pow(sun, 380.0) * 1.4 + pow(sun, 9.0) * 0.16);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(380, 24, 16), skyMat);
    skyDome.frustumCulled = false;
    skyDome.renderOrder = -10;
    this.exteriorGroup.add(skyDome);

    // Floating dust motes catch the light and give the arena depth
    const dustCount = this.isSoftwareGl ? 0 : 140;
    if (dustCount > 0) {
      const pos = new Float32Array(dustCount * 3);
      for (let i = 0; i < dustCount; i++) {
        pos[i * 3] = (Math.random() * 2 - 1) * map.bounds.halfW;
        pos[i * 3 + 1] = 0.4 + Math.random() * 7;
        pos[i * 3 + 2] = (Math.random() * 2 - 1) * map.bounds.halfD;
      }
      const dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const dustMat = new THREE.PointsMaterial({
        color: 0xfff4dc,
        size: 0.07,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        sizeAttenuation: true,
        fog: true,
      });
      this.dust = new THREE.Points(dustGeo, dustMat);
      this.dust.frustumCulled = false;
      this.exteriorGroup.add(this.dust);
    } else {
      this.dust = null;
    }
  }

  public connectAndDeploy(opts: DeployOptions) {
    this.audio.unlock();
    this.disconnect();

    const startWeapon: WeaponId =
      opts.preferredWeapon && WEAPONS[opts.preferredWeapon] ? opts.preferredWeapon : 'rifle';
    this.localState.weaponId = startWeapon;
    this.localState.ammo = WEAPONS[startWeapon].magSize;
    this.localState.reloading = false;
    this.localState.reloadTimer = 0;
    this.localLastFireMs = 0;
    this.lastPredictedShotTime = 0;
    this.muzzleTimer = 0;
    this.muzzleFramesLeft = 0;
    this.meleeSlashTimer = 0;
    this.pendingWeaponTarget = null;
    this.pendingWeaponUntil = 0;
    this.switchWeaponVisual(startWeapon, true);

    this.localState.characterStyle = opts.characterStyle || 'vanguard';
    this.localState.accentColor = opts.accentColor || '#38BDF8';
    const accentHex = parseHexColor(this.localState.accentColor);
    this.viewmodels.forEach((vm) => vm.setSleeveAccent(accentHex));

    const configuredUrl = process.env.NEXT_PUBLIC_WS_URL;
    let wsUrl: string;
    if (configuredUrl) {
      wsUrl = configuredUrl;
    } else {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${proto}//${window.location.host}/ws`;
    }
const ws = new WebSocket(wsUrl);
    this.ws = ws;
    this.ammoBank = {};
    this.outgoingInputs = [];

    // Give up if the server never answers with a welcome packet (server down / blocked network).
    this.connectTimer = window.setTimeout(() => {
      if (this.ws !== ws || this.selfId) return;
      this.disconnect();
      this.onServerError?.('Could not reach the game server (timed out). Check your connection and try again.');
    }, 10000);

    ws.onopen = () => {
      this.sendWs({
        type: 'join',
        roomId: opts.roomId,
        joinCode: opts.joinCode,
        roomName: opts.roomName,
        name: opts.name,
        clanTag: opts.clanTag,
        characterStyle: opts.characterStyle,
        accentColor: opts.accentColor,
        preferredWeapon: opts.preferredWeapon,
        mode: opts.mode,
        mapId: opts.mapId,
        maxPlayers: opts.maxPlayers,
        botCount: opts.botCount,
        isFriendsRoom: opts.isFriendsRoom,
        visibility: opts.visibility,
        password: opts.password,
        shuffleMaps: opts.shuffleMaps,
        createIfMissing: opts.createIfMissing,
        customMap: opts.customMap,
      });
      this.pingInterval = window.setInterval(() => {
        this.sendWs({ type: 'ping', clientTime: Date.now(), rtt: this.pingMs });
      }, 2000);
    };

    ws.onclose = () => {
      // Ignore sockets we closed ourselves (disconnect() clears this.ws first).
      if (this.ws !== ws || this.disposed) return;
      const wasInMatch = Boolean(this.selfId);
      this.disconnect();
      this.onServerError?.(
        wasInMatch
          ? 'Connection lost. The server stopped responding — check your network and deploy again.'
          : 'Could not reach the game server. Please try again.',
      );
    };

    ws.onmessage = (ev) => {
      if (this.ws !== ws) return;
      try {
        const msg = JSON.parse(ev.data) as ServerMessage;
        this.handleServerMessage(msg);
      } catch {
        // Ignore malformed
      }
    };
  }

  public updateProfile(profile: {
    name: string;
    clanTag?: string;
    characterStyle: CharacterStyle;
    accentColor: string;
    preferredWeapon?: WeaponId;
  }) {
    this.localState.characterStyle = profile.characterStyle;
    this.localState.accentColor = profile.accentColor;
    const accentHex = parseHexColor(profile.accentColor);
    this.viewmodels.forEach((vm) => vm.setSleeveAccent(accentHex));
    this.sendWs({
      type: 'update_profile',
      name: profile.name,
      clanTag: profile.clanTag,
      characterStyle: profile.characterStyle,
      accentColor: profile.accentColor,
      preferredWeapon: profile.preferredWeapon,
    });
  }

  public disconnect() {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    if (this.ws) {
      const old = this.ws;
      this.ws = null;
      try {
        old.close();
      } catch {
        // already closed
      }
    }
    this.outgoingInputs = [];
    this.ammoBank = {};
    for (const r of this.remoteRigs.values()) {
      this.scene.remove(r.rig.root);
      r.rig.dispose();
    }
    this.remoteRigs.clear();
    this.pendingInputs = [];
    this.killFeed = [];
    this.lastSnapshot = null;
    this.selfId = '';
    this.lastCountdownSec = 0;
    this.goBannerTimer = 0;
    this.adsHeld = false;
    this.adsToggled = false;
    this.adsBlend = 0;
  }

  private sendWs(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleServerMessage(msg: ServerMessage) {
    if (msg.type === 'welcome') {
      if (this.connectTimer !== null) {
        clearTimeout(this.connectTimer);
        this.connectTimer = null;
      }
      this.selfId = msg.playerId;
      this.currentMode = msg.mode;
      this.roomJoinCode = msg.joinCode;
      this.roomMaxPlayers = msg.maxPlayers;
      this.roomVisibility = msg.visibility;
      this.roomHasPassword = msg.hasPassword;
      this.lastCountdownSec = 0;
      this.goBannerTimer = 0;
      if (msg.map.id !== this.currentMap.id || msg.map.id === 'custom') {
        this.loadMapScene(msg.map);
      }
      return;
    }

    if (msg.type === 'map_change') {
      // Shuffle rooms rotate to a new arena between matches
      this.loadMapScene(msg.map);
      this.pendingInputs = [];
      this.emitHudSnapshot();
      return;
    }

    if (msg.type === 'error') {
      this.disconnect();
      this.onServerError?.(msg.message);
      return;
    }

    if (msg.type === 'pong') {
      this.pingMs = Math.max(1, Math.round(Date.now() - msg.clientTime));
      return;
    }

    if (msg.type === 'shot') {
      this.handleShotVisuals(msg.shot);
      return;
    }

    if (msg.type === 'kill') {
      this.killFeed = [msg.kill, ...this.killFeed].slice(0, 5);
      if (msg.kill.killerId === this.selfId) {
        this.audio.playKillChime();
        this.hitstopTimer = 0.038;
      }
      return;
    }

    if (msg.type === 'medicate') {
      this.localState.hp = msg.hp;
      this.localState.shield = msg.shield;
      if (msg.healedHp > 0 || msg.healedShield > 0) {
        this.medicateHp = msg.healedHp;
        this.medicateShield = msg.healedShield;
        this.medicateTimer = 1.9;
        this.audio.playMedicate();
      }
      return;
    }

    if (msg.type === 'hit_confirm') {
      this.hitmarkerTimer = 0.16;
      this.hitmarkerHead = msg.headshot;
      this.audio.playHitmarker(msg.headshot);
      return;
    }

    if (msg.type === 'damaged') {
      const attacker = this.lastSnapshot?.players.find((pl) => pl.id === msg.attackerId);
      if (attacker) {
        this.damageHitLog.push({
          dx: attacker.x - this.localState.x,
          dz: attacker.z - this.localState.z,
          t: performance.now(),
        });
        if (this.damageHitLog.length > 6) this.damageHitLog.shift();
      }
      this.damageFlash = 0.55;
      this.trauma = Math.min(1, this.trauma + 0.35);
      this.audio.playDamaged();
      return;
    }

    if (msg.type === 'snapshot') {
      this.reconcileSnapshot(msg.snapshot);
    }
  }

  private reconcileSnapshot(snapshot: MatchSnapshot) {
    const prevPhase = this.lastSnapshot?.phase;
    this.lastSnapshot = snapshot;
    this.roomJoinCode = snapshot.joinCode || this.roomJoinCode;
    this.roomMaxPlayers = snapshot.maxPlayers || this.roomMaxPlayers;
    this.roomVisibility = snapshot.visibility || this.roomVisibility;
    this.roomHasPassword = Boolean(snapshot.hasPassword);

    if (snapshot.phase === 'ended' && prevPhase !== 'ended' && prevPhase !== undefined) {
      const me = snapshot.players.find((pl) => pl.id === this.selfId);
      const won =
        snapshot.mode === 'TDM'
          ? Boolean(me) && me!.team !== 'NONE' && snapshot.winnerText.startsWith(me!.team)
          : Boolean(snapshot.winnerId) && snapshot.winnerId === this.selfId;
      this.audio.playMatchEnd(won);
    }

    if (snapshot.phase === 'countdown') {
      const sec = Math.max(1, Math.ceil(snapshot.countdownRemaining));
      if (sec !== this.lastCountdownSec) {
        this.lastCountdownSec = sec;
        this.audio.playCountdownBeep(false);
        this.emitHudSnapshot();
      }
    } else if (prevPhase === 'countdown' && snapshot.phase === 'active') {
      this.lastCountdownSec = 0;
      this.goBannerTimer = 0.85;
      this.audio.playCountdownBeep(true);
      this.emitHudSnapshot();
    } else if (prevPhase === undefined) {
      this.emitHudSnapshot();
    }

    const now = performance.now();
    const activeIds = new Set<string>();

    for (const p of snapshot.players) {
      if (p.id === this.selfId) {
        const prevAlive = this.localState.alive;
        const prevWeapon = this.localState.weaponId;
        const prevAmmo = this.localState.ammo;
        const prevReloading = this.localState.reloading;
        this.localState.hp = p.hp;
        this.localState.maxHp = p.maxHp;
        this.localState.shield = p.shield;
        this.localState.maxShield = p.maxShield;
        this.localState.alive = p.alive;
        this.localState.respawnTimer = p.respawnTimer;
        this.localState.kills = p.kills;
        this.localState.deaths = p.deaths;
        this.localState.score = p.score;
        this.localState.streak = p.streak;
        this.localState.gunGameTier = p.gunGameTier;
        this.localState.team = p.team;
        if (prevAlive && !p.alive) {
          this.audio.playDeath();
          this.audio.setLowHealth(false);
        } else if (!prevAlive && p.alive) {
          this.audio.playRespawn();
        }
        this.audio.setLowHealth(this.phase === 'playing' && p.alive && p.hp <= 30);
        this.localState.characterStyle = p.characterStyle;
        this.localState.accentColor = p.accentColor;

        if (this.pendingWeaponTarget && now < this.pendingWeaponUntil) {
          if (p.weaponId === this.pendingWeaponTarget) {
            this.pendingWeaponTarget = null;
            this.localState.weaponId = p.weaponId;
            this.localState.ammo = p.ammo;
            this.localState.reloading = p.reloading;
            this.localState.reloadTimer = p.reloadTimer;
          }
        } else {
          this.pendingWeaponTarget = null;
          this.localState.weaponId = p.weaponId;
          this.localState.ammo = p.ammo;
          this.localState.reloading = p.reloading;
          this.localState.reloadTimer = p.reloadTimer;
        }

        if (this.localState.weaponId !== this.activeWeaponId) {
          this.switchWeaponVisual(this.localState.weaponId);
        }
        if (
          this.localState.ammo !== prevAmmo ||
          this.localState.weaponId !== prevWeapon ||
          this.localState.reloading !== prevReloading ||
          snapshot.phase === 'ended'
        ) {
          this.emitHudSnapshot();
        }

        if (!prevAlive && p.alive) {
          this.localState.x = p.x;
          this.localState.y = p.y;
          this.localState.z = p.z;
          this.localState.vx = 0;
          this.localState.vy = 0;
          this.localState.vz = 0;
          this.localState.yaw = p.yaw;
          this.localState.pitch = p.pitch;
          this.pendingInputs = [];
        } else if (p.alive) {
          this.pendingInputs = this.pendingInputs.filter((i) => i.seq > p.lastProcessedSeq);
          const authCopy = { ...p, yaw: this.localState.yaw, pitch: this.localState.pitch };
          for (const inp of this.pendingInputs) {
            stepPlayerMovement(authCopy, inp, this.currentMap);
          }
          const errDist = Math.hypot(
            authCopy.x - this.localState.x,
            authCopy.y - this.localState.y,
            authCopy.z - this.localState.z,
          );
          if (errDist > 1.8) {
            this.localState.x = authCopy.x;
            this.localState.y = authCopy.y;
            this.localState.z = authCopy.z;
            this.localState.vx = authCopy.vx;
            this.localState.vy = authCopy.vy;
            this.localState.vz = authCopy.vz;
          } else if (errDist > 0.08) {
            this.localState.x += (authCopy.x - this.localState.x) * 0.35;
            this.localState.y += (authCopy.y - this.localState.y) * 0.35;
            this.localState.z += (authCopy.z - this.localState.z) * 0.35;
          }
        }
        continue;
      }

      activeIds.add(p.id);
      let remote = this.remoteRigs.get(p.id);
      const style = p.characterStyle || 'vanguard';
      const accent = p.accentColor || '#38BDF8';
      if (
        !remote ||
        remote.team !== p.team ||
        remote.characterStyle !== style ||
        remote.accentColor !== accent
      ) {
        if (remote) {
          this.scene.remove(remote.rig.root);
          remote.rig.dispose();
        }
        const shMat = this.materials?.shadowDisc || new THREE.MeshBasicMaterial({ visible: false });
        const col = this.ffaPalette[this.colorIndex++ % this.ffaPalette.length];
        const rig = buildPlayerRig(p.team, shMat, col, style, parseHexColor(accent));
        this.scene.add(rig.root);
        remote = {
          rig,
          buffer: [],
          walkPhase: 0,
          lastX: p.x,
          lastZ: p.z,
          hitFlashTimer: 0,
          deathTilt: 0,
          stepAccum: 0,
          team: p.team,
          characterStyle: style,
          accentColor: accent,
        };
        this.remoteRigs.set(p.id, remote);
      }

      remote.buffer.push({
        time: now,
        x: p.x,
        y: p.y,
        z: p.z,
        yaw: p.yaw,
        pitch: p.pitch,
        alive: p.alive,
        sliding: p.sliding,
      });
      if (remote.buffer.length > 16) {
        remote.buffer.shift();
      }
    }

    for (const [id, remote] of this.remoteRigs.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(remote.rig.root);
        remote.rig.dispose();
        this.remoteRigs.delete(id);
      }
    }
  }

  private triggerLocalMuzzleVisuals(weaponId: WeaponId, originPos?: { x: number; y: number; z: number }) {
    if (weaponId === 'knife') {
      this.meleeSlashTimer = 0.24;
      this.recoilKick = 0.06;
      this.recoilRoll = -0.26;
      this.audio.playShot('knife', undefined, this.localState, this.localState.yaw);
      return;
    }

    this.muzzleTimer = 0.11;
    this.muzzleFramesLeft = 3;
    const kick =
      weaponId === 'sniper' ? 0.15 : weaponId === 'shotgun' ? 0.13 : weaponId === 'smg' ? 0.05 : 0.072;
    this.recoilKick = Math.min(0.24, this.recoilKick + kick);
    this.recoilRoll = (Math.random() - 0.5) * 0.09;
    this.trauma = Math.min(
      1,
      this.trauma + (weaponId === 'sniper' || weaponId === 'shotgun' ? 0.22 : 0.11),
    );

    this.muzzleLight.color.setHex(weaponId === 'sniper' ? 0x38bdf8 : 0xfbbf24);
    this.muzzleLight.intensity = 7.5;

    const vm = this.viewmodels.get(this.activeWeaponId);
    if (vm) {
      vm.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
      const sc = 0.95 + Math.random() * 0.45;
      vm.muzzleFlash.scale.set(sc, sc, sc);
      this.muzzleLight.position.set(
        vm.group.position.x + vm.muzzleLocalPos[0],
        vm.group.position.y + vm.muzzleLocalPos[1],
        vm.group.position.z + vm.muzzleLocalPos[2] - 0.06,
      );
    }

    if (weaponId !== 'sniper') {
      const sh = this.shells[this.shellCursor];
      this.shellCursor = (this.shellCursor + 1) % this.shells.length;
      const rightX = Math.cos(this.localState.yaw);
      const rightZ = -Math.sin(this.localState.yaw);
      const fwdX = -Math.sin(this.localState.yaw);
      const fwdZ = -Math.cos(this.localState.yaw);
      const eyeY =
        originPos?.y ??
        this.localState.y + (this.localState.sliding ? SLIDE_EYE_HEIGHT : PLAYER_EYE_HEIGHT);
      const ox = originPos?.x ?? this.localState.x;
      const oz = originPos?.z ?? this.localState.z;
      sh.active = true;
      sh.x = ox + rightX * 0.24 + fwdX * 0.35;
      sh.y = eyeY - 0.14;
      sh.z = oz + rightZ * 0.24 + fwdZ * 0.35;
      sh.vx = rightX * (2.2 + Math.random() * 1.1) + (Math.random() - 0.5) * 0.5;
      sh.vy = 2.1 + Math.random() * 1.1;
      sh.vz = rightZ * (2.2 + Math.random() * 1.1) + (Math.random() - 0.5) * 0.5;
      sh.rx = Math.random() * Math.PI;
      sh.ry = Math.random() * Math.PI;
      sh.life = 0.55;
    }

    this.audio.playShot(weaponId, undefined, this.localState, this.localState.yaw);
  }

  private playShotWorldAudio(shot: ShotEvent, isSelf: boolean) {
    if (shot.weaponId === 'knife') return;
    const now = performance.now();
    if (!shot.hitPlayerId && now - this.lastImpactSoundMs > 45) {
      this.lastImpactSoundMs = now;
      this.audio.playImpact(shot.endPoint, this.localState, this.localState.yaw);
    }
    if (isSelf) return;
    // Near-miss whiz: distance from the listener's head to the bullet segment.
    const ex = this.localState.x;
    const ey = this.localState.y + 1.5;
    const ez = this.localState.z;
    const dx = shot.endPoint.x - shot.origin.x;
    const dy = shot.endPoint.y - shot.origin.y;
    const dz = shot.endPoint.z - shot.origin.z;
    const len2 = dx * dx + dy * dy + dz * dz;
    if (len2 < 4) return;
    const t = ((ex - shot.origin.x) * dx + (ey - shot.origin.y) * dy + (ez - shot.origin.z) * dz) / len2;
    if (t <= 0.05 || t >= 1) return;
    const cx = shot.origin.x + dx * t - ex;
    const cy = shot.origin.y + dy * t - ey;
    const cz = shot.origin.z + dz * t - ez;
    if (Math.hypot(cx, cy, cz) < 2.2 && shot.hitPlayerId !== this.selfId) {
      const rightX = Math.cos(this.localState.yaw);
      const rightZ = -Math.sin(this.localState.yaw);
      this.audio.playWhiz(Math.max(-1, Math.min(1, cx * rightX + cz * rightZ)));
    }
  }

  private handleShotVisuals(shot: ShotEvent) {
    const isSelf = shot.shooterId === this.selfId;
    this.playShotWorldAudio(shot, isSelf);
    const isMelee = shot.weaponId === 'knife';
    if (isSelf) {
      const recentlyPredicted = performance.now() - this.lastPredictedShotTime < 160;
      if (!recentlyPredicted) {
        this.triggerLocalMuzzleVisuals(shot.weaponId, shot.origin);
      } else if (!isMelee) {
        this.muzzleFramesLeft = Math.max(this.muzzleFramesLeft, 2);
      }
    } else {
      this.audio.playShot(shot.weaponId, shot.origin, this.localState, this.localState.yaw);

      // 3rd-person muzzle flash burst at remote shooter barrel tip (guns only)
      if (!isMelee) {
        _v3A.set(shot.endPoint.x - shot.origin.x, shot.endPoint.y - shot.origin.y, shot.endPoint.z - shot.origin.z);
        if (_v3A.lengthSq() > 0.01) {
          _v3A.normalize();
          const muzzleBurst = this.impactBursts[this.impactBurstCursor];
          this.impactBurstCursor = (this.impactBurstCursor + 1) % this.impactBursts.length;
          muzzleBurst.mat.color.setHex(shot.weaponId === 'sniper' ? 0x38bdf8 : 0xfde047);
          muzzleBurst.mat.opacity = 0.95;
          muzzleBurst.life = muzzleBurst.maxLife;
          muzzleBurst.mesh.position.set(
            shot.origin.x + _v3A.x * 0.72,
            shot.origin.y - 0.14 + _v3A.y * 0.72,
            shot.origin.z + _v3A.z * 0.72,
          );
          muzzleBurst.mesh.scale.set(0.85, 0.85, 0.85);
          muzzleBurst.mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
          muzzleBurst.mesh.visible = true;
        }
      }
    }

    if (shot.hitPlayerId && shot.hitPlayerId !== this.selfId) {
      const targetRig = this.remoteRigs.get(shot.hitPlayerId);
      if (targetRig) targetRig.hitFlashTimer = 0.075;
    }

    if (isMelee) {
      if (shot.hitPlayerId) {
        const burst = this.impactBursts[this.impactBurstCursor];
        this.impactBurstCursor = (this.impactBurstCursor + 1) % this.impactBursts.length;
        burst.mat.color.setHex(shot.headshot ? 0xef4444 : 0xf43f5e);
        burst.mat.opacity = 0.95;
        burst.life = burst.maxLife;
        burst.mesh.position.set(shot.endPoint.x, shot.endPoint.y, shot.endPoint.z);
        burst.mesh.scale.set(0.8, 0.8, 0.8);
        burst.mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
        burst.mesh.visible = true;
      }
      return;
    }

    // Offset first-person tracer start toward visible gun barrel
    _v3A.set(shot.origin.x, shot.origin.y - 0.06, shot.origin.z);
    if (isSelf) {
      const rightX = Math.cos(this.localState.yaw);
      const rightZ = -Math.sin(this.localState.yaw);
      const fwdX = -Math.sin(this.localState.yaw);
      const fwdZ = -Math.cos(this.localState.yaw);
      const sideOffset = this.adsBlend < 0.5 ? 0.18 : 0.05;
      const dropOffset = this.adsBlend < 0.5 ? 0.08 : 0.04;
      _v3A.x += rightX * sideOffset + fwdX * 0.55;
      _v3A.y -= dropOffset;
      _v3A.z += rightZ * sideOffset + fwdZ * 0.55;
    }
    _v3B.set(shot.endPoint.x, shot.endPoint.y, shot.endPoint.z);
    _v3C.subVectors(_v3B, _v3A);
    const dist = _v3C.length();
    if (dist > 0.25) {
      const slot = this.tracers[this.tracerIndex];
      this.tracerIndex = (this.tracerIndex + 1) % this.tracers.length;
      const tracerColor =
        shot.weaponId === 'sniper' ? 0x38bdf8 : shot.weaponId === 'shotgun' ? 0xfb923c : 0xfde047;
      slot.mat.color.setHex(tracerColor);
      slot.mat.opacity = 0.96;
      slot.maxLife = shot.weaponId === 'sniper' ? 0.22 : 0.14;
      slot.life = slot.maxLife;
      slot.length = dist;
      slot.mesh.position.addVectors(_v3A, _v3B).multiplyScalar(0.5);
      _v3C.normalize();
      slot.mesh.quaternion.setFromUnitVectors(_upAxis, _v3C);
      const thickness = shot.weaponId === 'sniper' ? 2.0 : 1.25;
      slot.mesh.scale.set(thickness, dist, thickness);
      slot.mesh.visible = true;
    }

    // Additive impact starburst flash
    const burst = this.impactBursts[this.impactBurstCursor];
    this.impactBurstCursor = (this.impactBurstCursor + 1) % this.impactBursts.length;
    burst.mat.color.setHex(shot.hitPlayerId ? (shot.headshot ? 0xef4444 : 0x38bdf8) : 0xfbbf24);
    burst.mat.opacity = 0.95;
    burst.life = burst.maxLife;
    burst.mesh.position.set(shot.endPoint.x, shot.endPoint.y, shot.endPoint.z);
    burst.mesh.scale.set(0.75, 0.75, 0.75);
    burst.mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    burst.mesh.visible = true;

    const sparkCount = this.settings.quality === 'low' ? 4 : 8;
    for (let i = 0; i < sparkCount; i++) {
      const sp = this.sparks[this.sparkCursor];
      this.sparkCursor = (this.sparkCursor + 1) % this.sparks.length;
      sp.active = true;
      sp.x = shot.endPoint.x;
      sp.y = shot.endPoint.y;
      sp.z = shot.endPoint.z;
      sp.vx = (Math.random() - 0.5) * 8.5;
      sp.vy = 1.6 + Math.random() * 5.2;
      sp.vz = (Math.random() - 0.5) * 8.5;
      sp.life = 0.28;
    }
  }

  private switchWeaponVisual(weaponId: WeaponId, silent = false) {
    const changed = this.activeWeaponId !== weaponId;
    this.activeWeaponId = weaponId;
    for (const [id, vm] of this.viewmodels.entries()) {
      vm.group.visible = id === weaponId;
    }
    if (changed && !silent) {
      this.weaponSwitchDip = 0.24;
      this.weaponSwitchRoll = -0.34;
      this.weaponSwitchZ = 0.16;
      this.audio.playWeaponSwitch(weaponId);
      this.emitHudSnapshot();
    }
  }

  public setPhase(phase: GamePhase) {
    this.phase = phase;
    this.audio.setMusicMode(phase === 'playing' ? 'match' : 'menu');
    if (phase !== 'playing') {
      this.audio.setLowHealth(false);
      this.keys.clear();
      this.mouseDown = false;
      this.fireQueued = false;
      this.adsHeld = false;
      this.adsToggled = false;
      this.touchFireHeld = false;
      this.slideHeld = false;
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock?.();
      }
    }
    this.viewmodelAnchor.visible = phase === 'playing';
  }

  public updateSettings(partial: Partial<EngineSettings>) {
    this.settings = { ...this.settings, ...partial };
    this.audio.setMuted(this.settings.muted);
    this.audio.setVolume(this.settings.volume);
    if (partial.music !== undefined) this.audio.setMusicEnabled(partial.music);
    if (partial.fov && this.camera.fov !== partial.fov) {
      this.camera.fov = partial.fov;
      this.camera.updateProjectionMatrix();
    }
    if (partial.quality) {
      if (partial.quality === 'low') this.renderScale = 0.68;
      else if (partial.quality === 'medium') this.renderScale = 0.85;
      else this.renderScale = 1.0;
      this.applyPixelRatio();
      if (this.sun && !this.isSoftwareGl) {
        const size = partial.quality === 'high' ? 2048 : 1024;
        if (this.sun.shadow.mapSize.x !== size) {
          this.sun.shadow.map?.dispose();
          this.sun.shadow.map = null;
          this.sun.shadow.mapSize.set(size, size);
        }
        this.sun.castShadow = partial.quality !== 'low';
        this.renderer.shadowMap.needsUpdate = true;
      }
    }
  }

  /** Locks the mouse using raw (unaccelerated) input when the browser supports it – better aim on PC. */
  private lockPointer() {
    const el = this.renderer.domElement as HTMLCanvasElement & {
      requestPointerLock: (opts?: { unadjustedMovement?: boolean }) => Promise<void> | void;
    };
    try {
      const res = el.requestPointerLock?.({ unadjustedMovement: true });
      if (res && typeof (res as Promise<void>).catch === 'function') {
        (res as Promise<void>).catch(() => {
          try {
            el.requestPointerLock?.();
          } catch {
            // lock refused (e.g. no user gesture)
          }
        });
      }
    } catch {
      el.requestPointerLock?.();
    }
  }

  public requestPointerLock() {
    this.audio.unlock();
    if (this.phase === 'playing' && !document.pointerLockElement) {
      this.lockPointer();
    }
  }

  public unlockAudio() {
    this.audio.unlock();
  }

  public playUiClick() {
    this.audio.playUiClick();
  }

  public requestRestartMatch() {
    this.sendWs({ type: 'restart_match' });
  }

  public setTouchMove(x: number, y: number) {
    this.touchMoveX = Math.max(-1, Math.min(1, x));
    this.touchMoveY = Math.max(-1, Math.min(1, y));
  }

  public addTouchLook(dx: number, dy: number) {
    if (this.phase !== 'playing' || !this.localState.alive) return;
    const wSpec = WEAPONS[this.localState.weaponId] || WEAPONS.rifle;
    const sensScale = THREE.MathUtils.lerp(1, wSpec.hasScope ? 0.44 : 0.72, this.adsBlend);
    this.localState.yaw -= dx * this.settings.sensitivity * 1.65 * sensScale;
    this.localState.pitch = Math.max(
      -1.45,
      Math.min(1.45, this.localState.pitch - dy * this.settings.sensitivity * 1.65 * sensScale),
    );
  }

  public setTouchFire(held: boolean) {
    this.audio.unlock();
    this.touchFireHeld = held;
  }

  public toggleAds() {
    this.audio.unlock();
    this.adsToggled = !this.adsToggled;
    this.audio.playScopeToggle(this.adsToggled);
  }

  public setAds(active: boolean) {
    this.audio.unlock();
    if (this.adsToggled !== active) {
      this.adsToggled = active;
      this.audio.playScopeToggle(active);
    }
  }

  public triggerJump() {
    this.audio.unlock();
    this.jumpQueued = true;
  }

  public setSlide(held: boolean) {
    this.slideHeld = held;
  }

  public triggerReload() {
    if (WEAPONS[this.localState.weaponId]?.isMelee) return;
    this.reloadQueued = true;
    this.adsToggled = false;
    this.audio.playReload(this.localState.weaponId);
  }

  public selectWeaponSlot(slot: number) {
    if (this.currentMode === 'GUN_GAME') return;
    const nextWeapon = getWeaponBySlot(slot);
    this.pendingWeaponSlot = slot;
    this.pendingWeaponTarget = nextWeapon;
    this.pendingWeaponUntil = performance.now() + 650;
    this.adsToggled = false;
    if (nextWeapon !== this.localState.weaponId) {
      this.ammoBank[this.localState.weaponId] = this.localState.ammo;
      this.localState.weaponId = nextWeapon;
      this.localState.ammo = this.ammoBank[nextWeapon] ?? WEAPONS[nextWeapon].magSize;
      this.localState.reloading = false;
      this.localState.reloadTimer = 0;
    }
    this.switchWeaponVisual(nextWeapon);
  }

  private applyPixelRatio() {
    const base = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(Math.max(0.6, base * this.renderScale));
  }

  private handleResize() {
    if (this.disposed) return;
    const width = Math.max(320, this.container.clientWidth || window.innerWidth);
    const height = Math.max(240, this.container.clientHeight || window.innerHeight);
    if (width === this.lastResizeW && height === this.lastResizeH) return;
    this.lastResizeW = width;
    this.lastResizeH = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderer.render(this.scene, this.camera);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.phase !== 'playing') return;
    this.keys.add(e.code);
    if (e.code === 'Space') {
      e.preventDefault();
      this.jumpQueued = true;
    } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyC') {
      if (!this.slideHeld) this.audio.playSlide();
      this.slideHeld = true;
    } else if (e.code === 'KeyR') {
      this.triggerReload();
    } else if (e.code === 'KeyF') {
      this.toggleAds();
    } else if (e.code === 'Digit1') this.selectWeaponSlot(1);
    else if (e.code === 'Digit2') this.selectWeaponSlot(2);
    else if (e.code === 'Digit3') this.selectWeaponSlot(3);
    else if (e.code === 'Digit4') this.selectWeaponSlot(4);
    else if (e.code === 'Digit5' || e.code === 'KeyV') this.selectWeaponSlot(5);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyC') {
      this.slideHeld = false;
    }
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.phase !== 'playing' || !this.localState.alive) return;
    if (document.pointerLockElement === this.renderer.domElement) {
      const wSpec = WEAPONS[this.localState.weaponId] || WEAPONS.rifle;
      const sensScale = THREE.MathUtils.lerp(1, wSpec.hasScope ? 0.44 : 0.72, this.adsBlend);
      this.localState.yaw -= e.movementX * this.settings.sensitivity * sensScale;
      this.localState.pitch = Math.max(
        -1.45,
        Math.min(1.45, this.localState.pitch - e.movementY * this.settings.sensitivity * sensScale),
      );
    }
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.phase !== 'playing') return;
    if (e.target === this.renderer.domElement) {
      this.audio.unlock();
      if (e.button === 0) {
        this.mouseDown = true;
        this.fireQueued = true;
        if (!document.pointerLockElement && !this.isSoftwareGl) {
          this.lockPointer();
        }
      } else if (e.button === 2) {
        this.adsHeld = true;
        this.audio.playScopeToggle(true);
      }
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDown = false;
    else if (e.button === 2) {
      if (this.adsHeld) this.audio.playScopeToggle(false);
      this.adsHeld = false;
    }
  };

  private onContextMenu = (e: MouseEvent) => {
    if (this.phase === 'playing') {
      e.preventDefault();
    }
  };

  private onWindowBlur = () => {
    this.keys.clear();
    this.mouseDown = false;
    this.fireQueued = false;
    this.adsHeld = false;
    this.adsToggled = false;
    this.touchFireHeld = false;
    this.slideHeld = false;
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
  };

  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onWindowBlur);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
  }

  private pollGamepad(dt: number): { fwd: number; strafe: number; fire: boolean; ads: boolean } {
    const pads = navigator.getGamepads?.();
    if (!pads) return { fwd: 0, strafe: 0, fire: false, ads: false };
    const pad = pads[0];
    if (!pad) return { fwd: 0, strafe: 0, fire: false, ads: false };

    const dead = 0.16;
    const lx = Math.abs(pad.axes[0] || 0) > dead ? pad.axes[0] : 0;
    const ly = Math.abs(pad.axes[1] || 0) > dead ? -pad.axes[1] : 0;
    const rx = Math.abs(pad.axes[2] || 0) > dead ? pad.axes[2] : 0;
    const ry = Math.abs(pad.axes[3] || 0) > dead ? pad.axes[3] : 0;

    if (rx !== 0 || ry !== 0) {
      const wSpec = WEAPONS[this.localState.weaponId] || WEAPONS.rifle;
      const sensScale = THREE.MathUtils.lerp(1, wSpec.hasScope ? 0.44 : 0.72, this.adsBlend);
      this.localState.yaw -= rx * 2.6 * dt * sensScale;
      this.localState.pitch = Math.max(
        -1.45,
        Math.min(1.45, this.localState.pitch - ry * 2.0 * dt * sensScale),
      );
    }
    if (pad.buttons[0]?.pressed) this.jumpQueued = true;
    if (pad.buttons[1]?.pressed) this.slideHeld = true;
    if (pad.buttons[2]?.pressed) this.triggerReload();

    return {
      fwd: ly,
      strafe: lx,
      fire: Boolean(pad.buttons[7]?.pressed),
      ads: Boolean(pad.buttons[6]?.pressed),
    };
  }

  private startLoop() {
    this.lastFrameTime = performance.now();
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = (now - this.lastFrameTime) / 1000;
      this.lastFrameTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      this.updateFrame(dt, rawDt, now);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    this.frameId = requestAnimationFrame(tick);
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 100);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    let polls = 0;
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      polls++;
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED && polls < 30) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 100);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateFrame(dt: number, rawDt: number, now: number) {
    if (rawDt > 0.001 && rawDt < 0.25) {
      this.fpsSamples.push(1 / rawDt);
      if (this.fpsSamples.length > 30) this.fpsSamples.shift();
      this.currentFps = Math.round(
        this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length,
      );
    }

    // Adaptive resolution. Targets the monitor's real refresh rate (60/120/144/240 Hz) instead of a fixed 60,
    // so a 60 Hz screen that reads 59.8 FPS no longer gets stuck at low resolution.
    if (this.phase === 'playing') {
      this.peakFps = Math.max(Math.min(this.currentFps, 360), this.peakFps * 0.9995);
    }
    if (this.settings.quality === 'auto' && !this.isSoftwareGl && now - this.lastAdaptiveCheck > 1500) {
      this.lastAdaptiveCheck = now;
      const target = Math.max(30, Math.min(this.peakFps, 165));
      if (this.currentFps < target * 0.88 && this.renderScale > 0.7) {
        this.renderScale = Math.max(0.7, this.renderScale - 0.1);
        this.goodChecks = 0;
        this.applyPixelRatio();
      } else if (this.currentFps >= target * 0.96 && this.renderScale < 1.0) {
        // Only scale back up after several consecutive healthy checks (prevents oscillation)
        if (++this.goodChecks >= 4) {
          this.goodChecks = 0;
          this.renderScale = Math.min(1.0, this.renderScale + 0.06);
          this.applyPixelRatio();
        }
      } else {
        this.goodChecks = 0;
      }
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
    }

    if (this.dust) this.dust.rotation.y += dt * 0.02;
    this.hitmarkerTimer = Math.max(0, this.hitmarkerTimer - dt);
    this.medicateTimer = Math.max(0, this.medicateTimer - dt);
    this.goBannerTimer = Math.max(0, this.goBannerTimer - dt);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.8);
    this.trauma = Math.max(0, this.trauma - dt * 2.4);
    this.recoilKick = THREE.MathUtils.damp(this.recoilKick, 0, 16, dt);
    this.recoilRoll = THREE.MathUtils.damp(this.recoilRoll, 0, 16, dt);
    this.weaponSwitchDip = THREE.MathUtils.damp(this.weaponSwitchDip, 0, 14, dt);
    this.weaponSwitchRoll = THREE.MathUtils.damp(this.weaponSwitchRoll, 0, 14, dt);
    this.weaponSwitchZ = THREE.MathUtils.damp(this.weaponSwitchZ, 0, 14, dt);
    this.muzzleTimer = Math.max(0, this.muzzleTimer - dt);
    this.meleeSlashTimer = Math.max(0, this.meleeSlashTimer - dt);
    this.muzzleLight.intensity = THREE.MathUtils.damp(this.muzzleLight.intensity, 0, 22, dt);

    const activeVm = this.viewmodels.get(this.activeWeaponId);
    if (activeVm) {
      activeVm.muzzleFlash.visible =
        this.activeWeaponId !== 'knife' && (this.muzzleTimer > 0 || this.muzzleFramesLeft > 0);
    }
    if (this.muzzleFramesLeft > 0) {
      this.muzzleFramesLeft -= 1;
    }

    for (const tr of this.tracers) {
      if (tr.life > 0) {
        tr.life -= dt;
        if (tr.life <= 0) {
          tr.mesh.visible = false;
        } else {
          const alpha = tr.life / tr.maxLife;
          tr.mat.opacity = alpha * 0.92;
          const th = 0.4 + alpha * 1.1;
          tr.mesh.scale.set(th, tr.length, th);
        }
      }
    }

    for (const burst of this.impactBursts) {
      if (burst.life > 0) {
        burst.life -= dt;
        if (burst.life <= 0) {
          burst.mesh.visible = false;
        } else {
          const t = 1 - burst.life / burst.maxLife;
          const s = 0.6 + t * 1.4;
          burst.mesh.scale.set(s, s, s);
          burst.mat.opacity = (1 - t) * 0.95;
        }
      }
    }

    let shellsDirty = false;
    for (let i = 0; i < this.shells.length; i++) {
      const sh = this.shells[i];
      if (!sh.active) continue;
      shellsDirty = true;
      sh.life -= dt;
      if (sh.life <= 0) {
        sh.active = false;
        _mat4.makeScale(0, 0, 0);
        this.shellMesh.setMatrixAt(i, _mat4);
      } else {
        sh.vy -= 12 * dt;
        sh.x += sh.vx * dt;
        sh.y = Math.max(0.03, sh.y + sh.vy * dt);
        sh.z += sh.vz * dt;
        sh.rx += dt * 16;
        sh.ry += dt * 12;
        _v3A.set(sh.x, sh.y, sh.z);
        _euler.set(sh.rx, sh.ry, 0, 'YXZ');
        _quat.setFromEuler(_euler);
        _scale.set(1, 1, 1);
        _mat4.compose(_v3A, _quat, _scale);
        this.shellMesh.setMatrixAt(i, _mat4);
      }
    }
    if (shellsDirty) this.shellMesh.instanceMatrix.needsUpdate = true;

    let sparksDirty = false;
    for (let i = 0; i < this.sparks.length; i++) {
      const sp = this.sparks[i];
      if (!sp.active) continue;
      sparksDirty = true;
      sp.life -= dt;
      if (sp.life <= 0) {
        sp.active = false;
        _mat4.makeScale(0, 0, 0);
        this.sparkMesh.setMatrixAt(i, _mat4);
      } else {
        sp.vy -= 14 * dt;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.z += sp.vz * dt;
        const s = (sp.life / 0.28) * 1.05;
        _v3A.set(sp.x, sp.y, sp.z);
        _quat.identity();
        _scale.set(s, s, s);
        _mat4.compose(_v3A, _quat, _scale);
        this.sparkMesh.setMatrixAt(i, _mat4);
      }
    }
    if (sparksDirty) this.sparkMesh.instanceMatrix.needsUpdate = true;

    if (this.phase === 'title' || this.phase === 'editor') {
      this.titleOrbitAngle += dt * 0.16;
      const r = 21;
      this.camera.position.set(
        Math.cos(this.titleOrbitAngle) * r,
        10.5,
        Math.sin(this.titleOrbitAngle) * r,
      );
      this.camera.lookAt(0, 1.8, 0);
      this.viewmodelAnchor.visible = false;
      if (now - this.lastHudEmit > 1000) {
        this.lastHudEmit = now;
        this.emitHudSnapshot();
      }
      return;
    }

    const inCountdown = this.lastSnapshot?.phase === 'countdown';
    let wantsAds = false;
    if (this.phase === 'playing' && this.localState.alive) {
      const pad = this.pollGamepad(dt);
      let forward = inCountdown
        ? 0
        : (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
          (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) +
          this.touchMoveY +
          pad.fwd;
      let strafe = inCountdown
        ? 0
        : (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
          (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) +
          this.touchMoveX +
          pad.strafe;
      forward = Math.max(-1, Math.min(1, forward));
      strafe = Math.max(-1, Math.min(1, strafe));

      const activeSpecForFire = WEAPONS[this.localState.weaponId] || WEAPONS.rifle;
      wantsAds =
        !inCountdown &&
        !activeSpecForFire.isMelee &&
        (this.adsHeld || this.adsToggled || pad.ads) &&
        !this.localState.reloading;
      const wantsFire = !inCountdown && (this.mouseDown || this.fireQueued || this.touchFireHeld || pad.fire);
      if (
        wantsFire &&
        !this.localState.reloading &&
        (activeSpecForFire.isMelee || this.localState.ammo > 0) &&
        now - this.localLastFireMs >= activeSpecForFire.fireRateMs
      ) {
        this.localLastFireMs = now;
        this.lastPredictedShotTime = now;
        this.triggerLocalMuzzleVisuals(this.localState.weaponId);
        if (activeVm && !activeSpecForFire.isMelee) {
          activeVm.muzzleFlash.visible = true;
        }
      }
      if (
        wantsFire &&
        !activeSpecForFire.isMelee &&
        this.localState.ammo <= 0 &&
        !this.localState.reloading &&
        now - this.lastEmptyClickMs > 380
      ) {
        this.lastEmptyClickMs = now;
        this.audio.playEmptyClick();
      }
      const input: PlayerInput = {
        seq: ++this.inputSeq,
        dt,
        forward,
        strafe,
        yaw: this.localState.yaw,
        pitch: this.localState.pitch,
        jump: !inCountdown && this.jumpQueued,
        slide: !inCountdown && this.slideHeld,
        fire: wantsFire,
        ads: wantsAds,
        reload: !inCountdown && this.reloadQueued,
        weaponSlot: this.pendingWeaponSlot,
        timestamp: Date.now(),
      };
      if (!inCountdown && this.jumpQueued && this.localState.grounded) {
        this.audio.playJump();
      }
      this.jumpQueued = false;
      this.fireQueued = false;
      this.reloadQueued = false;
      this.pendingWeaponSlot = 0;

      if (!inCountdown && this.hitstopTimer <= 0) {
        const preGrounded = this.localState.grounded;
        const preVy = this.localState.vy;
        stepPlayerMovement(this.localState, input, this.currentMap);
        if (!preGrounded && this.localState.grounded && preVy < -5) {
          this.audio.playLand(-preVy);
        }
        if (this.localState.grounded && !this.localState.sliding) {
          this.localStepDist += Math.hypot(this.localState.vx, this.localState.vz) * dt;
          if (this.localStepDist > 2.4) {
            this.localStepDist = 0;
            this.audio.playFootstep(undefined, this.localState, this.localState.yaw);
          }
        }
      }
      this.pendingInputs.push(input);
      if (this.pendingInputs.length > 300) this.pendingInputs.shift();

      // Every simulated frame is sent (batched ~30 ms) so the server integrates exactly the same
      // movement the client predicted; skipping frames made the server run at ~half speed at 60 FPS.
      this.outgoingInputs.push(input);
      const isEdge = input.jump || input.fire || input.reload || input.weaponSlot > 0;
      if (isEdge || now - this.lastInputSendTime >= 30 || this.outgoingInputs.length >= 6) {
        this.lastInputSendTime = now;
        const batch = this.outgoingInputs;
        this.outgoingInputs = [];
        if (batch.length === 1) this.sendWs({ type: 'input', input: batch[0] });
        else this.sendWs({ type: 'inputs', inputs: batch });
      }
    }

    this.adsBlend = THREE.MathUtils.damp(this.adsBlend, wantsAds ? 1 : 0, 18, dt);
    const activeWSpec = WEAPONS[this.localState.weaponId] || WEAPONS.rifle;
    const eyeTarget = this.localState.sliding ? SLIDE_EYE_HEIGHT : PLAYER_EYE_HEIGHT;
    const speed = Math.hypot(this.localState.vx, this.localState.vz);
    const hipFov = this.settings.fov + Math.min(8, Math.max(0, (speed - 9.4) * 1.1));
    const adsFov = this.settings.fov * activeWSpec.adsFovMult;
    const desiredFov = THREE.MathUtils.lerp(hipFov, adsFov, this.adsBlend);
    if (Math.abs(this.camera.fov - desiredFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, desiredFov, 14, dt);
      this.camera.updateProjectionMatrix();
    }

    const shake = this.trauma * this.trauma * 0.035;
    this.camera.position.set(
      this.localState.x,
      this.localState.y + eyeTarget,
      this.localState.z,
    );
    _euler.set(
      this.localState.pitch + this.recoilKick * 0.45 + (Math.random() - 0.5) * shake,
      this.localState.yaw + (Math.random() - 0.5) * shake,
      this.localState.sliding ? -0.055 * (1 - this.adsBlend * 0.7) : 0,
      'YXZ',
    );
    this.camera.quaternion.setFromEuler(_euler);

    if (this.localState.grounded && speed > 0.5 && !this.localState.sliding) {
      this.walkBobPhase += speed * dt * 1.45;
    }
    const bobScale = 1 - this.adsBlend * 0.85;
    const bobX = Math.cos(this.walkBobPhase) * 0.012 * bobScale;
    const bobY = Math.abs(Math.sin(this.walkBobPhase)) * -0.016 * bobScale;
    const reloadDip = this.localState.reloading ? Math.sin(this.localState.reloadTimer * 6) * 0.08 - 0.1 : 0;

    if (activeVm) {
      activeVm.group.position.set(
        THREE.MathUtils.lerp(activeVm.hipPos[0], activeVm.adsPos[0], this.adsBlend),
        THREE.MathUtils.lerp(activeVm.hipPos[1], activeVm.adsPos[1], this.adsBlend),
        THREE.MathUtils.lerp(activeVm.hipPos[2], activeVm.adsPos[2], this.adsBlend),
      );
    }
    const scopedHideVm = activeWSpec.hasScope && this.adsBlend > 0.5;
    this.viewmodelAnchor.visible =
      this.phase === 'playing' && this.localState.alive && !scopedHideVm;
    const slashSwing =
      this.meleeSlashTimer > 0
        ? Math.sin((1 - this.meleeSlashTimer / 0.24) * Math.PI)
        : 0;
    this.viewmodelAnchor.position.set(
      bobX - slashSwing * 0.18,
      bobY - this.weaponSwitchDip + reloadDip - slashSwing * 0.04,
      this.recoilKick * 0.42 + this.weaponSwitchZ - slashSwing * 0.22,
    );
    this.viewmodelAnchor.rotation.set(
      this.recoilKick * 0.72 - this.weaponSwitchDip * 0.65 - slashSwing * 0.62,
      slashSwing * 0.78,
      this.recoilRoll + this.weaponSwitchRoll + slashSwing * 0.48,
    );

    const renderTime = now - 85;
    for (const remote of this.remoteRigs.values()) {
      const buf = remote.buffer;
      if (buf.length === 0) continue;

      let targetSample = buf[buf.length - 1];
      for (let i = buf.length - 1; i >= 1; i--) {
        if (buf[i - 1].time <= renderTime) {
          const t0 = buf[i - 1];
          const t1 = buf[i];
          const span = Math.max(1, t1.time - t0.time);
          const alpha = Math.max(0, Math.min(1, (renderTime - t0.time) / span));
          targetSample = {
            time: renderTime,
            x: t0.x + (t1.x - t0.x) * alpha,
            y: t0.y + (t1.y - t0.y) * alpha,
            z: t0.z + (t1.z - t0.z) * alpha,
            yaw: t0.yaw + (t1.yaw - t0.yaw) * alpha,
            pitch: t0.pitch + (t1.pitch - t0.pitch) * alpha,
            alive: t1.alive,
            sliding: t1.sliding,
          };
          break;
        }
      }

      remote.rig.root.position.set(targetSample.x, targetSample.y, targetSample.z);
      remote.rig.root.rotation.y = targetSample.yaw;
      remote.rig.head.rotation.x = targetSample.pitch;

      if (!targetSample.alive) {
        remote.deathTilt = THREE.MathUtils.damp(remote.deathTilt, Math.PI * 0.48, 12, dt);
        remote.rig.bodyGroup.rotation.x = remote.deathTilt;
        remote.rig.bodyGroup.position.y = -0.35;
      } else {
        remote.deathTilt = 0;
        remote.rig.bodyGroup.rotation.x = targetSample.sliding ? 0.35 : 0;
        remote.rig.bodyGroup.position.y = targetSample.sliding ? -0.35 : 0;
      }

      const moved = Math.hypot(targetSample.x - remote.lastX, targetSample.z - remote.lastZ);
      remote.lastX = targetSample.x;
      remote.lastZ = targetSample.z;
      if (moved > 0.005 && targetSample.alive && !targetSample.sliding) {
        remote.walkPhase += moved * 2.4;
        remote.stepAccum += moved;
        if (remote.stepAccum > 2.5) {
          remote.stepAccum = 0;
          this.audio.playFootstep(
            { x: targetSample.x, y: targetSample.y, z: targetSample.z },
            this.localState,
            this.localState.yaw,
          );
        }
        const swing = Math.sin(remote.walkPhase) * 0.55;
        remote.rig.leftLeg.rotation.x = swing;
        remote.rig.rightLeg.rotation.x = -swing;
      } else {
        remote.rig.leftLeg.rotation.x = THREE.MathUtils.damp(remote.rig.leftLeg.rotation.x, 0, 12, dt);
        remote.rig.rightLeg.rotation.x = THREE.MathUtils.damp(remote.rig.rightLeg.rotation.x, 0, 12, dt);
      }

      if (remote.hitFlashTimer > 0) {
        remote.hitFlashTimer -= dt;
        remote.rig.hitFlashMats.forEach((m) => m.emissive.setHex(0xffffff));
      } else {
        remote.rig.hitFlashMats.forEach((m) => m.emissive.setHex(0x000000));
      }
    }

    if (now - this.lastHudEmit >= (this.phase === 'playing' ? 66 : 250)) {
      this.lastHudEmit = now;
      this.emitHudSnapshot();
    }
  }

  private emitHudSnapshot() {
    const snap = this.lastSnapshot;
    const wSpec = WEAPONS[this.localState.weaponId] || WEAPONS.rifle;
    const speed = Math.round(Math.hypot(this.localState.vx, this.localState.vz) * 10) / 10;

    this.onHudUpdate({
      hp: Math.round(this.localState.hp),
      maxHp: this.localState.maxHp,
      shield: Math.round(this.localState.shield),
      maxShield: this.localState.maxShield,
      ammo: this.localState.ammo,
      magSize: wSpec.magSize,
      reloading: this.localState.reloading,
      reloadProgress: this.localState.reloading
        ? Math.max(0, Math.min(1, 1 - this.localState.reloadTimer / (wSpec.reloadMs / 1000)))
        : 1,
      weaponId: this.localState.weaponId,
      speed,
      sliding: this.localState.sliding,
      alive: this.localState.alive,
      respawnTimer: Math.ceil(this.localState.respawnTimer),
      kills: this.localState.kills,
      deaths: this.localState.deaths,
      score: this.localState.score,
      streak: this.localState.streak,
      gunGameTier: this.localState.gunGameTier,
      timeRemaining: snap ? Math.ceil(snap.timeRemaining) : 180,
      scoreLimit: snap ? snap.scoreLimit : 15,
      redScore: snap ? snap.redScore : 0,
      blueScore: snap ? snap.blueScore : 0,
      mode: snap ? snap.mode : this.currentMode,
      team: this.localState.team,
      fps: this.currentFps,
      pingMs: this.pingMs,
      renderScale: Math.round(this.renderScale * 100),
      hitmarkerActive: this.hitmarkerTimer > 0,
      hitmarkerHeadshot: this.hitmarkerHead,
      damageFlash: this.damageFlash,
      pointerLocked:
        typeof document !== 'undefined' && document.pointerLockElement === this.renderer.domElement,
      players: (snap?.players || []).map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        x: p.x,
        z: p.z,
        yaw: p.yaw,
        alive: p.alive,
        kills: p.kills,
        deaths: p.deaths,
        score: p.score,
        isBot: p.isBot,
        isSelf: p.id === this.selfId,
      })),
      killFeed: this.killFeed,
      winnerText: snap?.winnerText || '',
      damageHits: this.damageHitLog
        .filter((h) => performance.now() - h.t < 1100)
        .map((h) => ({ dx: h.dx, dz: h.dz, age: (performance.now() - h.t) / 1100 })),
      winnerId: snap?.winnerId || '',
      nextMapName: snap?.nextMapName || '',
      selfId: this.selfId,
      isHost: Boolean(snap?.hostId) && snap?.hostId === this.selfId,
      matchEnded: snap?.phase === 'ended',
      localYaw: this.localState.yaw,
      localX: this.localState.x,
      localZ: this.localState.z,
      mapId: this.currentMap.id,
      mapName: this.currentMap.name,
      mapHalfW: this.currentMap.bounds.halfW,
      mapHalfD: this.currentMap.bounds.halfD,
      mapBlocks: this.currentMap.blocks,
      adsBlend: Math.round(this.adsBlend * 100) / 100,
      scoped: Boolean(wSpec.hasScope && this.adsBlend > 0.5),
      medicateActive: this.medicateTimer > 0,
      medicateHp: this.medicateHp,
      medicateShield: this.medicateShield,
      roomJoinCode: snap?.joinCode || this.roomJoinCode,
      maxPlayers: snap?.maxPlayers || this.roomMaxPlayers,
      botCount: snap?.botCount ?? 0,
      roomVisibility: snap?.visibility || this.roomVisibility,
      roomHasPassword: snap?.hasPassword ?? this.roomHasPassword,
      matchPhase: snap?.phase || 'active',
      countdownRemaining: snap ? Math.ceil(snap.countdownRemaining) : 0,
      goBannerActive: this.goBannerTimer > 0,
      characterStyle: this.localState.characterStyle,
      accentColor: this.localState.accentColor,
    });
  }

  public dispose() {
    this.disposed = true;
    this.audio.dispose();
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.disconnect();
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onWindowBlur);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);

    this.viewmodels.forEach((vm) => vm.dispose());
    this.materials?.dispose();
    if (this.tracers.length > 0) {
      this.tracers[0].mesh.geometry.dispose();
      this.tracers.forEach((t) => t.mat.dispose());
    }
    if (this.impactBursts.length > 0) {
      this.impactBursts[0].mesh.geometry.dispose();
      this.impactBursts.forEach((b) => b.mat.dispose());
    }
    this.shellMesh.geometry.dispose();
    (this.shellMesh.material as THREE.Material).dispose();
    this.sparkMesh.geometry.dispose();
    (this.sparkMesh.material as THREE.Material).dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
