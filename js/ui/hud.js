/**
 * HUD desenhado no canvas: pontos, flechas restantes, vento, combo e meta.
 * As telas com botões ficam no DOM (`screens.js`) — aqui só o que precisa
 * acompanhar a ação quadro a quadro.
 */

import { nextStarAt } from '../game/scoring.js';

export function drawHud(ctx, level, { width }) {
  ctx.save();
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.textBaseline = 'middle';

  // Faixa superior translúcida.
  ctx.fillStyle = 'rgba(12, 20, 30, 0.42)';
  ctx.fillRect(0, 0, width, 54);

  // Pontos.
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.fillText(String(level.score), 18, 28);

  ctx.font = '500 12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  const goal = level.infiniteArrows ? null : nextStarAt(level.stars, level.spec.target);
  ctx.fillText(goal ? `próxima estrela: ${goal}` : 'pontos', 18, 44);

  // Flechas restantes, desenhadas como pequenas flechas.
  if (level.infiniteArrows) {
    ctx.textAlign = 'center';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('flechas ∞', width / 2, 27);
  } else {
    const total = level.spec.arrows;
    const spacing = Math.min(16, (width * 0.3) / Math.max(1, total));
    const startX = width / 2 - ((total - 1) * spacing) / 2;
    for (let i = 0; i < total; i += 1) {
      const used = i >= level.arrowsLeft;
      ctx.strokeStyle = used ? 'rgba(255,255,255,0.22)' : '#e6c458';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(startX + i * spacing, 16);
      ctx.lineTo(startX + i * spacing, 38);
      ctx.stroke();
      ctx.fillStyle = used ? 'rgba(255,255,255,0.22)' : '#e2453c';
      ctx.beginPath();
      ctx.moveTo(startX + i * spacing, 12);
      ctx.lineTo(startX + i * spacing - 3.5, 19);
      ctx.lineTo(startX + i * spacing + 3.5, 19);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Vento.
  ctx.textAlign = 'right';
  const wind = level.wind;
  const strength = Math.abs(wind);
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillStyle = strength < 1 ? '#9fe6a0' : strength < 4 ? '#f5d23b' : '#ff8f86';
  ctx.fillText(`${strength.toFixed(1)} m/s`, width - 18, 22);

  // Seta do vento.
  const arrowY = 40;
  const direction = wind >= 0 ? 1 : -1;
  const length = 14 + Math.min(28, strength * 4);
  const cx = width - 18 - length / 2;
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - (length / 2) * direction, arrowY);
  ctx.lineTo(cx + (length / 2) * direction, arrowY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + (length / 2) * direction, arrowY);
  ctx.lineTo(cx + (length / 2 - 6) * direction, arrowY - 4);
  ctx.lineTo(cx + (length / 2 - 6) * direction, arrowY + 4);
  ctx.closePath();
  ctx.fill();

  // Combo em destaque.
  if (level.combo > 0) {
    ctx.textAlign = 'left';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillStyle = '#f5d23b';
    ctx.fillText(`combo ×${(1 + level.combo * 0.5).toFixed(1)}`, 18, 76);
  }

  ctx.restore();
}

/**
 * Luneta: uma janelinha ampliada do alvo.
 *
 * A 40 m de distância o alvo tem poucos pixels na tela — pior ainda no
 * celular. A luneta mostra a mesma cena ampliada, com as flechas já cravadas,
 * para o jogador conseguir ler o resultado e corrigir a mira.
 */
export function drawScope(ctx, level, camera) {
  const size = Math.round(Math.min(160, Math.max(96, camera.width * 0.17)));
  const margin = 14;
  const left = margin;
  const top = 62;
  const cx = left + size / 2;
  const cy = top + size / 2;

  const target = level.target;
  // Zoom que enquadra o alvo inteiro com folga, limitado para não exagerar.
  const zoom = Math.min(camera.scale * 6, (size * 0.42) / target.radius);
  if (zoom <= camera.scale * 1.2) return; // já dá para ver bem sem a luneta

  // Câmera virtual: mesma interface da real, centrada no alvo.
  const lens = {
    scale: zoom,
    width: size,
    height: size,
    toScreen: (x, y) => ({ x: cx + (x - target.x) * zoom, y: cy - (y - target.y) * zoom }),
  };

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = '#5d7f8c';
  ctx.fillRect(left, top, size, size);
  const horizon = lens.toScreen(target.x, 0).y;
  ctx.fillStyle = '#3f6b3a';
  ctx.fillRect(left, horizon, size, size);

  target.draw(ctx, lens);
  if (level.arrow?.alive && Math.abs(level.arrow.x - target.x) < size / 2 / zoom) {
    level.arrow.draw(ctx, lens);
  }
  ctx.restore();

  // Aro e retículo.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - size / 2, cy);
  ctx.lineTo(cx + size / 2, cy);
  ctx.moveTo(cx, cy - size / 2);
  ctx.lineTo(cx, cy + size / 2);
  ctx.stroke();

  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(target.x)} m`, cx, top + size + 14);
  ctx.restore();
}

/**
 * Marcador de borda: quando o alvo não cabe na tela (celular em pé, tiro
 * longo), uma seta na lateral direita mostra em que altura e a que distância
 * ele está.
 */
export function drawOffscreenTarget(ctx, level, camera) {
  const target = level.target;
  const p = camera.toScreen(target.x, target.y);
  if (p.x <= camera.width - 8) return;

  const y = Math.max(80, Math.min(camera.height - 40, p.y));
  const x = camera.width - 22;

  ctx.save();
  ctx.fillStyle = 'rgba(12, 20, 30, 0.6)';
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f5d23b';
  ctx.beginPath();
  ctx.moveTo(x + 8, y);
  ctx.lineTo(x - 5, y - 8);
  ctx.lineTo(x - 5, y + 8);
  ctx.closePath();
  ctx.fill();

  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`${Math.round(target.x)} m`, x - 20, y + 4);
  ctx.restore();
}

/** Dica do nível, some depois do primeiro tiro. */
export function drawHint(ctx, level, { width, height }) {
  if (!level.spec.hint || level.shots.length > 0) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '500 15px system-ui, sans-serif';
  const text = level.spec.hint;
  const metrics = ctx.measureText(text);
  const boxWidth = Math.min(width - 32, metrics.width + 36);
  const x = width / 2;
  const y = height - 54;

  ctx.fillStyle = 'rgba(12, 20, 30, 0.55)';
  roundRect(ctx, x - boxWidth / 2, y - 20, boxWidth, 40, 12);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
