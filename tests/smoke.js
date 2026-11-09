// Fumaça do main.js: carrega o jogo inteiro no Node com um navegador de mentira (sem WebGL, sem som)
// e confere que menu, duelo (com o robô), clique do PC, controle e mãos do VR e desafios funcionam.
import * as nodeModule from 'node:module';

// ---- navegador de mentira ----
function fakeCtx() {
  const fn = () => proxy;
  const proxy = new Proxy(fn, {
    get(_, k) {
      if (k === 'measureText') return (t) => ({ width: String(t).length * 12 });
      if (k === 'canvas') return null;
      return fn;
    },
    set() { return true; },
    apply() { return proxy; },
  });
  return proxy;
}
function fakeElement(tag = 'div') {
  const listeners = {};
  return {
    tagName: tag.toUpperCase(), style: {}, dataset: {}, children: [], textContent: '', innerHTML: '', width: 300, height: 150,
    listeners,
    addEventListener(t, f) { (listeners[t] ||= []).push(f); },
    removeEventListener() {},
    appendChild(c) { this.children.push(c); return c; },
    getContext() { return fakeCtx(); },
    setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; },
    dispatch(t, e) { for (const f of listeners[t] || []) f(e); },
  };
}
function installDom() {
  const els = {};
  const winListeners = {};
  const store = new Map();
  const doc = {
    createElement: (t) => fakeElement(t),
    createElementNS: (_, t) => fakeElement(t),
    getElementById: (id) => (els[id] ||= fakeElement('div')),
    body: fakeElement('body'),
    addEventListener() {},
  };
  const win = {
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, isSecureContext: false,
    addEventListener(t, f) { (winListeners[t] ||= []).push(f); },
    removeEventListener() {},
    dispatch(t, e) { for (const f of winListeners[t] || []) f(e); },
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  };
  globalThis.window = win;
  globalThis.document = doc;
  globalThis.self = win;
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node-teste' }, configurable: true, writable: true });
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  globalThis.requestAnimationFrame = win.requestAnimationFrame;
  return { els, win, store };
}

// Troca só o WebGLRenderer do Three.js por um de mentira (o resto do Three.js é o de verdade).
function installThreeStub() {
  const stub = new URL('./three-stub.js', import.meta.url).href;
  const resolve = (spec, ctx, next) => {
    if (spec.endsWith('vendor/three/three.module.js') && !String(ctx.parentURL || '').endsWith('three-stub.js')) return { url: stub, shortCircuit: true };
    return next(spec, ctx);
  };
  if (nodeModule.registerHooks) nodeModule.registerHooks({ resolve });
  else throw new Error('Node sem module.registerHooks (precisa do Node 22.15 ou mais novo)');
}

