// Liga as regras e a IA à cena, ao Quest (controles e mãos) e ao mouse/teclado.
import * as THREE from '../vendor/three/three.module.js';
import { PLAYER, CPU, MAX_HP, SHELF, EL, RECIPES, BY_KEY, newDuel, applyMove, applyScripted, isLegal, recipeFor, keyOf, isOffensive, rng } from './rules.js';
import { OPPONENTS, ROBOT, chooseMove } from './ai.js';
import { CHALLENGES, setupChallenge, dummyRecipe, isDone, measure, starsFor, goalText, metricName, solveChallenge } from './challenges.js';
import { buildWorld, CAUL, RIM_Y, LIQ_Y, CAUL_R, OPP_CAUL, OPP_POS, slotPos, STIR_POS, EMPTY_POS, BOOK_POS, PLAYER_HEAD, OPP_HEAD } from './scene.js';
import { createShell } from './shell.js';
import { setTheme } from './ui.js';
import { Sfx } from './audio.js';
import { loadSave, storeSave } from './save.js';

setTheme({
  bg: 'rgba(30,22,44,0.96)', edge: '#e8b84a', text: '#f6ecd8', dim: '#b8a8c8', btn: '#44305e', btnHover: '#6e4c94',
  btnOn: '#e8b84a', btnOnText: '#2a1a10', lock: '#2a2036', star: '#ffd24a', labelBg: 'rgba(30,22,44,0.85)',
  title: 'bold 58px Georgia, serif',
});

const save = loadSave();
const sfx = new Sfx();
sfx.on = save.sound;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const GRAB_DIST = 0.09, STIR_TURNS = 1.0;
const STAND = { x: 0, z: 0 };
const SCARE = { id: 'espantalho', name: 'Espantalho', robe: '#8a7a4a', hat: '#d8b05a', skin: '#e8d8a0', hair: '#d8b05a', style: 'scare' };

const IS_QUEST = /OculusBrowser|Quest/i.test(navigator.userAgent || '');
const world = buildWorld({ leve: true });
const { scene } = world;
const shell = createShell({ scene, sfx, save, storeSave, stand: STAND, exposure: 1.25, statusPos: new THREE.Vector3(-0.62, 1.72, -1.25), statusWidth: 0.7, shadows: true, hooks: {} });
const { renderer, camera, panel } = shell;
world.setupEnv(renderer);
shell.statusLabel.mesh.rotation.y = 0.35;
shell.orbit.target.set(0, 0.95, -1.05);
shell.orbit.dist = 1.85; shell.orbit.pitch = 0.5; shell.orbit.keys = 'wasd';
shell.orbit.minPitch = 0.1; shell.orbit.maxPitch = 1.2; shell.orbit.minDist = 1.0; shell.orbit.maxDist = 3;
const menuCam = (t) => ({ pos: new THREE.Vector3(Math.sin(t * 0.12) * 0.8, 1.6, 0.9), look: new THREE.Vector3(0, 1.25, -2.6) });

// vermelho na tela quando você leva um golpe (PC: CSS; VR: esfera em volta da cabeça)
const flashEl = document.getElementById('flash');
const flashVR = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 8), new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, toneMapped: false }));
flashVR.renderOrder = 20; flashVR.visible = false; camera.add(flashVR);
let flashT = 0, flashColor = '#ff2a1a';
function flash(color = '#ff2a1a') { flashT = 0.6; flashColor = color; flashVR.material.color.set(color); }

// ---------- Estado ----------
let app = 'menu', mode = 'match', duel = null, ch = null, oppIndex = 0;
let phase = 'idle';          // 'intro' | 'brew' | 'stir' | 'anim' | 'think' | 'over'
let time = 0, msg = null, random = rng((Date.now() % 100000) + 1);
let chResult = null, timerAuto = 0, bookPage = 0, lastDiscovered = null;
let pot = [];                // índices da prateleira já no caldeirão
let held = null;             // VR: { entry, kind: 'vial'|'spoon', i, acc, lastA }
let stirT = 0, stirAuto = false;
let oppPlan = null;          // lance do adversário + linha do tempo
const vials = [];            // grupos dos frascos na prateleira (índice = posição na prateleira)
const timers = [];
const later = (sec, fn) => timers.push({ at: time + sec, fn });
const movers = [];
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const opponent = () => (mode === 'match' ? OPPONENTS[oppIndex] : SCARE);
const oppName = () => opponent().name;
const cur = () => duel;

function moveTo(g, pos, dur = 0.4, arc = 0.1, onDone = null, scaleTo = null) {
  for (let i = movers.length - 1; i >= 0; i--) if (movers[i].g === g) movers.splice(i, 1);
  movers.push({ g, a: g.position.clone(), b: pos.clone(), t0: time, dur, arc, onDone, s0: g.scale.x, s1: scaleTo ?? g.scale.x });
}
function updateMovers() {
  for (let i = movers.length - 1; i >= 0; i--) {
    const v = movers[i];
    const k = clamp((time - v.t0) / v.dur, 0, 1), s = k * k * (3 - 2 * k);
    v.g.position.lerpVectors(v.a, v.b, s); v.g.position.y += Math.sin(Math.PI * k) * v.arc;
    v.g.scale.setScalar(v.s0 + (v.s1 - v.s0) * s);
    if (k >= 1) { movers.splice(i, 1); v.onDone?.(); }
  }
}

// ---------- Frascos ----------
function clearVials() { for (const g of vials) if (g) scene.remove(g); vials.length = 0; }
function layoutVials(fresh = 0) {
  clearVials();
  const st = cur();
  if (!st) return;
  st.shelf[PLAYER].forEach((e, i) => {
    const g = world.makeVial(e);
    slotPos(i, g.position);
    g.rotation.y = Math.atan2(-g.position.x, -g.position.z);
    g.userData.hit.userData = { kind: 'vial', i };
    g.userData.home = g.position.clone();
    scene.add(g); vials[i] = g;
    if (i >= st.shelf[PLAYER].length - fresh) { g.scale.setScalar(0.01); g.position.y += 0.15; moveTo(g, g.userData.home, 0.5, 0, null, 1); }
  });
}
const vialVisible = (i) => vials[i] && vials[i].visible;
function potElements() { const st = cur(); return pot.map(i => st.shelf[PLAYER][i]); }
function refreshPot(c = world.myCaul) {
  const els = potElements();
  if (!els.length) { c.target.set(0x3a6a4a); return; }
  const col = new THREE.Color(0, 0, 0);
  for (const e of els) col.add(new THREE.Color(EL[e].color).multiplyScalar(1 / els.length));
  c.target.copy(col);
}

