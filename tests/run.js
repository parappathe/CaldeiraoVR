// Testes automáticos: node tests/run.js (ou npm test). Não tocam som e saem com código 1 se algo falhar.
import { PLAYER, CPU, MAX_HP, SHELF, ELEMENTS, RECIPES, BY_NAME, recipeFor, keyOf, newDuel, legalMoves, isLegal, applyMove, applyScripted, castEffect, cloneDuel, publicView, rng } from '../js/rules.js';
import { OPPONENTS, ROBOT, chooseMove, playDuel } from '../js/ai.js';
import { CHALLENGES, setupChallenge, solveChallenge, gradeMoves, naive, recipeNames, isDone } from '../js/challenges.js';

let fails = 0, count = 0;
function ok(cond, msg) { count++; if (!cond) { fails++; console.log('  FALHOU:', msg); } }
process.on('uncaughtException', (e) => { console.log('ERRO:', e); process.exit(1); });
process.on('unhandledRejection', (e) => { console.log('ERRO:', e); process.exit(1); });
setTimeout(() => { console.log('ERRO: os testes passaram de 200 s'); process.exit(1); }, 200000).unref();
const T0 = performance.now();

// estado de teste com prateleiras escolhidas
const duelWith = (mine, his, opts = {}) => newDuel({ seed: 1, starter: PLAYER, shelves: [mine, his], ...opts });
const idxOf = (st, els) => { const used = new Set(); return els.map(e => { const i = st.shelf[st.turn].findIndex((x, k) => x === e && !used.has(k)); used.add(i); return i; }); };
const cast = (st, els) => applyMove(st, { type: 'cast', idx: idxOf(st, els) });

