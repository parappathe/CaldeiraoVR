# CaldeiraoVR

Caldeirão: duelo de bruxos por turnos em VR para o Meta Quest 3 no navegador (WebXR), sem instalar nada.
Numa cabana de bruxa à noite (paredes de tronco, ervas penduradas nas vigas, velas, a lua pela janela),
você fica em pé atrás do seu caldeirão, com uma prateleira em arco de 5 frascos em volta. Pega 2 ou 3
frascos, despeja no caldeirão e mexe com a colher em círculo: a mistura vira um feitiço (ou gororoba) que
voa até o bruxo do outro lado da sala, com o caldeirão dele. Duelo contra 3 bruxos com estilos diferentes
e 10 desafios de 3 estrelas; livro de receitas que se preenche conforme você descobre. Também joga no PC
com mouse e teclado. Tudo em português.

## Como rodar / jogar

**No Quest:** depois de publicado, abrir no navegador do óculos `https://parappathe.github.io/CaldeiraoVR/`
e apertar "Entrar em VR". (Publicação é com o Eduardo: `python publicar.py CaldeiraoVR` na pasta `C:\claude code`.)

**No PC:** `python serve.py` nesta pasta e abrir `http://localhost:8883` (o painel de visualização usa
`.claude/launch.json`). `python serve.py --https` serve para abrir no Quest pela rede de casa (porta 8443).

### Controles

| | VR (Quest) | PC |
|---|---|---|
| Despejar um frasco | Pegar com o botão lateral e soltar em cima do caldeirão; ou apontar o raio e gatilho | Clicar no frasco ou teclas 1 a 5 |
| Mexer e lançar | Pegar a colher pelo cabo e dar uma volta inteira em círculo; ou raio + gatilho na placa "Mexer!" ou na colher | Clicar em "Mexer!" ou Enter (Espaço também) |
| Esvaziar o caldeirão | Tocar ou apontar na placa "Esvaziar" | Clicar em "Esvaziar" ou Backspace (Z também) |
| Livro de receitas | Tocar ou apontar no livro aberto no atril, à esquerda | Clicar no livro ou L |
| Só com as mãos | Pinça perto pega frasco e colher ou toca nas placas; pinça apontando escolhe de longe | |
| Pausa | B ou Y | Esc ou P |
| Menu | Apontar com o controle (ou a mão) e gatilho (ou pinça) | Clique |
| Câmera | (sua cabeça) | Botão direito arrastando ou A/D/W/S |
| FPS | Menu → FPS | Tecla F |

No VR você fica em pé; o caldeirão fica a 45 cm à frente (boca a 80 cm do chão) e os 5 frascos numa
prateleira em arco a 60 cm de você, na altura de 1,08 m (números 1 a 5 embaixo de cada um).

### Regras

- 20 de vida cada um. Cada um tem uma prateleira com 5 frascos (a do adversário fica coberta: você não vê).
  Os elementos: fogo, água, vento, terra, gelo, luz, sombra e veneno.
- Na sua vez: despeje 2 ou 3 frascos e mexa. A combinação (a ordem não importa) define o feitiço. Depois a
  prateleira se completa com frascos novos sorteados.
- 30 receitas em `js/rules.js` (`RECIPES`): dano por elemento (Labareda, Bola de Fogo, Nevasca, Vulcão,
  Inferno...), escudos que bloqueiam elementos por alguns turnos (Escudo de Gelo bloqueia fogo; Muralha
  bloqueia terra, gelo e vento; Bolha d'Água bloqueia veneno e sombra; Prisma; Fortaleza), cura (Cura,
  Purificar, Fonte da Vida), veneno por turnos (Poção Venenosa, Fumaça Tóxica, Maldição, Névoa
  Pestilenta), atordoar = o outro perde a vez (Sopro Sombrio, Prisão de Gelo, Tempestade de Gelo),
  Espelho (devolve o próximo ataque) e Eclipse (quebra escudos e espelho). Combinação que não está no
  livro vira **gororoba**: 1 de dano que não se bloqueia, com um texto engraçado (sapo, chulé, meia velha...).
