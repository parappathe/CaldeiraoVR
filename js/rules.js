// Regras do Caldeirão: elementos, receitas, efeitos e o duelo por turnos. Sem navegador.
//
// Cada bruxo tem 20 de vida e uma prateleira com 5 frascos (só ele vê os dele). Na sua vez despeja
// 2 ou 3 frascos no caldeirão e mexe: a combinação vira um feitiço (ou gororoba). Depois a
// prateleira se completa com frascos novos. Efeitos que duram (escudo, espelho, veneno) contam nas
// viradas de turno de quem está com eles.

export const PLAYER = 0, CPU = 1;
export const MAX_HP = 20, SHELF = 5, MAX_TURNS = 60;

export const ELEMENTS = ['fogo', 'agua', 'vento', 'terra', 'gelo', 'luz', 'sombra', 'veneno'];
export const EL = {
  fogo: { name: 'Fogo', color: 0xff6a1a, css: '#ff6a1a' },
  agua: { name: 'Água', color: 0x2a8aff, css: '#2a8aff' },
  vento: { name: 'Vento', color: 0xbfeee0, css: '#7fd8c0' },
  terra: { name: 'Terra', color: 0x9a6a3a, css: '#9a6a3a' },
  gelo: { name: 'Gelo', color: 0x9ae4ff, css: '#5ac8f0' },
  luz: { name: 'Luz', color: 0xffe25a, css: '#e8b818' },
  sombra: { name: 'Sombra', color: 0x8a4aff, css: '#7a3ae8' },
  veneno: { name: 'Veneno', color: 0x6ad82a, css: '#4ab81a' },
};

export const keyOf = (els) => els.slice().sort((a, b) => ELEMENTS.indexOf(a) - ELEMENTS.indexOf(b)).join('+');

