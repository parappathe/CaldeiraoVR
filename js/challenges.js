// Os 10 desafios: um duelo curto contra o Espantalho, que lança sempre a mesma sequência de
// feitiços (escrita no desafio). A sua prateleira vem numa ordem fixa (fila), para o desafio ser
// sempre igual. Medidas: rapidez, vida que sobra ou dano causado. Sem navegador.
import { PLAYER, CPU, BY_NAME, newDuel, applyMove, applyScripted, legalMoves, moveElements, keyOf, recipeFor } from './rules.js';

const Q = (s) => s.split(' ');
export const CHALLENGES = [
  {
    name: 'Primeira Poção', metric: 'rapido', limit: 4, hp: [20, 9], script: [null],
    desc: 'O Espantalho só fica parado. Derrube os 9 de vida dele o mais rápido que der.',
    queue: Q('fogo agua vento luz terra gelo fogo agua sombra vento luz terra fogo vento agua'), stars: [1, 2, 3],
  },
  {
    name: 'Escudo na Hora', metric: 'vida', limit: 6, hp: [14, 10], script: ['Labareda'],
    desc: 'Ele lança Labareda (4 de fogo) toda vez. Vença com o máximo de vida.',
    queue: Q('agua fogo gelo vento terra luz vento fogo agua gelo terra fogo vento sombra luz agua gelo fogo'), stars: [8, 14, 20],
  },
  {
    name: 'Gota de Cura', metric: 'vida', limit: 6, hp: [7, 12], script: ['Lamaçal'],
    desc: 'Você começa com 7 de vida e ele bate 3 de água por vez. Sobreviva e vença.',
    queue: Q('luz agua fogo vento terra gelo luz fogo vento agua terra fogo vento luz gelo agua'), stars: [7, 12, 17],
  },
  {
    name: 'Veneno Lento', metric: 'rapido', limit: 6, hp: [20, 14], script: ['Muralha'], starter: CPU,
    desc: 'Ele vive atrás da Muralha (bloqueia terra, gelo e vento). Ache o que passa.',
    queue: Q('veneno agua terra gelo vento fogo sombra veneno vento terra fogo gelo agua veneno fogo vento sombra'), stars: [2, 3, 4],
  },
  {
    name: 'Espelho, Espelho', metric: 'vida', limit: 6, hp: [16, 12], script: ['Bola de Fogo'],
    desc: 'Bola de Fogo (5) toda vez. Devolva o fogo para ele.',
    queue: Q('luz sombra fogo terra vento luz sombra agua fogo vento luz sombra terra fogo vento gelo'), stars: [6, 11, 16],
  },
  {
    name: 'Mão Pesada', metric: 'vida', limit: 6, hp: [14, 14], script: ['Vulcão'],
    desc: 'Ele lança Vulcão (7 de fogo) toda vez. Não deixe ele lançar.',
    queue: Q('gelo gelo vento sombra fogo vento terra gelo gelo fogo sombra vento terra fogo gelo agua'), stars: [3, 5, 7],
  },
  {
    name: 'Quebra-Escudo', metric: 'rapido', limit: 6, hp: [20, 12], script: ['Fortaleza', 'Bolha d\'Água'], starter: CPU,
    desc: 'Fortaleza e Bolha d\'Água, um depois do outro. Quebre os escudos dele.',
    queue: Q('sombra sombra fogo vento terra luz sombra sombra fogo vento terra fogo luz agua sombra veneno'), stars: [2, 3, 4],
  },
  {
    name: 'Receita Tripla', metric: 'dano', limit: 3, hp: [20, 60], script: [null],
    desc: 'Três feitiços só. Faça o maior estrago que puder.',
    queue: Q('fogo fogo vento terra fogo agua fogo luz vento fogo terra fogo luz luz fogo'), stars: [12, 18, 23],
  },
  {
    name: 'Sem Desperdício', metric: 'rapido', limit: 6, hp: [20, 14], script: ['Purificar'],
    desc: 'Ele se cura 3 toda vez. Bata mais forte do que ele cura.',
    queue: Q('fogo vento terra veneno agua fogo fogo luz vento terra fogo sombra veneno vento fogo terra'), stars: [1, 2, 3],
  },
  {
    name: 'Mestre do Caldeirão', metric: 'vida', limit: 6, hp: [20, 16], script: ['Labareda', 'Maldição', 'Espelho', 'Nevasca'],
    desc: 'Ele mistura de tudo: fogo, maldição, espelho e gelo. Vença com o máximo de vida.',
    queue: Q('agua gelo luz sombra fogo vento agua veneno luz fogo vento terra sombra fogo vento luz agua gelo'), stars: [8, 14, 20],
  },
];

