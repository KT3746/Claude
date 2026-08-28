/**
 * A minhoca: estados de movimento e desenho.
 *
 * Ela não é um corpo físico honesto — é uma cápsula que segue regras de jogo.
 * Andar é dar passos de um pixel tentando subir ou descer um degrau; só o voo
 * é física de verdade. É o que faz o movimento parecer o do original em vez
 * de parecer um motor de física genérico.
 *
 * Colisão por SONDA DE 5 PONTOS (pés, dois flancos em duas alturas, cabeça),
 * não por varredura da cápsula inteira: é barato, previsível, e nunca gruda
 * numa quina.
 */

import { avancar, refletir } from './ballistics.js';
import { danoDeQueda } from './damage.js';

export const LARGURA = 0.55;
export const ALTURA = 0.95;
export const VIDA_MAX = 100;

const MEIA = LARGURA / 2;
export const VELOCIDADE = 2.4;   // m/s andando
const DEGRAU = 0.32;        // altura de degrau que sobe e desce sem pular
const PASSO_SONDA = 0.05;   // 1 px a 20 px/m
const PARADA = 0.35;        // abaixo disso, considera-se em repouso

export const PULOS = {
  frente: { vx: 3.2, vy: 6.3 },
  costas: { vx: -1.9, vy: 9.0 },
};

export function createWorm({ nome, equipe, x, y }) {
  return {
    nome,
    equipe,
    x,
    y,
    vx: 0,
    vy: 0,
    vida: VIDA_MAX,
    vivo: true,
    estado: 'voando',       // 'parada' | 'andando' | 'voando'
    direcao: 1,             // para onde olha: 1 direita, -1 esquerda
    angulo: Math.PI / 4,    // mira, em radianos
    tempoNoAr: 0,
    quedaMaxima: 0,
    restoDoPasso: 0,       // sobra de movimento menor que um pixel         // maior velocidade de queda desde que saiu do chão
    afogando: false,
    piscar: 0,
  };
}

// ---------------------------------------------------------------- sondas

/** A cápsula da minhoca encosta em terreno se posicionada em (x, y)? */
export function colide(terreno, x, y) {
  return (
    terreno.solidoEm(x, y + 0.06) ||
    terreno.solidoEm(x - MEIA, y + 0.28) ||
    terreno.solidoEm(x + MEIA, y + 0.28) ||
    terreno.solidoEm(x - MEIA, y + 0.70) ||
    terreno.solidoEm(x + MEIA, y + 0.70) ||
    terreno.solidoEm(x, y + ALTURA - 0.06)
  );
}

/** Tem chão logo abaixo dos pés? */
export function apoiada(terreno, x, y) {
  return terreno.solidoEm(x, y - 0.04);
}

// -------------------------------------------------------------- movimento

/**
 * Um passo de 1 px na horizontal, com degrau para cima e para baixo.
 * @returns {boolean} false se bateu numa parede alta demais
 */
function passoHorizontal(terreno, w, dir) {
  const nx = w.x + dir * PASSO_SONDA;

  if (!colide(terreno, nx, w.y)) {
    // Caminho livre: procura chão até um degrau abaixo (descer rampa colada).
    for (let d = 0; d <= DEGRAU + 1e-9; d += PASSO_SONDA) {
      const ny = w.y - d;
      if (colide(terreno, nx, ny)) break;
      if (apoiada(terreno, nx, ny)) {
        w.x = nx;
        w.y = ny;
        return true;
      }
    }
    // Nada embaixo: andou para fora da beirada e cai.
    w.x = nx;
    w.estado = 'voando';
    w.vx = dir * 1.1;
    w.vy = 0;
    w.quedaMaxima = 0;
    return true;
  }

  // Bloqueado: tenta subir um degrau.
  for (let h = PASSO_SONDA; h <= DEGRAU + 1e-9; h += PASSO_SONDA) {
    const ny = w.y + h;
    if (!colide(terreno, nx, ny)) {
      w.x = nx;
      w.y = ny;
      return true;
    }
  }
  return false;
}

/**
 * Anda enquanto o comando estiver pressionado. `dir` é -1 ou 1.
 *
 * Cada passo move um pixel inteiro, mas um quadro quase nunca vale um número
 * redondo de pixels: a sobra fica guardada em `restoDoPasso`. Sem isso, um
 * quadro de 1/120 s pediria 2 cm e andaria 5, e a minhoca sairia correndo
 * duas vezes e meia mais rápido do que a velocidade configurada.
 */