console.log('Receitas e duelo');
{
  ok(RECIPES.length >= 12, `pelo menos 12 receitas (${RECIPES.length})`);
  ok(new Set(RECIPES.map(r => r.key)).size === RECIPES.length, 'cada combinação é de uma receita só');
  ok(recipeFor(['vento', 'fogo']).name === 'Labareda' && recipeFor(['fogo', 'vento']).name === 'Labareda', 'a ordem dos frascos não importa (fogo + vento = Labareda)');
  ok(recipeFor(['gelo', 'agua']).name === 'Escudo de Gelo' && recipeFor(['terra', 'terra']).name === 'Muralha' && recipeFor(['luz', 'agua']).name === 'Cura', 'água + gelo = escudo, terra + terra = muralha, luz + água = cura');
  const g = recipeFor(['fogo', 'agua']);
  ok(g.goro && g.dmg === 1 && /Gororoba/.test(g.desc), `combinação inválida vira gororoba (${g.desc})`);
  const kinds = { dmg: 0, shield: 0, heal: 0, stun: 0, poison: 0, reflect: 0 };
  for (const r of RECIPES) for (const k of Object.keys(kinds)) if (r[k]) kinds[k]++;
  ok(Object.values(kinds).every(n => n > 0), `tem dano, escudo, cura, atordoar, veneno e espelho (${JSON.stringify(kinds)})`);
  const st = newDuel({ seed: 7 });
  ok(st.hp.join() === `${MAX_HP},${MAX_HP}` && st.shelf[0].length === SHELF && st.shelf[1].length === SHELF, '20 de vida e 5 frascos para cada um');
  ok(legalMoves(st).length === 20 && legalMoves(st).every(m => m.idx.length === 2 || m.idx.length === 3), 'lances: 2 ou 3 frascos (10 + 10 escolhas)');
  ok(!isLegal(st, { type: 'cast', idx: [0] }) && !isLegal(st, { type: 'cast', idx: [0, 1, 2, 3] }) && !isLegal(st, { type: 'cast', idx: [1, 1] }), 'não dá para usar 1, 4 ou o mesmo frasco duas vezes');

  // dano e a prateleira que se completa
  let s = duelWith(['fogo', 'vento', 'agua', 'luz', 'terra'], ['gelo', 'gelo', 'agua', 'agua', 'luz']);
  let r = cast(s, ['fogo', 'vento']);
  ok(r.st.hp[CPU] === MAX_HP - 4 && r.result.recipe.name === 'Labareda', 'Labareda tira 4');
  ok(r.st.turn === CPU && r.st.shelf[PLAYER].length === 3, 'passa a vez; sua prateleira fica com 3 até a sua vez');
  r = cast(r.st, ['agua', 'gelo']);
  ok(r.st.fx[CPU].shields.some(x => x.name === 'Escudo de Gelo') && r.st.shelf[PLAYER].length === SHELF, 'escudo de gelo no outro; sua prateleira volta a ter 5');
  // escudo bloqueia o elemento
  s = duelWith(['fogo', 'vento', 'fogo', 'terra', 'luz'], ['gelo', 'agua', 'luz', 'luz', 'luz'], { starter: CPU });
  s = cast(s, ['agua', 'gelo']).st;
  r = cast(s, ['fogo', 'vento']);
  ok(r.result.ev.blocked && r.st.hp[CPU] === MAX_HP, 'escudo de gelo bloqueia a labareda (fogo)');
  r = cast(s, ['fogo', 'terra']);
  ok(!r.result.ev.blocked && r.st.hp[CPU] === MAX_HP - 4, 'mas não bloqueia Pedra em Brasa (terra)');
  // escudo acaba
  let t = s; for (let k = 0; k < 3; k++) { t = applyScripted(t, null).st; t = applyScripted(t, null).st; }
  ok(t.fx[CPU].shields.length === 0, 'o escudo de 3 turnos some depois de 3 vezes do dono');
  // espelho devolve
  s = duelWith(['fogo', 'fogo', 'agua', 'luz', 'terra'], ['luz', 'sombra', 'agua', 'agua', 'gelo'], { starter: CPU });
  s = cast(s, ['luz', 'sombra']).st;
  r = cast(s, ['fogo', 'fogo']);
  ok(r.result.ev.reflected && r.st.hp[PLAYER] === MAX_HP - 5 && r.st.hp[CPU] === MAX_HP && r.st.fx[CPU].reflect === 0, 'espelho devolve a Bola de Fogo para quem lançou e se gasta');
  // eclipse quebra escudo e espelho
  s = duelWith(['sombra', 'sombra', 'agua', 'luz', 'terra'], ['luz', 'sombra', 'agua', 'gelo', 'gelo'], { starter: CPU });
  s = cast(s, ['luz', 'sombra']).st;
  s = applyScripted(s, null).st;
  s = applyScripted(s, BY_NAME['Escudo de Gelo']).st;
  r = cast(s, ['sombra', 'sombra']);
  ok(r.st.fx[CPU].shields.length === 0 && r.st.fx[CPU].reflect === 0 && r.st.hp[CPU] === MAX_HP - 2, 'Eclipse quebra escudo e espelho e tira 2');
  // veneno por turnos
  s = duelWith(['agua', 'veneno', 'fogo', 'luz', 'terra'], ['fogo', 'agua', 'vento', 'terra', 'gelo']);
  s = cast(s, ['agua', 'veneno']).st;
  ok(s.hp[CPU] === MAX_HP - 2 && s.fx[CPU].poison && s.fx[CPU].poison.turns === 2, 'veneno pesa no começo da vez de quem está envenenado');
  s = applyScripted(s, null).st; s = applyScripted(s, null).st; s = applyScripted(s, null).st; s = applyScripted(s, null).st;
  ok(s.hp[CPU] === MAX_HP - 6 && !s.fx[CPU].poison, 'Poção Venenosa: 2 por turno, 3 turnos, depois acaba');
  // purificar tira o veneno
  s = duelWith(['agua', 'veneno', 'fogo', 'luz', 'terra'], ['luz', 'luz', 'vento', 'terra', 'gelo']);
  s = cast(s, ['agua', 'veneno']).st;
  r = cast(s, ['luz', 'luz']);
  ok(!r.st.fx[CPU].poison && r.st.hp[CPU] === MAX_HP - 2 + 2, 'Purificar tira o veneno e cura (até o máximo)');
  // atordoar: perde a vez
  s = duelWith(['gelo', 'gelo', 'fogo', 'vento', 'terra'], ['fogo', 'fogo', 'agua', 'agua', 'luz']);
  r = cast(s, ['gelo', 'gelo']);
  ok(r.st.turn === PLAYER && r.result.events.some(e => e.type === 'stunned' && e.who === CPU) && !r.st.fx[CPU].stunned, 'Prisão de Gelo: o outro perde a vez e você joga de novo');
  // bolha bloqueia atordoar de sombra
  s = duelWith(['vento', 'sombra', 'fogo', 'vento', 'terra'], ['agua', 'agua', 'fogo', 'luz', 'luz'], { starter: CPU });
  s = cast(s, ['agua', 'agua']).st;
  r = cast(s, ['vento', 'sombra']);
  ok(r.result.ev.blocked && r.st.turn === CPU, "Bolha d'Água bloqueia o Sopro Sombrio");
  // cura
  s = duelWith(['agua', 'luz', 'fogo', 'vento', 'terra'], ['fogo', 'fogo', 'agua', 'agua', 'luz'], { hp: [10, 20] });
  r = cast(s, ['agua', 'luz']);
  ok(r.st.hp[PLAYER] === 15, 'Cura dá 5');
  // fim do duelo
  s = duelWith(['fogo', 'fogo', 'fogo', 'vento', 'terra'], ['agua', 'agua', 'agua', 'agua', 'luz'], { hp: [20, 9] });
  r = cast(s, ['fogo', 'fogo', 'fogo']);
  ok(r.st.over && r.st.winner === PLAYER && r.st.hp[CPU] === 0, 'Inferno (9) derruba quem tem 9: fim do duelo');
  // a prateleira do outro é segredo
  const v = publicView(newDuel({ seed: 3 }), PLAYER);
  ok(v.shelf[CPU].every(x => x === null) && v.seed === null && v.shelf[PLAYER].every(x => ELEMENTS.includes(x)), 'visão pública: sem a prateleira do outro e sem a semente dos sorteios');
}

