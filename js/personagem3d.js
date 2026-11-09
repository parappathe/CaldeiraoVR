// personagem3d.js - personagem estilizado completo e animado para Three.js r170.
// Copiar para <Projeto>/js/ junto com visual3d.js. Frente do personagem = +z, pés em y = 0.
// Juntas em p.ossos: quadril, coluna, pescoco, cabeca, ombroE/D, cotoveloE/D, pulsoE/D,
// coxaE/D, joelhoE/D, tornozeloE/D, dedosE/D (lista de dedos, cada um lista de falanges),
// polegarE/D (base, ponta). E = esquerda do personagem, em +x.
import * as THREE from '../vendor/three/three.module.js';
import { caixaArredondada } from './visual3d.js';

const cache = new Map();
const memo = (k, f) => cache.get(k) ?? (cache.set(k, f()), cache.get(k));
const q = (n) => Math.round(n * 1000);
const lerp = THREE.MathUtils.lerp;
const EIXO_Z = new THREE.Vector3(0, 0, 1);

// Membro afunilado com pontas arredondadas: começa na junta (y = 0) e desce até y = -L.
function membroGeo(L, rTopo, rBase, seg = 14) {
  return memo(`m${q(L)}_${q(rTopo)}_${q(rBase)}_${seg}`, () => {
    const pts = [];
    for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * Math.PI / 2;
      pts.push(new THREE.Vector2(Math.max(0, rBase * Math.cos(a)), -L + rBase * Math.sin(a))); }
    for (let i = 1; i <= 6; i++) { const a = (i / 6) * Math.PI / 2;
      pts.push(new THREE.Vector2(Math.max(0, rTopo * Math.cos(a)), rTopo * Math.sin(a))); }
    pts[0].x = 0; pts[pts.length - 1].x = 0;
    return new THREE.LatheGeometry(pts, seg);
  });
}

// Tronco moldado: quadril, cintura, peito, ombros (perfil girado e achatado na frente/trás).
function troncoGeo(T, rQuadril, rCintura, rPeito, rOmbro, barriga, achatar) {
  return memo(`t${[T, rQuadril, rCintura, rPeito, rOmbro, barriga, achatar].map(q).join('_')}`, () => {
    const perfil = [[0, -0.06], [0.75, -0.04], [1, 0.08], [0.92 + barriga * 0.35, 0.3], [rCintura / rQuadril, 0.45],
      [rPeito / rQuadril, 0.7], [rOmbro / rQuadril, 0.86], [rOmbro / rQuadril * 0.8, 0.97], [0.35, 1.02], [0, 1.03]];
    const pts = perfil.map(([r, y]) => new THREE.Vector2(r * rQuadril, y * T));
    const curva = new THREE.SplineCurve(pts);
    const lisos = curva.getPoints(40); for (const v of lisos) v.x = Math.max(0, v.x); lisos[0].x = 0; lisos[lisos.length - 1].x = 0;
    return new THREE.LatheGeometry(lisos, 28).scale(1, 1, achatar);
  });
}

const EXPRESSOES = {
  //          sobrancelha: inclinação, altura | pálpebra (0 aberta .. 1 fechada) | boca: arco, largura, abertura
  neutro:   { inc: 0.0,  alt: 0.0,  pal: 0.18, arco: 0.6, larg: 1.0, abre: 0.0 },
  feliz:    { inc: -0.15, alt: 0.15, pal: 0.12, arco: 1.6, larg: 1.25, abre: 0.0 },
  bravo:    { inc: 0.45, alt: -0.25, pal: 0.38, arco: -0.9, larg: 0.9, abre: 0.0 },
  triste:   { inc: -0.45, alt: 0.1, pal: 0.32, arco: -1.3, larg: 0.85, abre: 0.0 },
  surpreso: { inc: -0.05, alt: 0.55, pal: 0.0,  arco: 0.0, larg: 0.6, abre: 1.0 },
};


