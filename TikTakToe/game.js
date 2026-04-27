/* ═══════════════════════════════════════════════════════════════
   TIK TAK TOE — game.js
   Stars · Retro Music (Web Audio) · Voice (Web Speech API) · Game
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   STARS BACKGROUND
───────────────────────────────────────────────────────────── */
(function Stars() {
  const canvas = document.getElementById('stars');
  const ctx    = canvas.getContext('2d');
  let W, H;
  const stars  = [];

  function resize() {
    W = canvas.width  = innerWidth;
    H = canvas.height = innerHeight;
  }
  addEventListener('resize', resize);
  resize();

  for (let i = 0; i < 120; i++) {
    stars.push({
      x:     Math.random() * innerWidth,
      y:     Math.random() * innerHeight,
      r:     Math.random() * 1.4 + 0.2,
      a:     Math.random(),
      da:    (Math.random() * 0.004 + 0.001) * (Math.random() < .5 ? 1 : -1),
      color: ['#4d9fff','#a96fff','#ffffff','#c24bff'][Math.floor(Math.random()*4)],
    });
  }

  (function frame() {
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      s.a = Math.max(0.05, Math.min(1, s.a + s.da));
      if (s.a <= 0.05 || s.a >= 1) s.da *= -1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.globalAlpha = s.a * 0.7;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  })();
})();

/* ─────────────────────────────────────────────────────────────
   RETRO MUSIC ENGINE (Web Audio API)
   Chip-tune melody + bass + hi-hat rhythm
───────────────────────────────────────────────────────────── */
const Music = (() => {
  let ctx, playing = false, nodes = [];

  const MELODY = [
    523.25, 659.25, 783.99, 659.25,
    523.25, 392.00, 440.00, 523.25,
    587.33, 739.99, 587.33, 493.88,
    392.00, 329.63, 392.00, 440.00,
  ];
  const BASS = [130.81, 146.83, 164.81, 174.61, 195.99, 207.65, 220.00, 246.94];
  const NOTE_DUR = 0.18;
  const BPM = 148;
  const BEAT = 60 / BPM;

  function mkCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function osc(freq, type, gain, start, dur, dest) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(dest);
    o.start(start); o.stop(start + dur + 0.02);
    nodes.push(o, g);
  }

  function noise(start, dur, gainVal, dest) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'highpass'; filt.frequency.value = 8000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filt); filt.connect(g); g.connect(dest);
    src.start(start); src.stop(start + dur + 0.01);
    nodes.push(src, filt, g);
  }

  let loopId = null;
  let loopStart = 0;
  const LOOP_BARS = 4;
  const BAR_BEATS = 4;
  const LOOP_LEN  = LOOP_BARS * BAR_BEATS * BEAT;

  function scheduleLoop(startTime) {
    if (!playing) return;
    loopStart = startTime;

    const master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
    nodes.push(master);

    // Melody (square wave)
    for (let i = 0; i < MELODY.length * 2; i++) {
      const t = startTime + i * NOTE_DUR;
      if (t >= startTime + LOOP_LEN) break;
      osc(MELODY[i % MELODY.length], 'square', 0.35, t, NOTE_DUR * 0.8, master);
    }

    // Bass (sawtooth, one per beat)
    const beats = LOOP_BARS * BAR_BEATS;
    for (let b = 0; b < beats; b++) {
      const t = startTime + b * BEAT;
      osc(BASS[b % BASS.length], 'sawtooth', 0.18, t, BEAT * 0.6, master);
    }

    // Hi-hat (every 8th)
    const eighths = beats * 2;
    for (let e = 0; e < eighths; e++) {
      noise(startTime + e * BEAT / 2, 0.04, 0.12, master);
    }

    // Kick (every beat)
    for (let b = 0; b < beats; b++) {
      const t = startTime + b * BEAT;
      osc(80, 'sine', 0.6, t, 0.12, master);
    }

    loopId = setTimeout(() => scheduleLoop(startTime + LOOP_LEN), (LOOP_LEN - 0.3) * 1000);
  }

  return {
    start() {
      mkCtx();
      if (ctx.state === 'suspended') ctx.resume();
      if (playing) return;
      playing = true;
      nodes = [];
      scheduleLoop(ctx.currentTime + 0.05);
    },
    stop() {
      playing = false;
      clearTimeout(loopId);
      for (const n of nodes) { try { n.disconnect(); n.stop && n.stop(); } catch{} }
      nodes = [];
    },
    toggle() { playing ? this.stop() : this.start(); return playing; },
    isPlaying() { return playing; },
    sfx(type) {
      // Sound effects
      mkCtx();
      if (ctx.state === 'suspended') ctx.resume();
      const g = ctx.createGain();
      g.connect(ctx.destination);
      const t = ctx.currentTime;

      if (type === 'place') {
        // Short blip
        const o = ctx.createOscillator();
        o.type = 'square'; o.frequency.value = 660;
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
        o.connect(g); o.start(t); o.stop(t + 0.12);
      } else if (type === 'win') {
        // Victory arpeggio
        [523,659,784,1047].forEach((f, i) => {
          const o = ctx.createOscillator();
          o.type = 'square'; o.frequency.value = f;
          const gg = ctx.createGain();
          gg.gain.setValueAtTime(0.18, t + i*0.1);
          gg.gain.exponentialRampToValueAtTime(0.0001, t + i*0.1 + 0.18);
          o.connect(gg); gg.connect(ctx.destination);
          o.start(t + i*0.1); o.stop(t + i*0.1 + 0.2);
        });
      } else if (type === 'lose') {
        // Sad descend
        [330,262,196,165].forEach((f, i) => {
          const o = ctx.createOscillator();
          o.type = 'sawtooth'; o.frequency.value = f;
          const gg = ctx.createGain();
          gg.gain.setValueAtTime(0.15, t + i*0.12);
          gg.gain.exponentialRampToValueAtTime(0.0001, t + i*0.12 + 0.2);
          o.connect(gg); gg.connect(ctx.destination);
          o.start(t + i*0.12); o.stop(t + i*0.12 + 0.22);
        });
      } else if (type === 'draw') {
        const o = ctx.createOscillator();
        o.type = 'triangle'; o.frequency.setValueAtTime(440, t);
        o.frequency.linearRampToValueAtTime(220, t + 0.4);
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        o.connect(g); o.start(t); o.stop(t + 0.5);
      } else if (type === 'click') {
        const o = ctx.createOscillator();
        o.type = 'square'; o.frequency.value = 880;
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        o.connect(g); o.start(t); o.stop(t + 0.06);
      }
    }
  };
})();