// ---------- Partidas e desafios ----------
function newMatch(i) {
  mode = 'match';
  oppIndex = clamp(i, 0, OPPONENTS.length - 1);
  world.setOpponent(opponent());
  duel = newDuel({ seed: Math.floor(random() * 1e9), starter: random() < 0.5 ? PLAYER : CPU });
  ch = null;
  startPlay();
  msg = { text: duel.turn === PLAYER ? 'Sorteio: você começa.' : `Sorteio: ${oppName()} começa.`, t: 3 };
  beginTurn();
}
function newChallenge(i, skipIntro = false) {
  mode = 'challenge';
  const k = clamp(i, 0, CHALLENGES.length - 1);
  ch = { i: k, plan: null };
  duel = setupChallenge(CHALLENGES[k]);
  world.setOpponent(SCARE);
  startPlay();
  chResult = null; msg = null;
  if (skipIntro || dev.autoplay) { shell.hidePanel(); beginTurn(); } else { phase = 'intro'; showScreen('chIntro'); }
}
function startPlay() {
  app = 'play'; shell.hidePanel();
  timers.length = 0; movers.length = 0;
  pot = []; held = null; oppPlan = null; stirT = 0;
  world.opp.pose = 'idle';
  for (const p of world.oppPots) { p.position.copy(p.userData.home); p.scale.setScalar(1); p.visible = true; }
  world.myCaul.target.set(0x3a6a4a); world.oppCaul.target.set(0x3a6a4a);
  layoutVials();
  shell.orbit.menu = null; shell.orbit.snap = true;
  if (shell.vr && !rigPlaced) { shell.recenter(); rigPlaced = true; }
}
let rigPlaced = false;

function beginTurn() {
  const st = cur();
  if (!st) return;
  if (st.over || (mode === 'challenge' && isDone(CHALLENGES[ch.i], st))) { endDuel(); return; }
  if (st.turn === PLAYER) {
    phase = 'brew';
    pot = [];
    refreshPot();
    world.opp.pose = 'idle';
    const before = vials.filter(Boolean).length;
    layoutVials(Math.max(0, st.shelf[PLAYER].length - before));
    if (!msg || msg.t < 1) msg = { text: 'Sua vez: despeje 2 ou 3 frascos e mexa.', t: 3 };
  } else {
    phase = 'think';
    planOpponent();
  }
  updateHint();
}

// Adversário: decide, despeja os potes (você vê as cores caindo), mexe e lança.
function planOpponent() {
  const st = cur();
  let move = null, recipe = null;
  if (mode === 'challenge') recipe = dummyRecipe(CHALLENGES[ch.i], st);
  else { const c = chooseMove(st, CPU, opponent(), random); move = c.move; recipe = c.recipe; }
  const think = mode === 'match' ? opponent().think : 0.8;
  oppPlan = { move, recipe };
  world.opp.pose = 'idle'; world.opp.poseT = 0;
  const els = move ? move.idx.map(i => st.shelf[CPU][i]) : recipe ? recipe.els : [];
  const potsUsed = [];
  els.forEach((e, k) => later(think * 0.35 + k * 0.45, () => {
    const pot3 = world.oppPots[k];
    potsUsed.push(pot3);
    moveTo(pot3, OPP_CAUL.clone().setY(RIM_Y + 0.1), 0.35, 0.25, () => {
      pot3.visible = false; sfx.pour();
      world.sparkle(OPP_CAUL.clone().setY(LIQ_Y + 0.05), EL[e].color, 12, 0.6, 0.8, 0.6);
      const c = world.oppCaul, col = new THREE.Color(EL[e].color);
      c.target.copy(k === 0 ? col : c.target.clone().lerp(col, 1 / (k + 1)));
    });
  }));
  const tStir = think * 0.35 + els.length * 0.45 + 0.2;
  later(tStir, () => { world.opp.pose = 'stir'; world.opp.poseT = 0; world.oppCaul.swirl = 1; sfx.stir(); });
  later(tStir + Math.max(0.6, think * 0.5), () => {
    if (app !== 'play' || cur() !== st) return;
    world.opp.pose = 'cast'; world.opp.poseT = 0;
    let r;
    if (mode === 'challenge') r = applyScripted(st, recipe);
    else r = applyMove(st, move);
    duel = r.st;
    resolveCast(CPU, r.result);
    later(0.6, () => { for (const p of world.oppPots) { p.position.copy(p.userData.home).setY(p.userData.home.y + 0.2); p.scale.setScalar(0.01); p.visible = true; moveTo(p, p.userData.home, 0.4, 0, null, 1); } });
  });
}

// ---------- Lançar ----------
function startStir(auto) {
  if (!canBrew()) return false;
  if (pot.length < 2) { msg = { text: 'Ponha 2 ou 3 frascos no caldeirão antes de mexer.', t: 2.5 }; sfx.deny(); return false; }
  phase = 'stir'; stirT = 0; stirAuto = auto;
  world.myCaul.swirl = 1;
  sfx.stir();
  updateHint();
  return true;
}
function doCast() {
  const st = cur();
  const move = { type: 'cast', idx: pot.slice() };
  if (!isLegal(st, move)) { phase = 'brew'; return; }
  const r = applyMove(st, move);
  duel = r.st;
  pot = [];
  if (held?.kind === 'spoon') held = null;
  resolveCast(PLAYER, r.result);
}
const castFrom = (who) => (who === PLAYER ? CAUL : OPP_CAUL).clone().setY(1.0);
const headOf = (who) => (who === PLAYER ? new THREE.Vector3(0, 1.3, -0.25) : OPP_HEAD.clone().add(new THREE.Vector3(0, -0.15, 0.2)));
const frontOf = (who) => (who === PLAYER ? new THREE.Vector3(0, 1.2, -0.62) : new THREE.Vector3(0, 1.25, -2.42));

