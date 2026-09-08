/**
 * Ponto de entrada: liga canvas, entrada, loop, níveis e telas.
 */

import { createLoop } from './engine/loop.js';
import { createInput } from './engine/input.js';
import { createCamera } from './engine/camera.js';
import { createParticles } from './engine/particles.js';
import { save } from './engine/storage.js';
import { sfx } from './engine/audio.js';

import { createLevel } from './game/level.js';
import { LEVELS, PRACTICE } from './game/levels.js';
import { PHYSICS_DT } from './game/physics.js';

import { drawHud, drawHint, drawScope, drawOffscreenTarget } from './ui/hud.js';
import { createScreens } from './ui/screens.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const ui = document.getElementById('ui');
const pauseButton = document.getElementById('pause-button');

const camera = createCamera();
const particles = createParticles();
const input = createInput(canvas);

const state = {
  mode: 'menu', // 'menu' | 'playing' | 'paused' | 'result'
  level: null,
  levelIndex: 0,
  practice: false,
  motion: true,
};

save.load();
sfx.setEnabled(save.settings.sound);
state.motion = save.settings.motion !== false;
camera.shakeEnabled = state.motion;

// Quem prefere menos movimento não leva tremida de câmera nem câmera lenta.
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
if (reducedMotion?.matches) setMotion(false);

const screens = createScreens(ui, {
  playNext: () => startLevel(nextPlayableIndex()),
  playLevel: (index) => startLevel(index),
  practice: () => startPractice(),
  restart: () => (state.practice ? startPractice() : startLevel(state.levelIndex)),
  resume: () => resume(),
  toMenu: () => toMenu(),
  setMotion,
});

function setMotion(enabled) {
  state.motion = enabled;
  camera.shakeEnabled = enabled;
  if (state.level) state.level.motionEnabled = enabled;
}

// ------------------------------------------------------------------ tamanho

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  camera.resize(width, height);
}

window.addEventListener('resize', resize);
resize();

// ------------------------------------------------------------ fluxo de jogo

/** Primeiro nível ainda não concluído (ou o último, se todos já foram). */
function nextPlayableIndex() {
  for (let i = 0; i < LEVELS.length; i += 1) {
    if (!save.isUnlocked(i, LEVELS)) return Math.max(0, i - 1);
    if (save.levelResult(LEVELS[i].id).stars === 0) return i;
  }
  return LEVELS.length - 1;
}

function startLevel(index) {
  state.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
  state.practice = false;
  state.level = createLevel(LEVELS[state.levelIndex], {
    camera,
    particles,
    motionEnabled: state.motion,
  });
  particles.clear();
  state.mode = 'playing';
  screens.hide();
  pauseButton.hidden = false;
}

function startPractice() {
  state.practice = true;
  state.level = createLevel(PRACTICE, { camera, particles, motionEnabled: state.motion });
  particles.clear();
  state.mode = 'playing';
  screens.hide();
  pauseButton.hidden = false;
}

function pause() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  pauseButton.hidden = true;
  screens.pause();
}

function resume() {
  if (state.mode !== 'paused') return;
  state.mode = 'playing';
  pauseButton.hidden = false;
  screens.hide();
}

function toMenu() {
  state.mode = 'menu';
  state.level = null;
  particles.clear();
  pauseButton.hidden = true;
  screens.menu();
}

function finishLevel() {
  const level = state.level;
  state.mode = 'result';
  pauseButton.hidden = true;

  if (state.practice) {
    toMenu();
    return;
  }

  const spec = LEVELS[state.levelIndex];
  const record = save.recordLevel(spec.id, { stars: level.stars, score: level.score });

  screens.result({
    levelName: spec.name,
    score: level.score,
    stars: level.stars,
    shots: level.shots,
    bestCombo: level.bestCombo,
    targetScore: spec.target,
    isLast: state.levelIndex === LEVELS.length - 1,
    record: record.improved && level.stars > 0,
  });
}

pauseButton.addEventListener('click', () => {
  sfx.click();
  pause();
});

// --------------------------------------------------------------- entrada