/* ─────────────────────────────────────────────────────────────
   VOICE ENGINE (Web Speech API)
───────────────────────────────────────────────────────────── */
const Voice = (() => {
  const synth = window.speechSynthesis;
  let voiceReady = false;
  let voices = [];

  // Preload voices
  function loadVoices() {
    voices = synth.getVoices().filter(v => v.lang.startsWith('es'));
    if (voices.length) voiceReady = true;
  }
  loadVoices();
  if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = loadVoices;

  const speechEl  = document.getElementById('speech-bubble');
  const speechTxt = document.getElementById('speech-text');
  let bubbleTimer  = null;

  function showBubble(text) {
    clearTimeout(bubbleTimer);
    speechTxt.textContent = text;
    speechEl.classList.remove('hidden');
    bubbleTimer = setTimeout(() => speechEl.classList.add('hidden'), Math.max(3000, text.length * 70));
  }

  function speak(text, { rate = 1, pitch = 1, volume = 1 } = {}) {
    if (!synth) return;
    synth.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    if (voices.length) utt.voice = voices[0];
    utt.lang   = 'es-MX';
    utt.rate   = rate;
    utt.pitch  = pitch;
    utt.volume = volume;
    synth.speak(utt);
    showBubble(text);
  }

  return {
    turn(name) {
      speak(`¡Es turno de ${name}!`, { rate: 0.95, pitch: 1.1 });
    },
    cell(row, col) {
      speak(`Seleccionando casilla ${row}, ${col}`, { rate: 1.05, pitch: 1 });
    },
    countdown(n) {
      if (n === 0) speak('¡YA!', { rate: 0.85, pitch: 1.3 });
      else speak(String(n), { rate: 0.75, pitch: 1 + n * 0.08 });
    },
    win(name, isMachine) {
      const msg = isMachine
        ? `¡Ohhh no... la máquina gana! Inténtalo de nuevo, campeón.`
        : `¡¡Guaooow!! ¡¡Ganaste!! ¡Eres tremendo, ${name}!!`;
      speak(msg, { rate: 0.9, pitch: isMachine ? 0.85 : 1.25 });
    },
    lose(name) {
      speak(`Ohhh no, has perdido. ¡Pero tú puedes, ${name}!`, { rate: 0.9, pitch: 0.9 });
    },
    draw() {
      speak(`¡Empate! ¡Nadie puede con nadie hoy!`, { rate: 1, pitch: 1.05 });
    },
    machineThinks() {
      speak(`La máquina está pensando...`, { rate: 1.1, pitch: 0.95 });
    },
    start() {
      speak(`¡La partida comienza!`, { rate: 1, pitch: 1.1 });
    }
  };
})();