export function setupChallenge(c) {
  const st = newDuel({ seed: 4242, starter: c.starter ?? PLAYER, hp: c.hp, maxHp: [Math.max(20, c.hp[0]), Math.max(20, c.hp[1])], queue: [c.queue, []] });
  return advanceDummy(c, st);
}
// O Espantalho joga sempre o próximo da lista (o atordoado perde a vez e não avança a lista).
export function dummyRecipe(c, st) { const n = c.script[st.casts[CPU] % c.script.length]; return n ? BY_NAME[n] : null; }
export function advanceDummy(c, st) {
  let g = 0;
  while (!st.over && st.turn === CPU && g++ < 20) st = applyScripted(st, dummyRecipe(c, st)).st;
  return st;
}
export const isDone = (c, st) => st.over || st.casts[PLAYER] >= c.limit;
// Joga um lance seu e a resposta do Espantalho.
export function stepChallenge(c, st, m) {
  let s = applyMove(st, m).st;
  if (!isDone(c, s)) s = advanceDummy(c, s);
  return s;
}

export function measure(c, st) {
  const won = st.over && st.winner === PLAYER;
  const dealt = c.hp[1] - st.hp[CPU];
  if (c.metric === 'rapido') return won ? c.limit - st.casts[PLAYER] + 1 : 0;
  if (c.metric === 'vida') return won ? st.hp[PLAYER] : 0;
  return st.hp[PLAYER] > 0 ? dealt : 0;
}
export const starsFor = (c, v) => c.stars.filter(t => v >= t).length;
export function metricName(c) { return { rapido: 'Feitiços de sobra', vida: 'Vida no fim', dano: 'Dano causado' }[c.metric]; }
export function goalText(c) {
  const [a, b, d] = c.stars;
  if (c.metric === 'rapido') return `Até ${c.limit} feitiços. Estrelas: vencer com ${a - 1}, ${b - 1} e ${d - 1} feitiço(s) de sobra.`;
  if (c.metric === 'vida') return `Vença em até ${c.limit} feitiços. Estrelas com ${a}, ${b} e ${d} de vida no fim.`;
  return `${c.limit} feitiços. Estrelas com ${a}, ${b} e ${d} de dano.`;
}

// Robô dos desafios: busca completa (todas as combinações da prateleira, sem repetir as iguais).
function stateKey(st) {
  return `${st.hp}|${st.casts}|${st.drawn}|${st.turn}|${keyOf(st.shelf[0])}|${JSON.stringify(st.fx)}`;
}
function moves(st) {
  const seen = new Set(), out = [];
  for (const m of legalMoves(st)) {
    const els = moveElements(st, m, PLAYER);
    const left = st.shelf[PLAYER].filter((_, i) => !m.idx.includes(i));
    const k = `${keyOf(els)}|${keyOf(left)}`;
    if (!seen.has(k)) { seen.add(k); out.push(m); }
  }
  return out;
}
export function solveChallenge(c) {
  const memo = new Map();
  const rec = (st) => {
    if (isDone(c, st)) return { value: measure(c, st), moves: [] };
    const k = stateKey(st);
    if (memo.has(k)) return memo.get(k);
    let best = { value: -1, moves: [] };
    for (const m of moves(st)) {
      const r = rec(stepChallenge(c, st, m));
      if (r.value > best.value) best = { value: r.value, moves: [m, ...r.moves] };
    }
    memo.set(k, best);
    return best;
  };
  const best = rec(setupChallenge(c));
  return { ...best, stars: starsFor(c, best.value) };
}
// Confere uma lista de lances do começo.
export function gradeMoves(c, list) {
  let st = setupChallenge(c);
  for (const m of list) { if (isDone(c, st)) break; st = stepChallenge(c, st, m); }
  const value = measure(c, st);
  return { value, stars: starsFor(c, value), st };
}
// Jogada "ingênua": sempre os dois primeiros frascos. Não pode dar 3 estrelas.
export function naive(c) {
  let st = setupChallenge(c);
  while (!isDone(c, st)) st = stepChallenge(c, st, { type: 'cast', idx: [0, 1] });
  return measure(c, st);
}
export function recipeNames(c, list) {
  let st = setupChallenge(c); const out = [];
  for (const m of list) { if (isDone(c, st)) break; out.push(recipeFor(moveElements(st, m, PLAYER)).name); st = stepChallenge(c, st, m); }
  return out;
}