// Poses de mão: dobra das falanges [base, meio, ponta] (0 = reta, ~1.5 = fechada), abertura dos
// dedos em leque, polegar [abre para a frente, dobra, cruza sobre a palma]. porDedo troca dedos
// específicos (0 = indicador ... último = mínimo).
const POSES_MAO = {
  relaxada: { dobra: [0.28, 0.38, 0.25], extra: 0.12, leque: 0.04, pol: [0.35, 0.25, 0.15] },
  aberta:   { dobra: [0.02, 0.04, 0.02], extra: 0.0, leque: 0.16, pol: [0.85, 0.0, 0.0] },
  punho:    { dobra: [1.45, 1.6, 1.1], extra: 0.0, leque: 0.0, pol: [0.55, 0.75, 0.9] },
  segurar:  { dobra: [0.95, 1.05, 0.7], extra: 0.05, leque: 0.0, pol: [0.6, 0.5, 0.45] },
  apontar:  { dobra: [1.45, 1.6, 1.1], extra: 0.0, leque: 0.0, pol: [0.55, 0.75, 0.9], porDedo: { 0: [0.03, 0.04, 0.02] } },
};

export function criarPersonagem(o = {}) {
  const altura = o.altura ?? 1.2, cabecas = o.cabecas ?? 3, porte = o.porte ?? 1.0;
  const cor = { pele: '#e0a27c', camisa: '#2f6fb0', calca: '#38404f', sapato: '#6b3a24', cabelo: '#3a2414',
    detalhe: '#f2b632', iris: '#3d6e9e', boca: '#5a1e1e', ...o.cores };
  const k = THREE.MathUtils.clamp((cabecas - 2) / 5, 0, 1);         // 0 chibi .. 1 herói
  const extremidades = o.extremidades ?? lerp(1.35, 1.0, k);         // mãos e pés exagerados no cartoon

  // ---- medidas ----
  const H = altura, cab = H / cabecas, rc = cab * 0.5;
  const corpo = H - cab;
  const pernaT = corpo * lerp(0.44, 0.56, k), pescH = corpo * lerp(0.02, 0.04, k);
  const troncoT = corpo - pernaT - pescH;
  const peH = pernaT * 0.1, coxaL = (pernaT - peH) * 0.5, canelaL = coxaL;
  const largOmbro = rc * lerp(1.7, 2.3, k) * porte;
  const rMembro = rc * lerp(0.26, 0.3, k) * Math.sqrt(porte);
  const bracoL = troncoT * lerp(0.42, 0.44, k), anteL = bracoL * 0.92;
  const rQuadril = largOmbro * 0.42 * (o.quadril ?? 1);

  const mat = (c, r, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });
  const M = {
    pele: mat(cor.pele, 0.55), camisa: mat(cor.camisa, 0.85), calca: mat(cor.calca, 0.88),
    sapato: mat(cor.sapato, 0.55), sola: mat('#2a2522', 0.8), cabelo: mat(cor.cabelo, 0.72),
    detalhe: mat(cor.detalhe, 0.45, { metalness: o.detalheMetal ? 1 : 0 }),
    branco: new THREE.MeshBasicMaterial({ color: '#efeae0', toneMapped: false }), iris: mat(cor.iris, 0.3),
    pupila: new THREE.MeshBasicMaterial({ color: '#120c0a' }), brilho: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
    boca: new THREE.MeshBasicMaterial({ color: cor.boca }), bochecha: new THREE.MeshBasicMaterial({ color: '#ff7a7a', transparent: true, opacity: 0.22, depthWrite: false }),
  };
  const malha = (geo, m, pai, sombra = true) => { const x = new THREE.Mesh(geo, m); x.castShadow = sombra; x.receiveShadow = true; pai.add(x); return x; };
  const junta = (nome, pai, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.name = nome; g.position.set(x, y, z); pai.add(g); return g; };

  const grupo = new THREE.Group();
  const ossos = {};
  const yQuadril = peH + canelaL + coxaL;
  ossos.quadril = junta('quadril', grupo, 0, yQuadril);
  ossos.coluna = junta('coluna', ossos.quadril, 0, 0);
  const tronco = malha(troncoGeo(troncoT, rQuadril, rQuadril * lerp(0.95, 0.82, k), largOmbro * 0.47,
    largOmbro * 0.5, o.barriga ?? 0, 0.72), M.camisa, ossos.coluna);
  // cós da calça e cinto
  const cos = malha(new THREE.CylinderGeometry(rQuadril * 1.04, rQuadril * 1.06, troncoT * 0.2, 28, 1).scale(1, 1, 0.74), M.calca, ossos.coluna);
  cos.position.y = troncoT * 0.0;
  const cinto = malha(new THREE.TorusGeometry(rQuadril * 1.05, rc * 0.045, 8, 32).rotateX(Math.PI / 2).scale(1, 1, 0.74), M.detalhe, ossos.coluna);
  cinto.position.y = troncoT * 0.1;
  const fivela = malha(caixaArredondada(rc * 0.22, rc * 0.16, rc * 0.06, rc * 0.03, 2), M.detalhe, ossos.coluna);
  fivela.position.set(0, troncoT * 0.1, rQuadril * 0.78 + rc * 0.03);

  // pescoço, gola e cabeça
  ossos.pescoco = junta('pescoco', ossos.coluna, 0, troncoT * 0.98);
  malha(membroGeo(pescH + rc * 0.25, rMembro * 1.15, rMembro * 1.25), M.pele, ossos.pescoco).position.y = pescH + rc * 0.2;
  const gola = malha(new THREE.TorusGeometry(rMembro * 1.45, rc * 0.07, 8, 24).rotateX(Math.PI / 2), M.detalhe, ossos.pescoco);
  gola.position.y = rc * 0.02;
  ossos.cabeca = junta('cabeca', ossos.pescoco, 0, pescH);
  const cabeca = new THREE.Group(); cabeca.position.y = rc * 0.95; ossos.cabeca.add(cabeca);
  // cabeça numa malha só: crânio maior atrás, mandíbula mais estreita e queixo para a frente
  const geoCab = memo(`cab${q(rc)}_${q(k)}`, () => {
    const g = new THREE.SphereGeometry(rc, 48, 32), p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).divideScalar(rc);
      const baixo = Math.max(0, -v.y), frente = Math.max(0, v.z);
      v.x *= 1 - 0.16 * baixo * baixo;                                   // mandíbula estreita
      v.z += 0.1 * baixo * frente * (1 - Math.abs(v.x)) - 0.05 * Math.max(0, v.y) * frente; // queixo / testa
      v.y *= v.y > 0 ? 1.04 : lerp(0.95, 1.1, k);                      // rosto mais comprido no herói
      v.z *= v.z < 0 ? 1.04 : 0.97;                                      // crânio atrás
      p.setXYZ(i, v.x * rc, v.y * rc, v.z * rc);
    }
    g.computeVertexNormals();
    return g;
  });
  malha(geoCab, M.pele, cabeca);
  // ponto da superfície do rosto (x, y locais da cabeça) e a normal ali, para encaixar as peças
  const ray = new THREE.Raycaster(), soCab = new THREE.Mesh(geoCab);
  const sup = (x, y, recuo = 0) => {
    ray.set(new THREE.Vector3(x, y, rc * 3), new THREE.Vector3(0, 0, -1));
    const h = ray.intersectObject(soCab)[0];
    if (!h) return { p: new THREE.Vector3(x, y, rc * 0.5), n: new THREE.Vector3(0, 0, 1) };
    return { p: h.point.addScaledVector(h.face.normal, -recuo), n: h.face.normal.clone() };
  };
  const naSuperficie = (obj, x, y, recuo = 0) => { const s = sup(x, y, recuo);
    obj.position.copy(s.p); obj.quaternion.setFromUnitVectors(EIXO_Z, s.n); return s; };
  const nariz = malha(new THREE.SphereGeometry(rc * 0.12, 14, 10), M.pele, cabeca);
  naSuperficie(nariz, 0, -rc * 0.12, rc * 0.03); nariz.scale.set(1, 0.85, 0.9);
  for (const s of [1, -1]) {
    const orelha = malha(new THREE.SphereGeometry(rc * 0.2, 14, 10), M.pele, cabeca);
    orelha.position.set(s * rc * 0.97, -rc * 0.05, -rc * 0.05); orelha.scale.set(0.45, 1, 0.8);
    const boch = malha(new THREE.CircleGeometry(rc * 0.15, 16), M.bochecha, cabeca, false);
    naSuperficie(boch, s * rc * 0.5, -rc * 0.26, -rc * 0.004);
    boch.visible = o.bochechas ?? k < 0.5;
  }

  // olhos: branco, íris + pupila (giram), brilho fixo, pálpebra que pisca
  const re = rc * lerp(0.25, 0.15, k), olhos = [], palpebras = [], sobrancelhas = [];
  const yOlho = rc * lerp(-0.08, 0.05, k), xOlho = rc * lerp(0.36, 0.33, k);
  for (const s of [1, -1]) {
    const base = new THREE.Group(); naSuperficie(base, s * xOlho, yOlho, re * 0.5);
    base.rotateY(-s * 0.08); cabeca.add(base);
    malha(new THREE.SphereGeometry(re, 24, 16), M.branco, base, false);
    const globo = new THREE.Group(); base.add(globo);
    const cap = (r, th, m) => malha(new THREE.SphereGeometry(r, 24, 8, 0, Math.PI * 2, 0, th).rotateX(Math.PI / 2), m, globo, false);
    cap(re * 1.012, 0.62, M.iris); cap(re * 1.022, 0.3, M.pupila);
    const brilho = malha(new THREE.SphereGeometry(re * 0.17, 10, 8), M.brilho, base, false);
    brilho.position.set(s * re * 0.32, re * 0.4, re * 0.9);
    const pal = new THREE.Group(); base.add(pal);
    malha(new THREE.SphereGeometry(re * 1.08, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.pele, pal);
    olhos.push(globo); palpebras.push(pal);
    const sob = malha(caixaArredondada(re * 1.5, re * 0.32, re * 0.3, re * 0.12, 2), M.cabelo, cabeca);
    sob.userData.base = new THREE.Vector3(s * xOlho, yOlho + re * 1.45, 0);
    sob.userData.lado = s; sobrancelhas.push(sob);
  }
  const posSobre = (sob, dy) => naSuperficie(sob, sob.userData.base.x, sob.userData.base.y + dy, -re * 0.05);

  // boca: arco de toro (sorriso/triste) e oval (aberta)
  const boca = new THREE.Group(); naSuperficie(boca, 0, -rc * 0.42, -rc * 0.01); cabeca.add(boca);
  let arcoBoca = null;
  const bocaAberta = malha(new THREE.SphereGeometry(rc * 0.11, 16, 12), M.boca, boca, false);
  bocaAberta.scale.set(1, 1.3, 0.4);

  // cabelo
  const estilo = o.cabelo ?? 'curto';
  if (estilo !== 'careca') {
    const capa = malha(new THREE.SphereGeometry(rc * 1.06, 36, 18, 0, Math.PI * 2, 0, Math.PI * 0.42), M.cabelo, cabeca);
    capa.rotation.x = -0.45;
    const nuca = malha(new THREE.SphereGeometry(rc * 1.04, 30, 16, Math.PI * 0.2, Math.PI * 0.6, Math.PI * 0.2, Math.PI * 0.45), M.cabelo, cabeca);
    nuca.rotation.y = Math.PI;
    if (estilo === 'topete') for (let i = 0; i < 4; i++) {
      const t = malha(new THREE.SphereGeometry(rc * (0.36 - i * 0.04), 16, 12), M.cabelo, cabeca);
      t.position.set((i - 1.5) * rc * 0.2, rc * (0.85 - Math.abs(i - 1.5) * 0.06), rc * (0.42 - i * 0.03)); t.scale.set(1, 0.7, 1.2);
    }
    if (estilo === 'coque') malha(new THREE.SphereGeometry(rc * 0.38, 18, 14), M.cabelo, cabeca).position.set(0, rc * 0.85, -rc * 0.55);
    if (estilo === 'franja') for (let i = 0; i < 5; i++) {
      const f = malha(new THREE.SphereGeometry(rc * 0.24, 12, 10), M.cabelo, cabeca);
      const a = (i - 2) * 0.32; f.position.set(Math.sin(a) * rc * 0.82, rc * 0.52, Math.cos(a) * rc * 0.62); f.scale.set(1, 0.65, 0.8);
    }
  }
  if (o.chapeu) {
    const aba = malha(new THREE.CylinderGeometry(rc * 1.45, rc * 1.45, rc * 0.06, 32), M.detalhe, cabeca); aba.position.y = rc * 0.62;
    const copa = malha(new THREE.CylinderGeometry(rc * 0.8, rc * 0.95, rc * 0.6, 28), M.detalhe, cabeca); copa.position.y = rc * 0.9;
    aba.rotation.x = copa.rotation.x = -0.12;
  }


  // braços
  const mangaCurta = (o.mangas ?? 'curta') === 'curta';
  const rMao = Math.max(rMembro * 1.1, H * 0.028) * extremidades;
  // mãos: palma em caixa arredondada, base do polegar, dedos com falanges que dobram de verdade.
  // Braço caído: dedos para -y, palma virada para o corpo (-s em x), polegar na frente (+z).
  const nDedos = o.dedos ?? (k < 0.5 ? 3 : 4), nFal = k < 0.5 ? 2 : 3;
  const palmL = rMao * 1.55, palmW = rMao * (nDedos === 3 ? 1.6 : 1.75), palmT = rMao * lerp(0.9, 0.72, k);
  const vaoPulso = rMembro * 0.12, rDedo = palmW / nDedos * 0.47, dedoL = palmL * lerp(0.78, 0.98, k);
  const compDedo = nDedos === 3 ? [0.95, 1.0, 0.86] : [0.92, 1.0, 0.95, 0.78];
  const fracFal = nFal === 2 ? [0.56, 0.44] : [0.45, 0.31, 0.24];
  function construirMao(L, s, pulso) {
    const palma = malha(memo(`palma${q(palmT)}_${q(palmL)}_${q(palmW)}`, () =>
      caixaArredondada(palmT, palmL, palmW, palmT * 0.45, 3)), M.pele, pulso);
    palma.position.set(0, -vaoPulso - palmL / 2, 0);
    palma.rotation.x = 0.04;
    const tenar = malha(memo(`tenar${q(palmT)}`, () => new THREE.SphereGeometry(palmT * 0.5, 16, 12)), M.pele, pulso);
    tenar.position.set(-s * palmT * 0.18, -vaoPulso - palmL * 0.42, palmW * 0.3); tenar.scale.set(0.85, 1.35, 0.9);
    const dedos = [];
    for (let i = 0; i < nDedos; i++) {
      const z = lerp(palmW * 0.5 - rDedo, -palmW * 0.5 + rDedo, nDedos === 1 ? 0.5 : i / (nDedos - 1));
      let pai = junta(`dedo${L}${i}`, pulso, -s * palmT * 0.06, -vaoPulso - palmL * 0.93, z);
      const fal = [];
      fracFal.forEach((fr, j) => {
        if (j > 0) pai = junta(`dedo${L}${i}_${j}`, pai, 0, -fal.comp);
        const comp = dedoL * compDedo[i] * fr, r0 = rDedo * (1 - j * 0.07), r1 = rDedo * (1 - (j + 1) * 0.07);
        malha(membroGeo(comp, r0, r1, 10), M.pele, pai);
        fal.push(pai); fal.comp = comp;
      });
      dedos.push(fal);
    }
    const polBase = junta(`polegar${L}`, pulso, -s * palmT * 0.2, -vaoPulso - palmL * 0.3, palmW * 0.36);
    malha(membroGeo(dedoL * 0.42, rDedo * 1.18, rDedo * 1.08, 10), M.pele, polBase);
    const polPonta = junta(`polegar${L}_1`, polBase, 0, -dedoL * 0.42);
    malha(membroGeo(dedoL * 0.34, rDedo * 1.08, rDedo * 0.98, 10), M.pele, polPonta);
    ossos['dedos' + L] = dedos; ossos['polegar' + L] = [polBase, polPonta];
  }

  for (const [s, L] of [[1, 'E'], [-1, 'D']]) {
    const ombro = ossos['ombro' + L] = junta('ombro' + L, ossos.coluna, s * largOmbro * 0.43, troncoT * 0.84);
    malha(membroGeo(bracoL, rMembro * 1.12, rMembro * 0.95), mangaCurta ? M.pele : M.camisa, ombro);
    if (mangaCurta) malha(membroGeo(bracoL * 0.42, rMembro * 1.32, rMembro * 1.2), M.camisa, ombro);
    const cot = ossos['cotovelo' + L] = junta('cotovelo' + L, ombro, 0, -bracoL);
    malha(membroGeo(anteL, rMembro * 0.95, rMembro * 0.8), mangaCurta ? M.pele : M.camisa, cot);
    if (!mangaCurta) malha(new THREE.TorusGeometry(rMembro * 0.88, rMembro * 0.18, 6, 16).rotateX(Math.PI / 2), M.detalhe, cot).position.y = -anteL * 0.9;
    const pulso = ossos['pulso' + L] = junta('pulso' + L, cot, 0, -anteL);
    construirMao(L, s, pulso);
  }

  // pernas e sapatos
  const rCoxa = rMembro * 1.35 * Math.sqrt(porte), pe = { l: Math.max(rc * 0.85, H * 0.14) * extremidades, w: rCoxa * 1.45, h: peH * 1.6 };
  for (const [s, L] of [[1, 'E'], [-1, 'D']]) {
    const coxa = ossos['coxa' + L] = junta('coxa' + L, ossos.quadril, s * rQuadril * 0.52, 0);
    malha(membroGeo(coxaL, rCoxa, rCoxa * 0.82), M.calca, coxa);
    const joe = ossos['joelho' + L] = junta('joelho' + L, coxa, 0, -coxaL);
    malha(membroGeo(canelaL, rCoxa * 0.82, rCoxa * 0.66), o.bermuda ? M.pele : M.calca, joe);
    if (o.bermuda) malha(membroGeo(coxaL * 0.25, rCoxa * 1.05, rCoxa * 0.95), M.calca, joe).position.y = coxaL * 0.25;
    const tor = ossos['tornozelo' + L] = junta('tornozelo' + L, joe, 0, -canelaL);
    const sap = malha(caixaArredondada(pe.w, pe.h, pe.l, Math.min(pe.w, pe.h) * 0.45, 3), M.sapato, tor);
    sap.position.set(0, -peH + pe.h * 0.5, pe.l * 0.28);
    const sola = malha(caixaArredondada(pe.w * 1.04, pe.h * 0.28, pe.l * 1.03, pe.h * 0.12, 2), M.sola, tor);
    sola.position.set(0, -peH + pe.h * 0.12, pe.l * 0.28);
  }

  // ---- estado e animação ----
  const est = { t: Math.random() * 10, fase: 0, piscar: 0, proxPiscar: 1 + Math.random() * 3,
    maoAlvo: { E: POSES_MAO.relaxada, D: POSES_MAO.relaxada }, maoAtual: {}, alvo: null, yaw: 0, pitch: 0, olhoX: 0, olhoY: 0, expr: { ...EXPRESSOES.neutro }, exprAlvo: EXPRESSOES[o.expressao ?? 'neutro'] };
  const tmp = new THREE.Vector3(), tmpM = new THREE.Matrix4();

  function setArcoBoca(arco, larg) {
    const chave = `${Math.round(arco * 20)}_${Math.round(larg * 20)}`;
    if (arcoBoca?.userData.chave === chave) return;
    if (arcoBoca) { boca.remove(arcoBoca); arcoBoca.geometry.dispose(); }
    const curv = Math.max(0.15, Math.abs(arco)), raio = rc * 0.2 * larg / Math.sin(Math.min(curv, 2.6) / 2) * 0.5;
    const g = new THREE.TorusGeometry(raio, rc * 0.035, 6, 20, Math.min(curv, 2.6));
    g.rotateZ(-Math.PI / 2 - Math.min(curv, 2.6) / 2);
    g.translate(0, raio, 0);
    if (arco < 0) g.rotateZ(Math.PI);
    arcoBoca = new THREE.Mesh(g, M.boca); arcoBoca.userData.chave = chave; boca.add(arcoBoca);
  }

  function aplicarRosto(e, piscar) {
    for (const sob of sobrancelhas) { posSobre(sob, e.alt * re); sob.rotateZ(sob.userData.lado * e.inc); }
    const fech = Math.max(e.pal, piscar);
    for (const pal of palpebras) pal.rotation.x = lerp(-1.25, Math.PI / 2, fech);
    setArcoBoca(e.arco, e.larg);
    arcoBoca.visible = e.abre < 0.5; bocaAberta.visible = e.abre >= 0.5;
  }


  function aplicarMaos(dt) {
    const a = 1 - Math.exp(-dt * 14);
    for (const [s, L] of [[1, 'E'], [-1, 'D']]) {
      const pose = est.maoAlvo[L], dedos = ossos['dedos' + L];
      const cur = est.maoAtual[L] ??= { d: dedos.map(() => [0, 0, 0]), leque: 0, pol: [0, 0, 0] };
      dedos.forEach((fal, i) => {
        const alvo = pose.porDedo?.[i] ?? pose.dobra.map(v => v + pose.extra * i / Math.max(1, dedos.length - 1));
        const meio = (dedos.length - 1) / 2;
        fal.forEach((jt, j) => {
          cur.d[i][j] = dt === 0 ? alvo[j] : lerp(cur.d[i][j], alvo[j], a);
          jt.rotation.z = -s * cur.d[i][j];
        });
        cur.leque = dt === 0 ? pose.leque : lerp(cur.leque, pose.leque, a);
        fal[0].rotation.x = (i - meio) * cur.leque;
      });
      for (let j = 0; j < 3; j++) cur.pol[j] = dt === 0 ? pose.pol[j] : lerp(cur.pol[j], pose.pol[j], a);
      const [pb, pp] = ossos['polegar' + L];
      pb.rotation.set(-(0.35 + cur.pol[0] * 0.8), 0, -s * (0.35 + cur.pol[2] * 0.55));
      pp.rotation.set(-cur.pol[1] * 0.3, 0, -s * cur.pol[1] * 0.9);
    }
  }

  function atualizar(dt, { velocidade = 0 } = {}) {
    est.t += dt; const t = est.t;
    // expressão (transição suave)
    for (const kx in est.expr) est.expr[kx] = lerp(est.expr[kx], est.exprAlvo[kx], 1 - Math.exp(-dt * 10));
    // piscar
    est.proxPiscar -= dt;
    if (est.proxPiscar <= 0) { est.piscar = 0.16; est.proxPiscar = Math.random() < 0.15 ? 0.25 : 2 + Math.random() * 4; }
    est.piscar = Math.max(0, est.piscar - dt);
    const p = est.piscar > 0 ? Math.sin((est.piscar / 0.16) * Math.PI) : 0;
    aplicarRosto(est.expr, p);

    // andar x parado
    const anda = THREE.MathUtils.clamp(velocidade / (pernaT * 2.5), 0, 1.5);
    est.fase += dt * (velocidade / Math.max(0.05, pernaT)) * 1.6;
    const f = est.fase, A = Math.min(anda, 1);
    const resp = Math.sin(t * 1.7);
    tronco.scale.set(1 + resp * 0.012, 1 + resp * 0.008, 1 + resp * 0.018);
    ossos.quadril.position.y = yQuadril - A * Math.abs(Math.cos(f)) * pernaT * 0.04 + (1 - A) * resp * pernaT * 0.004;
    ossos.quadril.rotation.z = (1 - A) * Math.sin(t * 0.6) * 0.035 + A * Math.sin(f) * 0.05;
    ossos.coluna.rotation.z = -(1 - A) * Math.sin(t * 0.6) * 0.03 - A * Math.sin(f) * 0.04;
    ossos.coluna.rotation.x = A * 0.08;
    ossos.coluna.rotation.y = A * Math.sin(f) * 0.12;
    for (const [s, L, df] of [[1, 'E', 0], [-1, 'D', Math.PI]]) {
      const g = f + df;
      ossos['coxa' + L].rotation.x = -Math.sin(g) * 0.55 * A;
      ossos['coxa' + L].rotation.z = s * 0.02;
      ossos['joelho' + L].rotation.x = A * Math.max(0, Math.sin(g - 1.2)) * 0.9 + 0.03;
      ossos['tornozelo' + L].rotation.x = -ossos['coxa' + L].rotation.x * 0.3 - ossos['joelho' + L].rotation.x * 0.5;
      ossos['ombro' + L].rotation.x = Math.sin(g) * 0.5 * A + (1 - A) * Math.sin(t * 0.6 + df) * 0.03;
      ossos['ombro' + L].rotation.z = s * (0.14 + (1 - A) * resp * 0.012);
      ossos['cotovelo' + L].rotation.x = -(0.25 + A * (0.3 + Math.max(0, -Math.sin(g)) * 0.4));
      ossos['pulso' + L].rotation.z = -s * 0.1;
    }
    // olhar: cabeça com limite e atraso, olhos mais rápidos
    let yaw = Math.sin(t * 0.35) * 0.15, pitch = 0;
    if (est.alvo) {
      ossos.pescoco.updateWorldMatrix(true, false);
      tmp.copy(est.alvo).applyMatrix4(tmpM.copy(ossos.pescoco.matrixWorld).invert());
      yaw = Math.atan2(tmp.x, tmp.z); pitch = -Math.atan2(tmp.y - rc, Math.hypot(tmp.x, tmp.z));
    }
    const yawC = THREE.MathUtils.clamp(yaw, -0.9, 0.9), pitchC = THREE.MathUtils.clamp(pitch, -0.45, 0.4);
    est.yaw = lerp(est.yaw, yawC, 1 - Math.exp(-dt * 4)); est.pitch = lerp(est.pitch, pitchC, 1 - Math.exp(-dt * 4));
    ossos.cabeca.rotation.set(est.pitch, est.yaw, -est.yaw * 0.12);
    est.olhoX = lerp(est.olhoX, THREE.MathUtils.clamp(yaw - est.yaw, -0.4, 0.4), 1 - Math.exp(-dt * 18));
    est.olhoY = lerp(est.olhoY, THREE.MathUtils.clamp(pitch - est.pitch, -0.3, 0.3), 1 - Math.exp(-dt * 18));
    for (const g of olhos) g.rotation.set(est.olhoY, est.olhoX, 0);
    aplicarMaos(dt);
  }

  atualizar(0);
  return {
    grupo, ossos, materiais: M, medidas: { altura: H, rc, troncoT, pernaT },
    atualizar,
    olharPara(v) { est.alvo = v ? (est.alvo ?? new THREE.Vector3()).copy(v) : null; },
    expressao(nome) { est.exprAlvo = EXPRESSOES[nome] ?? EXPRESSOES.neutro; },
    // lado: 'E', 'D' ou 'ambas'; pose: nome em POSES_MAO ou objeto no mesmo formato
    mao(lado, pose) { const p = typeof pose === 'string' ? POSES_MAO[pose] ?? POSES_MAO.relaxada : pose;
      for (const L of lado === 'ambas' ? ['E', 'D'] : [lado]) est.maoAlvo[L] = p; },
  };
}