/* ─────────────────────────────────────────────────────────────
   AUDIO TOGGLE BUTTON
───────────────────────────────────────────────────────────── */
const audioBtn = document.getElementById('audio-toggle');
audioBtn.addEventListener('click', () => {
  const on = Music.toggle();
  audioBtn.classList.toggle('on', on);
  audioBtn.textContent = on ? '♫' : '♪';
  Music.sfx('click');
});

/* ─────────────────────────────────────────────────────────────
   SCREEN NAVIGATION
───────────────────────────────────────────────────────────── */
const SCREENS = {
  menu:     document.getElementById('s-menu'),
  register: document.getElementById('s-register'),
  lobby:    document.getElementById('s-lobby'),
  game:     document.getElementById('s-game'),
};

function goTo(name) {
  Object.values(SCREENS).forEach(s => s.classList.remove('active'));
  SCREENS[name].classList.add('active');
  Music.sfx('click');
}

/* ─────────────────────────────────────────────────────────────
   GAME STATE
───────────────────────────────────────────────────────────── */
const G = {
  mode:        null,   // 'solo' | 'duo'
  players:     ['', ''],
  board:       Array(9).fill(null),
  current:     0,      // 0=X, 1=O
  firstNext:   0,
  scores:      [0, 0, 0], // [X, O, draws]
  over:        false,
};

const WIN_COMBOS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

/* ─────────────────────────────────────────────────────────────
   ELEMENT REFS
───────────────────────────────────────────────────────────── */
const cells     = document.querySelectorAll('.cell');
const turnTxt   = document.getElementById('turn-txt');
const turnLed   = document.getElementById('turn-led');
const sbNameL   = document.getElementById('sb-name-l');
const sbNameR   = document.getElementById('sb-name-r');
const sbPtsL    = document.getElementById('sb-pts-l');
const sbPtsR    = document.getElementById('sb-pts-r');
const sbDraws   = document.getElementById('sb-draws');
const sbcLeft   = document.getElementById('sbc-left');
const sbcRight  = document.getElementById('sbc-right');
const winLine   = document.getElementById('win-line');
const modal     = document.getElementById('modal');
const mEmoji    = document.getElementById('m-emoji');
const mTitle    = document.getElementById('m-title');
const mSub      = document.getElementById('m-sub');
const btnNext   = document.getElementById('btn-next');
const cdOverlay = document.getElementById('cd-overlay');
const cdNum     = document.getElementById('cd-num');

/* ─────────────────────────────────────────────────────────────
   MENU
───────────────────────────────────────────────────────────── */
document.getElementById('btn-solo').addEventListener('click', () => {
  G.mode = 'solo';
  document.getElementById('reg-solo').classList.remove('hidden');
  document.getElementById('reg-duo').classList.add('hidden');
  goTo('register');
});
document.getElementById('btn-duo').addEventListener('click', () => {
  G.mode = 'duo';
  document.getElementById('reg-duo').classList.remove('hidden');
  document.getElementById('reg-solo').classList.add('hidden');
  goTo('register');
});

/* ─────────────────────────────────────────────────────────────
   REGISTER
───────────────────────────────────────────────────────────── */
document.getElementById('btn-reg-solo').addEventListener('click', () => {
  const name = document.getElementById('inp-p1').value.trim() || 'JUGADOR';
  G.players = [name.toUpperCase(), 'MÁQUINA'];
  toLobby();
});
document.getElementById('btn-reg-duo').addEventListener('click', () => {
  const n1 = document.getElementById('inp-p1d').value.trim() || 'JUGADOR 1';
  const n2 = document.getElementById('inp-p2d').value.trim() || 'JUGADOR 2';
  G.players = [n1.toUpperCase(), n2.toUpperCase()];
  toLobby();
});
document.getElementById('btn-back-reg').addEventListener('click', () => goTo('menu'));

// Enter key support
document.getElementById('inp-p1').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('btn-reg-solo').click(); });
document.getElementById('inp-p2d').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('btn-reg-duo').click(); });

function toLobby() {
  document.getElementById('lob-p1').textContent = G.players[0];
  document.getElementById('lob-p2').textContent = G.players[1];
  G.scores = [0,0,0];
  updateScore();
  goTo('lobby');
}