function discover(r) {
  if (r.goro || save.book[r.key]) return false;
  save.book[r.key] = true; storeSave(save);
  lastDiscovered = r;
  return true;
}
// Mostra o feitiço: voa, bate, é bloqueado, devolvido; ou efeito em quem lançou.
function resolveCast(who, res) {
  phase = 'anim';
  const r = res.recipe, ev = res.ev;
  const name = who === PLAYER ? 'Você' : oppName();
  const caul = who === PLAYER ? world.myCaul : world.oppCaul;
  if (!r) {
    msg = { text: `${name} fica parado olhando para você.`, t: 2.5 };
    later(1.0, () => afterCast(res));
    return;
  }
  const isNew = discover(r);
  const color = r.el ? EL[r.el].color : r.els.length ? EL[r.els[0]].color : 0xffffff;
  caul.target.set(color); caul.swirl = 1.2;
  if (r.goro) sfx.goro(); else sfx.cast(r.el || r.els[0]);
  let text = r.goro ? `${name}: ${r.desc}` : `${name} lança ${r.name}${r.els.length ? ` (${r.els.map(e => EL[e].name).join(' + ')})` : ''}: ${r.desc}.`;
  if (isNew) { text = `Receita nova no livro: ${r.name}! ${r.desc}.`; later(0.3, () => sfx.discover()); }
  msg = { text, t: 4 };
  // efeitos em quem lançou
  later(0.25, () => {
    const at = headOf(who);
    if (r.heal) { world.sparkle(at, 0x8aff8a, 30, 0.7, 1.2, 1.2); if (ev.heal) world.floatText(`+${ev.heal}`, at.clone().add(new THREE.Vector3(0.15, 0.2, 0)), '#7aff8a'); sfx.heal(); }
    if (r.shield) { sfx.shield(); world.sparkle(frontOf(who), EL[r.shield.blocks[0]].color, 26, 0.9, 0.5, 0.9); }
    if (r.reflect) { sfx.reflect(); world.sparkle(frontOf(who), 0xe0e8ff, 26, 0.9, 0.5, 0.9); }
  });
  let dur = 1.2;
  if (isOffensive(r)) {
    const target = ev.target, from = castFrom(who);
    const big = r.els.length === 3 ? 1.5 : 1;
    const hit = () => {
      if (ev.blocked) { sfx.block(); world.floatText('Bloqueado!', frontOf(target).add(new THREE.Vector3(0, 0.3, 0)), '#bfe8ff'); world.sparkle(frontOf(target), 0xffffff, 30, 1.4, 0.5, 0.7); return; }
      if (ev.dmg) {
        sfx.hit(); world.floatText(`-${ev.dmg}`, headOf(target).add(new THREE.Vector3(0.2, 0.25, 0)), '#ff6a5a');
        if (target === PLAYER) { flash(); shell.pulseAll(0.8, 120); } else { world.opp.pose = 'hit'; world.opp.poseT = 0; world.opp.p?.expressao('triste'); }
      }
      if (ev.poison) { sfx.poison(); world.floatText('Envenenado!', headOf(target).add(new THREE.Vector3(-0.2, 0.35, 0)), '#8aff4a'); if (target === PLAYER) flash('#4ac81a'); }
      if (ev.stun) { sfx.stun(); world.floatText('Atordoado!', headOf(target).add(new THREE.Vector3(0, 0.45, 0)), '#ffe25a'); if (target === PLAYER) flash('#ffe25a'); }
      if (r.dispel) world.sparkle(frontOf(target), 0x8a4aff, 40, 1.6, 0.5, 0.9);
    };
    if (ev.reflected) {
      const mid = frontOf(1 - who);
      world.launch({ from, to: mid, color, size: big, dur: 0.7, arc: 0.3, onHit: () => {
        sfx.reflect(); world.floatText('Devolvido!', mid.clone().add(new THREE.Vector3(0, 0.3, 0)), '#e0e8ff');
        world.launch({ from: mid, to: headOf(target), color, size: big, dur: 0.6, arc: 0.2, onHit: hit });
      } });
      dur = 2.0;
    } else {
      world.launch({ from, to: ev.blocked ? frontOf(target) : headOf(target), color, color2: r.els[1] ? EL[r.els[1]].color : null, size: big, dur: 0.85, arc: 0.35, onHit: hit });
      dur = 1.6;
    }
  }
  later(dur, () => afterCast(res));
  updateHint();
}
function afterCast(res) {
  if (app === 'menu') return;
  const st = cur();
  // venenos e atordoados que aconteceram na virada
  for (const e of res.events || []) {
    if (e.type === 'poison') { world.floatText(`-${e.n} veneno`, headOf(e.who).add(new THREE.Vector3(-0.2, 0.1, 0)), '#8aff4a'); sfx.poison(); if (e.who === PLAYER) flash('#4ac81a'); }
    if (e.type === 'stunned') msg = { text: e.who === PLAYER ? 'Você está atordoado e perdeu a vez!' : `${oppName()} está atordoado e perdeu a vez!`, t: 3 };
  }
  if (world.opp.pose !== 'hit') world.opp.pose = 'idle';
  world.opp.p?.expressao('neutro');
  if (st.over || (mode === 'challenge' && isDone(CHALLENGES[ch.i], st))) { later(0.6, () => endDuel()); phase = 'anim'; return; }
  beginTurn();
}