export async function smoke() {
  const out = [];
  const ok = (c, m) => out.push([!!c, m]);
  const { els, win, store } = installDom();
  installThreeStub();
  const errors = [];
  const origErr = console.error;
  console.error = (...a) => errors.push(a.join(' '));
  await import('../js/main.js');
  const dev = window.dev;
  const G = window.caldeirao;
  const THREE = await import('../vendor/three/three.module.js');
  ok(dev && typeof dev.advance === 'function', 'main.js carregou e criou window.dev');
  let s = dev.advance(0.5);
  ok(s.tela === 'menu' && s.painel, 'abre no menu principal');
  ok(els.vr.textContent.includes('VR'), `botão de VR avisa que não tem VR aqui ("${els.vr.textContent}")`);
  const canvasEl = G.renderer.domElement;
  const click = (what) => { const p = dev.screenOf(what); canvasEl.dispatch('pointermove', { clientX: p.x, clientY: p.y }); dev.advance(0.02); canvasEl.dispatch('pointerdown', { clientX: p.x, clientY: p.y, button: 0 }); win.dispatch('pointerup', {}); return dev.advance(0.02); };
  const key = (k) => { win.dispatch('keydown', { key: k }); win.dispatch('keyup', { key: k }); return dev.advance(0.02); };
  const waitFor = (f, max = 160) => { for (let i = 0; i < max && !f(dev.state()); i++) dev.advance(0.25); return dev.advance(0.05); };

  s = dev.startMatch(1);
  ok(s.tela === 'play' && s.adversario === 'Brasa' && s.prateleira.length === 5 && s.vida.join() === '20,20', 'duelo contra o Brasa: 20 de vida e 5 frascos');
  s = waitFor(x => x.fase === 'brew');
  ok(s.fase === 'brew' && s.frascosNaCena === 5, `chega a sua vez com 5 frascos na prateleira (${s.frascosNaCena})`);
  // PC: clicar em dois frascos e em Mexer
  const shelf0 = s.prateleira.slice();
  s = click({ slot: 0 }); s = dev.advance(0.5);
  ok(s.caldeirao.length === 1 && s.caldeirao[0] === shelf0[0] && s.frascosNaCena === 4, 'clicar no frasco 1 despeja no caldeirão');
  s = click({ slot: 1 }); s = dev.advance(0.5);
  ok(s.caldeirao.length === 2, 'clicar no frasco 2 também');
  s = key('Backspace'); s = dev.advance(0.4);
  ok(s.caldeirao.length === 0 && s.frascosNaCena === 5, 'Backspace esvazia e os frascos voltam');
  s = key('1'); s = key('3'); s = dev.advance(0.5);
  ok(s.caldeirao.length === 2, 'teclas 1 e 3 despejam');
  const casts0 = G.duel.casts[0];
  s = click('stir');
  ok(s.fase === 'stir', 'clicar em Mexer! mexe o caldeirão');
  s = dev.advance(1.2);
  const myLast = () => G.duel.log.filter(l => l.type === 'cast' && l.by === 0).pop();
  ok(G.duel.casts[0] === casts0 + 1 && myLast(), `lançou o feitiço (${myLast()?.name})`);
  ok(myLast().goro || s.livro >= 1, 'receita lançada entra no livro (gororoba não)');
  s = waitFor(x => x.fase === 'brew' || x.fase === 'over');
  ok(G.duel.casts[1] >= 1 || G.duel.over, 'o Brasa respondeu com um feitiço');

  // VR com controle de mentira: aperto pega o frasco, solta em cima do caldeirão, colher em círculo lança
  s = waitFor(x => x.fase === 'brew');
  const entry = G.shell.ctrls[1];
  entry.source = { handedness: 'right', gamepad: { buttons: [], axes: [0, 0, 0, 0] } };
  entry.side = 'right';
  const rigInv = new THREE.Matrix4().copy(G.shell.rig.matrixWorld).invert();
  const setGrab = (p) => { entry.grip.position.copy(p.clone().add(new THREE.Vector3(0, 0.02, 0.04)).applyMatrix4(rigInv)); entry.ctrl.position.copy(entry.grip.position); G.shell.rig.updateMatrixWorld(true); };
  const vialPos = (i) => G.scene.children.find(o => o.userData?.hit?.userData?.kind === 'vial' && o.userData.hit.userData.i === i && o.visible).userData.hit.getWorldPosition(new THREE.Vector3());
  const mouth = new THREE.Vector3(0, 0.95, -0.45);
  if (s.fase === 'brew') {
    for (const i of [0, 1]) {
      setGrab(vialPos(i));
      G.shell.hooks.squeezeStart(entry);
      s = dev.advance(0.05);
      ok(s.segurando === 'vial', `VR: aperto pega o frasco ${i + 1}`);
      setGrab(mouth);
      s = dev.advance(0.05);
      G.shell.hooks.squeezeEnd(entry);
      s = dev.advance(0.5);
    }
    ok(s.caldeirao.length === 2, 'VR: soltar em cima do caldeirão despeja (2 frascos)');
    const sp = G.world.spoon.localToWorld(new THREE.Vector3(0, 0.42, 0));
    setGrab(sp);
    G.shell.hooks.squeezeStart(entry);
    s = dev.advance(0.05);
    ok(s.segurando === 'spoon', 'VR: aperto no cabo pega a colher');
    const c0 = G.duel.casts[0];
    for (let k = 0; k <= 48; k++) { const a = k / 48 * Math.PI * 2 * 1.6; setGrab(new THREE.Vector3(Math.cos(a) * 0.15, 1.0, -0.45 + Math.sin(a) * 0.15)); dev.advance(1 / 60); }
    G.shell.hooks.squeezeEnd(entry);
    s = dev.advance(1.0);
    ok(G.duel.casts[0] === c0 + 1, 'VR: mexer em círculo com a colher lança o feitiço');
  } else ok(false, 'não chegou a sua vez para o teste do controle');
  entry.source = null; entry.side = null;

  // Só com as mãos: pinça perto pega o frasco; pinça apontando de longe despeja
  s = waitFor(x => x.fase === 'brew');
  if (s.fase === 'brew') {
    const hand = G.shell.ctrls[0];
    hand.source = { handedness: 'left', hand: {} };
    hand.side = 'left';
    const setHand = (p) => { hand.grip.position.copy(p.clone().applyMatrix4(rigInv)); G.shell.rig.updateMatrixWorld(true); };
    setHand(vialPos(2));
    G.shell.hooks.selectStart(hand);
    s = dev.advance(0.05);
    ok(s.segurando === 'vial', 'mãos: pinça perto do frasco pega');
    setHand(mouth); dev.advance(0.05);
    G.shell.hooks.selectEnd(hand);
    s = dev.advance(0.5);
    ok(s.caldeirao.length === 1, 'mãos: soltar a pinça em cima do caldeirão despeja');
    const target = vialPos(3);
    const from = new THREE.Vector3(0, 1.4, 0.4);
    setHand(from);
    hand.ctrl.position.copy(from.clone().applyMatrix4(rigInv));
    hand.ctrl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), target.clone().sub(from).normalize());
    G.shell.rig.updateMatrixWorld(true);
    G.shell.hooks.selectStart(hand); G.shell.hooks.selectEnd(hand);
    s = dev.advance(0.5);
    ok(s.caldeirao.length === 2, 'mãos: pinça apontando de longe despeja o frasco');
    hand.source = null; hand.side = null;
    s = key('Enter'); s = dev.advance(1.5);
  } else ok(false, 'não chegou a sua vez para o teste das mãos');

  dev.startMatch(1);
  s = waitFor(x => x.fase === 'brew');
  key('l');
  ok(dev.state().painel, 'L abre o livro de receitas');
  key('l');
  ok(!dev.state().painel, 'L de novo fecha');

  // o resto do duelo o robô joga
  dev.autoplay = true;
  let guard = 0;
  while (!dev.state().vencedor && guard++ < 3000) s = dev.advance(0.25);
  s = dev.state();
  ok(s.vencedor, `duelo terminou sozinho (vida ${s.vida?.join(' x ')}, vencedor: ${s.vencedor})`);
  const saved = () => JSON.parse(store.get('caldeiraovr.v1') || '{}');
  ok(saved().games?.[0] === 1, 'resultado salvo no localStorage');
  ok(Object.keys(saved().book || {}).length >= 2, `receitas descobertas salvas no livro (${Object.keys(saved().book || {}).length})`);

  const C = await import('../js/challenges.js');
  const stars = [];
  for (let n = 1; n <= C.CHALLENGES.length; n++) {
    dev.loadLevel(n);
    let g = 0;
    while (dev.state().estrelas == null && g++ < 800) dev.advance(0.25);
    stars.push(dev.state().estrelas);
  }
  ok(stars.every(x => x === 3), `robô tira 3 estrelas nos ${C.CHALLENGES.length} desafios dentro do jogo (${stars.join(' ')})`);
  ok(Object.keys(saved().ch || {}).length === C.CHALLENGES.length, 'estrelas dos desafios salvas');

  dev.autoplay = false;
  dev.loadLevel(10);
  s = dev.win();
  ok(s.estrelas === 3, 'dev.win() resolve o desafio');
  dev.startMatch(3);
  s = dev.win();
  ok(s.vencedor === 'você', 'dev.win() ganha o duelo');
  ok(dev.cheat() && dev.cheat().prateleiraDele.length === 5, 'dev.cheat() mostra a prateleira do adversário');

  dev.startMatch(2);
  dev.advance(0.2);
  win.dispatch('keydown', { key: 'Escape' });
  ok(dev.state().tela === 'paused', 'Esc pausa');
  win.dispatch('keydown', { key: 'Escape' });
  ok(dev.state().tela === 'play', 'Esc de novo continua');
  dev.resetSave();
  ok(saved().wins.join() === '0,0,0', 'dev.resetSave() apaga o progresso');
  const loop = G.renderer._loop;
  for (let i = 0; i < 5; i++) loop?.(performance.now() + i * 16);
  ok(typeof loop === 'function', 'laço de animação ligado');
  console.error = origErr;
  ok(errors.length === 0, `sem erros no console (${errors.slice(0, 2).join(' | ')})`);
  return out;
}
