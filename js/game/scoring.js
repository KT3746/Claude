/**
 * Pontuação — funções puras, sem DOM.
 *
 * O alvo segue a convenção da World Archery: dez anéis concêntricos, o mais
 * externo valendo 1 e o central valendo 10. O miolo do 10 é o "X", que não
 * vale pontos extras mas é usado como critério de desempate e para o efeito
 * de câmera lenta.
 */

/** Número de anéis do alvo. */
export const RINGS = 10;

/** Fração do raio do alvo ocupada pelo X (metade do anel do 10). */
export const X_RING_FRACTION = 0.05;

/**
 * Anel atingido a partir da distância do centro.
 *
 * @param {number} distance distância do centro do alvo (m)
 * @param {number} targetRadius raio do alvo, ou seja, borda externa do anel 1 (m)
 * @returns {number} 10..1, ou 0 se a flecha passou fora do alvo
 */
export function ringFor(distance, targetRadius) {
  if (!(targetRadius > 0) || distance < 0) return 0;
  if (distance > targetRadius) return 0;
  const band = distance / targetRadius; // 0 no centro, 1 na borda
  const ring = RINGS - Math.floor(band * RINGS);
  return Math.min(RINGS, Math.max(1, ring));
}

/**
 * A flecha acertou o X (miolo do 10)?
 * @param {number} distance distância do centro (m)
 * @param {number} targetRadius raio do alvo (m)
 */
export function isBullseye(distance, targetRadius) {
  return targetRadius > 0 && distance <= targetRadius * X_RING_FRACTION;
}

/**
 * Multiplicador de combo: acertos consecutivos em 9 ou 10 aumentam o combo.
 * O combo satura em 5× para o placar não explodir.
 *
 * @param {number} combo número de acertos "bons" consecutivos já acumulados
 */
export function comboMultiplier(combo) {
  return Math.min(5, 1 + Math.max(0, combo) * 0.5);
}

/** Um acerto conta para o combo? */
export function keepsCombo(ring) {
  return ring >= 9;
}

/**
 * Pontos de um tiro.
 *
 * @param {object} hit
 * @param {number} hit.ring anel atingido (0 = erro)
 * @param {boolean} [hit.bullseye] acertou o X
 * @param {number} [hit.combo] combo ANTES deste tiro
 * @param {number} [hit.bonus] pontos extras (balão, maçã, alvo bônus)
 * @returns {number} pontos inteiros
 */
export function pointsFor({ ring, bullseye = false, combo = 0, bonus = 0 }) {
  if (ring <= 0 && bonus <= 0) return 0;
  const base = ring + (bullseye ? 5 : 0) + bonus;
  return Math.round(base * comboMultiplier(combo));
}

/**
 * Estrelas conquistadas no nível.
 * 1 estrela = meta, 2 = 130% da meta, 3 = 165% da meta.
 *
 * @param {number} score pontos feitos
 * @param {number} targetScore meta do nível
 * @returns {0|1|2|3}
 */
export function starsFor(score, targetScore) {
  if (!(targetScore > 0)) return 0;
  if (score >= targetScore * 1.65) return 3;
  if (score >= targetScore * 1.3) return 2;
  if (score >= targetScore) return 1;
  return 0;
}

/** Pontuação necessária para a próxima estrela (null se já tem 3). */
export function nextStarAt(stars, targetScore) {
  if (stars >= 3) return null;
  const factor = [1, 1.3, 1.65][stars];
  return Math.ceil(targetScore * factor);
}

/** Rótulo curto de um acerto, para o texto flutuante. */
export function labelFor({ ring, bullseye = false }) {
  if (bullseye) return 'X!';
  if (ring <= 0) return 'errou';
  return String(ring);
}