function endDuel() {
  if (phase === 'over') return;
  phase = 'over';
  held = null;
  const st = cur();
  if (mode === 'challenge') { finishChallenge(); return; }
  save.games[oppIndex]++;
  if (st.winner === PLAYER) { save.wins[oppIndex]++; sfx.fanfare(); world.opp.pose = 'stunned'; world.opp.p?.expressao('triste'); }
  else if (st.winner === CPU) { sfx.bad(); world.opp.pose = 'happy'; world.opp.p?.expressao('feliz'); }
  storeSave(save);
  timerAuto = 2.5;
  showScreen('over');
}
function finishChallenge() {
  const c = CHALLENGES[ch.i];
  const value = measure(c, cur()), stars = starsFor(c, value);
  chResult = { stars, value };
  save.ch[ch.i] = Math.max(save.ch[ch.i] || 0, stars);
  storeSave(save);
  for (let k = 0; k < stars; k++) later(0.25 * k, () => sfx.star(k));
  if (stars === 3) later(0.8, () => sfx.fanfare());
  timerAuto = 2.5;
  showScreen('chResult');
}
function goMenu() {
  app = 'menu'; phase = 'idle';
  shell.orbit.menu = menuCam; shell.orbit.snap = true;
  duel = null; ch = null; pot = []; held = null;
  timers.length = 0; movers.length = 0;
  clearVials();
  world.setOpponent(OPPONENTS[(Math.floor(time / 20)) % 3]);
  world.opp.pose = 'stir';
  if (shell.vr) shell.recenter();
  showScreen('main');
}
function togglePause() {
  if (app === 'play' && !panel.visible) { app = 'paused'; dropHeld(); showScreen('pause'); }
  else if (app === 'paused') { app = 'play'; shell.hidePanel(); }
  updateHint();
}

