import * as THREE from 'three';
import { BlockMaterialType } from './types';

function makeCanvas(size = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  isColor: boolean,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export interface ArenaMaterialSet {
  floor: THREE.MeshStandardMaterial;
  blocks: Record<BlockMaterialType, THREE.MeshStandardMaterial>;
  shadowDisc: THREE.MeshBasicMaterial;
  dispose: () => void;
}

export function createArenaMaterials(
  maxAnisotropy: number,
  floorHex: number,
): ArenaMaterialSet {
  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];

  // 1. Tactical Arena Floor Grid Texture
  const [fCanvas, fCtx] = makeCanvas(256);
  const baseCol = new THREE.Color(floorHex);
  fCtx.fillStyle = `#${baseCol.getHexString()}`;
  fCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 650; i++) {
    const shade = Math.random() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)';
    fCtx.fillStyle = shade;
    fCtx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
  }
  fCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  fCtx.lineWidth = 2;
  fCtx.strokeRect(1, 1, 254, 254);
  fCtx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  fCtx.lineWidth = 1;
  fCtx.beginPath();
  fCtx.moveTo(128, 0);
  fCtx.lineTo(128, 256);
  fCtx.moveTo(0, 128);
  fCtx.lineTo(256, 128);
  fCtx.stroke();

  const floorTex = finalizeTexture(fCanvas, maxAnisotropy, true, 24, 24);
  textures.push(floorTex);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: floorTex,
    roughness: 0.84,
    metalness: 0.08,
  });
  materials.push(floorMat);

  // 2. Concrete Architectural Panel
  const [cCanvas, cCtx] = makeCanvas(256);
  cCtx.fillStyle = '#64707d';
  cCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 500; i++) {
    cCtx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
    cCtx.fillRect(Math.random() * 256, Math.random() * 256, 4, 4);
  }
  cCtx.strokeStyle = 'rgba(15, 23, 42, 0.32)';
  cCtx.lineWidth = 4;
  cCtx.strokeRect(4, 4, 248, 248);
  cCtx.fillStyle = 'rgba(255,255,255,0.08)';
  cCtx.fillRect(8, 8, 240, 4);
  const concreteTex = finalizeTexture(cCanvas, maxAnisotropy, true, 1, 1);
  textures.push(concreteTex);
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: concreteTex,
    roughness: 0.86,
    metalness: 0.05,
  });

  // 3. Brushed Industrial Steel
  const [sCanvas, sCtx] = makeCanvas(256);
  sCtx.fillStyle = '#475569';
  sCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 4) {
    sCtx.fillStyle = y % 8 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    sCtx.fillRect(0, y, 256, 2);
  }
  sCtx.strokeStyle = '#1e293b';
  sCtx.lineWidth = 6;
  sCtx.strokeRect(3, 3, 250, 250);
  sCtx.fillStyle = '#94a3b8';
  for (const rx of [16, 240]) {
    for (const ry of [16, 128, 240]) {
      sCtx.beginPath();
      sCtx.arc(rx, ry, 4, 0, Math.PI * 2);
      sCtx.fill();
    }
  }
  const steelTex = finalizeTexture(sCanvas, maxAnisotropy, true, 1, 1);
  textures.push(steelTex);
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: steelTex,
    roughness: 0.36,
    metalness: 0.68,
  });

  // 4. Tactical Timber Crate
  const [wCanvas, wCtx] = makeCanvas(256);
  wCtx.fillStyle = '#a47148';
  wCtx.fillRect(0, 0, 256, 256);
  wCtx.fillStyle = '#8b5e34';
  for (let y = 0; y < 256; y += 32) {
    wCtx.fillRect(0, y, 256, 3);
  }
  wCtx.strokeStyle = '#58381d';
  wCtx.lineWidth = 14;
  wCtx.strokeRect(7, 7, 242, 242);
  wCtx.beginPath();
  wCtx.moveTo(14, 14);
  wCtx.lineTo(242, 242);
  wCtx.stroke();
  const crateTex = finalizeTexture(wCanvas, maxAnisotropy, true, 1, 1);
  textures.push(crateTex);
  const crateMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: crateTex,
    roughness: 0.78,
    metalness: 0.04,
  });

  // 5. Hazard Stripe Block
  const [hCanvas, hCtx] = makeCanvas(256);
  hCtx.fillStyle = '#e59500';
  hCtx.fillRect(0, 0, 256, 256);
  hCtx.fillStyle = '#1e242b';
  for (let i = -256; i < 512; i += 48) {
    hCtx.beginPath();
    hCtx.moveTo(i, 0);
    hCtx.lineTo(i + 24, 0);
    hCtx.lineTo(i - 232, 256);
    hCtx.lineTo(i - 256, 256);
    hCtx.closePath();
    hCtx.fill();
  }
  const hazardTex = finalizeTexture(hCanvas, maxAnisotropy, true, 1, 1);
  textures.push(hazardTex);
  const hazardMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: hazardTex,
    roughness: 0.5,
    metalness: 0.28,
  });

  // 6. Corrugated Shipping Containers (Red & Blue)
  const makeContainerMat = (base: string, dark: string) => {
    const [cc, cctx] = makeCanvas(256);
    cctx.fillStyle = base;
    cctx.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 16) {
      cctx.fillStyle = dark;
      cctx.fillRect(x, 0, 6, 256);
      cctx.fillStyle = 'rgba(255,255,255,0.08)';
      cctx.fillRect(x + 6, 0, 2, 256);
    }
    cctx.strokeStyle = 'rgba(15,23,42,0.45)';
    cctx.lineWidth = 8;
    cctx.strokeRect(4, 4, 248, 248);
    const tex = finalizeTexture(cc, maxAnisotropy, true, 2, 1);
    textures.push(tex);
    return new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: tex,
      roughness: 0.48,
      metalness: 0.42,
    });
  };

  const containerRedMat = makeContainerMat('#b8332a', '#87211a');
  const containerBlueMat = makeContainerMat('#275d94', '#1a4169');

  // 7. Accent Amber Ramp/Pad
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.4,
    metalness: 0.45,
  });

  // 8. Soft Radial Contact Shadow Disc
  const [shCanvas, shCtx] = makeCanvas(128);
  const grad = shCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  shCtx.fillStyle = grad;
  shCtx.fillRect(0, 0, 128, 128);
  const shTex = new THREE.CanvasTexture(shCanvas);
  shTex.colorSpace = THREE.SRGBColorSpace;
  textures.push(shTex);
  const shadowDisc = new THREE.MeshBasicMaterial({
    map: shTex,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });

  const blockMaterials: Record<BlockMaterialType, THREE.MeshStandardMaterial> = {
    concrete: concreteMat,
    steel: steelMat,
    crate: crateMat,
    hazard: hazardMat,
    container_red: containerRedMat,
    container_blue: containerBlueMat,
    accent: accentMat,
  };
  materials.push(
    concreteMat,
    steelMat,
    crateMat,
    hazardMat,
    containerRedMat,
    containerBlueMat,
    accentMat,
    shadowDisc,
  );

  return {
    floor: floorMat,
    blocks: blockMaterials,
    shadowDisc,
    dispose: () => {
      textures.forEach((t) => t.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