- Efeitos que duram contam no começo da vez de quem está com eles: o veneno pesa, o escudo e o espelho
  perdem um turno.
- O livro de receitas guarda o que você já viu (lançado por você ou pelo adversário), salvo no navegador.
- Adversários (em `js/ai.js`): **Brasa** (o piromaníaco: só pensa em dano, gosta de fogo e nem olha os seus
  escudos), **Mãe Sálvia** (a curandeira: cura, escudo e veneno; erra mais na escolha), **Corvino** (o
  astuto: simula o efeito no seu estado público, não ataca escudo nem espelho, quebra escudo com Eclipse,
  guarda frascos bons e imagina a sua resposta com prateleiras sorteadas, sem espiar a sua). A IA nunca
  olha a sua prateleira nem os sorteios futuros (o teste confere).
- Desafios (em `js/challenges.js`): duelo curto contra o Espantalho, que lança sempre a mesma lista de
  feitiços escrita no desafio; a sua prateleira vem numa ordem fixa. 1 Primeira Poção, 2 Escudo na Hora,
  3 Gota de Cura, 4 Veneno Lento, 5 Espelho Espelho, 6 Mão Pesada, 7 Quebra-Escudo, 8 Receita Tripla,
  9 Sem Desperdício, 10 Mestre do Caldeirão. Medida: feitiços de sobra, vida no fim ou dano causado.
- Progresso salvo no navegador (localStorage, chave `caldeiraovr.v1`): vitórias, estrelas e o livro.

## Como testar

- `npm test` (ou `node tests/run.js`): receitas (pelo menos 12, ordem não importa, gororoba), duelo (dano,
  prateleira que se completa, escudo bloqueia só o elemento dele e acaba, espelho devolve, Eclipse quebra,
  veneno por turnos, Purificar, atordoar perde a vez, Bolha bloqueia o atordoar de sombra, cura, fim do
  duelo, visão pública sem a prateleira do outro); IA (lance válido, menos de 100 ms, **não espia**: a
  escolha não muda se a sua prateleira e os sorteios mudam, Brasa usa mais fogo, Sálvia cura e se protege
  mais, Corvino desperdiça menos ataque em escudo); IA contra IA (160 duelos por par, metade de cada
  lado: Corvino ganha dos dois, Sálvia do Brasa; mostra os placares); robô tira 3 estrelas nos 10
  desafios com busca completa e "sempre os dois primeiros frascos" não dá 3; e fumaça do `main.js`
  (carrega o jogo no Node com navegador e WebGL de mentira: clique nos frascos e em Mexer!, Backspace,
  teclas, controle de VR de mentira pega o frasco, solta no caldeirão e gira a colher, mão de mentira
  pega com a pinça e escolhe de longe com o raio, L abre o livro, robô termina o duelo, os 10 desafios
  com 3 estrelas dentro do jogo, `dev.win()`, `dev.cheat()`, pausa, sem erro no console). Tem que
  terminar com "Tudo certo"; sai com código 1 se algo falhar (ou 200 s). Não toca som. Leva uns 35 s.
- O teste de fumaça usa `module.registerHooks` do Node (22.15 ou mais novo).
- No navegador (console): `dev.autoplay = true`, `dev.advance(5)`, `dev.state()` (fase, vida, sua
  prateleira, caldeirão, efeitos), `dev.cheat()` (a prateleira do adversário), `dev.loadLevel(3)`,
  `dev.startMatch(2)`, `dev.win()`, `dev.screenOf({ slot: 0 } | 'stir' | 'empty' | 'book' | 'spoon')`,
  `dev.resetSave()`. `window.caldeirao` tem `duel`, `challenge`, `save`, `camera`, `scene`, `renderer`, `world`, `shell`.
- **Só dá para testar no óculos:** alcance da prateleira, pegar e soltar o frasco em cima do caldeirão,
  girar a colher, raio, mãos, legibilidade das placas, FPS.

## Estrutura