// ---------- Menus ----------
const challengeUnlocked = (i) => i === 0 || (save.ch[i - 1] || 0) >= 1;
const known = () => RECIPES.filter(r => save.book[r.key]).length;
function showScreen(name) {
  const vr = shell.vr;
  shell.showPanel((p) => {
    if (name === 'main') {
      p.title('Caldeirão', 72);
      p.text('Duelo de bruxos: misture, mexa e lance o feitiço', 512, 128, { size: 26, color: '#b8a8c8' });
      p.button('Duelo contra o computador', () => showScreen('opponents'), 212, 166, 600, 88, { size: 36 });
      p.button('Desafios', () => showScreen('challenges'), 212, 266, 600, 72);
      p.button(`Livro de receitas (${known()} de ${RECIPES.length})`, () => { bookPage = 0; showScreen('book'); }, 212, 350, 600, 72, { size: 30 });
      p.button('Como jogar', () => showScreen('help'), 212, 434, 600, 66);
      p.button(`Som: ${save.sound ? 'sim' : 'não'}`, () => { save.sound = !save.sound; sfx.setOn(save.sound); storeSave(save); showScreen('main'); }, 212, 514, 290, 60, { size: 26 });
      p.button(`FPS: ${save.fps ? 'sim' : 'não'}`, () => { save.fps = !save.fps; storeSave(save); showScreen('main'); }, 522, 514, 290, 60, { size: 26 });
      const stars = Object.values(save.ch).reduce((a, b) => a + b, 0);
      p.text(`Vitórias: ${save.wins.reduce((a, b) => a + b, 0)}   ·   Estrelas: ${stars} de ${CHALLENGES.length * 3}`, 512, 610, { size: 26, color: '#e8b84a' });
      p.text(vr ? 'Aponte com o controle (ou a mão) e aperte o gatilho (ou faça a pinça)' : 'No Quest: abra esta página no navegador do óculos e aperte "Entrar em VR"', 512, 662, { size: 21, color: '#b8a8c8' });
    } else if (name === 'opponents') {
      p.title('Escolha o adversário', 62);
      OPPONENTS.forEach((o, i) => p.button(`${o.name}  ·  ${o.title}`, () => newMatch(i), 72, 116 + i * 156, 880, 136, { size: 34, sub: o.desc }));
      p.text(`20 de vida cada um. Vitórias: ${save.wins.join(' / ')}`, 512, 600, { size: 24, color: '#b8a8c8' });
      p.button('Voltar', () => showScreen('main'), 362, 632, 300, 66, { size: 28 });
    } else if (name === 'challenges') {
      p.title('Desafios', 56);
      CHALLENGES.forEach((c, i) => p.tile(52 + (i % 5) * 186, 110 + Math.floor(i / 5) * 200, 172, 176, { num: i + 1, name: c.name, stars: save.ch[i] || 0, done: save.ch[i] != null, locked: !challengeUnlocked(i), action: () => newChallenge(i) }));
      p.text('Passe um desafio (1 estrela) para liberar o próximo.', 512, 540, { size: 24, color: '#b8a8c8' });
      p.button('Voltar', () => showScreen(app === 'paused' ? 'pause' : 'main'), 362, 600, 300, 70, { size: 30 });
    } else if (name === 'book') {
      p.title('Livro de receitas', 54);
      const per = 16, list = RECIPES.slice(bookPage * per, bookPage * per + per);
      list.forEach((r, k) => {
        const x = k < 8 ? 40 : 532, y = 104 + (k % 8) * 58;
        if (save.book[r.key]) {
          p.text(r.name, x, y, { size: 24, bold: true, align: 'left', color: EL[r.el || r.els[0]].css === '#2a8aff' ? '#7ab8ff' : '#f6ecd8' });
          p.text(`${r.els.map(e => EL[e].name).join(' + ')}: ${r.desc}`.slice(0, 50), x, y + 26, { size: 18, align: 'left', color: '#c8b8d8' });
        } else {
          p.text('? ? ?', x, y, { size: 24, bold: true, align: 'left', color: '#6a5a7a' });
          p.text(`${r.els.length} ingredientes · tem ${EL[r.els[0]].name}`, x, y + 26, { size: 18, align: 'left', color: '#6a5a7a' });
        }
      });
      const pages = Math.ceil(RECIPES.length / per);
      p.text(`Página ${bookPage + 1} de ${pages} · ${known()} de ${RECIPES.length} descobertas · o resto vira gororoba`, 512, 580, { size: 21, color: '#b8a8c8' });
      p.button('Anterior', () => { bookPage = (bookPage + pages - 1) % pages; showScreen('book'); }, 112, 612, 240, 72, { size: 28 });
      p.button('Voltar', () => (app === 'paused' ? showScreen('pause') : app === 'play' ? shell.hidePanel() : showScreen('main')), 392, 612, 240, 72, { size: 28 });
      p.button('Próxima', () => { bookPage = (bookPage + 1) % pages; showScreen('book'); }, 672, 612, 240, 72, { size: 28 });
    } else if (name === 'help') {
      p.title('Como jogar', 60);
      const rows = [
        'Cada um tem 20 de vida. Na sua vez, despeje 2 ou 3 frascos e mexa.',
        'A mistura vira um feitiço: dano, escudo, cura, veneno, atordoar, espelho...',
        'Mistura que não está no livro vira gororoba (1 de dano engraçado).',
        'Escudo bloqueia os elementos dele; o espelho devolve o próximo ataque.',
        'A prateleira se completa com frascos novos a cada vez.',
        vr ? 'VR: pegue o frasco (botão lateral ou pinça) e solte em cima do caldeirão.' : 'PC: clique nos frascos (ou 1 a 5). Clique em Mexer! (ou Enter).',
        vr ? 'Pegue a colher e mexa em círculo para lançar. Raio + gatilho também vale.' : 'Esvaziar (ou Backspace) devolve. L: livro. Botão direito: câmera.',
        vr ? 'B ou Y: pausa. Toque no livro para ver as receitas.' : 'Esc: pausa. F: FPS.',
      ];
      rows.forEach((t, i) => p.text(t, 40, 124 + i * 54, { size: 24, align: 'left' }));
      p.button('Voltar', () => showScreen(app === 'paused' ? 'pause' : 'main'), 362, 586, 300, 80);
    } else if (name === 'pause') {
      p.title('Pausa', 66);
      p.text(mode === 'match' ? `Contra ${oppName()}` : `Desafio ${ch.i + 1}: ${CHALLENGES[ch.i].name}`, 512, 130, { size: 28, color: '#b8a8c8' });
      p.button('Continuar', () => togglePause(), 262, 170, 500, 80);
      p.button(mode === 'match' ? 'Recomeçar o duelo' : 'Recomeçar o desafio', () => (mode === 'match' ? newMatch(oppIndex) : newChallenge(ch.i, true)), 262, 262, 500, 80);
      p.button('Livro de receitas', () => { bookPage = 0; showScreen('book'); }, 262, 354, 500, 72, { size: 30 });
      p.button('Como jogar', () => showScreen('help'), 262, 438, 245, 72, { size: 28 });
      p.button('Recentralizar', () => { togglePause(); shell.recenter(); }, 517, 438, 245, 72, { size: 28, locked: !vr });
      p.button('Menu principal', () => goMenu(), 262, 522, 500, 76);
    } else if (name === 'over') {
      const st = cur(), w = st.winner;
      p.title(w === PLAYER ? 'Você venceu!' : w === CPU ? `${oppName()} venceu` : 'Empate!', 72);
      p.text(`Vida: você ${st.hp[0]} x ${st.hp[1]} ${oppName()}`, 512, 150, { size: 38, bold: true });
      p.text(`${st.casts[0]} feitiços seus, ${st.casts[1]} dele. Receitas no livro: ${known()} de ${RECIPES.length}`, 512, 208, { size: 25, color: '#b8a8c8' });
      p.text(`Contra ${oppName()}: ${save.wins[oppIndex]} vitória(s) em ${save.games[oppIndex]} duelo(s)`, 512, 252, { size: 24, color: '#b8a8c8' });
      p.button('Jogar de novo', () => newMatch(oppIndex), 262, 300, 500, 90, { size: 36 });
      p.button('Outro adversário', () => showScreen('opponents'), 262, 408, 500, 78);
      p.button('Menu principal', () => goMenu(), 262, 504, 500, 78);
    } else if (name === 'chIntro') {
      const c = CHALLENGES[ch.i];
      p.title(`Desafio ${ch.i + 1}: ${c.name}`, 66);
      p.text(c.desc, 512, 150, { size: 25 });
      p.text(`Você ${c.hp[0]} de vida, o Espantalho ${c.hp[1]}. ${c.starter === CPU ? 'Ele começa.' : 'Você começa.'}`, 512, 200, { size: 24, color: '#b8a8c8' });
      p.text(goalText(c), 512, 250, { size: 22, color: '#e8b84a' });
      p.button('Começar', () => { shell.hidePanel(); beginTurn(); }, 262, 310, 500, 94, { size: 38 });
      p.button('Desafios', () => showScreen('challenges'), 262, 430, 500, 80);
    } else if (name === 'chResult') {
      const c = CHALLENGES[ch.i];
      p.title(chResult.stars ? 'Desafio cumprido!' : 'Não foi dessa vez', 66);
      p.stars(chResult.stars, 512, 160, 80);
      p.text(`${metricName(c)}: ${c.metric === 'rapido' ? Math.max(0, chResult.value - 1) : chResult.value}`, 512, 232, { size: 30, bold: true });
      p.text(goalText(c), 512, 276, { size: 21, color: '#b8a8c8' });
      p.text(`Melhor: ${save.ch[ch.i] || 0} estrela(s)`, 512, 314, { size: 24 });
      p.button('Tentar de novo', () => newChallenge(ch.i, true), 262, 350, 245, 84, { size: 30 });
      p.button('Próximo', () => newChallenge(ch.i + 1), 517, 350, 245, 84, { size: 30, locked: ch.i >= CHALLENGES.length - 1 || !challengeUnlocked(ch.i + 1) });
      p.button('Desafios', () => showScreen('challenges'), 262, 454, 500, 80);
      p.button('Menu principal', () => goMenu(), 262, 554, 500, 80);
    }
  });
  updateHint();
}