console.log('IA');
{
  const r = rng(5);
  for (const o of [...OPPONENTS, ROBOT]) {
    let worst = 0, legal = true;
    for (let g = 0; g < 6; g++) {
      const st = newDuel({ seed: 100 + g, starter: CPU });
      const t0 = performance.now();
      const c = chooseMove(st, CPU, o, r);
      worst = Math.max(worst, performance.now() - t0);
      if (!isLegal(st, c.move)) legal = false;
    }
    ok(legal, `${o.name}: lance válido`);
    ok(worst < 100, `${o.name}: decide em menos de 100 ms (pior ${worst.toFixed(1)} ms)`);
  }
  // não espia: com a mesma informação pública, a escolha não muda se a SUA prateleira (escondida dele) muda
  let same = true;
  for (let g = 0; g < 20; g++) for (const o of OPPONENTS) {
    const base = newDuel({ seed: 300 + g, starter: CPU });
    const a = cloneDuel(base), b = cloneDuel(base);
    b.shelf[PLAYER] = ['veneno', 'sombra', 'sombra', 'gelo', 'gelo'];
    b.seed = 999999; b.drawn = [7, 3];
    if (JSON.stringify(chooseMove(a, CPU, o, rng(1)).move) !== JSON.stringify(chooseMove(b, CPU, o, rng(1)).move)) same = false;
  }
  ok(same, 'a IA não espia: a escolha não depende da sua prateleira nem dos sorteios futuros');
  // estilos
  const stats = (o) => { const c = { fogo: 0, heal: 0, shield: 0, total: 0, blockedInto: 0, attacks: 0 }; const rr = rng(21);
    for (let g = 0; g < 60; g++) { let s = newDuel({ seed: 700 + g, starter: g % 2 }); let guard = 0;
      while (!s.over && guard++ < 200) { const who = s.turn; const p = who === CPU ? o : OPPONENTS[1]; const ch = chooseMove(s, who, p, rr); const res = applyMove(s, ch.move);
        if (who === CPU) { const rec = res.result.recipe; c.total++; if (!rec.goro && rec.els.includes('fogo')) c.fogo++; if (rec.heal) c.heal++; if (rec.shield) c.shield++; if (rec.dmg || rec.poison || rec.stun) { c.attacks++; if (res.result.ev.blocked || res.result.ev.reflected) c.blockedInto++; } }
        s = res.st; } }
    return { fogo: c.fogo / c.total, heal: c.heal / c.total, shield: c.shield / c.total, wasted: c.blockedInto / Math.max(1, c.attacks) }; };
  const [sB, sS, sC] = OPPONENTS.map(stats);
  const pc = (x) => `${(x * 100).toFixed(0)}%`;
  console.log(`  fogo: Brasa ${pc(sB.fogo)}, Sálvia ${pc(sS.fogo)}, Corvino ${pc(sC.fogo)}  ·  cura+escudo: ${pc(sB.heal + sB.shield)} / ${pc(sS.heal + sS.shield)} / ${pc(sC.heal + sC.shield)}  ·  ataque bloqueado ou devolvido: ${pc(sB.wasted)} / ${pc(sS.wasted)} / ${pc(sC.wasted)}`);
  ok(sB.fogo > sS.fogo * 1.2 && sB.fogo > sC.fogo * 1.2, 'Brasa usa bem mais feitiço de fogo que os outros');
  ok(sS.heal + sS.shield > sB.heal + sB.shield, 'Mãe Sálvia cura e se protege mais que o Brasa');
  ok(sC.wasted < sB.wasted, 'Corvino desperdiça menos ataque em escudo e espelho que o Brasa');
}