export function andar(w, terreno, dir, dt) {
  if (!w.vivo || w.estado === 'voando') return;
  if (dir !== w.direcao) w.restoDoPasso = 0;
  w.direcao = dir;
  w.estado = 'andando';

  w.restoDoPasso += VELOCIDADE * dt;
  while (w.restoDoPasso >= PASSO_SONDA) {
    w.restoDoPasso -= PASSO_SONDA;
    if (!passoHorizontal(terreno, w, dir) || w.estado === 'voando') {
      w.restoDoPasso = 0;
      break;
    }
  }
}

/** Pulo curto para frente ou cambalhota para trás. */
export function pular(w, terreno, tipo = 'frente') {
  if (!w.vivo || w.estado === 'voando') return false;
  if (!apoiada(terreno, w.x, w.y)) return false;
  const p = PULOS[tipo] ?? PULOS.frente;
  w.restoDoPasso = 0;
  w.vx = p.vx * w.direcao;
  w.vy = p.vy;
  w.estado = 'voando';
  w.quedaMaxima = 0;
  return true;
}

/** Empurrão de explosão: joga a minhoca no ar. */
export function empurrar(w, ix, iy) {
  if (!w.vivo) return;
  w.restoDoPasso = 0;
  w.vx += ix;
  w.vy += iy;
  w.estado = 'voando';
  w.quedaMaxima = 0;
}

/**
 * Um passo de física. Só a minhoca no ar integra de verdade; no chão ela
 * apenas confere se o terreno sumiu debaixo dela (uma cratera, por exemplo).
 *
 * @returns {{dano:number, causa:string}|null} dano de queda, se houve
 */
export function atualizar(w, terreno, dt, env) {
  if (!w.vivo) return null;

  if (w.estado !== 'voando') {
    w.vx = 0;
    w.vy = 0;
    if (!apoiada(terreno, w.x, w.y)) {
      w.estado = 'voando';
      w.quedaMaxima = 0;
    } else if (colide(terreno, w.x, w.y)) {
      // O terreno cresceu por baixo (ou ela nasceu meio enterrada): sobe.
      for (let h = PASSO_SONDA; h <= 1.2; h += PASSO_SONDA) {
        if (!colide(terreno, w.x, w.y + h)) {
          w.y += h;
          break;
        }
      }
    }
    w.tempoNoAr = 0;
    return null;
  }

  w.tempoNoAr += dt;
  const semVento = { ...env, vento: 0 }; // minhoca não é levada pelo vento
  const r = avancar(w, dt, semVento, (x, y) => colide(terreno, x, y));

  w.quedaMaxima = Math.min(w.quedaMaxima, r.estado.vy);

  if (!r.impacto) {
    w.x = r.estado.x;
    w.y = r.estado.y;
    w.vx = r.estado.vx;
    w.vy = r.estado.vy;
    return null;
  }

  // Bateu: volta ao último ponto livre e decide entre parar ou resvalar.
  w.x = r.impacto.livreX;
  w.y = r.impacto.livreY;

  const velocidade = Math.hypot(r.estado.vx, r.estado.vy);
  const queda = w.quedaMaxima;

  if (velocidade < PARADA || apoiada(terreno, w.x, w.y)) {
    w.vx = 0;
    w.vy = 0;
    w.estado = 'parada';
    w.tempoNoAr = 0;
    const dano = danoDeQueda(queda);
    w.quedaMaxima = 0;
    return dano > 0 ? { dano, causa: 'queda' } : null;
  }

  // Resvalo em parede ou teto: perde bastante energia, sem quicar como bola.
  const n = terreno.normalEm(w.x, w.y, 0.3);
  const v = refletir(r.estado, n, 0.15, 0.45);
  w.vx = v.vx;
  w.vy = v.vy;
  return null;
}

/** Está em repouso o bastante para o turno poder virar? */
export function estaParada(w) {
  return !w.vivo || (w.estado !== 'voando' && Math.abs(w.vx) < 0.05 && Math.abs(w.vy) < 0.05);
}

/** Ponta do cano da arma, de onde o projétil sai. */
export function bocaDaArma(w, distancia = 0.75) {
  const cy = w.y + ALTURA * 0.55;
  return {
    x: w.x + Math.cos(w.angulo) * w.direcao * distancia,
    y: cy + Math.sin(w.angulo) * distancia,
    cx: w.x,
    cy,
  };
}

// ----------------------------------------------------------------- desenho