// ---------- Entrada ----------
const canBrew = () => app === 'play' && phase === 'brew' && !panel.visible;
const canAct = () => canBrew() && !dev.autoplay;
function pourVial(i) {
  if (!canAct() || !vialVisible(i) || pot.includes(i)) return false;
  if (pot.length >= 3) { msg = { text: 'O caldeirão já tem 3 frascos. Mexa ou esvazie.', t: 2.5 }; sfx.deny(); returnVial(i); return false; }
  pot.push(i);
  const g = vials[i];
  if (held?.kind === 'vial' && held.i === i) held = null;
  moveTo(g, CAUL.clone().setY(RIM_Y + 0.12), 0.35, 0.12, () => {
    g.visible = false; sfx.pour();
    world.sparkle(CAUL.clone().setY(LIQ_Y + 0.04), EL[g.userData.e].color, 14, 0.6, 0.8, 0.6);
    refreshPot();
  });
  sfx.pick();
  return true;
}
function returnVial(i) { const g = vials[i]; if (g) { g.visible = true; g.rotation.x = g.rotation.z = 0; moveTo(g, g.userData.home, 0.3, 0.05); } }
function emptyPot() {
  if (!canAct() || !pot.length) return;
  for (const i of pot) { const g = vials[i]; g.position.copy(CAUL).setY(RIM_Y + 0.05); returnVial(i); }
  pot = [];
  refreshPot();
  sfx.empty();
  world.myCaul.target.set(0x3a6a4a);
}
function openBook() { if (app !== 'play' || panel.visible) return; bookPage = 0; showScreen('book'); }
function pickables() {
  const out = [world.stirPlate, world.emptyPlate, world.spoonHit, world.bookPages];
  for (const g of vials) if (g && g.visible) out.push(g.userData.hit);
  return out;
}
function activate(ud) {
  if (!ud) return;
  if (ud.kind === 'vial') pourVial(ud.i);
  else if (ud.kind === 'stir' || ud.kind === 'spoon') startStir(true);
  else if (ud.kind === 'empty') emptyPot();
  else if (ud.kind === 'book') openBook();
}
function rayPick(rc) { const h = rc.intersectObjects(pickables(), false)[0]; return h ? { ud: h.object.userData, dist: h.distance } : null; }
function touchAt(p) {
  let best = null, bd = GRAB_DIST;
  for (const o of pickables()) { o.getWorldPosition(_v); const d = _v.distanceTo(p); if (d < bd) { bd = d; best = o.userData; } }
  // a colher também se pega pelo cabo
  world.spoon.localToWorld(_v.set(0, 0.42, 0));
  if (_v.distanceTo(p) < Math.min(bd, 0.1)) best = world.spoonHit.userData;
  return best;
}
function tryGrab(e) {
  const p = shell.grabPoint(e);
  const ud = touchAt(p);
  if (!ud) return false;
  if (ud.kind === 'vial') {
    if (!canAct()) return true;
    held = { entry: e, kind: 'vial', i: ud.i };
    sfx.pick(); shell.pulse(e, 0.3, 20);
    return true;
  }
  if (ud.kind === 'spoon') {
    if (!canAct()) return true;
    held = { entry: e, kind: 'spoon', acc: 0, lastA: null };
    sfx.pick(); shell.pulse(e, 0.3, 20);
    return true;
  }
  activate(ud); shell.pulse(e, 0.3, 20);
  return true;
}
function overMouth(p) { return Math.hypot(p.x - CAUL.x, p.z - CAUL.z) < CAUL_R + 0.06 && p.y > RIM_Y - 0.06 && p.y < RIM_Y + 0.45; }
function releaseHeld() {
  if (!held) return;
  const h = held; held = null;
  if (h.kind === 'vial') {
    const g = vials[h.i];
    if (g && overMouth(g.position)) pourVial(h.i); else returnVial(h.i);
  } else if (h.kind === 'spoon') world.setSpoon(world.spoon, CAUL, Math.PI / 2 + 0.3);
}
function dropHeld() { if (held) { const h = held; held = null; if (h.kind === 'vial') returnVial(h.i); else world.setSpoon(world.spoon, CAUL, Math.PI / 2 + 0.3); } }
function updateHeld(dt) {
  if (!held) return;
  const p = shell.grabPoint(held.entry);
  if (held.kind === 'vial') {
    const g = vials[held.i];
    if (!g || !g.visible) { held = null; return; }
    g.position.copy(p).add(_v2.set(0, -0.07, 0));
    g.rotation.z = overMouth(g.position) ? 1.6 : 0;   // inclina em cima do caldeirão
    return;
  }
  // colher: o ângulo da mão em volta do centro do caldeirão
  const a = Math.atan2(p.z - CAUL.z, p.x - CAUL.x);
  world.setSpoon(world.spoon, CAUL, a, 0.09, p);
  if (held.lastA != null) { let d = a - held.lastA; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; held.acc += d; world.myCaul.swirl = Math.min(1.5, world.myCaul.swirl + Math.abs(d) * 0.6); }
  held.lastA = a;
  if (Math.abs(held.acc) >= Math.PI * 2 * STIR_TURNS && phase === 'brew') {
    held.acc = 0;
    if (pot.length >= 2) { startStir(false); stirT = 0.6; } else { msg = { text: 'Ponha 2 ou 3 frascos antes de mexer.', t: 2.5 }; sfx.deny(); }
  }
}
const hooks = {
  tick,
  pause: () => togglePause(),
  squeezeStart: (e) => { if (!e.isHand) tryGrab(e); },
  squeezeEnd: (e) => { if (held?.entry === e) releaseHeld(); },
  selectStart: (e) => {
    if (e.isHand && tryGrab(e)) return;
    const h = rayPick(shell.entryRay(e));
    if (h) activate(h.ud);
  },
  selectEnd: (e) => { if (e.isHand && held?.entry === e) releaseHeld(); },
  disconnected: (e) => { if (held?.entry === e) dropHeld(); },
  sessionStart: () => { rigPlaced = false; updateHint(); },
  sessionEnd: () => { dropHeld(); updateHint(); },
  pointerDown: () => { const h = rayPick(shell.mouseRay()); if (h) activate(h.ud); },
  key: (k) => {
    if (k >= '1' && k <= '5') { pourVial(+k - 1); return true; }
    if (k === 'enter' || k === ' ') { startStir(true); return true; }
    if (k === 'backspace' || k === 'delete' || k === 'z') { emptyPot(); return true; }
    if (k === 'l') { if (panel.visible && app === 'play') shell.hidePanel(); else openBook(); return true; }
    return false;
  },
};
Object.assign(shell.hooks, hooks);

