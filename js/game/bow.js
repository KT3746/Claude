/**
 * O arqueiro e o arco: mira, força e o desenho de tudo isso.
 *
 * Existem dois jeitos de mirar, e os dois mexem no mesmo estado:
 *  - arrastar (mouse/dedo) para trás do arco, como um estilingue;
 *  - teclado (setas), para quem prefere precisão ou não usa apontador.
 */

import { launch, simulate } from './physics.js';

/**
 * Faixa de velocidade do disparo. Um arco real manda a flecha a ~60 m/s, mas
 * nessa velocidade a trajetória fica quase reta nas distâncias do jogo e a
 * mira perde a graça. A faixa abaixo mantém um arco visível e legível sem
 * transformar a flecha numa bola de canhão.
 */
export const MIN_SPEED = 16;
export const MAX_SPEED = 46;
export const MIN_ANGLE = -0.35;
export const MAX_ANGLE = 1.25;

/** Distância de arrasto, em pixels, que corresponde à força máxima. */
const FULL_DRAW_PX = 190;

export function createBow({ x = 0, y = 1.62 } = {}) {
  return {
    x,
    y,
    angle: 0.1,
    power: 0.5,
    dragging: false,
    /** Tempo desde o disparo, usado para a animação de recuo do arco. */
    recoil: 0,

    get speed() {
      return MIN_SPEED + (MAX_SPEED - MIN_SPEED) * this.power;
    },

    /** Ponta da flecha, de onde ela realmente sai. */
    get tip() {
      const reach = 0.55 - this.power * 0.35; // recuada quando o arco está armado
      return {
        x: this.x + Math.cos(this.angle) * reach,
        y: this.y + Math.sin(this.angle) * reach,
      };
    },

    beginDrag() {
      this.dragging = true;
    },

    /**
     * Atualiza mira e força a partir da posição do ponteiro na tela.
     * Puxar para trás/baixo do arco mira para frente/cima — como um arco de verdade.
     */
    updateDrag(pointerScreen, camera) {
      const anchor = camera.toScreen(this.x, this.y);
      const dx = anchor.x - pointerScreen.x;
      const dy = anchor.y - pointerScreen.y;
      const distance = Math.hypot(dx, dy);

      if (distance < 12) return; // muito perto do arco: mantém a mira anterior

      this.angle = clamp(Math.atan2(-dy, dx), MIN_ANGLE, MAX_ANGLE);
      this.power = clamp(distance / FULL_DRAW_PX, 0.05, 1);
    },

    endDrag() {
      this.dragging = false;
    },

    /** Ajuste fino pelo teclado. */
    adjust({ angle = 0, power = 0 }) {
      this.angle = clamp(this.angle + angle, MIN_ANGLE, MAX_ANGLE);
      this.power = clamp(this.power + power, 0.05, 1);
    },

    /** Estado inicial da flecha para este tiro. */
    shot() {
      const tip = this.tip;
      this.recoil = 0.25;
      return launch(tip.x, tip.y, this.angle, this.speed);
    },

    update(dt) {
      this.recoil = Math.max(0, this.recoil - dt);
    },

    /**
     * Trajetória prevista (linha pontilhada da mira).
     * Só é chamada quando o nível permite a ajuda visual.
     */
    preview(env, opts = {}) {
      const { points } = simulate(this.shotPreviewState(), env, {
        dt: 1 / 60,
        maxTime: opts.maxTime ?? 1.4,
        maxX: opts.maxX ?? Infinity,
      });
      return points;
    },

    shotPreviewState() {
      const tip = this.tip;
      return launch(tip.x, tip.y, this.angle, this.speed);
    },

    draw(ctx, camera, { showString = true } = {}) {
      drawArcher(ctx, camera, this);
      if (showString) drawBow(ctx, camera, this);
    },
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function drawArcher(ctx, camera, bow) {
  const scale = camera.scale;
  const feet = camera.toScreen(bow.x - 0.15, 0);
  const hip = camera.toScreen(bow.x - 0.15, 0.95);
  const shoulder = camera.toScreen(bow.x - 0.1, 1.55);
  const head = camera.toScreen(bow.x - 0.08, 1.78);
  const lw = Math.max(2, 0.075 * scale);

  ctx.lineCap = 'round';
  ctx.strokeStyle = '#2f3b4a';
  ctx.lineWidth = lw;

  // Pernas afastadas, postura de tiro.
  ctx.beginPath();
  ctx.moveTo(hip.x, hip.y);
  ctx.lineTo(feet.x - 0.28 * scale, feet.y);
  ctx.moveTo(hip.x, hip.y);
  ctx.lineTo(feet.x + 0.3 * scale, feet.y);
  ctx.stroke();

  // Tronco.
  ctx.beginPath();
  ctx.moveTo(hip.x, hip.y);
  ctx.lineTo(shoulder.x, shoulder.y);
  ctx.stroke();

  // Cabeça.
  ctx.fillStyle = '#e8b98c';
  ctx.beginPath();
  ctx.arc(head.x, head.y - 0.06 * scale, 0.17 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Braço do arco (esticado) e braço da corda (dobrado conforme a força).
  const grip = camera.toScreen(bow.x, bow.y);
  ctx.strokeStyle = '#3c4b5e';
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  ctx.moveTo(shoulder.x, shoulder.y);
  ctx.lineTo(grip.x, grip.y);
  ctx.stroke();

  const pull = bow.power * 0.5 + (bow.recoil > 0 ? -0.2 : 0);
  const nock = camera.toScreen(
    bow.x - Math.cos(bow.angle) * pull,
    bow.y - Math.sin(bow.angle) * pull,
  );
  ctx.beginPath();
  ctx.moveTo(shoulder.x, shoulder.y);
  ctx.lineTo(shoulder.x + 0.1 * scale, shoulder.y + 0.22 * scale);
  ctx.lineTo(nock.x, nock.y);
  ctx.stroke();
}

function drawBow(ctx, camera, bow) {
  const scale = camera.scale;
  const grip = camera.toScreen(bow.x, bow.y);
  const limb = 0.62 * scale;
  const perpendicular = bow.angle + Math.PI / 2;

  const upper = {
    x: grip.x + Math.cos(perpendicular) * limb,
    y: grip.y - Math.sin(perpendicular) * limb,
  };
  const lower = {
    x: grip.x - Math.cos(perpendicular) * limb,
    y: grip.y + Math.sin(perpendicular) * limb,
  };
  // Ponto de controle à frente do punho: é ele que dá a barriga curva do arco.
  const belly = {
    x: grip.x + Math.cos(bow.angle) * 0.42 * scale,
    y: grip.y - Math.sin(bow.angle) * 0.42 * scale,
  };

  // Braços do arco.
  ctx.strokeStyle = '#8a5a2b';
  ctx.lineWidth = Math.max(2, 0.06 * scale);
  ctx.beginPath();
  ctx.moveTo(upper.x, upper.y);
  ctx.quadraticCurveTo(belly.x, belly.y, lower.x, lower.y);
  ctx.stroke();

  // Corda: puxada para trás na direção oposta à mira.
  const pull = (bow.recoil > 0 ? -0.12 : bow.power * 0.5) * scale;
  const nock = {
    x: grip.x - Math.cos(bow.angle) * pull,
    y: grip.y + Math.sin(bow.angle) * pull,
  };
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(1, 0.015 * scale);
  ctx.beginPath();
  ctx.moveTo(upper.x, upper.y);
  ctx.lineTo(nock.x, nock.y);
  ctx.lineTo(lower.x, lower.y);
  ctx.stroke();

  // Flecha encaixada, enquanto ainda não foi disparada.
  if (bow.recoil <= 0) {
    ctx.strokeStyle = '#d9b04a';
    ctx.lineWidth = Math.max(1.5, 0.025 * scale);
    ctx.beginPath();
    ctx.moveTo(nock.x, nock.y);
    ctx.lineTo(
      nock.x + Math.cos(bow.angle) * 0.95 * scale,
      nock.y - Math.sin(bow.angle) * 0.95 * scale,
    );
    ctx.stroke();
  }
}