const CORES_EQUIPE = [
  { corpo: '#e8534a', escuro: '#a8352e', capacete: '#f2b134' },
  { corpo: '#4aa3e8', escuro: '#2c6a9c', capacete: '#d7dde3' },
  { corpo: '#7bc65f', escuro: '#4d8a38', capacete: '#e2e8b0' },
  { corpo: '#c77be8', escuro: '#8a4da3', capacete: '#efd7f7' },
];

export function coresDaEquipe(indice) {
  return CORES_EQUIPE[indice % CORES_EQUIPE.length];
}

/**
 * Desenha a minhoca em vetor — sem sprite, como todo o resto do projeto.
 */
export function desenharMinhoca(ctx, w, camera, { ativa = false, cores } = {}) {
  if (!w.vivo) return;
  const c = cores ?? coresDaEquipe(w.equipe);
  const p = camera.toScreen(w.x, w.y);
  const e = camera.scale; // pixels por metro

  // Pisca quando acabou de tomar dano.
  if (w.piscar > 0 && Math.floor(w.piscar * 12) % 2 === 0) return;

  const alturaPx = ALTURA * e;
  const larguraPx = LARGURA * e;
  const cx = p.x;
  const base = p.y;

  ctx.save();

  // Sombra no chão.
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, base, larguraPx * 0.55, larguraPx * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Corpo: cápsula levemente inclinada para a direção do olhar.
  const topo = base - alturaPx;
  const raio = larguraPx * 0.5;
  const gradiente = ctx.createLinearGradient(cx - raio, topo, cx + raio, base);
  gradiente.addColorStop(0, c.corpo);
  gradiente.addColorStop(1, c.escuro);

  ctx.fillStyle = gradiente;
  ctx.beginPath();
  ctx.moveTo(cx - raio, base - raio * 0.6);
  ctx.quadraticCurveTo(cx - raio, topo + raio, cx, topo + raio * 0.55);
  ctx.quadraticCurveTo(cx + raio, topo + raio, cx + raio, base - raio * 0.6);
  ctx.quadraticCurveTo(cx + raio, base, cx, base);
  ctx.quadraticCurveTo(cx - raio, base, cx - raio, base - raio * 0.6);
  ctx.fill();

  // Capacete da equipe.
  ctx.fillStyle = c.capacete;
  ctx.beginPath();
  ctx.arc(cx, topo + raio * 0.75, raio * 0.78, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();
  ctx.fillRect(cx - raio * 0.85, topo + raio * 0.6, raio * 1.7, raio * 0.2);

  // Olhos, olhando para onde a minhoca mira.
  const olhoX = cx + w.direcao * raio * 0.28;
  const olhoY = topo + raio * 1.35;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(olhoX - raio * 0.16, olhoY, raio * 0.2, 0, Math.PI * 2);
  ctx.arc(olhoX + raio * 0.16, olhoY, raio * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#141c24';
  const pupila = w.direcao * raio * 0.07;
  ctx.beginPath();
  ctx.arc(olhoX - raio * 0.16 + pupila, olhoY, raio * 0.1, 0, Math.PI * 2);
  ctx.arc(olhoX + raio * 0.16 + pupila, olhoY, raio * 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Nome e vida flutuando acima.
  desenharPlaca(ctx, w, c, cx, base - alturaPx - e * 0.45, e, ativa);
}

function desenharPlaca(ctx, w, cores, cx, cy, escala, ativa) {
  const fonte = Math.max(10, Math.min(16, escala * 0.42));
  ctx.save();
  ctx.font = `600 ${fonte}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  const texto = `${w.nome}  ${Math.max(0, Math.round(w.vida))}`;
  const largura = ctx.measureText(texto).width + fonte * 0.9;
  const altura = fonte * 1.5;

  ctx.fillStyle = 'rgba(9, 16, 26, 0.62)';
  ctx.beginPath();
  ctx.roundRect(cx - largura / 2, cy - altura, largura, altura, fonte * 0.4);
  ctx.fill();

  if (ativa) {
    ctx.strokeStyle = cores.capacete;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.fillStyle = cores.corpo;
  ctx.fillText(texto, cx, cy - fonte * 0.28);
  ctx.restore();

  // Seta indicando de quem é a vez.
  if (ativa) {
    const t = Date.now() / 300;
    const oscila = Math.sin(t) * escala * 0.12;
    ctx.fillStyle = cores.capacete;
    ctx.beginPath();
    ctx.moveTo(cx, cy - altura - escala * 0.18 + oscila);
    ctx.lineTo(cx - escala * 0.2, cy - altura - escala * 0.5 + oscila);
    ctx.lineTo(cx + escala * 0.2, cy - altura - escala * 0.5 + oscila);
    ctx.closePath();
    ctx.fill();
  }
}