// ---------- HUD ----------
function fxText(st, p) {
  const f = st.fx[p], out = [];
  for (const s of f.shields) out.push(`${s.name} (${s.turns})`);
  if (f.reflect) out.push(`Espelho (${f.reflect})`);
  if (f.poison) out.push(`Veneno ${f.poison.n}x${f.poison.turns}`);
  if (f.stunned) out.push('Atordoado');
  return out.join(' · ');
}
function updateHint() {
  let t;
  if (app !== 'play' || panel.visible) t = 'Clique nas opções do painel';
  else if (phase === 'brew') t = 'Clique em 2 ou 3 frascos (ou 1 a 5) e em Mexer! (Enter) · Esvaziar: Backspace · L: livro · botão direito: câmera · Esc: pausa';
  else t = 'Esc: pausa · L: livro · botão direito ou A/D/W/S: câmera';
  shell.setHint(t);
}
function potText() {
  const els = potElements();
  if (!els.length) return phase === 'brew' ? 'Caldeirão vazio' : '';
  const names = els.map(e => EL[e].name).join(' + ');
  if (els.length < 2) return `${names} + ...`;
  const r = recipeFor(els);
  return `${names} = ${r.goro ? 'gororoba?' : save.book[r.key] ? r.name : '???'}`;
}
let hudKey = '';
function updateHud() {
  const st = cur();
  const show = app !== 'menu' && st;
  world.hpLabels[0].mesh.visible = world.hpLabels[1].mesh.visible = !!show;
  world.potLabel.mesh.visible = !!show && phase === 'brew' && pot.length > 0;
  if (!show) { shell.setStatus(null); return; }
  const key = JSON.stringify([st.hp, st.fx, pot, phase, oppName()]);
  if (key !== hudKey) {
    hudKey = key;
    const hpColor = (h, m) => (h <= m * 0.3 ? '#ff7a6a' : h <= m * 0.6 ? '#ffd24a' : '#9aff8a');
    world.hpLabels[0].set([{ text: 'Você', size: 0.26, color: '#e8d8f0' }, { text: `${st.hp[0]} de ${st.maxHp[0]}`, size: 0.4, color: hpColor(st.hp[0], st.maxHp[0]) }, { text: fxText(st, 0) || ' ', size: 0.24, bold: false }]);
    world.hpLabels[1].set([{ text: oppName(), size: 0.26, color: '#e8d8f0' }, { text: `${st.hp[1]} de ${st.maxHp[1]}`, size: 0.4, color: hpColor(st.hp[1], st.maxHp[1]) }, { text: fxText(st, 1) || ' ', size: 0.24, bold: false }]);
    world.potLabel.set([{ text: potText(), size: 0.5, color: '#ffe8b0' }]);
  }
  const head = mode === 'match' ? `Duelo contra ${oppName()}` : `Desafio ${ch.i + 1}: ${CHALLENGES[ch.i].name} · feitiços ${st.casts[0]} de ${CHALLENGES[ch.i].limit}`;
  shell.setStatus({ a: `${head} · você ${st.hp[0]} x ${st.hp[1]} ${oppName()}`, b: phase === 'think' ? `${oppName()} está preparando...` : (phase === 'brew' ? potText() : ''), msg: msg?.text });
}
function updateEffects(dt) {
  const st = cur();
  for (const p of [0, 1]) {
    const f = st && app !== 'menu' ? st.fx[p] : null;
    const sh = world.shields[p];
    sh.visible = !!f && f.shields.length > 0;
    if (sh.visible) { sh.material.color.set(EL[f.shields[0].blocks[0]].color); sh.material.opacity = 0.14 + Math.sin(time * 3) * 0.04; }
    world.mirrors[p].visible = !!f && f.reflect > 0;
    world.poisonFx[p].visible = !!f && !!f.poison;
  }
  world.stunStars.visible = !!st && app !== 'menu' && st.fx[1].stunned;
  world.stunStars.position.copy(OPP_HEAD).add(_v.set(0, 0.32, 0));
  // vidros brilham quando dá para pegar
  for (const g of vials) if (g) g.userData.hl.visible = canAct() && !pot.includes(vials.indexOf(g));
  world.stirPlate.material.emissiveIntensity = canAct() && pot.length >= 2 ? 0.1 + Math.sin(time * 5) * 0.07 : 0;
}

