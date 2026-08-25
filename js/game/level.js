/**
 * Um nível em andamento: monta o mundo a partir da tabela de níveis,
 * roda a máquina de estados do tiro e desenha tudo.
 *
 * Estados: 'aiming' → 'flying' → 'settling' → (próxima flecha | 'finished')
 */

import { createArrow } from './arrow.js';
import { createBow } from './bow.js';
import { createTarget, createBalloon, createObstacle } from './target.js';
import { createScenery, drawScenery, drawSky, drawWindFlag } from './scenery.js';
import { GRAVITY, DRAG } from './physics.js';
import { pointsFor, starsFor, keepsCombo, labelFor } from './scoring.js';
import { sfx } from '../engine/audio.js';

/** Pausa depois que a flecha para, antes de rearmar o arco. */
const SETTLE_TIME = 1.1;

/** Quão perto do centro (em raios do alvo) dispara a câmera lenta. */
const SLOWMO_RADIUS = 0.35;

/** Menor escala aceitável ao mirar (px/m): abaixo disso o arqueiro some. */
const MIN_AIM_SCALE = 20;

export function createLevel(spec, { camera, particles, motionEnabled = true }) {
  const wind = { base: spec.wind?.base ?? 0, gust: spec.wind?.gust ?? 0, current: spec.wind?.base ?? 0, phase: 0 };

  const level = {
    spec,
    bow: createBow(),
    target: createTarget(spec),
    balloons: (spec.balloons ?? []).map(createBalloon),
    obstacles: (spec.obstacles ?? []).map(createObstacle),
    scenery: createScenery(spec, hashId(spec.id)),

    state: 'aiming',
    arrow: null,
    arrowsLeft: spec.arrows,
    score: 0,
    combo: 0,
    bestCombo: 0,
    shots: [], // histórico: {ring, bullseye, points}
    settleTimer: 0,
    time: 0,
    floaters: [],
    slowmo: 1,
    motionEnabled,
    finished: false,

    get wind() {
      return wind.current;
    },

    get env() {
      return { gravity: GRAVITY, drag: DRAG, wind: wind.current };
    },

    get infiniteArrows() {
      return !Number.isFinite(spec.arrows);
    },

    get stars() {
      return this.infiniteArrows ? 0 : starsFor(this.score, spec.target);
    },

    /** O arco aceita comandos agora? */
    get canAim() {
      return this.state === 'aiming' && !this.finished;
    },

    // ---------------------------------------------------------------- disparo

    fire() {
      if (!this.canAim) return false;
      this.arrow = createArrow(this.bow.shot());
      this.state = 'flying';
      this.slowmo = 1;
      sfx.release(this.bow.power);
      camera.addShake(0.18);
      const tip = this.bow.tip;
      particles.burst(tip.x, tip.y, 8, { color: ['#ffffff', '#e6c458'], speed: 2, life: 0.3, size: 0.035, gravity: 2 });
      return true;
    },

    // ------------------------------------------------------------- simulação

    update(dt, { aimInput } = {}) {
      this.time += dt;

      // Vento: base + rajada suave (duas senoides em frequências diferentes,
      // para não virar um padrão previsível).
      wind.phase += dt;
      wind.current = wind.base
        + Math.sin(wind.phase * 0.7) * wind.gust * 0.6
        + Math.sin(wind.phase * 1.9 + 1.3) * wind.gust * 0.4;

      this.target.update(dt);
      for (const balloon of this.balloons) balloon.update(dt);
      this.bow.update(dt);
      particles.update(dt);
      this.updateFloaters(dt);

      if (this.state === 'aiming' && aimInput) aimInput(this.bow);

      if (this.state === 'flying' && this.arrow) {
        const event = this.arrow.update(dt, this.env, {
          target: this.target,
          balloons: this.balloons,
          obstacles: this.obstacles,
          maxX: this.target.x + 45,
        });
        this.updateSlowmo();
        if (event) this.resolve(event);
      }

      if (this.state === 'settling') {
        this.settleTimer -= dt;
        if (this.settleTimer <= 0) this.nextArrow();
      }

      this.updateCamera(dt);
    },

    /** Câmera lenta quando a flecha chega perto do centro do alvo. */
    updateSlowmo() {
      if (!this.motionEnabled) {
        this.slowmo = 1;
        return;
      }
      const arrow = this.arrow;
      const distanceToPlane = this.target.x - arrow.x;
      const offCenter = Math.abs(arrow.y - this.target.y);
      const closing = distanceToPlane > 0 && distanceToPlane < 6;
      this.slowmo = closing && offCenter < this.target.radius * (1 + SLOWMO_RADIUS) ? 0.28 : 1;
    },

    resolve(event) {
      // Balões estourados pontuam mesmo que a flecha siga voando.
      for (const balloon of event.popped ?? []) {
        const points = pointsFor({ ring: 0, bonus: balloon.bonus, combo: this.combo });
        this.score += points;
        this.addFloater(balloon.x, balloon.y, `+${points}`, '#f5d23b');
        particles.burst(balloon.x, balloon.y, 22, {
          color: [balloon.color, '#ffffff'],
          speed: 4.5,
          life: 0.7,
          size: 0.06,
        });
        sfx.pop();
        camera.addShake(0.1);
      }

      if (event.type === 'popped') return; // a flecha continua o voo

      if (event.type === 'target') {
        const points = pointsFor({ ring: event.ring, bullseye: event.bullseye, combo: this.combo });
        this.score += points;
        this.shots.push({ ring: event.ring, bullseye: event.bullseye, points });
        this.combo = keepsCombo(event.ring) ? this.combo + 1 : 0;
        this.bestCombo = Math.max(this.bestCombo, this.combo);

        this.target.stickArrow(event.offset, this.arrow.heading);
        this.addFloater(event.x, event.y + 0.6, `${labelFor(event)} +${points}`, event.bullseye ? '#f5d23b' : '#ffffff');

        if (event.bullseye) {
          sfx.bullseye();
          camera.addShake(0.5);
          particles.burst(event.x, event.y, 40, { color: ['#f5d23b', '#ffffff'], speed: 5, life: 0.9, size: 0.05 });
        } else {
          sfx.hit(event.ring);
          camera.addShake(0.22);
          particles.burst(event.x, event.y, 14, { color: ['#d9c9a8', '#ffffff'], speed: 2.5, life: 0.5, size: 0.04 });
        }
      } else if (event.type === 'obstacle') {
        this.shots.push({ ring: 0, bullseye: false, points: 0 });
        this.combo = 0;
        sfx.miss();
        camera.addShake(0.25);
        particles.burst(event.x, event.y, 16, { color: ['#8a8f7a', '#5a6350'], speed: 3, life: 0.6, size: 0.05 });
        this.addFloater(event.x, event.y + 0.5, 'bloqueada', '#ff9f9f');
      } else {
        this.shots.push({ ring: 0, bullseye: false, points: 0 });
        this.combo = 0;
        sfx.miss();
        particles.burst(event.x, Math.max(0.05, event.y), 12, { color: ['#6b5a3a', '#8a7550'], speed: 2, life: 0.5, size: 0.05 });
        const near = this.arrow.closestMiss;
        this.addFloater(
          event.x,
          Math.max(0.6, event.y + 0.5),
          near !== undefined && near < this.target.radius * 2 ? 'quase!' : 'errou',
          '#ff9f9f',
        );
      }

      this.state = 'settling';
      this.settleTimer = SETTLE_TIME;
      this.slowmo = 1;
    },

    nextArrow() {
      this.arrow = null;
      if (!this.infiniteArrows) this.arrowsLeft -= 1;

      if (!this.infiniteArrows && this.arrowsLeft <= 0) {
        this.state = 'finished';
        this.finished = true;
        if (this.stars > 0) sfx.fanfare();
        return;
      }
      this.state = 'aiming';
    },

    // ---------------------------------------------------------------- câmera

    updateCamera(dt) {
      if (this.state === 'flying' && this.arrow) {
        // Segue a flecha, olhando um pouco à frente dela.
        const scale = this.slowmo < 1 ? 52 : Math.max(MIN_AIM_SCALE, this.fitScale() * 1.5);
        const lookAhead = Math.min(6, this.arrow.vx * 0.2);
        camera.lookAt(
          this.arrow.x + lookAhead,
          Math.max(this.arrow.y, this.groundLevelY(scale)),
          scale,
        );
        camera.smoothing = this.slowmo < 1 ? 4 : 9;
      } else {
        // Enquadramento de mira: mostra o campo inteiro (arqueiro → alvo)
        // sempre que isso não deixar a cena pequena demais para ser lida.
        const scale = this.aimScale();
        camera.lookAt(this.aimCenterX(scale), this.groundLevelY(scale), scale);
        camera.smoothing = 5;
      }
      camera.update(dt);
    },

    /**
     * Altura do centro da câmera: coloca a linha do chão a 80% da altura da
     * tela, em qualquer proporção. O que sobra embaixo é grama suficiente para
     * a cena não ficar cortada, e o resto vira céu para a flecha subir.
     */
    groundLevelY(scale) {
      return (0.3 * camera.height) / scale;
    },

    /**
     * Escala usada ao mirar. Abaixo de MIN_AIM_SCALE a cena fica pequena
     * demais para ser lida (o caso do celular em pé num nível longo), então
     * aproximamos e deixamos o alvo sair da tela — a luneta e o marcador de
     * borda cuidam dele.
     */
    aimScale() {
      return Math.max(MIN_AIM_SCALE, this.fitScale());
    },

    /** O campo inteiro cabe na tela sem ficar minúsculo? */
    fieldFits() {
      return this.fitScale() >= MIN_AIM_SCALE;
    },

    /** Centro horizontal da câmera ao mirar. */
    aimCenterX(scale) {
      return this.fieldFits()
        ? (this.target.x + 2) / 2
        : this.bow.x - 2 + camera.width / 2 / scale;
    },

    /** Escala que faz caber o arqueiro, o alvo e o que estiver acima. */
    fitScale() {
      const worldWidth = this.target.x + 7;
      const worldHeight = Math.max(7, this.highestPoint() + 2.5);
      return Math.min(camera.width / worldWidth, camera.height / worldHeight);
    },

    highestPoint() {
      let top = this.target.y + this.target.radius;
      for (const balloon of this.balloons) top = Math.max(top, balloon.y + balloon.radius);
      for (const obstacle of this.obstacles) top = Math.max(top, obstacle.y + obstacle.height);
      return top;
    },

    // ------------------------------------------------------- textos flutuantes

    addFloater(x, y, text, color) {
      this.floaters.push({ x, y, text, color, life: 1.5, maxLife: 1.5 });
    },

    updateFloaters(dt) {
      for (const floater of this.floaters) {
        floater.life -= dt;
        floater.y += dt * 0.9;
      }
      this.floaters = this.floaters.filter((f) => f.life > 0);
    },

    // ---------------------------------------------------------------- desenho

    draw(ctx) {
      drawSky(ctx, camera.width, camera.height);
      drawScenery(ctx, camera, this.scenery, this.time, wind.current);

      for (const obstacle of this.obstacles) obstacle.draw(ctx, camera);
      drawWindFlag(ctx, camera, this.target.x - 2.5, wind.current, this.time);
      this.target.draw(ctx, camera);
      for (const balloon of this.balloons) balloon.draw(ctx, camera);

      if (this.canAim && spec.guide) this.drawGuide(ctx);

      this.bow.draw(ctx, camera, { showString: this.state !== 'flying' || this.bow.recoil > 0 });
      if (this.arrow) this.arrow.draw(ctx, camera);

      particles.draw(ctx, camera);
      this.drawFloaters(ctx);
      if (this.canAim) this.drawAimHint(ctx);
    },

    /** Trajetória prevista, pontilhada e desbotando com a distância. */
    drawGuide(ctx) {
      const points = this.bow.preview(this.env, { maxTime: 2.2, maxX: this.target.x });
      ctx.save();
      for (let i = 2; i < points.length; i += 3) {
        if (points[i].y < 0) break;
        const p = camera.toScreen(points[i].x, points[i].y);
        const fade = Math.max(0, 1 - i / points.length);
        ctx.fillStyle = `rgba(255,255,255,${(fade * 0.55).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, 0.035 * camera.scale * fade + 0.8), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },

    /** Barra de força junto ao arco enquanto se puxa a corda. */
    drawAimHint(ctx) {
      if (!this.bow.dragging) return;
      const anchor = camera.toScreen(this.bow.x, this.bow.y);
      const radius = 46;
      ctx.save();
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, radius, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.stroke();
      ctx.strokeStyle = powerColor(this.bow.power);
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, radius, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * this.bow.power);
      ctx.stroke();
      ctx.restore();
    },

    drawFloaters(ctx) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '600 20px system-ui, sans-serif';
      for (const floater of this.floaters) {
        const p = camera.toScreen(floater.x, floater.y);
        const alpha = Math.min(1, floater.life / floater.maxLife * 1.6);
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.strokeText(floater.text, p.x, p.y);
        ctx.fillStyle = floater.color;
        ctx.fillText(floater.text, p.x, p.y);
      }
      ctx.restore();
    },
  };

  const initialScale = level.aimScale();
  camera.snap(level.aimCenterX(initialScale), level.groundLevelY(initialScale), initialScale);
  return level;
}

function powerColor(power) {
  if (power > 0.85) return '#e2453c';
  if (power > 0.55) return '#f5d23b';
  return '#7ee081';
}

/** Semente estável a partir do id do nível, para o cenário ser sempre o mesmo. */
function hashId(id = '') {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
