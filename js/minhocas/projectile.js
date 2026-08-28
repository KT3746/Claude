/**
 * Execução dos projéteis. Cada `tipo` da tabela de armas é tratado aqui.
 *
 * `projetil` explode no primeiro contato; `granada` e `soltavel` quicam usando
 * a normal do terreno e explodem quando o pavio acaba.
 */

import { avancar, refletir } from './ballistics.js';

export function createProjectile({ arma, x, y, vx = 0, vy = 0, dono = null, pavio }) {
  return {
    arma,
    x,
    y,
    vx,
    vy,
    dono,
    pavio: pavio ?? arma.pavio ?? 0,
    vivo: true,
    fumaca: 0,
    giro: 0,
    apoiado: false,
  };
}

/**
 * Um passo do projétil.
 * @returns {'voando'|'explodir'}
 */
export function atualizarProjetil(p, terreno, dt, env) {
  if (!p.vivo) return 'explodir';

  const ambiente = p.arma.vento ? env : { ...env, vento: 0 };
  const r = avancar(p, dt, ambiente, (x, y) => terreno.solidoEm(x, y));

  p.giro += (Math.abs(p.vx) + Math.abs(p.vy)) * dt * 0.6;

  if (p.pavio > 0) {
    p.pavio -= dt;
    if (p.pavio <= 0) return 'explodir';
  }

  if (!r.impacto) {
    p.x = r.estado.x;
    p.y = r.estado.y;
    p.vx = r.estado.vx;
    p.vy = r.estado.vy;
    p.apoiado = false;
    return 'voando';
  }

  // Explode ao encostar (bazuca, morteiro).
  if (!p.arma.pavio) {
    p.x = r.impacto.x;
    p.y = r.impacto.y;
    return 'explodir';
  }

  // Quica: volta ao último ponto livre e reflete na normal da superfície.
  p.x = r.impacto.livreX;
  p.y = r.impacto.livreY;

  const n = terreno.normalEm(r.impacto.x, r.impacto.y, 0.25);
  const v = refletir(r.estado, n, p.arma.restituicao ?? 0.42, p.arma.atrito ?? 0.3);
  p.vx = v.vx;
  p.vy = v.vy;

  // Quase parado sobre uma superfície: assenta em vez de tremer no lugar.
  if (Math.hypot(p.vx, p.vy) < 0.6) {
    p.vx = 0;
    p.vy = 0;
    p.apoiado = true;
  }

  return 'voando';
}

/** Está parado o bastante para o turno poder virar? */
export function projetilParado(p) {
  return p.apoiado || Math.hypot(p.vx, p.vy) < 0.2;
}

export function desenharProjetil(ctx, p, camera) {
  const s = camera.toScreen(p.x, p.y);
  const e = camera.scale;
  const r = Math.max(3, e * 0.17);

  ctx.save();
  ctx.translate(s.x, s.y);

  if (p.arma.tipo === 'projetil') {
    // Foguete, apontado para onde vai.
    ctx.rotate(Math.atan2(-p.vy, p.vx));
    ctx.fillStyle = '#d9dee4';
    ctx.beginPath();
    ctx.moveTo(r * 1.9, 0);
    ctx.lineTo(-r * 1.1, -r * 0.62);
    ctx.lineTo(-r * 1.1, r * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e2453c';
    ctx.fillRect(-r * 1.2, -r * 0.62, r * 0.6, r * 1.24);
  } else {
    ctx.rotate(p.giro);
    ctx.fillStyle = p.arma.tipo === 'soltavel' ? '#b8452f' : '#3f5a3a';
    ctx.beginPath();
    ctx.roundRect(-r * 0.7, -r, r * 1.4, r * 2, r * 0.5);
    ctx.fill();

    // Pavio piscando cada vez mais rápido conforme o tempo acaba.
    const restante = Math.max(0, p.pavio);
    const piscaRapido = restante < 1.2;
    const aceso = Math.floor(Date.now() / (piscaRapido ? 90 : 220)) % 2 === 0;
    ctx.fillStyle = aceso ? '#ffd24a' : '#7a6030';
    ctx.beginPath();
    ctx.arc(0, -r * 1.15, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
