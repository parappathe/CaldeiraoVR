// Cenário do Caldeirão: cabana de bruxa à noite. Paredes de tronco, ervas penduradas nas vigas,
// velas, a lua pela janela. Você em pé atrás do seu caldeirão, com a prateleira de 5 frascos em
// arco em volta; o adversário do outro lado da sala, com o caldeirão dele e os potes cobertos.
import * as THREE from '../vendor/three/three.module.js';
import { caixaArredondada, sombraContato, halo, ambienteDoCeu, escurecerBase } from './visual3d.js';
import { madeira, metal } from './materiais3d.js';
import { criarPersonagem } from './personagem3d.js';
import { EL, ELEMENTS, SHELF } from './rules.js';
import { Label } from './ui.js';

export const CAUL = new THREE.Vector3(0, 0, -0.45);       // seu caldeirão (centro no chão)
export const RIM_Y = 0.8, LIQ_Y = 0.75, CAUL_R = 0.2;
export const OPP_CAUL = new THREE.Vector3(0, 0, -2.6);
export const OPP_POS = new THREE.Vector3(0, 0, -3.05);
export const SLOT_ANG = [-64, -32, 0, 32, 64].map(a => a * Math.PI / 180);
export const SLOT_R = 0.6, SLOT_Y = 1.08;
export const slotPos = (i, out = new THREE.Vector3()) => out.set(Math.sin(SLOT_ANG[i]) * SLOT_R, SLOT_Y, -Math.cos(SLOT_ANG[i]) * SLOT_R);
export const STIR_POS = new THREE.Vector3(-0.27, 0.86, -0.2);   // placa "Mexer"
export const EMPTY_POS = new THREE.Vector3(0.27, 0.86, -0.2);   // placa "Esvaziar"
export const BOOK_POS = new THREE.Vector3(-0.66, 1.0, -0.72);
export const PLAYER_HEAD = new THREE.Vector3(0, 1.5, 0);
export const OPP_HEAD = new THREE.Vector3(0, 1.55, -3.05);

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function rand(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

// rótulo do frasco: nome e símbolo do elemento
function labelCanvas(e) {
  const c = canvas(128, 160), g = c.getContext('2d');
  g.fillStyle = '#efe0bc'; g.fillRect(0, 0, 128, 160);
  g.strokeStyle = '#6a4a2a'; g.lineWidth = 6; g.strokeRect(5, 5, 118, 150);
  g.fillStyle = EL[e].css; g.beginPath(); g.arc(64, 62, 36, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 44px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(EL[e].name[0], 64, 64);
  g.fillStyle = '#3a2412'; g.font = 'bold 26px Georgia, serif'; g.fillText(EL[e].name, 64, 128);
  return c;
}
function signCanvas(text, bg) {
  const c = canvas(256, 128), g = c.getContext('2d');
  g.fillStyle = bg; g.beginPath(); g.ellipse(128, 64, 124, 60, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#f2d08a'; g.lineWidth = 7; g.stroke();
  g.fillStyle = '#fff4d8'; g.font = 'bold 50px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 68);
  return c;
}
function windowCanvas() {
  const c = canvas(256, 320), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 320); gr.addColorStop(0, '#16204a'); gr.addColorStop(0.7, '#2c3a78'); gr.addColorStop(1, '#4a4a88');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 320);
  const r = rand(5); for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,240,${0.3 + r() * 0.7})`; g.fillRect(r() * 256, r() * 220, 2, 2); }
  const mg = g.createRadialGradient(170, 90, 10, 170, 90, 90); mg.addColorStop(0, 'rgba(255,250,220,0.6)'); mg.addColorStop(1, 'rgba(255,250,220,0)');
  g.fillStyle = mg; g.fillRect(0, 0, 256, 320);
  g.fillStyle = '#fff8dc'; g.beginPath(); g.arc(170, 90, 34, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(200,190,160,0.5)'; for (const [x, y, rr] of [[160, 80, 7], [182, 100, 5], [165, 106, 4]]) { g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill(); }
  // pinheiros e morro
  g.fillStyle = '#0e1630'; g.beginPath(); g.moveTo(0, 320); g.lineTo(0, 250); g.quadraticCurveTo(128, 215, 256, 255); g.lineTo(256, 320); g.fill();
  for (let i = 0; i < 9; i++) { const x = i * 31 + r() * 10, h = 40 + r() * 40, y = 262 - (i % 3) * 6; g.beginPath(); g.moveTo(x, y - h); g.lineTo(x - 13, y); g.lineTo(x + 13, y); g.fill(); }
  return c;
}

export function buildWorld({ leve = false } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c1830);
  scene.fog = new THREE.Fog(0x2a2440, 7, 16);
  const ceu = { zenite: '#1a2050', horizonte: '#c08a5a', chao: '#3a2a20', dirSol: new THREE.Vector3(0.4, 0.6, 0.6) };
  // luz principal: lustre de velas acima e à esquerda (quente), preenchimento azulado da noite
  const key = new THREE.DirectionalLight(0xffcf96, 2.0);
  key.position.set(-1.6, 3.2, 0.6); key.target.position.set(0, 0.6, -1.5);
  key.castShadow = true;
  const sc = key.shadow.camera; sc.left = -2.6; sc.right = 2.6; sc.top = 2.6; sc.bottom = -2.6; sc.near = 0.5; sc.far = 9;
  key.shadow.mapSize.set(leve ? 1024 : 2048, leve ? 1024 : 2048); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  scene.add(new THREE.HemisphereLight(0x9aa8f0, 0x7a5a48, 1.7));
  const moon = new THREE.DirectionalLight(0x9ab4ff, 0.6); moon.position.set(2.5, 2.5, -4); scene.add(moon);
  const fireLight = new THREE.PointLight(0xff8a3a, 2.2, 3.2, 1.6); fireLight.position.set(0, 0.45, -0.45); scene.add(fireLight);
  const oppFireLight = new THREE.PointLight(0xff8a3a, 2.2, 3.2, 1.6); oppFireLight.position.set(0, 0.45, -2.6); scene.add(oppFireLight);

  // ---------- Cabana ----------
  const W = 2.7, ZF = 1.6, ZB = -4.3, H = 2.9;
  const floorGeo = new THREE.PlaneGeometry(W * 2, ZF - ZB).rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeo, madeira({ clara: '#94705a', escura: '#56402e', tabuas: 6, leve: true, repete: [3, 3] }));
  floor.position.set(0, 0, (ZF + ZB) / 2); floor.receiveShadow = true; scene.add(floor);
  const logMat = madeira({ clara: '#806252', escura: '#4e382c', tabuas: 0, leve: true, repete: [4, 1] });
  // paredes de tronco: cilindros deitados empilhados
  const logGeo = new THREE.CylinderGeometry(0.13, 0.13, 1, 14).rotateZ(Math.PI / 2);
  const walls = [
    { len: W * 2, pos: (y) => [0, y, ZB], rotY: 0 },
    { len: ZF - ZB, pos: (y) => [-W, y, (ZF + ZB) / 2], rotY: Math.PI / 2 },
    { len: ZF - ZB, pos: (y) => [W, y, (ZF + ZB) / 2], rotY: Math.PI / 2 },
    { len: W * 2, pos: (y) => [0, y, ZF], rotY: 0 },
  ];
  const nLogs = Math.ceil(H / 0.24);
  const logs = new THREE.InstancedMesh(logGeo, logMat, walls.length * nLogs);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc3 = new THREE.Vector3(), p3 = new THREE.Vector3();
  let li = 0;
  for (const w of walls) for (let k = 0; k < nLogs; k++) {
    const y = 0.12 + k * 0.24;
    q.setFromEuler(new THREE.Euler(0, w.rotY, 0));
    m4.compose(p3.set(...w.pos(y)), q, sc3.set(w.len + 0.3, 1, 1)); logs.setMatrixAt(li++, m4);
  }
  logs.receiveShadow = true; scene.add(logs);
  // janela no fundo (lua) e uma na lateral esquerda
  const winMat = new THREE.MeshBasicMaterial({ map: tex(windowCanvas()), fog: false, toneMapped: false });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a2414, roughness: 0.8 });
  const addWindow = (x, y, z, ry) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.1), winMat));
    for (const [w, h, px, py] of [[1.02, 0.08, 0, 0.58], [1.02, 0.08, 0, -0.58], [0.08, 1.2, 0.48, 0], [0.08, 1.2, -0.48, 0], [0.05, 1.1, 0, 0], [0.9, 0.05, 0, 0.1]]) {
      const f = new THREE.Mesh(caixaArredondada(w, h, 0.08, 0.015, 2), frameMat); f.position.set(px, py, 0.03); g.add(f);
    }
    g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
    const glow = halo('#6a80d8', 1.8, 0.35); glow.position.set(x, y, z + (ry ? 0 : 0.2)); scene.add(glow);
  };
  addWindow(1.3, 1.7, ZB + 0.14, 0);
  addWindow(-W + 0.14, 1.6, -1.6, Math.PI / 2);
  // vigas do teto com ervas penduradas
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x4a2e1a, roughness: 0.85 });
  for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(caixaArredondada(W * 2, 0.16, 0.16, 0.02, 2), beamMat); b.position.set(0, H - 0.1, 1.0 - k * 1.25); scene.add(b); }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, ZF - ZB).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.9 }));
  ceil.position.set(0, H, (ZF + ZB) / 2); scene.add(ceil);
  const herbCols = [0x6a8a3a, 0x8a6aa8, 0xa89a4a, 0x4a7a5a, 0xa85a3a];
  const hr = rand(11);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x5a4a2a, roughness: 0.9 });
  for (let k = 0; k < 16; k++) {
    const g = new THREE.Group();
    const beam = k % 5, x = -2.2 + hr() * 4.4;
    if (Math.abs(x) < 0.6 && beam < 3) continue;
    const len = 0.3 + hr() * 0.25;
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.25, 4), stemMat); cord.position.y = -0.12; g.add(cord);
    const bunch = new THREE.Mesh(new THREE.ConeGeometry(0.07 + hr() * 0.04, len, 7), new THREE.MeshStandardMaterial({ color: herbCols[k % 5], roughness: 0.9, flatShading: true }));
    bunch.position.y = -0.25 - len / 2; bunch.rotation.x = Math.PI; g.add(bunch);
    g.position.set(x, H - 0.18, 1.0 - beam * 1.25); g.rotation.z = (hr() - 0.5) * 0.2;
    scene.add(g);
  }
  // velas: em pires nas prateleiras e mesinhas; chama com halo
  const candles = [];
  const waxMat = new THREE.MeshStandardMaterial({ color: 0xf0e2c0, roughness: 0.6 });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false });
  const addCandle = (x, y, z, h = 0.12) => {
    const g = new THREE.Group();
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, h, 10), waxMat); w.position.y = h / 2; g.add(w);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6).scale(1, 2, 1), flameMat); f.position.y = h + 0.02; g.add(f);
    const hl = halo('#ffb85a', 0.22, 0.9); hl.position.y = h + 0.02; g.add(hl);
    g.position.set(x, y, z); scene.add(g); candles.push({ f, hl, ph: candles.length * 1.7 });
  };
  // ---------- Bancadas laterais (móveis com potes, livros e velas) ----------
  const tableMat = madeira({ clara: '#9a6a44', escura: '#5a3a22', tabuas: 3, leve: true });
  const addCounter = (x, z, w, d, rot = 0) => {
    const g = new THREE.Group();
    const top = new THREE.Mesh(caixaArredondada(w, 0.06, d, 0.015, 2), tableMat); top.position.y = 0.88; top.castShadow = top.receiveShadow = true; g.add(top);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = new THREE.Mesh(caixaArredondada(0.06, 0.86, 0.06, 0.01, 2), tableMat); l.position.set(sx * (w / 2 - 0.06), 0.43, sz * (d / 2 - 0.06)); g.add(l); }
    g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
    const s = sombraContato(w * 1.2, d * 1.4, 0.4); s.position.set(x, 0.003, z); s.rotation.z = rot; scene.add(s);
    return g;
  };
  const jarCols = [0x6a3a8a, 0x2a6a5a, 0x8a5a2a, 0x3a5a8a, 0x8a2a3a];
  addCounter(-1.9, -1.4, 0.6, 1.4, 0);
  addCounter(1.9, -1.0, 0.6, 1.4, 0);
  for (let k = 0; k < 6; k++) {
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.16 + (k % 3) * 0.05, 14), new THREE.MeshStandardMaterial({ color: jarCols[k % 5], roughness: 0.35 }));
    jar.position.set(k < 3 ? -1.9 : 1.9, 0.99 + (k % 3) * 0.025, (k < 3 ? -1.9 : -1.5) + (k % 3) * 0.32); jar.castShadow = true; scene.add(jar);
  }
  addCandle(-1.85, 0.91, -0.95); addCandle(-1.95, 0.91, -1.2, 0.18); addCandle(1.85, 0.91, -0.5); addCandle(1.95, 0.91, -1.55, 0.16);
  // pilha de livros e caveirinha de enfeite
  const bookCols = [0x7a2a2a, 0x2a4a6a, 0x5a6a2a, 0x6a4a8a];
  for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(caixaArredondada(0.22, 0.05, 0.16, 0.01, 2), new THREE.MeshStandardMaterial({ color: bookCols[k], roughness: 0.7 })); b.position.set(1.85, 0.935 + k * 0.05, -1.2); b.rotation.y = k * 0.3; b.castShadow = true; scene.add(b); }
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10).scale(1, 0.9, 1.1), new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.6 }));
  skull.position.set(-1.85, 0.97, -1.7); scene.add(skull);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), new THREE.MeshBasicMaterial({ color: 0x1a1010 })); e.position.set(-1.85 + s * 0.025, 0.98, -1.63); scene.add(e); }
  // tapete redondo entre os dois
  const rugC = canvas(256, 256), rg = rugC.getContext('2d');
  rg.fillStyle = '#5a2a3a'; rg.beginPath(); rg.arc(128, 128, 126, 0, Math.PI * 2); rg.fill();
  rg.strokeStyle = '#d8a84a'; rg.lineWidth = 6; for (const r of [116, 80, 40]) { rg.beginPath(); rg.arc(128, 128, r, 0, Math.PI * 2); rg.stroke(); }
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; rg.fillStyle = '#d8a84a'; rg.beginPath(); rg.arc(128 + Math.cos(a) * 98, 128 + Math.sin(a) * 98, 7, 0, Math.PI * 2); rg.fill(); }
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.0, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex(rugC), roughness: 0.95, transparent: true }));
  rug.position.set(0, 0.004, -1.55); rug.receiveShadow = true; scene.add(rug);
  // chão nunca vazio: folhas secas e pedrinhas espalhadas
  const lr = rand(21);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.9, side: THREE.DoubleSide });
  const leaves = new THREE.InstancedMesh(new THREE.CircleGeometry(0.03, 5).scale(1.6, 1, 1).rotateX(-Math.PI / 2), leafMat, 60);
  for (let k = 0; k < 60; k++) { const x = (lr() - 0.5) * 5, z = 1.4 - lr() * 5.6; q.setFromEuler(new THREE.Euler(0, lr() * 6, 0)); m4.compose(p3.set(x, 0.006, z), q, sc3.setScalar(0.6 + lr())); leaves.setMatrixAt(k, m4); }
  scene.add(leaves);

  // ---------- Caldeirões ----------
  const ironMat = metal({ tipo: 'ferro', escovado: 0.1, arranhoes: 0.3, sujeira: 0.6, leve: true });
  ironMat.color = new THREE.Color(0x5a5a62);
  const caulProfile = [];
  for (let i = 0; i <= 14; i++) { const a = -Math.PI / 2 + i / 14 * Math.PI * 0.86; caulProfile.push(new THREE.Vector2(Math.cos(a) * 0.24, 0.4 + Math.sin(a) * 0.26)); }
  caulProfile.push(new THREE.Vector2(0.205, 0.78), new THREE.Vector2(0.23, 0.8), new THREE.Vector2(0.215, 0.81), new THREE.Vector2(0.19, 0.79));
  const caulGeo = new THREE.LatheGeometry(caulProfile, 36);
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a, toneMapped: false, transparent: true, opacity: 0.9 });
  function makeCauldron(pos) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(caulGeo, ironMat); body.castShadow = true; g.add(body);
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.5; const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.018, 0.2, 8), ironMat); leg.position.set(Math.cos(a) * 0.18, 0.1, Math.sin(a) * 0.18); leg.rotation.z = Math.cos(a) * 0.2; leg.rotation.x = -Math.sin(a) * 0.2; g.add(leg); }
    // lenha e fogo embaixo
    const logM = new THREE.MeshStandardMaterial({ color: 0x4a2a14, roughness: 0.9 });
    for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8).rotateZ(Math.PI / 2), logM); l.position.y = 0.04; l.rotation.y = k * Math.PI / 3; g.add(l); }
    const flames = [];
    for (let k = 0; k < 5; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 7), fireMat); f.position.set(Math.cos(k * 1.3) * 0.07, 0.12, Math.sin(k * 1.3) * 0.07); g.add(f); flames.push(f); }
    const fh = halo('#ff7a2a', 0.6, 0.8); fh.position.y = 0.14; g.add(fh);
    // líquido
    const liqMat = new THREE.MeshStandardMaterial({ color: 0x3a6a4a, roughness: 0.15, metalness: 0, emissive: 0x1a3a2a, emissiveIntensity: 0.8 });
    const liq = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32).rotateX(-Math.PI / 2), liqMat); liq.position.y = LIQ_Y; g.add(liq);
    const liqGlow = halo('#5ad88a', 0.7, 0.5); liqGlow.position.y = LIQ_Y + 0.08; g.add(liqGlow);
    // bolhas
    const bubbles = [];
    const bubMat = new THREE.MeshStandardMaterial({ color: 0x8ae8aa, roughness: 0.2, emissive: 0x2a6a3a, transparent: true, opacity: 0.85 });
    for (let k = 0; k < 8; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), bubMat); g.add(b); bubbles.push({ m: b, t: k / 8, a: k * 2.4, r: 0.04 + (k % 4) * 0.035 }); }
    const sh = sombraContato(0.7, 0.7, 0.5); g.add(sh);
    g.position.copy(pos); scene.add(g);
    return { g, liq, liqMat, liqGlow, flames, bubbles, bubMat, fh, color: new THREE.Color(0x3a6a4a), target: new THREE.Color(0x3a6a4a), swirl: 0 };
  }
  const myCaul = makeCauldron(CAUL), oppCaul = makeCauldron(OPP_CAUL);

  // colher de pau (gira no seu caldeirão)
  const spoonMat = new THREE.MeshStandardMaterial({ color: 0xb88a5a, roughness: 0.6 });
  const spoon = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.5, 10).translate(0, 0.25, 0), spoonMat); spoon.add(handle);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8).scale(1, 0.4, 1.4), spoonMat); spoon.add(bowl);
  const grip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), spoonMat); grip.position.y = 0.5; spoon.add(grip);
  scene.add(spoon);
  const spoonHit = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
  spoonHit.userData = { kind: 'spoon' }; scene.add(spoonHit);
  const oppSpoon = spoon.clone(); scene.add(oppSpoon);
  // põe a colher com a ponta num ângulo a dentro do caldeirão, inclinada para fora
  function setSpoon(s, center, a, r = 0.09, toward = null) {
    const tip = new THREE.Vector3(center.x + Math.cos(a) * r, LIQ_Y - 0.03, center.z + Math.sin(a) * r);
    const top = toward ? toward.clone() : new THREE.Vector3(center.x + Math.cos(a) * 0.3, LIQ_Y + 0.42, center.z + Math.sin(a) * 0.3);
    s.position.copy(tip);
    const dir = top.clone().sub(tip).normalize();
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return top;
  }
  setSpoon(spoon, CAUL, Math.PI / 2 + 0.3);
  setSpoon(oppSpoon, OPP_CAUL, -Math.PI / 2 - 0.4);

  // placas Mexer e Esvaziar (no suporte na frente do caldeirão)
  const plate = (text, bg, pos, kind) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.075, 28).scale(1.3, 0.75, 1), new THREE.MeshStandardMaterial({ map: tex(signCanvas(text, bg)), roughness: 0.7, emissive: 0xffffff, emissiveIntensity: 0.0 }));
    m.position.copy(pos); m.rotation.x = -0.5; m.userData = { kind }; scene.add(m);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.098, 0.015, 24).scale(1, 1, 0.58).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.8 }));
    back.position.copy(pos).add(new THREE.Vector3(0, -0.004, -0.008)); back.rotation.x = -0.5; scene.add(back);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, pos.y, 8), new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.8 }));
    post.position.set(pos.x, pos.y / 2 - 0.03, pos.z - 0.04); scene.add(post);
    return m;
  };
  const stirPlate = plate('Mexer!', '#7a3a9a', STIR_POS, 'stir');
  const emptyPlate = plate('Esvaziar', '#6a4a2a', EMPTY_POS, 'empty');

  // ---------- Prateleira em arco ----------
  const shelfMat = madeira({ clara: '#a8784c', escura: '#6a4228', tabuas: 2, leve: true });
  for (let i = 0; i < SHELF; i++) {
    const p = slotPos(i);
    const board = new THREE.Mesh(caixaArredondada(0.2, 0.03, 0.15, 0.01, 2), shelfMat);
    board.position.set(p.x, SLOT_Y - 0.015, p.z); board.rotation.y = -SLOT_ANG[i]; board.castShadow = board.receiveShadow = true; scene.add(board);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, SLOT_Y - 0.03, 8), shelfMat);
    const back = new THREE.Vector3(Math.sin(SLOT_ANG[i]) * (SLOT_R + 0.06), 0, -Math.cos(SLOT_ANG[i]) * (SLOT_R + 0.06));
    post.position.set(back.x, (SLOT_Y - 0.03) / 2, back.z); scene.add(post);
    const num = new Label(0.05, 64, 64); num.set([{ text: String(i + 1), size: 0.7, color: '#ffe8b0' }]);
    num.mesh.position.set(p.x * 1.0, SLOT_Y - 0.045, p.z * 1.0); num.mesh.position.add(new THREE.Vector3(-Math.sin(SLOT_ANG[i]) * 0.08, 0, Math.cos(SLOT_ANG[i]) * 0.08));
    num.mesh.rotation.y = -SLOT_ANG[i]; num.mesh.renderOrder = 3; num.mesh.material.depthTest = true; scene.add(num.mesh);
  }
  addCandle(Math.sin(-1.4) * 0.66, SLOT_Y, -Math.cos(-1.4) * 0.66, 0.1);
  addCandle(Math.sin(1.4) * 0.66, SLOT_Y, -Math.cos(1.4) * 0.66, 0.14);

  // ---------- Frascos ----------
  const flaskPts = [[0, 0], [0.034, 0.002], [0.045, 0.03], [0.044, 0.06], [0.03, 0.085], [0.014, 0.1], [0.014, 0.135], [0.018, 0.14]].map(([x, y]) => new THREE.Vector2(x, y));
  const glassGeo = new THREE.LatheGeometry(flaskPts, 18);
  const liquidGeo = new THREE.LatheGeometry([[0, 0.004], [0.031, 0.006], [0.041, 0.03], [0.04, 0.06], [0.027, 0.08], [0, 0.082]].map(([x, y]) => new THREE.Vector2(x, y)), 16);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false, envMapIntensity: 1.6 });
  const corkMat = new THREE.MeshStandardMaterial({ color: 0xb08850, roughness: 0.85 });
  const corkGeo = new THREE.CylinderGeometry(0.016, 0.013, 0.03, 10).translate(0, 0.15, 0);
  const elMats = {}, labelMats = {};
  for (const e of ELEMENTS) {
    elMats[e] = new THREE.MeshStandardMaterial({ color: EL[e].color, roughness: 0.3, emissive: EL[e].color, emissiveIntensity: 0.45 });
    labelMats[e] = new THREE.MeshStandardMaterial({ map: tex(labelCanvas(e)), roughness: 0.8 });
  }
  const labelGeo = new THREE.CylinderGeometry(0.0455, 0.0455, 0.04, 16, 1, true, -0.9, 1.8).translate(0, 0.045, 0);
  const hitGeo = new THREE.SphereGeometry(0.065, 8, 6);
  function makeVial(e) {
    const g = new THREE.Group();
    const liq = new THREE.Mesh(liquidGeo, elMats[e]); g.add(liq);
    const gl = new THREE.Mesh(glassGeo, glassMat); gl.renderOrder = 2; g.add(gl);
    g.add(new THREE.Mesh(corkGeo, corkMat));
    const lab = new THREE.Mesh(labelGeo, labelMats[e]); g.add(lab);
    const hit = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.07; g.add(hit);
    const hl = halo(EL[e].css, 0.14, 0.5); hl.position.y = 0.05; g.add(hl);
    g.userData = { e, hit, hl };
    for (const c of g.children) if (c.isMesh && c !== hit) c.castShadow = true;
    return g;
  }
  // potes cobertos do adversário (você não vê o que tem)
  const potMat = new THREE.MeshStandardMaterial({ color: 0x6a4a3a, roughness: 0.6 });
  const clothMat = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.95 });
  const oppPots = [];
  const oppShelf = new THREE.Mesh(caixaArredondada(1.1, 0.04, 0.22, 0.01, 2), shelfMat);
  oppShelf.position.set(0, 1.0, OPP_POS.z - 0.55); oppShelf.castShadow = true; scene.add(oppShelf);
  for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 8), shelfMat); leg.position.set(sx * 0.5, 0.5, OPP_POS.z - 0.55); scene.add(leg); }
  for (let i = 0; i < SHELF; i++) {
    const g = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.11, 14), potMat); pot.position.y = 0.055; g.add(pot);
    const cl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 1), clothMat); cl.position.y = 0.11; g.add(cl);
    g.position.set((i - 2) * 0.21, 1.02, OPP_POS.z - 0.55); g.userData.home = g.position.clone(); scene.add(g); oppPots.push(g);
  }

  // ---------- Livro de receitas (no atril) ----------
  const bookC = canvas(512, 320);
  const bookTex = tex(bookC);
  const lectern = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, BOOK_POS.y - 0.05, 8), shelfMat); lectern.position.set(BOOK_POS.x, (BOOK_POS.y - 0.05) / 2, BOOK_POS.z); scene.add(lectern);
  const bookG = new THREE.Group();
  const cover = new THREE.Mesh(caixaArredondada(0.36, 0.02, 0.24, 0.006, 2), new THREE.MeshStandardMaterial({ color: 0x5a1a2a, roughness: 0.6 })); bookG.add(cover);
  const pages = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.22).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: bookTex, roughness: 0.9, emissive: 0xffffff, emissiveIntensity: 0.12, emissiveMap: bookTex }));
  pages.position.y = 0.012; pages.userData = { kind: 'book' }; bookG.add(pages);
  bookG.position.copy(BOOK_POS); bookG.rotation.set(0.55, 0.75, 0, 'YXZ'); bookG.rotation.order = 'YXZ'; bookG.rotation.y = 0.85; bookG.rotation.x = 0.55;
  scene.add(bookG);
  function drawBook(known, total, last) {
    const g = bookC.getContext('2d');
    g.fillStyle = '#efe2c2'; g.fillRect(0, 0, 512, 320);
    g.fillStyle = '#c8b48a'; g.fillRect(253, 0, 6, 320);
    g.fillStyle = '#5a1a2a'; g.font = 'bold 34px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('Receitas', 128, 50);
    g.font = '28px Georgia, serif'; g.fillStyle = '#3a2412'; g.fillText(`${known} de ${total}`, 128, 110);
    g.font = '20px Georgia, serif'; g.fillText('descobertas', 128, 145);
    g.fillText('toque para abrir', 128, 270);
    g.font = 'bold 24px Georgia, serif'; g.fillStyle = '#5a1a2a'; g.fillText('Última:', 384, 50);
    g.font = '24px Georgia, serif'; g.fillStyle = '#3a2412';
    const lines = last ? [last.name, last.els.map(e => EL[e].name).join(' + '), ...wrap(last.desc, 22)] : ['nenhuma ainda'];
    lines.slice(0, 6).forEach((t, i) => g.fillText(t, 384, 100 + i * 34));
    bookTex.needsUpdate = true;
  }
  function wrap(t, n) { const w = t.split(' '), out = []; let cur = ''; for (const x of w) { if ((cur + ' ' + x).trim().length > n) { out.push(cur.trim()); cur = x; } else cur += ' ' + x; } if (cur.trim()) out.push(cur.trim()); return out; }

  // ---------- Adversário ----------
  const opp = { p: null, hat: null, robe: null, root: new THREE.Group(), pose: 'idle', poseT: 0 };
  opp.root.position.copy(OPP_POS); scene.add(opp.root);
  const oppShadow = sombraContato(0.9, 0.9, 0.5); oppShadow.position.set(OPP_POS.x, 0.004, OPP_POS.z); scene.add(oppShadow);
  function setOpponent(o) {
    if (opp.p) opp.root.remove(opp.p.grupo);
    const cab = o.style === 'scare' ? 'careca' : o.style === 'herb' ? 'coque' : o.style === 'fire' ? 'topete' : 'franja';
    const p = criarPersonagem({ altura: 1.72, cabecas: 3.4, porte: o.style === 'fire' ? 1.15 : 0.95, mangas: 'longa', cabelo: cab, barriga: o.style === 'herb' ? 0.3 : 0,
      cores: { pele: o.skin, camisa: o.robe, calca: o.robe, cabelo: o.hair, detalhe: o.style === 'scare' ? '#c8a050' : '#e8c24a', sapato: '#3a2418', iris: o.style === 'crow' ? '#8a2a2a' : '#3a6a3a' } });
    // túnica longa até o chão
    const robeMat = new THREE.MeshStandardMaterial({ color: o.robe, roughness: 0.85 });
    const yq = p.ossos.quadril.position.y;
    const robe = new THREE.Mesh(new THREE.LatheGeometry([[0.0, -yq], [0.3, -yq + 0.02], [0.26, -yq * 0.5], [0.2, 0.0], [0.17, 0.12], [0, 0.12]].map(([x, y]) => new THREE.Vector2(x, y)), 24).scale(1, 1, 0.8), robeMat);
    robe.castShadow = true; p.ossos.quadril.add(robe);
    // chapéu de bruxo
    const rc = p.medidas.rc;
    const hatMat = new THREE.MeshStandardMaterial({ color: o.hat, roughness: 0.75 });
    const hat = new THREE.Group();
    if (o.style === 'scare') {
      const straw = new THREE.MeshStandardMaterial({ color: 0xd8b05a, roughness: 0.9 });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(rc * 1.9, rc * 1.9, rc * 0.08, 24), straw); hat.add(brim);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(rc * 0.8, rc * 1.0, rc * 0.7, 18), straw); top.position.y = rc * 0.35; hat.add(top);
    } else {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(rc * 1.75, rc * 1.75, rc * 0.07, 28), hatMat); hat.add(brim);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(rc * 0.95, rc * 2.6, 20, 4), hatMat); cone.position.y = rc * 1.3;
      const pos = cone.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { const y = Math.max(0, pos.getY(i) / (rc * 2.6) + 0.5); pos.setX(i, pos.getX(i) + Math.pow(y, 2.2) * rc * 0.9); }
      cone.geometry.computeVertexNormals(); hat.add(cone);
      const band = new THREE.Mesh(new THREE.TorusGeometry(rc * 0.93, rc * 0.07, 6, 24).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: o.style === 'fire' ? 0xffb02a : o.style === 'herb' ? 0x8ac04a : 0x8a8ac8, roughness: 0.5 }));
      band.position.y = rc * 0.12; hat.add(band);
      if (o.style === 'herb') for (let k = 0; k < 3; k++) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(rc * 0.18, 8, 6).scale(0.5, 1.4, 0.2), new THREE.MeshStandardMaterial({ color: 0x5aa04a, roughness: 0.8 })); leaf.position.set(rc * (0.7 + k * 0.1), rc * 0.3, rc * 0.5); leaf.rotation.z = -0.6 + k * 0.3; hat.add(leaf); }
      if (o.style === 'crow') { const fe = new THREE.Mesh(new THREE.ConeGeometry(rc * 0.12, rc * 1.2, 6), new THREE.MeshStandardMaterial({ color: 0x1a1a2a, roughness: 0.5 })); fe.position.set(rc * 0.9, rc * 0.6, 0); fe.rotation.z = -0.6; hat.add(fe); }
      if (o.style === 'fire') { const fl = halo('#ff8a2a', rc * 1.6, 0.6); fl.position.y = rc * 2.7; hat.add(fl); }
    }
    hat.position.y = rc * 0.75; hat.rotation.x = -0.1;
    p.ossos.cabeca.add(hat);
    p.grupo.traverse(c => { if (c.isMesh) c.castShadow = true; });
    opp.root.add(p.grupo);
    opp.p = p; opp.style = o.style;
  }
  // poses: 'idle', 'stir' (mexe), 'cast' (braços para cima), 'hit' (recua), 'happy', 'sad', 'stunned'
  function updateOpponent(dt, t, look) {
    const p = opp.p; if (!p) return;
    opp.poseT += dt;
    p.olharPara(look);
    p.atualizar(dt);
    const o = p.ossos;
    if (opp.pose === 'stir') {
      o.ombroD.rotation.x = -1.0 + Math.sin(t * 7) * 0.15; o.ombroD.rotation.z = -0.3 + Math.cos(t * 7) * 0.2; o.cotoveloD.rotation.x = -0.8;
      o.coluna.rotation.x = 0.18;
    } else if (opp.pose === 'cast') {
      const k = Math.min(1, opp.poseT * 5);
      for (const [L, s] of [['E', 1], ['D', -1]]) { o['ombro' + L].rotation.x = -2.2 * k; o['ombro' + L].rotation.z = s * 0.5 * k; o['cotovelo' + L].rotation.x = -0.3; }
      o.coluna.rotation.x = -0.1 * k;
    } else if (opp.pose === 'hit') {
      const k = Math.max(0, 1 - opp.poseT * 1.5);
      o.coluna.rotation.x = -0.35 * k; o.ombroE.rotation.z = 0.9 * k; o.ombroD.rotation.z = -0.9 * k;
    } else if (opp.pose === 'happy') {
      o.ombroE.rotation.x = -2.6; o.ombroD.rotation.x = -2.6; o.quadril.position.y += Math.abs(Math.sin(t * 8)) * 0.04;
    } else if (opp.pose === 'stunned') {
      o.cabeca.rotation.z = Math.sin(t * 3) * 0.25; o.coluna.rotation.z = Math.sin(t * 3) * 0.08;
    }
  }

  // ---------- Efeitos visuais ----------
  // estrelinhas de atordoado (em volta da cabeça do adversário)
  const stunStars = new THREE.Group();
  for (let k = 0; k < 5; k++) { const s = halo('#ffe25a', 0.08, 1.2); s.userData.a = k / 5 * Math.PI * 2; stunStars.add(s); }
  stunStars.visible = false; scene.add(stunStars);
  // escudos: domo translúcido na frente de cada um, cor dos elementos bloqueados
  function makeShield(z, facing) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.75, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.32).rotateX(facing * Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x9ae4ff, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
    m.position.set(0, 1.2, z); m.visible = false; m.renderOrder = 5; scene.add(m);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.75 * Math.sin(Math.PI * 0.32), 0.008, 6, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, fog: false }));
    rim.position.set(0, 1.2, z + facing * -0.75 * Math.cos(Math.PI * 0.32) * -1); m.userData.rim = rim; rim.visible = false; scene.add(rim);
    return m;
  }
  const shields = [makeShield(0.35, -1), makeShield(-3.35, 1)];
  // espelho: anel prateado
  const mirrors = [0, 1].map(i => { const m = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.3, 40), new THREE.MeshBasicMaterial({ color: 0xe0e8ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending, depthWrite: false })); m.position.set(0, 1.25, i === 0 ? -0.85 : -2.25); m.visible = false; scene.add(m); return m; });
  // veneno: bolhas verdes em volta de cada um
  const poisonFx = [PLAYER_HEAD, OPP_HEAD].map((h, i) => { const g = new THREE.Group(); for (let k = 0; k < 7; k++) { const s = halo('#6ad82a', 0.07, 1.0); s.userData.a = k; g.add(s); } g.position.set(h.x, 0, i === 0 ? -0.35 : h.z + 0.3); g.visible = false; scene.add(g); return g; });

  // projéteis (feitiço voando) e partículas
  const projectiles = [];
  const coreGeo = new THREE.SphereGeometry(0.07, 16, 10);
  const sparks = [];
  const sparkGeo = new THREE.SphereGeometry(0.012, 6, 4);
  function sparkle(pos, color, n = 20, speed = 1.2, up = 0.6, life = 0.9) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, toneMapped: false, depthWrite: false });
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(sparkGeo, mat);
      m.position.copy(pos);
      const v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * up * 2, (Math.random() - 0.5) * 2).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.6));
      scene.add(m); sparks.push({ m, v, life, t: 0, mat });
    }
  }
  function launch({ from, to, color, color2 = null, size = 1, dur = 0.9, arc = 0.4, onHit }) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    core.scale.setScalar(size); g.add(core);
    const shell = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    shell.scale.setScalar(size * 1.8); g.add(shell);
    const h = halo(new THREE.Color(color).getStyle(), 0.6 * size, 1.4); g.add(h);
    if (color2 != null) { const h2 = halo(new THREE.Color(color2).getStyle(), 0.4 * size, 1.2); h2.position.x = 0.05; g.add(h2); }
    g.position.copy(from); scene.add(g);
    projectiles.push({ g, from: from.clone(), to: to.clone(), t: 0, dur, arc, color, onHit, trailT: 0 });
  }
  function updateFx(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      p.g.position.lerpVectors(p.from, p.to, k); p.g.position.y += Math.sin(Math.PI * k) * p.arc;
      p.g.rotation.y += dt * 8; p.g.scale.setScalar(1 + Math.sin(p.t * 30) * 0.08);
      p.trailT += dt;
      if (p.trailT > 0.03) { p.trailT = 0; sparkle(p.g.position, p.color, 2, 0.25, 0.3, 0.45); }
      if (k >= 1) { scene.remove(p.g); projectiles.splice(i, 1); sparkle(p.to, p.color, 30, 1.6, 0.6, 0.8); p.onHit?.(); }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.t += dt;
      s.m.position.addScaledVector(s.v, dt); s.v.y -= dt * 1.2; s.v.multiplyScalar(1 - dt * 1.5);
      s.m.scale.setScalar(Math.max(0.05, 1 - s.t / s.life));
      if (s.t >= s.life) { scene.remove(s.m); sparks.splice(i, 1); }
    }
  }
  // números flutuantes (dano, cura)
  const floaters = [];
  function floatText(text, pos, color = '#ff6a5a') {
    const l = new Label(0.32, 256, 96); l.set([{ text, size: 0.8, color }]);
    l.mesh.position.copy(pos); scene.add(l.mesh);
    floaters.push({ l, t: 0 });
  }
  function updateFloaters(dt, camPos) {
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i]; f.t += dt;
      f.l.mesh.position.y += dt * 0.25; f.l.mesh.lookAt(camPos);
      f.l.mesh.material.opacity = Math.max(0, 1 - Math.max(0, f.t - 1.0) / 0.6);
      if (f.t > 1.6) { scene.remove(f.l.mesh); floaters.splice(i, 1); }
    }
  }

  // placas de vida
  const hpLabels = [new Label(0.45, 512, 200), new Label(0.5, 512, 200)];
  hpLabels[0].mesh.position.set(0.5, 1.42, -0.95); hpLabels[0].mesh.rotation.y = -0.35;
  hpLabels[1].mesh.position.set(-0.85, 1.32, OPP_POS.z + 0.45); hpLabels[1].mesh.rotation.y = 0.25;
  for (const l of hpLabels) scene.add(l.mesh);
  // o que tem no caldeirão
  const potLabel = new Label(0.42, 512, 120);
  potLabel.mesh.position.set(0, 1.0, CAUL.z - 0.05); potLabel.mesh.rotation.x = -0.3; scene.add(potLabel.mesh);

  function animate(dt, t) {
    for (const c of candles) { const k = 1 + Math.sin(t * 13 + c.ph) * 0.08 + Math.sin(t * 7.3 + c.ph * 2) * 0.06; c.f.scale.set(1, k, 1); c.hl.scale.setScalar(0.22 * k); }
    fireLight.intensity = 2.1 + Math.sin(t * 11) * 0.25 + Math.sin(t * 17) * 0.15;
    oppFireLight.intensity = 2.1 + Math.sin(t * 10 + 1) * 0.25 + Math.sin(t * 15) * 0.15;
    for (const c of [myCaul, oppCaul]) {
      c.color.lerp(c.target, 1 - Math.exp(-dt * 4));
      c.liqMat.color.copy(c.color); c.liqMat.emissive.copy(c.color).multiplyScalar(0.5);
      c.liqGlow.material.color.copy(c.color).multiplyScalar(0.9);
      c.bubMat.color.copy(c.color).lerp(new THREE.Color(0xffffff), 0.4);
      c.swirl = Math.max(0, c.swirl - dt * 0.5);
      c.liq.rotation.y += dt * (0.3 + c.swirl * 8);
      c.flames.forEach((f, k) => { f.scale.set(1, 0.8 + Math.sin(t * 12 + k * 2) * 0.25 + c.swirl * 0.4, 1); });
      for (const b of c.bubbles) {
        b.t += dt * (0.6 + c.swirl * 2);
        if (b.t > 1) { b.t -= 1; b.a += 2.1; }
        b.m.position.set(Math.cos(b.a + c.swirl * t) * b.r, LIQ_Y + b.t * 0.05, Math.sin(b.a + c.swirl * t) * b.r);
        b.m.scale.setScalar(0.5 + b.t);
      }
    }
    stunStars.children.forEach(s => { const a = s.userData.a + t * 3; s.position.set(Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2); });
    for (const g of poisonFx) g.children.forEach((s, k) => { const ph = (t * 0.6 + k / 7) % 1; s.position.set(Math.cos(k * 2.3) * 0.3, 0.6 + ph * 1.1, Math.sin(k * 2.3) * 0.18); s.material.opacity = Math.sin(ph * Math.PI); });
    for (const m of mirrors) if (m.visible) m.rotation.z += dt;
    updateFx(dt);
  }

  return {
    scene, key, myCaul, oppCaul, spoon, spoonHit, oppSpoon, setSpoon, stirPlate, emptyPlate, makeVial, oppPots, drawBook, bookPages: pages,
    opp, setOpponent, updateOpponent, stunStars, shields, mirrors, poisonFx, launch, sparkle, floatText, updateFloaters, hpLabels, potLabel, animate,
    elMats,
    // reflexo nos vidros e no ferro: mapa de ambiente gerado do céu (só com WebGL de verdade)
    setupEnv(renderer) { if (renderer?.isWebGLRenderer) ambienteDoCeu(renderer, scene, ceu, 0.55); },
  };
}