// Receitas. efeito: { dmg, el, poison: [n, turnos], stun, heal, cleanse, shield: { blocks, turns },
// reflect: turnos, dispel }. "el" é o elemento do ataque (escudos bloqueiam pelo elemento).
const R = (els, name, desc, fx) => ({ key: keyOf(els), els, name, desc, ...fx });
export const RECIPES = [
  R(['fogo', 'vento'], 'Labareda', '4 de dano de fogo', { dmg: 4, el: 'fogo' }),
  R(['fogo', 'fogo'], 'Bola de Fogo', '5 de dano de fogo', { dmg: 5, el: 'fogo' }),
  R(['fogo', 'terra'], 'Pedra em Brasa', '4 de dano de terra', { dmg: 4, el: 'terra' }),
  R(['fogo', 'luz'], 'Raio de Sol', '3 de dano de luz', { dmg: 3, el: 'luz' }),
  R(['fogo', 'veneno'], 'Fumaça Tóxica', 'veneno: 3 por turno, 2 turnos', { poison: [3, 2], el: 'veneno' }),
  R(['agua', 'vento'], 'Tromba d\'Água', '4 de dano de água', { dmg: 4, el: 'agua' }),
  R(['gelo', 'vento'], 'Nevasca', '4 de dano de gelo', { dmg: 4, el: 'gelo' }),
  R(['terra', 'veneno'], 'Espinhos', '2 de dano de terra e veneno 1 por 3 turnos', { dmg: 2, poison: [1, 3], el: 'terra' }),
  R(['agua', 'veneno'], 'Poção Venenosa', 'veneno: 2 por turno, 3 turnos', { poison: [2, 3], el: 'veneno' }),
  R(['sombra', 'veneno'], 'Maldição', 'veneno: 2 por turno, 4 turnos (sombra)', { poison: [2, 4], el: 'sombra' }),
  R(['vento', 'sombra'], 'Sopro Sombrio', 'atordoa: o outro perde a vez', { stun: true, el: 'sombra' }),
  R(['gelo', 'gelo'], 'Prisão de Gelo', 'atordoa: o outro perde a vez', { stun: true, el: 'gelo' }),
  R(['agua', 'gelo'], 'Escudo de Gelo', 'bloqueia fogo por 3 turnos', { shield: { blocks: ['fogo'], turns: 3 } }),
  R(['terra', 'terra'], 'Muralha', 'bloqueia terra, gelo e vento por 2 turnos', { shield: { blocks: ['terra', 'gelo', 'vento'], turns: 2 } }),
  R(['agua', 'agua'], 'Bolha d\'Água', 'bloqueia veneno e sombra por 3 turnos', { shield: { blocks: ['veneno', 'sombra'], turns: 3 } }),
  R(['gelo', 'luz'], 'Prisma', 'bloqueia luz, gelo e água por 3 turnos', { shield: { blocks: ['luz', 'gelo', 'agua'], turns: 3 } }),
  R(['luz', 'sombra'], 'Espelho', 'devolve o próximo ataque (2 turnos)', { reflect: 2 }),
  R(['agua', 'luz'], 'Cura', 'cura 5', { heal: 5 }),
  R(['luz', 'luz'], 'Purificar', 'tira o veneno e cura 3', { heal: 3, cleanse: true }),
  R(['sombra', 'sombra'], 'Eclipse', 'quebra escudos e espelho do outro e 2 de dano', { dispel: true, dmg: 2, el: 'sombra', pierce: true }),
  R(['agua', 'terra'], 'Lamaçal', '3 de dano de água', { dmg: 3, el: 'agua' }),
  // três ingredientes: mais fortes
  R(['fogo', 'vento', 'terra'], 'Vulcão', '7 de dano de fogo', { dmg: 7, el: 'fogo' }),
  R(['fogo', 'fogo', 'fogo'], 'Inferno', '9 de dano de fogo', { dmg: 9, el: 'fogo' }),
  R(['agua', 'vento', 'gelo'], 'Tempestade de Gelo', '4 de dano de gelo e atordoa', { dmg: 4, stun: true, el: 'gelo' }),
  R(['agua', 'terra', 'luz'], 'Fonte da Vida', 'cura 8 e tira o veneno', { heal: 8, cleanse: true }),
  R(['vento', 'sombra', 'veneno'], 'Névoa Pestilenta', 'veneno: 3 por turno, 3 turnos', { poison: [3, 3], el: 'veneno' }),
  R(['terra', 'terra', 'gelo'], 'Fortaleza', 'bloqueia fogo, água, vento, terra e gelo por 2 turnos', { shield: { blocks: ['fogo', 'agua', 'vento', 'terra', 'gelo'], turns: 2 } }),
  R(['fogo', 'luz', 'luz'], 'Sol Nascente', '5 de dano de luz e cura 2', { dmg: 5, el: 'luz', heal: 2 }),
  R(['sombra', 'sombra', 'sombra'], 'Noite Eterna', 'quebra escudos e espelho e atordoa', { dispel: true, stun: true, el: 'sombra', pierce: true }),
  R(['luz', 'sombra', 'gelo'], 'Espelho de Gelo', 'devolve o próximo ataque (3 turnos) e bloqueia fogo', { reflect: 3, shield: { blocks: ['fogo'], turns: 3 } }),
];
export const BY_KEY = Object.fromEntries(RECIPES.map(r => [r.key, r]));
export const BY_NAME = Object.fromEntries(RECIPES.map(r => [r.name, r]));

const GORO_TEXTS = [
  'Gororoba! Sai um sapo do caldeirão e morde o outro (1 de dano).',
  'Gororoba! Uma nuvem de chulé atinge o outro (1 de dano).',
  'Gororoba! O caldeirão arrota e cospe uma meia velha (1 de dano).',
  'Gororoba! Chove macarrão no outro (1 de dano).',
  'Gororoba! Bolhas cor-de-rosa fazem cócegas no outro (1 de dano).',
];
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// Combinação inválida: gororoba, efeito fraco e engraçado (1 de dano que não se bloqueia).
export function gororoba(els) {
  const k = keyOf(els);
  return { key: k, els: els.slice(), name: 'Gororoba', desc: GORO_TEXTS[hashStr(k) % GORO_TEXTS.length], dmg: 1, el: null, pierce: true, goro: true };
}
export function recipeFor(els) { return (els.length >= 2 && els.length <= 3 && BY_KEY[keyOf(els)]) || gororoba(els); }
export const isOffensive = (r) => !!(r.dmg || r.poison || r.stun || r.dispel);

