/**
 * Alvos: o alvo principal com anéis, os balões de bônus e os obstáculos.
 * Todos vivem no espaço do mundo (metros) e sabem se desenhar.
 */

import { ringFor, isBullseye, RINGS } from './scoring.js';

/** Cores oficiais dos anéis, do 1 (externo) ao 10 (central). */
const RING_COLORS = [
  '#f7f7f7', '#f7f7f7', // 1-2 branco
  '#1b1b1b', '#1b1b1b', // 3-4 preto
  '#4a9fe0', '#4a9fe0', // 5-6 azul
  '#e2453c', '#e2453c', // 7-8 vermelho
  '#f5d23b', '#f5d23b', // 9-10 amarelo
];

const RING_STROKE = ['#1b1b1b', '#1b1b1b', '#f7f7f7', '#f7f7f7', '#1b1b1b', '#1b1b1b', '#1b1b1b', '#1b1b1b', '#1b1b1b', '#1b1b1b'];

export function createTarget(spec) {
  return {
    x: spec.distance,
    baseY: spec.height ?? 1.3,
    y: spec.height ?? 1.3,
    radius: spec.radius ?? 0.61,
    /** {type:'vertical'|'pendulum'|'none', amplitude, speed} */
    motion: spec.motion ?? { type: 'none' },
    phase: Math.random() * Math.PI * 2,
    arrows: [], // flechas cravadas: {offset, angle}

    update(dt) {
      const m = this.motion;
      if (!m || m.type === 'none') return;
      this.phase += dt * (m.speed ?? 1);
      const amplitude = m.amplitude ?? 1;
      if (m.type === 'vertical') {
        this.y = this.baseY + Math.sin(this.phase) * amplitude;
      } else if (m.type === 'pendulum') {
        // Balanço tipo pêndulo: mais lento nos extremos.
        this.y = this.baseY + Math.sin(this.phase) * amplitude;
        this.x = spec.distance + Math.cos(this.phase * 0.5) * (m.sway ?? 0);
      }
      this.y = Math.max(this.radius + 0.05, this.y);
    },

    /**
     * Avalia um impacto no plano do alvo.
     * @param {number} impactY altura em que a flecha cruzou o plano
     */
    evaluate(impactY) {
      const distance = Math.abs(impactY - this.y);
      const ring = ringFor(distance, this.radius);
      return {
        ring,
        bullseye: ring > 0 && isBullseye(distance, this.radius),
        distance,
        offset: impactY - this.y, // guardado relativo ao centro, para acompanhar o movimento
      };
    },

    stickArrow(offset, angle) {
      this.arrows.push({ offset, angle });
    },

    draw(ctx, camera) {
      const center = camera.toScreen(this.x, this.y);
      const scale = camera.scale;
      const outer = this.radius * scale;

      // Tripé atrás do alvo.
      ctx.strokeStyle = '#6b4b2a';
      ctx.lineWidth = Math.max(1.5, 0.05 * scale);
      const foot = camera.toScreen(this.x, 0);
      ctx.beginPath();
      ctx.moveTo(center.x - outer * 0.5, center.y + outer * 0.3);
      ctx.lineTo(foot.x - outer * 0.35, foot.y);
      ctx.moveTo(center.x + outer * 0.5, center.y + outer * 0.3);
      ctx.lineTo(foot.x + outer * 0.35, foot.y);
      ctx.stroke();

      // Anéis, do externo para o central.
      for (let ring = 1; ring <= RINGS; ring += 1) {
        const radius = ((RINGS - ring + 1) / RINGS) * outer;
        ctx.fillStyle = RING_COLORS[ring - 1];
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = RING_STROKE[ring - 1];
        ctx.lineWidth = Math.max(0.5, outer * 0.012);
        ctx.stroke();
      }

      // Cruz central do X.
      ctx.strokeStyle = '#1b1b1b';
      ctx.lineWidth = Math.max(0.5, outer * 0.015);
      const tick = outer * 0.06;
      ctx.beginPath();
      ctx.moveTo(center.x - tick, center.y);
      ctx.lineTo(center.x + tick, center.y);
      ctx.moveTo(center.x, center.y - tick);
      ctx.lineTo(center.x, center.y + tick);
      ctx.stroke();

      // Flechas cravadas acompanham o alvo enquanto ele se move.
      for (const arrow of this.arrows) {
        drawStuckArrow(ctx, camera, this.x, this.y + arrow.offset, arrow.angle);
      }
    },
  };
}

