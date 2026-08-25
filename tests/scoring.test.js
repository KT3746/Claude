import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RINGS,
  ringFor,
  isBullseye,
  comboMultiplier,
  keepsCombo,
  pointsFor,
  starsFor,
  nextStarAt,
  labelFor,
} from '../js/game/scoring.js';

const R = 0.61; // raio do alvo WA de 122 cm

test('o centro vale 10 e a borda vale 1', () => {
  assert.equal(ringFor(0, R), 10);
  assert.equal(ringFor(R * 0.999, R), 1);
});

test('cada anel ocupa uma faixa igual do raio', () => {
  for (let ring = 1; ring <= RINGS; ring += 1) {
    const meio = ((RINGS - ring + 0.5) / RINGS) * R;
    assert.equal(ringFor(meio, R), ring, `raio ${meio.toFixed(3)} deveria ser o anel ${ring}`);
  }
});

test('fora do alvo é zero', () => {
  assert.equal(ringFor(R * 1.01, R), 0);
  assert.equal(ringFor(5, R), 0);
});

test('entradas inválidas não quebram a pontuação', () => {
  assert.equal(ringFor(0.1, 0), 0);
  assert.equal(ringFor(-1, R), 0);
});

test('o X é o miolo do anel do 10', () => {
  assert.ok(isBullseye(0, R));
  assert.ok(isBullseye(R * 0.04, R));
  assert.ok(!isBullseye(R * 0.09, R));
  assert.equal(ringFor(R * 0.04, R), 10, 'todo X também é um 10');
});

test('o combo multiplica e satura em 5x', () => {
  assert.equal(comboMultiplier(0), 1);
  assert.equal(comboMultiplier(2), 2);
  assert.equal(comboMultiplier(20), 5);
  assert.equal(comboMultiplier(-3), 1, 'combo negativo não penaliza');
});

test('só 9 e 10 mantêm o combo', () => {
  assert.ok(keepsCombo(10));
  assert.ok(keepsCombo(9));
  assert.ok(!keepsCombo(8));
  assert.ok(!keepsCombo(0));
});

test('pontos somam anel, bônus do X e combo', () => {
  assert.equal(pointsFor({ ring: 7 }), 7);
  assert.equal(pointsFor({ ring: 10, bullseye: true }), 15);
  assert.equal(pointsFor({ ring: 10, bullseye: true, combo: 2 }), 30);
  assert.equal(pointsFor({ ring: 0 }), 0);
});

test('um alvo bônus pontua mesmo sem anel', () => {
  assert.equal(pointsFor({ ring: 0, bonus: 12 }), 12);
});

test('estrelas seguem a meta do nível', () => {
  const meta = 100;
  assert.equal(starsFor(99, meta), 0);
  assert.equal(starsFor(100, meta), 1);
  assert.equal(starsFor(130, meta), 2);
  assert.equal(starsFor(165, meta), 3);
  assert.equal(starsFor(400, meta), 3, 'não passa de 3 estrelas');
  assert.equal(starsFor(50, 0), 0, 'meta inválida não dá estrela');
});

test('nextStarAt mostra a próxima meta', () => {
  assert.equal(nextStarAt(0, 100), 100);
  assert.equal(nextStarAt(1, 100), 130);
  assert.equal(nextStarAt(2, 100), 165);
  assert.equal(nextStarAt(3, 100), null);
});

test('os rótulos do texto flutuante', () => {
  assert.equal(labelFor({ ring: 10, bullseye: true }), 'X!');
  assert.equal(labelFor({ ring: 8 }), '8');
  assert.equal(labelFor({ ring: 0 }), 'errou');
});