/* ─────────────────────────────────────────────────────────────
   LOBBY
───────────────────────────────────────────────────────────── */
document.getElementById('btn-launch').addEventListener('click', () => {
  goTo('game');
  setupGameUI();
  startCountdown();
});
document.getElementById('btn-back-lobby').addEventListener('click', () => goTo('register'));

function setupGameUI() {
  sbNameL.textContent = G.players[0];
  sbNameR.textContent = G.players[1];
  updateScore();
}

/* ─────────────────────────────────────────────────────────────
   COUNTDOWN → START ROUND
───────────────────────────────────────────────────────────── */
function startCountdown() {
  cdOverlay.classList.remove('hidden');
  const steps = ['3','2','1','¡YA!'];
  let i = 0;

  function step() {
    cdNum.style.animation = 'none';
    void cdNum.offsetWidth; // reflow
    cdNum.style.animation = '';
    cdNum.textContent = steps[i];
    Voice.countdown(i < 3 ? 3-i : 0);

    i++;
    if (i < steps.length) {
      setTimeout(step, 950);
    } else {
      setTimeout(() => {
        cdOverlay.classList.add('hidden');
        startRound();
      }, 700);
    }
  }
  step();
}

/* ─────────────────────────────────────────────────────────────
   ROUND
───────────────────────────────────────────────────────────── */
function startRound() {
  G.board   = Array(9).fill(null);
  G.over    = false;
  G.current = G.firstNext;

  clearBoard();
  resetWinLine();
  btnNext.disabled = true;

  updateTurnUI();
  Voice.turn(G.players[G.current]);
  Voice.start();

  if (G.mode === 'solo' && G.current === 1) {
    setTimeout(machinePlay, 1100);
  }
}

function clearBoard() {
  cells.forEach(c => {
    c.innerHTML = '';
    c.classList.remove('played', 'win-cell');
  });
}

/* ─────────────────────────────────────────────────────────────
   CELLS
───────────────────────────────────────────────────────────── */
cells.forEach(cell => {
  cell.addEventListener('click', () => {
    const idx = parseInt(cell.dataset.i);
    if (G.over || G.board[idx] !== null) return;
    if (G.mode === 'solo' && G.current === 1) return;

    const row = cell.dataset.row;
    const col = cell.dataset.col;
    Voice.cell(row, col);
    playMove(idx);
  });

  // Hover voice hint
  cell.addEventListener('mouseenter', () => {
    if (G.over || cell.classList.contains('played')) return;
    if (G.mode === 'solo' && G.current === 1) return;
    // subtle — no voice on hover to avoid spam
  });
});