| Arquivo | O que tem |
|---|---|
| `index.html`, `css/style.css` | Página, botão "Entrar em VR", placar, dica do PC e o clarão vermelho do golpe |
| `js/rules.js` | Elementos, receitas, gororoba, duelo (`newDuel`, `legalMoves`, `applyMove`, `applyScripted`, `castEffect`), `publicView`. Sem navegador |
| `js/ai.js` | Os 3 bruxos e o robô (`chooseMove`, `evaluate`, `playDuel`). Sem navegador |
| `js/challenges.js` | Os 10 desafios, o Espantalho, a busca completa do robô (`solveChallenge`). Sem navegador |
| `js/shell.js` | Casca: render, câmera, VR, mouse/teclado, painel, placas, FPS, laço (igual ao dos outros jogos) |
| `js/main.js` | O jogo: vez de preparar, despejar, mexer, lançar, animação do adversário, menus, livro, HUD, `dev` |
| `js/scene.js` | Cabana, caldeirões, colher, prateleira, frascos, potes cobertos, atril com o livro, adversário com chapéu e túnica, escudos, espelho, veneno, estrelinhas, projéteis e números flutuantes |
| `js/visual3d.js`, `js/materiais3d.js`, `js/personagem3d.js` | Da skill `dudu`: chanfro, halo, sombra de contato, mapa de ambiente, madeira e ferro em textura gerada, personagem animado |
| `js/ui.js`, `js/audio.js`, `js/save.js` | Painel/placas, sons (glub do frasco, mexer, lançar por elemento, golpe, escudo, cura, veneno, arroto da gororoba, grilos e coruja), progresso |
| `tests/run.js`, `tests/smoke.js`, `tests/three-stub.js` | Testes |
| `serve.py` | Servidor local sem cache (porta 8883, `--https` para o Quest) |
| `vendor/three/three.module.js` | Three.js r170 (cópia local) |

Você em (0; 0) olhando para -z. Seu caldeirão em z = -0,45, o do adversário em z = -2,6, o adversário em
z = -3,05. Frascos em `slotPos(i)`: ângulos -64°, -32°, 0°, 32°, 64°, raio 0,6 m, altura 1,08 m.

## Regras e convenções do projeto

- `rules.js`, `ai.js` e `challenges.js` não usam navegador nem Three.js.
- A IA só usa `publicView` (sem a prateleira do outro e sem a semente). O sorteio dos frascos depende só da
  semente e de quantos frascos cada um tirou, então o estado é puro e copiável.
- Mexeu em regras, IA ou desafios: rodar `npm test`. As metas dos desafios saem da busca do robô.
- Testes nunca tocam som.

## Decisões

- Direção de arte: estilo cartoon com material simples (madeira e ferro com textura gerada, frascos de
  vidro com líquido que brilha); paleta dominante madeira quente (#806252 / #94705a), secundária azul da
  noite (#2c3a78, janela e luz de preenchimento), destaque nas cores dos elementos (só frascos, líquido e
  feitiços) e o âmbar das velas. Luz: lustre de velas quente vindo de cima e da esquerda com sombra,
  preenchimento azulado da noite (hemisfério), fogo laranja embaixo de cada caldeirão.
- Duelo por vida (20) em vez de rodadas: cada feitiço muda o placar e a partida dura uns 7 lances de cada.
- Prateleira de 5 frascos sorteados que se completam: dá escolha (até 20 combinações) sem mana.
- Mexer uma volta inteira com a colher lança (era 1,25; uma volta já deixa claro o gesto sem cansar).
- Raio + gatilho na colher ou na placa "Mexer!" também lança: para quem não quer fazer o gesto.
- A Mãe Sálvia tem mais acaso na escolha (ruído 4): sem isso ela empatava com o Corvino; assim fica
  Corvino > Sálvia > Brasa.
- Adversário de pé do outro lado da sala (2,6 m), para o feitiço ter caminho para voar.
- Porta do servidor local 8883.

## Pendências / problemas conhecidos

- Falta testar no Quest: alcance da prateleira, soltar o frasco em cima do caldeirão, a colher em
  círculo, raio, mãos, placas e FPS (tem sombra de uma luz e 3 luzes pontuais/direcionais).
- A Sálvia ganha do Brasa por 107 x 53 e perde do Corvino por 54 x 106; contra gente só jogando para saber.