// ---------- Laço ----------
function tick(dt) {
  const paused = app === 'paused';
  if (!paused) {
    time += dt;
    for (let i = 0; i < timers.length; i++) if (timers[i].at <= time) { const t = timers.splice(i, 1)[0]; i--; t.fn(); }
    updateMovers();
  }
  if (app === 'play' && cur() && !paused) {
    if (phase === 'stir') {
      stirT += dt;
      if (stirAuto || !held) world.setSpoon(world.spoon, CAUL, Math.PI / 2 + 0.3 + stirT * 9);
      if (stirT >= 0.9) { world.setSpoon(world.spoon, CAUL, Math.PI / 2 + 0.3); doCast(); }
    } else if (phase === 'brew' && dev.autoplay) robotTurn(dt);
    else if (phase === 'over' && dev.autoplay && mode === 'match') { timerAuto -= dt; if (timerAuto <= 0) newMatch(oppIndex); }
  }
  if (world.opp.pose === 'stir' || app === 'menu') world.setSpoon(world.oppSpoon, OPP_CAUL, -Math.PI / 2 + time * 7, 0.09);
  else world.setSpoon(world.oppSpoon, OPP_CAUL, -Math.PI / 2 - 0.4);
  updateHeld(dt);
  updateEffects(dt);
  if (shell.vr && canAct()) for (const e of shell.ctrls) { if (!e.source || held?.entry === e) continue; const h = rayPick(shell.entryRay(e)); if (h) e.laserLen = h.dist; }
  shell.showPinch = app === 'play';
  const look = phase === 'think' ? OPP_CAUL.clone().setY(0.8) : camera.getWorldPosition(_v);
  world.updateOpponent(dt, time, look.clone());
  world.animate(dt, time);
  world.updateFloaters(dt, camera.getWorldPosition(_v2));
  if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
  if (flashT > 0) {
    flashT = Math.max(0, flashT - dt);
    const a = flashT / 0.6 * 0.45;
    flashVR.visible = shell.vr && a > 0; flashVR.material.opacity = a;
    if (flashEl) { flashEl.style.opacity = shell.vr ? 0 : a; flashEl.style.background = `radial-gradient(ellipse at center, transparent 40%, ${flashColor} 140%)`; }
  }
  updateHud();
  if (lastDiscovered && bookKey !== known()) { bookKey = known(); world.drawBook(known(), RECIPES.length, lastDiscovered); }
}
let bookKey = -1;
world.drawBook(known(), RECIPES.length, null);

let robotT = 0;
function robotTurn(dt) {
  robotT += dt;
  if (robotT < ROBOT.think) return;
  robotT = 0;
  const st = cur();
  let m;
  if (mode === 'challenge') {
    if (!ch.plan) ch.plan = solvePlanFrom(st);
    m = ch.plan.shift();
  } else m = chooseMove(st, PLAYER, ROBOT, random).move;
  if (!m) return;
  pot = m.idx.slice();
  for (const i of pot) if (vials[i]) vials[i].visible = false;
  refreshPot();
  phase = 'brew';
  startStir(true);
}
// o robô dos desafios segue a melhor sequência da busca completa
function solvePlanFrom(st) { void st; return solveChallenge(CHALLENGES[ch.i]).moves.slice(); }

// ---------- Depuração (console do navegador) ----------
// dev.autoplay = true   o robô joga por você      dev.advance(5)   avança 5 s na hora
// dev.state()           resumo                     dev.cheat()      a prateleira do adversário
// dev.loadLevel(3)      abre o desafio 3 (1 a 10)  dev.startMatch(2) duelo contra o 2 (1 a 3)
// dev.win()             ganha o duelo/desafio      dev.screenOf({ slot: 0 } | 'stir' | 'empty' | 'book') posição na tela
// dev.resetSave()       apaga o progresso (e o livro)
const dev = {
  _auto: false,
  get autoplay() { return this._auto; },
  set autoplay(v) { this._auto = !!v; dropHeld(); },
  loadLevel(n) { newChallenge(n - 1, true); return this.state(); },
  startMatch(n = 1) { newMatch(n - 1); return this.state(); },
  advance(sec, stepT = 1 / 60) {
    const frames = Math.round(sec / stepT);
    for (let i = 0; i < frames; i++) shell.step(stepT);
    shell.resetClock(); shell.render();
    return this.state();
  },
  cheat() { const st = cur(); return st ? { prateleiraDele: st.shelf[CPU].slice() } : null; },
  win() {
    if (mode === 'challenge' && ch) {
      const c = CHALLENGES[ch.i];
      const best = solveChallenge(c);
      let st = setupChallenge(c);
      for (const m of best.moves) { if (isDone(c, st)) break; st = applyMove(st, m).st; while (!st.over && st.turn === CPU && !isDone(c, st)) st = applyScripted(st, dummyRecipe(c, st)).st; }
      duel = st; timers.length = 0; phase = 'anim'; endDuel();
    } else if (mode === 'match' && duel) {
      timers.length = 0;
      duel = { ...duel, hp: [duel.hp[0], 0], over: true, winner: PLAYER };
      phase = 'anim'; endDuel();
    }
    return this.state();
  },
  screenOf(what) {
    const o = what === 'stir' ? world.stirPlate : what === 'empty' ? world.emptyPlate : what === 'book' ? world.bookPages : what === 'spoon' ? world.spoonHit : vials[what.slot].userData.hit;
    const p = o.getWorldPosition(new THREE.Vector3()).project(camera);
    return { x: (p.x + 1) / 2 * window.innerWidth, y: (1 - p.y) / 2 * window.innerHeight };
  },
  state() {
    const base = { tela: app, modo: mode, fase: phase, painel: panel.visible };
    const st = cur();
    if (!st) return base;
    return {
      ...base,
      adversario: oppName(),
      desafio: mode === 'challenge' ? `${ch.i + 1}: ${CHALLENGES[ch.i].name}` : null,
      vez: st.turn === PLAYER ? 'você' : 'computador',
      vida: st.hp.slice(), prateleira: st.shelf[PLAYER].slice(), caldeirao: potElements(), feiticos: st.casts.slice(),
      efeitos: [fxText(st, 0), fxText(st, 1)], segurando: held ? held.kind : null, giro: held?.kind === 'spoon' ? +(held.acc / (Math.PI * 2)).toFixed(2) : null,
      frascosNaCena: vials.filter(g => g && g.visible).length,
      livro: known(),
      estrelas: mode === 'challenge' && chResult ? chResult.stars : null,
      vencedor: mode === 'match' && st.over && phase === 'over' ? (st.winner === PLAYER ? 'você' : st.winner === CPU ? oppName() : 'empate') : null,
      salvo: { vitorias: save.wins, desafios: save.ch },
    };
  },
  resetSave() { save.wins = [0, 0, 0]; save.games = [0, 0, 0]; save.ch = {}; save.book = {}; storeSave(save); },
};
window.dev = dev;
window.caldeirao = { dev, get duel() { return duel; }, get challenge() { return ch; }, save, camera, scene, renderer, world, shell };

goMenu();
shell.start();