// gerador determinístico (mesma semente, mesma sequência)
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// frasco novo: vem da fila do desafio, se houver; senão, de um sorteio que depende só da semente
// e de quantos frascos aquele bruxo já tirou (o estado continua puro e copiável).
function draw(st, p) {
  const q = st.queue?.[p];
  const n = st.drawn[p]++;
  if (q && n < q.length) return q[n];
  const h = hashStr(`${st.seed}:${p}:${n}`);
  return ELEMENTS[h % ELEMENTS.length];
}

const newFx = () => ({ shields: [], reflect: 0, poison: null, stunned: false });
export function newDuel({ seed = 1, starter = PLAYER, hp = [MAX_HP, MAX_HP], maxHp = [MAX_HP, MAX_HP], queue = null, shelves = null } = {}) {
  const st = { seed, hp: hp.slice(), maxHp: maxHp.slice(), shelf: [[], []], fx: [newFx(), newFx()], drawn: [0, 0], queue, turn: starter, starter, turnNo: 0, casts: [0, 0], over: false, winner: null, log: [] };
  for (const p of [PLAYER, CPU]) {
    if (shelves?.[p]) st.shelf[p] = shelves[p].slice();
    while (st.shelf[p].length < SHELF) st.shelf[p].push(draw(st, p));
  }
  return st;
}
export function cloneDuel(st) {
  return {
    ...st, hp: st.hp.slice(), maxHp: st.maxHp.slice(), shelf: st.shelf.map(s => s.slice()), drawn: st.drawn.slice(), casts: st.casts.slice(),
    fx: st.fx.map(f => ({ shields: f.shields.map(s => ({ ...s })), reflect: f.reflect, poison: f.poison ? { ...f.poison } : null, stunned: f.stunned })),
    log: st.log.slice(),
  };
}

// Lances: escolher 2 ou 3 frascos da própria prateleira (índices).
export function legalMoves(st) {
  if (st.over) return [];
  const n = st.shelf[st.turn].length, out = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    out.push({ type: 'cast', idx: [a, b] });
    for (let c = b + 1; c < n; c++) out.push({ type: 'cast', idx: [a, b, c] });
  }
  return out;
}
export function isLegal(st, m) {
  if (st.over || !m || m.type !== 'cast' || !Array.isArray(m.idx)) return false;
  if (m.idx.length < 2 || m.idx.length > 3) return false;
  const n = st.shelf[st.turn].length;
  return new Set(m.idx).size === m.idx.length && m.idx.every(i => Number.isInteger(i) && i >= 0 && i < n);
}
export const moveElements = (st, m, p = st.turn) => m.idx.map(i => st.shelf[p][i]);

// Aplica o efeito de um feitiço de quem lança (p) no outro. Só usa informação pública (vida e
// efeitos), por isso a IA pode usar para prever. Muda o estado e devolve o que aconteceu.
export function castEffect(st, p, r) {
  const o = 1 - p;
  const ev = { by: p, name: r.name, key: r.key, els: r.els, goro: !!r.goro, blocked: false, reflected: false, dmg: 0, heal: 0, target: o, el: r.el ?? null };
  if (r.heal) { const before = st.hp[p]; st.hp[p] = Math.min(st.maxHp[p], st.hp[p] + r.heal); ev.heal = st.hp[p] - before; }
  if (r.cleanse) st.fx[p].poison = null;
  if (r.shield) { st.fx[p].shields = st.fx[p].shields.filter(s => s.name !== r.name); st.fx[p].shields.push({ name: r.name, blocks: r.shield.blocks.slice(), turns: r.shield.turns }); }
  if (r.reflect) st.fx[p].reflect = Math.max(st.fx[p].reflect, r.reflect);
  if (isOffensive(r)) {
    let tgt = o;
    if (r.dispel) { st.fx[o].shields = []; st.fx[o].reflect = 0; ev.dispel = true; }
    if (!r.pierce && st.fx[o].reflect > 0) { st.fx[o].reflect = 0; tgt = p; ev.reflected = true; }
    ev.target = tgt;
    const sh = r.pierce || !r.el ? null : st.fx[tgt].shields.find(s => s.blocks.includes(r.el));
    if (sh) { ev.blocked = true; ev.blockedBy = sh.name; }
    else {
      if (r.dmg) { st.hp[tgt] = Math.max(0, st.hp[tgt] - r.dmg); ev.dmg = r.dmg; }
      if (r.poison) { const cur = st.fx[tgt].poison; if (!cur || cur.n * cur.turns <= r.poison[0] * r.poison[1]) st.fx[tgt].poison = { n: r.poison[0], turns: r.poison[1] }; ev.poison = r.poison.slice(); }
      if (r.stun) { st.fx[tgt].stunned = true; ev.stun = true; }
    }
  }
  return ev;
}