console.log('IA contra IA');
{
  const r = rng(11);
  const duel = (i, j, games) => {
    let wa = 0, wb = 0; const lines = [];
    for (let g = 0; g < games; g++) {
      const sw = g % 2 === 1;
      const st = newDuel({ seed: 9000 + g, starter: g % 4 < 2 ? PLAYER : CPU });
      const f = playDuel(st, sw ? OPPONENTS[j] : OPPONENTS[i], sw ? OPPONENTS[i] : OPPONENTS[j], r);
      ok(f.over, 'duelo IA x IA até o fim');
      const hpA = sw ? f.hp[1] : f.hp[0], hpB = sw ? f.hp[0] : f.hp[1];
      if (hpA > hpB) wa++; else if (hpB > hpA) wb++;
      if (g < 8) lines.push(`${hpA}x${hpB}`);
    }
    console.log(`  ${OPPONENTS[i].name} ${wa} x ${wb} ${OPPONENTS[j].name}  (vida no fim: ${lines.join(' ')} ...)`);
    return [wa, wb];
  };
  const [a, b] = duel(2, 0, 160), [c, d] = duel(2, 1, 160), [e, f] = duel(1, 0, 160);
  ok(a > b && c > d, 'Corvino (astuto) ganha mais do que perde dos outros dois');
  ok(e > f, 'Mãe Sálvia ganha mais do que perde do Brasa');
}

console.log('Desafios');
{
  for (const [i, c] of CHALLENGES.entries()) {
    ok(c.desc && c.stars.length === 3 && c.stars[0] < c.stars[1] && c.stars[1] < c.stars[2] && c.limit >= 1, `desafio ${i + 1}: texto e metas crescentes`);
    const t0 = performance.now();
    const best = solveChallenge(c);
    const again = gradeMoves(c, best.moves);
    console.log(`  ${i + 1}. ${c.name}: ${'★'.repeat(best.stars)}${'☆'.repeat(3 - best.stars)}  ${best.value}  ${recipeNames(c, best.moves).join(', ')}  (${(performance.now() - t0).toFixed(0)} ms)`);
    ok(best.stars === 3 && again.stars === 3, `robô tira 3 estrelas no desafio ${i + 1}`);
    ok(naive(c) < c.stars[2], `desafio ${i + 1}: usar sempre os dois primeiros frascos não dá 3 estrelas`);
    ok(!isDone(c, setupChallenge(c)) && setupChallenge(c).turn === PLAYER, `desafio ${i + 1}: começa na sua vez`);
  }
}

console.log('Fumaça do main.js');
{
  const { smoke } = await import('./smoke.js');
  try {
    const out = await smoke();
    for (const [cond, msg] of out) ok(cond, msg);
    console.log(`  ${out.filter(o => o[0]).length} de ${out.length} conferências do jogo carregado`);
  } catch (e) { ok(false, `main.js quebrou: ${e.stack || e}`); }
}

console.log(`\n${count - fails} de ${count} passaram (${((performance.now() - T0) / 1000).toFixed(1)} s)`);
if (fails) { console.log(`${fails} FALHARAM`); process.exit(1); }
console.log('Tudo certo');
process.exit(0);
