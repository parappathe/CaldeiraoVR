// Os bruxos do computador. Cada um escolhe os frascos da própria prateleira olhando só o que é
// público (vida, escudos, espelho, veneno e os feitiços já lançados): chooseMove recebe o estado
// inteiro mas trabalha numa cópia com a prateleira do outro apagada. Sem navegador.
import { PLAYER, CPU, MAX_HP, ELEMENTS, SHELF, rng, legalMoves, applyMove, moveElements, recipeFor, castEffect, cloneDuel, publicView, usedElements, isOffensive, keyOf } from './rules.js';

export const OPPONENTS = [
  {
    id: 'brasa', name: 'Brasa', title: 'o piromaníaco', desc: 'Só pensa em fogo e dano. Nem olha os seus escudos.',
    think: 1.3, noise: 1.6, robe: '#b8321a', hat: '#5a1a0a', skin: '#e8a27c', hair: '#ff8a1a', style: 'fire',
  },
  {
    id: 'salvia', name: 'Mãe Sálvia', title: 'a curandeira', desc: 'Cura, escudo e veneno: ganha no cansaço.',
    think: 1.6, noise: 4, robe: '#3a7a4a', hat: '#2a4a2a', skin: '#c88a64', hair: '#e8e4dc', style: 'herb',
  },
  {
    id: 'corvino', name: 'Corvino', title: 'o astuto', desc: 'Lê os seus escudos e espelhos e acha a brecha.',
    think: 1.8, noise: 0.15, robe: '#2a2a5a', hat: '#141430', skin: '#d8b090', hair: '#1a1a24', style: 'crow',
  },
];
// robô do modo automático (testes e dev.autoplay): o mesmo raciocínio do Corvino, sem sorte
export const ROBOT = { id: 'robo', name: 'Robô', think: 0.4, noise: 0, style: 'crow' };

const AVG_HIT = 4;
const CORVO_W = { dmg: 0.85, heal: 1.5, shield: 1.5, poison: 1.35 };
// quanto o outro costuma atacar com cada elemento (o que ele já lançou, misturado com um palpite igual)
function threat(view, me) {
  const used = usedElements(view, 1 - me);
  const tot = Object.values(used).reduce((a, b) => a + b, 0);
  const out = {};
  for (const e of ELEMENTS) out[e] = (1 + (used[e] || 0) * 3) / (ELEMENTS.length + tot * 3);
  return out;
}

// valor de um feitiço para quem lança, simulando o efeito no estado público
export function evaluate(view, me, r, w = {}) {
  const o = 1 - me;
  const sim = cloneDuel(view);
  const before = { my: sim.hp[me], op: sim.hp[o], myPoison: sim.fx[me].poison, opShields: sim.fx[o].shields.length, opRef: sim.fx[o].reflect, myRef: sim.fx[me].reflect };
  const myShieldsBefore = sim.fx[me].shields.map(s => ({ ...s }));
  const ev = castEffect(sim, me, r);
  const wDmg = w.dmg ?? 1, wHeal = w.heal ?? 1, wShield = w.shield ?? 1, wPoison = w.poison ?? 1;
  let s = 0;
  if (sim.hp[o] <= 0) return 1000 + sim.hp[me];
  if (sim.hp[me] <= 0) return -1000;
  s += (before.op - sim.hp[o]) * wDmg;
  s -= (before.my - sim.hp[me]) * 1.2;
  // cura vale mais com pouca vida
  const missing = (view.maxHp[me] - before.my) / view.maxHp[me];
  s += ev.heal * (0.45 + missing * 1.3) * wHeal;
  if (r.cleanse && before.myPoison) s += before.myPoison.n * before.myPoison.turns * wHeal;
  if (ev.poison && !ev.blocked) s += (ev.target === o ? 1 : -1.2) * ev.poison[0] * ev.poison[1] * 0.8 * wPoison;
  if (ev.stun && !ev.blocked) s += ev.target === o ? AVG_HIT + 0.5 : -(AVG_HIT + 1);
  if (r.shield) {
    const th = threat(view, me);
    const p = r.shield.blocks.reduce((a, e) => a + (th[e] || 0), 0);
    const old = myShieldsBefore.find(x => x.name === r.name);
    const gain = r.shield.turns - (old ? old.turns : 0);
    s += Math.max(0, gain) * AVG_HIT * p * 0.9 * wShield;
  }
  if (r.reflect && before.myRef < r.reflect) s += (before.myRef > 0 ? 1 : 3.2) * wShield;
  if (r.dispel) s += before.opShields * 1.8 + (before.opRef ? 3 : 0);
  return s;
}

