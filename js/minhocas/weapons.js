/**
 * O arsenal, em tabela — no mesmo espírito de `js/game/levels.js`.
 *
 * O motor sabe executar cada `tipo`; uma arma nova é uma linha aqui, não um
 * arquivo novo. Os seis tipos previstos são `projetil`, `granada`, `hitscan`,
 * `soltavel`, `dirigivel` e `utilitario`; esta entrega usa os três primeiros
 * necessários para uma partida completa.
 */

export const ARMAS = [
  {
    id: 'bazuca',
    nome: 'Bazuca',
    tipo: 'projetil',
    tecla: 'Digit1',
    municao: Infinity,
    vento: true,            // a única arma daqui que o vento entorta
    velocidadeMax: 26,      // m/s com a força no máximo
    raio: 2.4,              // raio da explosão, em metros
    dano: 45,
    impulso: 11,
    encerraTurno: true,
    miravel: true,
    dica: 'Leia o vento antes de soltar.',
  },
  {
    id: 'granada',
    nome: 'Granada',
    tipo: 'granada',
    tecla: 'Digit2',
    municao: Infinity,
    vento: false,
    velocidadeMax: 20,
    raio: 2.2,
    dano: 40,
    impulso: 10,
    pavio: 3,               // segundos
    restituicao: 0.42,      // quica
    atrito: 0.3,
    encerraTurno: true,
    miravel: true,
    ajustavel: true,        // o pavio muda com 1–5
    dica: 'Quica. Use 1 a 5 para mudar o pavio.',
  },
  {
    id: 'dinamite',
    nome: 'Dinamite',
    tipo: 'soltavel',
    tecla: 'Digit3',
    municao: Infinity,
    vento: false,
    raio: 3.2,
    dano: 65,
    impulso: 13,
    pavio: 5,
    restituicao: 0.1,
    atrito: 0.75,
    encerraTurno: true,
    miravel: false,         // larga no pé, não mira
    dica: 'Larga no chão. Corra.',
  },
];

export function armaPorId(id) {
  return ARMAS.find((a) => a.id === id) ?? ARMAS[0];
}
