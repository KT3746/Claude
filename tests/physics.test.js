import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GRAVITY,
  launch,
  step,
  simulate,
  headingOf,
  crossVerticalPlane,
  crossHorizontalPlane,
} from '../js/game/physics.js';

const NO_DRAG = { gravity: GRAVITY, drag: 0, wind: 0 };

test('sem arrasto e sem vento, o alcance bate com a fórmula balística', () => {
  const speed = 40;
  const angle = Math.PI / 4;
  const expected = (speed * speed * Math.sin(2 * angle)) / GRAVITY;

  const { state } = simulate(launch(0, 0.0001, angle, speed), NO_DRAG, { dt: 1 / 2000 });

  assert.ok(
    Math.abs(state.x - expected) < 0.2,
    `alcance ${state.x.toFixed(2)} m deveria ser ~${expected.toFixed(2)} m`,
  );
});

test('a trajetória sem arrasto é simétrica em torno do ápice', () => {
  const { points } = simulate(launch(0, 0.0001, Math.PI / 4, 30), NO_DRAG, { dt: 1 / 2000 });
  const apex = points.reduce((best, p) => (p.y > best.y ? p : best), points[0]);
  const range = points[points.length - 1].x;

  assert.ok(
    Math.abs(apex.x - range / 2) < 0.15,
    `ápice em x=${apex.x.toFixed(2)} deveria ficar no meio do alcance ${range.toFixed(2)}`,
  );
});

test('o arrasto encurta o alcance', () => {
  const shot = () => launch(0, 1.5, 0.2, 55);
  const semArrasto = simulate(shot(), { gravity: GRAVITY, drag: 0, wind: 0 }).state.x;
  const comArrasto = simulate(shot(), { gravity: GRAVITY, drag: 0.0022, wind: 0 }).state.x;

  assert.ok(comArrasto < semArrasto, 'com arrasto deveria voar menos');
  assert.ok(comArrasto > semArrasto * 0.7, 'o arrasto não deveria ser absurdo');
});

test('vento de cauda empurra a flecha e vento de frente a segura', () => {
  const shot = () => launch(0, 1.5, 0.2, 50);
  const env = (wind) => ({ gravity: GRAVITY, drag: 0.0022, wind });

  const calmo = simulate(shot(), env(0)).state.x;
  const cauda = simulate(shot(), env(8)).state.x;
  const frente = simulate(shot(), env(-8)).state.x;

  assert.ok(cauda > calmo, 'vento de cauda deveria aumentar o alcance');
  assert.ok(frente < calmo, 'vento de frente deveria reduzir o alcance');
});

test('a flecha aponta para onde está indo', () => {
  const subindo = headingOf({ vx: 10, vy: 10 });
  const descendo = headingOf({ vx: 10, vy: -10 });

  assert.ok(Math.abs(subindo - Math.PI / 4) < 1e-9);
  assert.ok(Math.abs(descendo + Math.PI / 4) < 1e-9);
});

test('step não modifica o estado recebido', () => {
  const original = launch(0, 1.5, 0.3, 40);
  const copia = { ...original };
  step(original, 1 / 120);

  assert.deepEqual(original, copia);
});

test('a colisão por segmento pega o alvo mesmo em alta velocidade', () => {
  // Deslocamento de 1 m por quadro passa por cima de um alvo pontual:
  // só o teste de segmento detecta a passagem pelo plano.
  const p0 = { x: 29.6, y: 1.7 };
  const p1 = { x: 30.6, y: 1.5 };

  const hit = crossVerticalPlane(p0, p1, 30);
  assert.ok(hit, 'deveria detectar a travessia do plano do alvo');
  assert.equal(hit.x, 30);
  assert.ok(Math.abs(hit.y - 1.62) < 1e-9, `y do impacto foi ${hit.y}`);
});

test('crossVerticalPlane devolve null quando o segmento não alcança o plano', () => {
  assert.equal(crossVerticalPlane({ x: 0, y: 1 }, { x: 10, y: 1 }, 30), null);
  assert.equal(crossVerticalPlane({ x: 40, y: 1 }, { x: 50, y: 1 }, 30), null);
  assert.equal(crossVerticalPlane({ x: 5, y: 3 }, { x: 5, y: 0 }, 30), null);
});

test('crossHorizontalPlane acha o ponto onde a flecha crava no chão', () => {
  const hit = crossHorizontalPlane({ x: 10, y: 2 }, { x: 12, y: -2 }, 0);
  assert.ok(hit);
  assert.equal(hit.y, 0);
  assert.ok(Math.abs(hit.x - 11) < 1e-9);
});

test('simulate respeita maxX e para antes de gastar o tempo todo', () => {
  const { state, points } = simulate(launch(0, 1.5, 0.25, 60), undefined, { maxX: 30 });
  assert.ok(state.x >= 30 && state.x < 31, `parou em x=${state.x}`);
  assert.ok(points.length > 1);
});
