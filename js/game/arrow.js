/**
 * A flecha em voo: integra a física, guarda o rastro e resolve as colisões
 * contra alvo, balões, obstáculos e chão.
 */

import { step, headingOf, crossVerticalPlane, crossHorizontalPlane } from './physics.js';

const TRAIL_MAX = 26;

export function createArrow(state) {
  return {
    ...state,
    prev: { x: state.x, y: state.y },
    trail: [],
    alive: true,
    /** Motivo do fim do voo: 'target' | 'obstacle' | 'ground' | 'out' */
    result: null,
    /** Ângulo congelado no instante do impacto (ver `stop`). */
    finalHeading: 0,

    // `stop()` zera vx/vy para a flecha ficar parada — por isso o ângulo real
    // do impacto precisa ser lido ANTES disso e guardado à parte; sem isso,
    // toda flecha cravada renderizaria horizontal (atan2(0,0) = 0).
    get heading() {
      return this.alive ? headingOf(this) : this.finalHeading;
    },

    /**
     * Avança um passo de física e resolve colisões.
     *
     * @returns {object|null} evento de colisão, ou null se ainda está voando
     */
    update(dt, env, world) {
      if (!this.alive) return null;

      this.prev = { x: this.x, y: this.y };
      const next = step(this, dt, env);
      this.x = next.x;
      this.y = next.y;
      this.vx = next.vx;
      this.vy = next.vy;

      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > TRAIL_MAX) this.trail.shift();

      const p0 = this.prev;
      const p1 = { x: this.x, y: this.y };

      // 1. Balões: podem ser estourados no caminho sem parar a flecha.
      const popped = [];
      for (const balloon of world.balloons ?? []) {
        if (balloon.hitBy(p0, p1)) {
          balloon.popped = true;
          popped.push(balloon);
        }
      }

      // 2. Obstáculos param a flecha.
      for (const obstacle of world.obstacles ?? []) {
        const block = obstacle.blocks(p0, p1);
        if (block) {
          this.stop('obstacle', block.x, block.y);
          return { type: 'obstacle', x: block.x, y: block.y, popped };
        }
      }

      // 3. Plano do alvo — testado no segmento para não atravessar em alta velocidade.
      const target = world.target;
      if (target) {
        const cross = crossVerticalPlane(p0, p1, target.x);
        if (cross) {
          const evaluation = target.evaluate(cross.y);
          if (evaluation.ring > 0) {
            this.stop('target', cross.x, cross.y);
            return { type: 'target', ...evaluation, x: cross.x, y: cross.y, popped };
          }
          // Passou raspando: segue o voo, mas registramos o quão perto foi.
          this.closestMiss = Math.min(this.closestMiss ?? Infinity, evaluation.distance);
        }
      }

      // 4. Chão.
      if (this.y <= 0) {
        const ground = crossHorizontalPlane(p0, p1, 0) ?? { x: this.x, y: 0 };
        this.stop('ground', ground.x, ground.y);
        return { type: 'ground', x: ground.x, y: 0, popped };
      }

      // 5. Saiu do mundo (passou muito do alvo ou voltou para trás).
      const limit = world.maxX ?? (target ? target.x + 40 : 200);
      if (this.x > limit || this.x < -20) {
        this.stop('out', this.x, this.y);
        return { type: 'out', x: this.x, y: this.y, popped };
      }

      return popped.length ? { type: 'popped', popped } : null;
    },

    stop(result, x, y) {
      this.finalHeading = headingOf(this);
      this.alive = false;
      this.result = result;
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
    },

    /** Distância percorrida na horizontal, para o HUD. */
    get distance() {
      return this.x;
    },

    draw(ctx, camera) {
      // Rastro.
      if (this.trail.length > 1) {
        ctx.lineCap = 'round';
        for (let i = 1; i < this.trail.length; i += 1) {
          const a = camera.toScreen(this.trail[i - 1].x, this.trail[i - 1].y);
          const b = camera.toScreen(this.trail[i].x, this.trail[i].y);
          const alpha = (i / this.trail.length) * 0.5;
          ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
          ctx.lineWidth = Math.max(0.8, (i / this.trail.length) * 0.05 * camera.scale);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      const p = camera.toScreen(this.x, this.y);
      const length = 0.85 * camera.scale;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(-this.heading);

      // Haste.
      ctx.strokeStyle = '#e6c458';
      ctx.lineWidth = Math.max(1.2, 0.024 * camera.scale);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-length, 0);
      ctx.stroke();

      // Ponta.
      ctx.fillStyle = '#cfd6de';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-length * 0.16, -length * 0.07);
      ctx.lineTo(-length * 0.16, length * 0.07);
      ctx.closePath();
      ctx.fill();

      // Empenas.
      ctx.fillStyle = '#e2453c';
      ctx.beginPath();
      ctx.moveTo(-length, 0);
      ctx.lineTo(-length * 0.76, -length * 0.13);
      ctx.lineTo(-length * 0.7, 0);
      ctx.lineTo(-length * 0.76, length * 0.13);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    },
  };
}