function playMove(idx) {
  if (G.board[idx] !== null || G.over) return;

  const p = G.current;
  G.board[idx] = p;

  const cell = cells[idx];
  const span = document.createElement('span');
  span.classList.add('mark', p === 0 ? 'x' : 'o');
  span.textContent = p === 0 ? 'X' : 'O';
  cell.appendChild(span);
  cell.classList.add('played');
  Music.sfx('place');

  const res = checkWin(G.board);
  if (res.winner !== null) {
    endRound(res.winner, res.combo);
  } else if (G.board.every(v => v !== null)) {
    endRound(null, null);
  } else {
    G.current = 1 - G.current;
    updateTurnUI();
    setTimeout(() => Voice.turn(G.players[G.current]), 400);

    if (G.mode === 'solo' && G.current === 1) {
      setTimeout(machinePlay, 900);
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   MACHINE
───────────────────────────────────────────────────────────── */
function machinePlay() {
  if (G.over) return;
  const free = G.board.map((v,i) => v===null ? i : null).filter(v => v!==null);
  if (!free.length) return;
  const pick = free[Math.floor(Math.random() * free.length)];
  const cell = cells[pick];
  Voice.cell(cell.dataset.row, cell.dataset.col);
  playMove(pick);
}

/* ─────────────────────────────────────────────────────────────
   WIN CHECK
───────────────────────────────────────────────────────────── */
function checkWin(board) {
  for (const combo of WIN_COMBOS) {
    const [a,b,c] = combo;
    if (board[a] !== null && board[a] === board[b] && board[a] === board[c])
      return { winner: board[a], combo };
  }
  return { winner: null, combo: null };
}

/* ─────────────────────────────────────────────────────────────
   END ROUND
───────────────────────────────────────────────────────────── */
function endRound(winner, combo) {
  G.over    = true;
  btnNext.disabled = false;
  G.firstNext = 1 - G.firstNext;

  if (winner !== null) {
    G.scores[winner]++;
    highlightWinCells(combo);
    drawWinLine(combo);
    updateScore();

    const isMachine = G.mode === 'solo' && winner === 1;
    Music.sfx(isMachine ? 'lose' : 'win');
    setTimeout(() => {
      Voice.win(G.players[winner], isMachine);
      showModal(winner);
    }, 700);
  } else {
    G.scores[2]++;
    updateScore();
    Music.sfx('draw');
    setTimeout(() => { Voice.draw(); showModal(null); }, 400);
  }
}

function highlightWinCells(combo) {
  combo.forEach(i => cells[i].classList.add('win-cell'));
}

/* ─────────────────────────────────────────────────────────────
   WIN LINE SVG
───────────────────────────────────────────────────────────── */
function resetWinLine() {
  winLine.setAttribute('x1', 0); winLine.setAttribute('y1', 0);
  winLine.setAttribute('x2', 0); winLine.setAttribute('y2', 0);
  winLine.classList.remove('drawn');
}

function drawWinLine(combo) {
  const board = document.getElementById('board');
  const br    = board.getBoundingClientRect();

  function center(idx) {
    const r = cells[idx].getBoundingClientRect();
    return {
      x: ((r.left + r.width/2)  - br.left) / br.width  * 300,
      y: ((r.top  + r.height/2) - br.top)  / br.height * 300,
    };
  }
  const s = center(combo[0]);
  const e = center(combo[2]);
  winLine.setAttribute('x1', s.x); winLine.setAttribute('y1', s.y);
  winLine.setAttribute('x2', e.x); winLine.setAttribute('y2', e.y);
  requestAnimationFrame(() => winLine.classList.add('drawn'));
}

/* ─────────────────────────────────────────────────────────────
   UI UPDATES
───────────────────────────────────────────────────────────── */
function updateTurnUI() {
  const name = G.players[G.current];
  const isX  = G.current === 0;
  turnTxt.textContent = `TURNO DE ${name}`;
  turnTxt.style.color = isX ? 'var(--x-clr)' : 'var(--o-clr)';
  turnLed.className = 'turn-led ' + (isX ? 'x' : 'o');
  sbcLeft.classList.toggle('active',  G.current === 0);
  sbcRight.classList.toggle('active', G.current === 1);
}

function updateScore() {
  sbPtsL.textContent  = G.scores[0];
  sbPtsR.textContent  = G.scores[1];
  sbDraws.textContent = G.scores[2];
}

/* ─────────────────────────────────────────────────────────────
   MODAL
───────────────────────────────────────────────────────────── */
function showModal(winner) {
  modal.classList.remove('hidden', 'draw');
  if (winner !== null) {
    const isMachine = G.mode === 'solo' && winner === 1;
    mEmoji.textContent = isMachine ? '🤖' : '🏆';
    mTitle.textContent = isMachine ? '¡TE GANÉ!' : '¡GANASTE!';
    mSub.textContent   = G.players[winner];
  } else {
    modal.classList.add('draw');
    mEmoji.textContent = '🐱';
    mTitle.textContent = '¡EMPATE!';
    mSub.textContent   = 'NADIE GANA ESTA VEZ';
  }
}

document.getElementById('m-btn-next').addEventListener('click', () => {
  modal.classList.add('hidden');
  startCountdown();
});
document.getElementById('m-btn-menu').addEventListener('click', () => {
  modal.classList.add('hidden');
  goTo('menu');
});

/* ─────────────────────────────────────────────────────────────
   GAME BUTTONS
───────────────────────────────────────────────────────────── */
btnNext.addEventListener('click', () => {
  if (!G.over) return;
  startCountdown();
});
document.getElementById('btn-home').addEventListener('click', () => {
  modal.classList.add('hidden');
  goTo('menu');
});
document.getElementById('btn-sb-reset').addEventListener('click', () => {
  G.scores = [0,0,0];
  updateScore();
  Music.sfx('click');
});

/* ─────────────────────────────────────────────────────────────
   AUTO-START MUSIC on first interaction (browser policy)
───────────────────────────────────────────────────────────── */
document.addEventListener('click', function startMusicOnce() {
  if (!Music.isPlaying()) {
    Music.start();
    audioBtn.classList.add('on');
    audioBtn.textContent = '♫';
  }
  document.removeEventListener('click', startMusicOnce);
}, { once: true });