/** Traduz ponteiro e teclado nos comandos do arco. */
function applyAim(bow, dt) {
  const speed = input.isDown('ShiftLeft') || input.isDown('ShiftRight') ? 0.25 : 1;

  if (input.isDown('ArrowLeft') || input.isDown('KeyA')) bow.adjust({ angle: 0.9 * dt * speed });
  if (input.isDown('ArrowRight') || input.isDown('KeyD')) bow.adjust({ angle: -0.9 * dt * speed });
  if (input.isDown('ArrowUp') || input.isDown('KeyW')) bow.adjust({ power: 0.55 * dt * speed });
  if (input.isDown('ArrowDown') || input.isDown('KeyS')) bow.adjust({ power: -0.55 * dt * speed });

  if (bow.dragging) bow.updateDrag(input.pointer, camera);
}

function handleDiscreteInput() {
  if (state.mode === 'playing' && input.wasPressed('KeyP')) {
    pause();
    return;
  }
  if (state.mode === 'paused' && input.wasPressed('KeyP')) {
    resume();
    return;
  }
  if (state.mode !== 'playing' || !state.level) return;

  const level = state.level;

  if (input.wasPressed('KeyR')) {
    state.practice ? startPractice() : startLevel(state.levelIndex);
    return;
  }

  if (level.canAim) {
    // `pointer.down` (não só `justPressed`) porque o botão pode já estar
    // pressionado de antes: por exemplo, se o jogador segura o clique
    // enquanto a flecha anterior ainda está em voo/assentando, o "clique"
    // já aconteceu e nunca dispararia `justPressed` de novo — sem isso, o
    // arco simplesmente não responde até soltar e clicar outra vez.
    if (!level.bow.dragging && input.pointer.down) {
      level.bow.beginDrag();
      level.bow.updateDrag(input.pointer, camera);
      sfx.draw(level.bow.power);
    }
    if (input.pointer.justReleased && level.bow.dragging) {
      level.bow.endDrag();
      level.fire();
    }
    if (input.wasPressed('Space')) level.fire();
  } else if (input.pointer.justReleased) {
    level.bow.endDrag();
  }
}

// ------------------------------------------------------------------- loop

const loop = createLoop({
  dt: PHYSICS_DT,

  beginFrame() {
    handleDiscreteInput();
  },

  step(dt) {
    if (state.mode !== 'playing' || !state.level) {
      camera.update(dt);
      return;
    }

    const level = state.level;
    level.update(dt, { aimInput: (bow) => applyAim(bow, dt) });
    loop.setTimeScale(level.slowmo);

    if (level.finished) finishLevel();
  },

  render() {
    if (state.level) {
      state.level.draw(ctx);
      // A luneta atrapalharia durante o close-up em câmera lenta.
      if (state.level.slowmo === 1) {
        drawScope(ctx, state.level, camera);
        drawOffscreenTarget(ctx, state.level, camera);
      }
      drawHud(ctx, state.level, camera);
      if (state.mode === 'playing') drawHint(ctx, state.level, camera);
    } else {
      drawMenuBackdrop();
    }
  },

  endFrame() {
    input.endFrame();
  },
});

/** Fundo tranquilo por trás do menu. */
let backdropTime = 0;
function drawMenuBackdrop() {
  backdropTime += 1 / 60;
  const gradient = ctx.createLinearGradient(0, 0, 0, camera.height);
  gradient.addColorStop(0, '#12233b');
  gradient.addColorStop(0.6, '#2b5470');
  gradient.addColorStop(1, '#7d9a86');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, camera.width, camera.height);

  // Alvo grande e discreto ao fundo, girando devagar.
  const cx = camera.width * 0.78;
  const cy = camera.height * 0.42;
  const radius = Math.min(camera.width, camera.height) * 0.28;
  const colors = ['#f5d23b', '#e2453c', '#4a9fe0', '#1b1b1b', '#f7f7f7'];
  ctx.globalAlpha = 0.13;
  for (let i = 5; i >= 1; i -= 1) {
    ctx.fillStyle = colors[5 - i];
    ctx.beginPath();
    ctx.arc(cx, cy + Math.sin(backdropTime * 0.6) * 6, (radius * i) / 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Gancho de depuração: permite dirigir o jogo pelo console (e pelos testes
// de navegador) sem tocar no resto da arquitetura.
window.__game = { state, startLevel, startPractice, toMenu, pause, resume, camera, input };

loop.start();
toMenu();

// A aba oculta não precisa gastar bateria; ao voltar, o loop reinicia limpo.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    loop.stop();
    if (state.mode === 'playing') pause();
  } else {
    loop.start();
  }
});