/** Flecha curta, vista de lado, cravada num ponto. */
export function drawStuckArrow(ctx, camera, x, y, angle) {
  const p = camera.toScreen(x, y);
  const length = 0.75 * camera.scale;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(-angle);
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = Math.max(1, 0.02 * camera.scale);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-length, 0);
  ctx.stroke();
  // Empenas.
  ctx.fillStyle = '#e2453c';
  ctx.beginPath();
  ctx.moveTo(-length, 0);
  ctx.lineTo(-length * 0.78, -length * 0.12);
  ctx.lineTo(-length * 0.72, 0);
  ctx.lineTo(-length * 0.78, length * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Balão de bônus: sobe devagar e estoura ao ser acertado. */
export function createBalloon(spec) {
  return {
    x: spec.x,
    y: spec.y,
    baseY: spec.y,
    radius: spec.radius ?? 0.35,
    bonus: spec.bonus ?? 10,
    color: spec.color ?? '#7ee081',
    popped: false,
    phase: Math.random() * Math.PI * 2,
    drift: spec.drift ?? 0.4,

    update(dt) {
      this.phase += dt * 0.9;
      this.y = this.baseY + Math.sin(this.phase) * this.drift;
    },

    /** Colisão círculo × segmento (a flecha andou de p0 a p1 neste passo). */
    hitBy(p0, p1) {
      if (this.popped) return false;
      return segmentCircleHit(p0, p1, this, this.radius);
    },

    draw(ctx, camera) {
      if (this.popped) return;
      const p = camera.toScreen(this.x, this.y);
      const r = this.radius * camera.scale;

      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + r);
      ctx.quadraticCurveTo(p.x + r * 0.4, p.y + r * 1.8, p.x, p.y + r * 2.6);
      ctx.stroke();

      const gradient = ctx.createRadialGradient(
        p.x - r * 0.35, p.y - r * 0.35, r * 0.1,
        p.x, p.y, r,
      );
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.35, this.color);
      gradient.addColorStop(1, shade(this.color, -30));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r * 0.88, r, 0, 0, Math.PI * 2);
      ctx.fill();
    },
  };
}

/** Obstáculo sólido: a flecha para nele e o tiro é perdido. */
export function createObstacle(spec) {
  return {
    x: spec.x,
    y: spec.y ?? 0,
    width: spec.width ?? 0.4,
    height: spec.height ?? 2,
    color: spec.color ?? '#4a5a3a',

    /** A flecha cruzou o plano do obstáculo dentro da altura dele? */
    blocks(p0, p1) {
      const left = this.x - this.width / 2;
      const right = this.x + this.width / 2;
      // Amostra o segmento: obstáculos são finos e a flecha é rápida.
      const steps = 6;
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        const x = p0.x + (p1.x - p0.x) * t;
        const y = p0.y + (p1.y - p0.y) * t;
        if (x >= left && x <= right && y >= this.y && y <= this.y + this.height) {
          return { x, y };
        }
      }
      return null;
    },

    draw(ctx, camera) {
      const top = camera.toScreen(this.x - this.width / 2, this.y + this.height);
      const w = this.width * camera.scale;
      const h = this.height * camera.scale;
      ctx.fillStyle = this.color;
      ctx.fillRect(top.x, top.y, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(top.x + w * 0.62, top.y, w * 0.38, h);
    },
  };
}

/** Interseção de segmento com círculo — usada por balões. */
export function segmentCircleHit(p0, p1, center, radius) {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const fx = p0.x - center.x;
  const fy = p0.y - center.y;

  const a = dx * dx + dy * dy;
  if (a === 0) return Math.hypot(fx, fy) <= radius;

  let t = -(fx * dx + fy * dy) / a;
  t = Math.max(0, Math.min(1, t));
  const cx = p0.x + dx * t - center.x;
  const cy = p0.y + dy * t - center.y;
  return cx * cx + cy * cy <= radius * radius;
}

/** Clareia (positivo) ou escurece (negativo) uma cor hexadecimal. */
export function shade(hex, amount) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const num = parseInt(full, 16);
  const clamp = (n) => Math.max(0, Math.min(255, n));
  const r = clamp((num >> 16) + amount);
  const g = clamp(((num >> 8) & 0xff) + amount);
  const b = clamp((num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}
