/**
 * Tabela declarativa dos níveis. Tudo o que muda de um nível para o outro
 * mora aqui — `level.js` só interpreta estes dados.
 *
 * Campos:
 *   distance   distância do alvo (m)
 *   height     altura do centro do alvo (m)
 *   radius     raio do alvo (m); 0.61 = alvo WA de 122 cm
 *   arrows     flechas disponíveis
 *   target     pontuação necessária para 1 estrela
 *   wind       {base, gust} vento constante (m/s, positivo = de cauda) e amplitude da rajada
 *   motion     movimento do alvo: {type:'vertical'|'pendulum', amplitude, speed, sway}
 *   balloons   alvos bônus [{x, y, bonus, color}]
 *   obstacles  obstáculos sólidos [{x, y, width, height}]
 *   guide      mostra a trajetória prevista ao mirar
 */

export const LEVELS = [
  {
    id: 'l1',
    name: 'Primeiro tiro',
    hint: 'Puxe a corda para trás e solte. A linha pontilhada mostra o caminho da flecha.',
    distance: 18,
    height: 1.3,
    arrows: 6,
    target: 42,
    wind: { base: 0, gust: 0 },
    guide: true,
  },
  {
    id: 'l2',
    name: 'Mais longe',
    hint: 'Quanto mais longe, mais força e mais ângulo. A gravidade cobra o preço.',
    distance: 30,
    height: 1.3,
    arrows: 6,
    target: 46,
    wind: { base: 0, gust: 0 },
    guide: true,
  },
  {
    id: 'l3',
    name: 'Brisa leve',
    hint: 'O vento empurra a flecha. Repare na bandeira antes de soltar.',
    distance: 30,
    height: 1.3,
    arrows: 6,
    target: 52,
    wind: { base: 3.5, gust: 0.8 },
    guide: true,
    balloons: [{ x: 22, y: 4.2, bonus: 8, color: '#7ee081' }],
  },
  {
    id: 'l4',
    name: 'Alvo alto',
    hint: 'O alvo subiu. Suba junto o ângulo, não só a força.',
    distance: 34,
    height: 4.2,
    arrows: 6,
    target: 50,
    wind: { base: -2.5, gust: 1 },
    guide: true,
  },
  {
    id: 'l5',
    name: 'Sobe e desce',
    hint: 'O alvo se move. Mire onde ele vai estar, não onde ele está.',
    distance: 32,
    height: 3,
    arrows: 6,
    target: 50,
    wind: { base: 0, gust: 1.5 },
    motion: { type: 'vertical', amplitude: 1.4, speed: 1.1 },
  },
  {
    id: 'l6',
    name: 'Muro no caminho',
    hint: 'Passe por cima. Um arco alto perde velocidade — compense com força.',
    distance: 38,
    height: 1.4,
    arrows: 6,
    target: 54,
    wind: { base: 2, gust: 1 },
    obstacles: [{ x: 20, y: 0, width: 0.6, height: 4.5 }],
    balloons: [{ x: 29, y: 6, bonus: 10, color: '#f5d23b' }],
  },
  {
    id: 'l7',
    name: 'Vento de frente',
    hint: 'Vento contra encurta o tiro. Puxe mais.',
    distance: 45,
    height: 1.6,
    arrows: 6,
    target: 48,
    wind: { base: -6, gust: 2 },
  },
  {
    id: 'l8',
    name: 'Alvo pequeno',
    hint: 'Metade do tamanho, o dobro da atenção.',
    distance: 40,
    height: 2.2,
    radius: 0.34,
    arrows: 7,
    target: 62,
    wind: { base: 3, gust: 1.5 },
    balloons: [
      { x: 24, y: 5.5, bonus: 8, color: '#7ee081' },
      { x: 33, y: 7, bonus: 12, color: '#e879f9' },
    ],
  },
  {
    id: 'l9',
    name: 'Pêndulo',
    hint: 'O alvo balança e ainda muda de distância. Tenha paciência.',
    distance: 42,
    height: 3.6,
    arrows: 7,
    target: 58,
    wind: { base: -3, gust: 2 },
    motion: { type: 'pendulum', amplitude: 1.8, speed: 1.2, sway: 1.5 },
  },
  {
    id: 'l10',
    name: 'Corredor estreito',
    hint: 'Dois muros e uma janela. Só uma trajetória passa.',
    distance: 48,
    height: 2,
    radius: 0.45,
    arrows: 7,
    target: 58,
    wind: { base: 2.5, gust: 1.5 },
    obstacles: [
      { x: 18, y: 0, width: 0.6, height: 3.5 },
      { x: 32, y: 6.5, width: 0.6, height: 8 },
    ],
  },
  {
    id: 'l11',
    name: 'Rajadas',
    hint: 'O vento muda a cada instante. Solte no momento certo.',
    distance: 55,
    height: 2.4,
    radius: 0.45,
    arrows: 8,
    target: 72,
    wind: { base: 0, gust: 6.5 },
    balloons: [
      { x: 30, y: 8, bonus: 12, color: '#f5d23b' },
      { x: 44, y: 5.5, bonus: 15, color: '#e879f9' },
    ],
  },
  {
    id: 'l12',
    name: 'Mestre do arco',
    hint: 'Alvo pequeno, longe, em movimento, com vento e obstáculo. Boa sorte.',
    distance: 65,
    height: 4,
    radius: 0.3,
    arrows: 8,
    target: 68,
    wind: { base: -4.5, gust: 4 },
    motion: { type: 'vertical', amplitude: 1.6, speed: 1.4 },
    obstacles: [{ x: 34, y: 0, width: 0.6, height: 5 }],
    balloons: [{ x: 50, y: 9, bonus: 18, color: '#e879f9' }],
  },
];

/** Nível de prática: sem vento, flechas infinitas, trajetória sempre visível. */
export const PRACTICE = {
  id: 'practice',
  name: 'Prática',
  hint: 'Flechas infinitas, sem vento. Use para calibrar a mira.',
  distance: 30,
  height: 1.3,
  arrows: Infinity,
  target: 0,
  wind: { base: 0, gust: 0 },
  guide: true,
};

export function levelByIndex(index) {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, index))];
}
