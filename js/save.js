// Progresso e opções, salvos no navegador.
const KEY = 'caldeiraovr.v1';
const DEFAULTS = {
  wins: [0, 0, 0],      // vitórias contra cada adversário
  games: [0, 0, 0],     // partidas jogadas contra cada um
  ch: {},               // desafios: { 0: 3, 1: 2, ... } = melhor número de estrelas
  sound: true,
  fps: false,
  book: {},             // receitas descobertas: { 'fogo+vento': true }
};

export function loadSave() {
  try {
    const s = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    if (!Array.isArray(s.wins) || s.wins.length !== 3) s.wins = [0, 0, 0];
    if (!Array.isArray(s.games) || s.games.length !== 3) s.games = [0, 0, 0];
    if (typeof s.ch !== 'object' || !s.ch) s.ch = {};
    if (typeof s.book !== 'object' || !s.book) s.book = {};
    return s;
  } catch { return { ...DEFAULTS, wins: [0, 0, 0], games: [0, 0, 0], ch: {}, book: {} }; }
}

export function storeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sem armazenamento: segue sem salvar */ }
}
