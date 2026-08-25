/**
 * Física da flecha — funções puras, sem DOM.
 *
 * Sistema de coordenadas do mundo: metros, x cresce para a direita,
 * y cresce para CIMA (o chão fica em y = 0). A conversão para a tela,
 * onde y cresce para baixo, é feita pela câmera.
 */

/** Aceleração da gravidade (m/s²). */
export const GRAVITY = 9.81;

/**
 * Coeficiente de arrasto reduzido da flecha (1/m).
 * A desaceleração é `k · |v|²`, então uma flecha a 60 m/s perde ~9 m/s
 * ao longo de 70 m — próximo o bastante do comportamento real para o jogo.
 */
export const DRAG = 0.0022;

/** Passo fixo da integração da física (s). */
export const PHYSICS_DT = 1 / 120;

/** Ambiente padrão: sem vento, gravidade e arrasto normais. */
export const DEFAULT_ENV = { gravity: GRAVITY, drag: DRAG, wind: 0 };

/**
 * Cria o estado inicial de uma flecha disparada.
 *
 * @param {number} x posição inicial (m)
 * @param {number} y posição inicial (m)
 * @param {number} angle ângulo de lançamento em radianos (0 = horizontal, positivo = para cima)
 * @param {number} speed velocidade inicial (m/s)
 */
export function launch(x, y, angle, speed) {
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  };
}

/**
 * Avança o estado da flecha em um passo de tempo (Euler semi-implícito).
 *
 * O arrasto age sobre a velocidade do ar *relativa*: com vento de cauda a
 * flecha desacelera menos, com vento de frente desacelera mais — e é assim
 * que o vento lateral empurra a flecha, sem uma força extra artificial.
 *
 * @param {{x:number,y:number,vx:number,vy:number}} state
 * @param {number} dt
 * @param {{gravity?:number, drag?:number, wind?:number}} [env]
 * @returns {{x:number,y:number,vx:number,vy:number}} novo estado (o original não é modificado)
 */
export function step(state, dt, env = DEFAULT_ENV) {
  const gravity = env.gravity ?? GRAVITY;
  const drag = env.drag ?? DRAG;
  const wind = env.wind ?? 0;

  // Velocidade relativa ao ar.
  const rx = state.vx - wind;
  const ry = state.vy;
  const speed = Math.hypot(rx, ry);

  const ax = -drag * speed * rx;
  const ay = -drag * speed * ry - gravity;

  const vx = state.vx + ax * dt;
  const vy = state.vy + ay * dt;

  return {
    x: state.x + vx * dt,
    y: state.y + vy * dt,
    vx,
    vy,
  };
}

/**
 * Ângulo em que a flecha aponta: sempre alinhado ao vetor velocidade.
 * @param {{vx:number, vy:number}} state
 */
export function headingOf(state) {
  return Math.atan2(state.vy, state.vx);
}

/**
 * Simula a trajetória inteira e devolve os pontos percorridos.
 * Usado tanto pela trajetória fantasma da mira quanto pelos testes.
 *
 * @param {{x:number,y:number,vx:number,vy:number}} state estado inicial
 * @param {object} [env] ambiente (gravidade, arrasto, vento)
 * @param {{dt?:number, maxTime?:number, groundY?:number, maxX?:number}} [opts]
 * @returns {{points: {x:number,y:number}[], state: object, time: number}}
 */
export function simulate(state, env = DEFAULT_ENV, opts = {}) {
  const dt = opts.dt ?? PHYSICS_DT;
  const maxTime = opts.maxTime ?? 12;
  const groundY = opts.groundY ?? 0;
  const maxX = opts.maxX ?? Infinity;

  let current = { ...state };
  const points = [{ x: current.x, y: current.y }];
  let time = 0;

  while (time < maxTime && current.y > groundY && current.x < maxX) {
    current = step(current, dt, env);
    time += dt;
    points.push({ x: current.x, y: current.y });
  }

  return { points, state: current, time };
}

/**
 * Interseção do segmento p0→p1 com o plano vertical x = planeX.
 *
 * Testar o segmento inteiro (e não só a posição final) impede que uma flecha
 * rápida "atravesse" o alvo entre dois quadros.
 *
 * @returns {{x:number, y:number, t:number}|null} ponto de impacto, ou null
 */
export function crossVerticalPlane(p0, p1, planeX) {
  const dx = p1.x - p0.x;
  if (dx === 0) return null;
  const t = (planeX - p0.x) / dx;
  if (t < 0 || t > 1) return null;
  return { x: planeX, y: p0.y + (p1.y - p0.y) * t, t };
}

/**
 * Interseção do segmento p0→p1 com o plano horizontal y = planeY
 * (usado para a flecha cravar no chão no ponto certo).
 *
 * @returns {{x:number, y:number, t:number}|null}
 */
export function crossHorizontalPlane(p0, p1, planeY) {
  const dy = p1.y - p0.y;
  if (dy === 0) return null;
  const t = (planeY - p0.y) / dy;
  if (t < 0 || t > 1) return null;
  return { x: p0.x + (p1.x - p0.x) * t, y: planeY, t };
}