// candidatos sem repetir: mesma receita e mesmos frascos sobrando são o mesmo lance
function candidates(view, me) {
  const seen = new Set(), out = [];
  for (const m of legalMoves(view)) {
    const els = moveElements(view, m, me);
    const left = view.shelf[me].filter((_, i) => !m.idx.includes(i));
    const k = `${keyOf(els)}|${keyOf(left)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ move: m, els, left, recipe: recipeFor(els) });
  }
  return out;
}

// valor do que sobra na prateleira (o Corvino guarda ingredientes bons para depois)
function leftoverValue(view, me, left) {
  let best = 0;
  for (let a = 0; a < left.length; a++) for (let b = a + 1; b < left.length; b++) {
    const r = recipeFor([left[a], left[b]]);
    if (!r.goro) best = Math.max(best, isOffensive(r) ? (r.dmg || 0) + (r.poison ? r.poison[0] * r.poison[1] * 0.6 : 0) + (r.stun ? 4 : 0) : 2.5);
  }
  return best;
}

// Brasa: dano "no papel", com gosto por fogo, sem olhar escudo nem espelho do outro
function brasaScore(view, me, c) {
  const r = c.recipe;
  if (view.hp[me] <= 5 && r.heal) return 20 + r.heal;
  let s = (r.dmg || 0) + (r.poison ? r.poison[0] * r.poison[1] * 0.5 : 0) + (r.stun ? 2 : 0);
  if (r.el === 'fogo') s += 5; else if (!r.goro && r.els.includes('fogo')) s += 3;
  if (r.goro) s -= 2;
  if (!isOffensive(r)) s = r.heal ? (view.hp[me] < 10 ? r.heal * 0.6 : 0.3) : 0.5;
  return s;
}

// Corvino: pensa também na resposta do outro. Como não vê a prateleira dele, imagina algumas
// prateleiras sorteadas (palpite, não espiada) e vê o melhor que ele faria depois do seu feitiço.
const SAMPLES = 6;
function guessShelves(view) {
  const r = rng(977 + view.turnNo * 31 + view.hp[0] * 7 + view.hp[1]);
  return Array.from({ length: SAMPLES }, () => Array.from({ length: SHELF }, () => ELEMENTS[Math.floor(r() * ELEMENTS.length)]));
}
function replyValue(view, me, r, guesses) {
  const o = 1 - me;
  const sim = cloneDuel(view);
  castEffect(sim, me, r);
  if (sim.hp[o] <= 0) return 0;
  if (sim.fx[o].stunned) return 0;
  sim.turn = o;
  let tot = 0;
  for (const shelf of guesses) {
    sim.shelf[o] = shelf;
    let best = -Infinity;
    for (const c of candidates(sim, o)) best = Math.max(best, evaluate(sim, o, c.recipe));
    tot += Math.min(best, 60);
  }
  return tot / guesses.length;
}

export function chooseMove(st, me, profile, random = Math.random) {
  const view = publicView(st, me);
  const cands = candidates(view, me);
  const guesses = profile.id === 'corvino' || profile.id === 'robo' ? guessShelves(view) : null;
  let best = null, bs = -Infinity;
  for (const c of cands) {
    let s;
    if (profile.id === 'brasa') s = brasaScore(view, me, c);
    else if (profile.id === 'salvia') s = evaluate(view, me, c.recipe, { dmg: 0.85, heal: 1.5, shield: 1.5, poison: 1.35 });
    else s = evaluate(view, me, c.recipe, profile.w ?? CORVO_W) + leftoverValue(view, me, c.left) * (profile.left ?? 0.4) - replyValue(view, me, c.recipe, guesses) * (profile.reply ?? 0.3);
    s += (random() - 0.5) * 2 * (profile.noise ?? 0);
    if (s > bs) { bs = s; best = c; }
  }
  return { move: best.move, recipe: best.recipe, score: bs };
}

// Duelo inteiro entre duas IAs (a = jogador 0, b = jogador 1). Devolve o estado final.
export function playDuel(st, a, b, random) {
  let s = st, guard = 0;
  while (!s.over && guard++ < 500) s = applyMove(s, chooseMove(s, s.turn, s.turn === PLAYER ? a : b, random).move).st;
  return s;
}
export { PLAYER, CPU, MAX_HP };