function checkOver(st) {
  if (st.over) return true;
  if (st.hp[0] <= 0 || st.hp[1] <= 0) {
    st.over = true;
    st.winner = st.hp[0] <= 0 && st.hp[1] <= 0 ? null : st.hp[0] <= 0 ? CPU : PLAYER;
  } else if (st.turnNo >= MAX_TURNS) {
    st.over = true;
    st.winner = st.hp[0] === st.hp[1] ? null : st.hp[0] > st.hp[1] ? PLAYER : CPU;
  }
  return st.over;
}

// Começo da vez de p: o veneno pesa, os efeitos dele perdem um turno, a prateleira se completa.
// Atordoado: perde a vez (devolve true) e a vez volta para o outro.
function beginTurn(st, p, events) {
  const f = st.fx[p];
  if (f.poison) {
    st.hp[p] = Math.max(0, st.hp[p] - f.poison.n);
    events.push({ type: 'poison', who: p, n: f.poison.n });
    if (--f.poison.turns <= 0) f.poison = null;
  }
  for (const s of f.shields) s.turns--;
  f.shields = f.shields.filter(s => s.turns > 0);
  if (f.reflect > 0) f.reflect--;
  while (st.shelf[p].length < SHELF) st.shelf[p].push(draw(st, p));
  if (checkOver(st)) return false;
  if (f.stunned) { f.stunned = false; events.push({ type: 'stunned', who: p }); st.log.push({ type: 'stunned', who: p, turnNo: st.turnNo }); return true; }
  return false;
}

// Lança: tira os frascos da prateleira, aplica o feitiço e passa a vez.
export function applyMove(st0, m) {
  if (!isLegal(st0, m)) throw new Error('lance inválido');
  const st = cloneDuel(st0);
  const p = st.turn;
  const els = moveElements(st, m, p);
  const r = recipeFor(els);
  const sorted = m.idx.slice().sort((a, b) => b - a);
  for (const i of sorted) st.shelf[p].splice(i, 1);
  const ev = castEffect(st, p, r);
  st.casts[p]++;
  st.turnNo++;
  st.log.push({ type: 'cast', turnNo: st.turnNo, ...ev });
  const events = [];
  if (!checkOver(st)) {
    let next = 1 - p;
    st.turn = next;
    // atordoado perde a vez; o veneno de quem volta também conta
    while (!st.over && beginTurn(st, next, events)) { st.turnNo++; next = 1 - next; st.turn = next; if (checkOver(st)) break; }
  }
  return { st, result: { recipe: r, ev, events } };
}

// Para os desafios e testes: lança uma receita direto (sem prateleira), como o espantalho.
export function applyScripted(st0, recipe) {
  const st = cloneDuel(st0);
  const p = st.turn;
  const ev = recipe ? castEffect(st, p, recipe) : { by: p, name: 'Nada', els: [], dmg: 0, heal: 0, blocked: false, target: 1 - p };
  st.casts[p]++;
  st.turnNo++;
  st.log.push({ type: 'cast', turnNo: st.turnNo, ...ev, scripted: true });
  const events = [];
  if (!checkOver(st)) {
    let next = 1 - p;
    st.turn = next;
    while (!st.over && beginTurn(st, next, events)) { st.turnNo++; next = 1 - next; st.turn = next; if (checkOver(st)) break; }
  }
  return { st, result: { recipe, ev, events } };
}

// O que um bruxo pode saber: tudo menos a prateleira do outro e os sorteios futuros.
export function publicView(st, p) {
  const v = cloneDuel(st);
  v.shelf[1 - p] = v.shelf[1 - p].map(() => null);
  v.seed = null; v.queue = null;
  return v;
}
// elementos que o outro já usou (público: os feitiços aparecem)
export function usedElements(st, who) {
  const c = {};
  for (const l of st.log) if (l.type === 'cast' && l.by === who && l.el) c[l.el] = (c[l.el] || 0) + 1;
  return c;
}
