import test from 'node:test';
import assert from 'node:assert/strict';

import { ARMAS, MINI_FRAGMENTO, armaPorId, indiceDaArma, armaSeguinte } from '../js/minhocas/weapons.js';

const TIPOS_VALIDOS = new Set(['projetil', 'granada', 'hitscan', 'soltavel', 'dirigivel', 'utilitario']);

test('toda arma tem um id único e um tipo reconhecido pelo motor', () => {
  const ids = new Set();
  for (const arma of ARMAS) {
    assert.ok(TIPOS_VALIDOS.has(arma.tipo), `${arma.id} tem tipo desconhecido: ${arma.tipo}`);
    assert.equal(ids.has(arma.id), false, `id duplicado: ${arma.id}`);
    ids.add(arma.id);
    assert.equal(typeof arma.nome, 'string');
    assert.ok(arma.nome.length > 0);
    assert.equal(typeof arma.dica, 'string');
  }
});

test('arma de área (projetil, granada, soltavel, dirigivel) tem raio, dano e impulso', () => {
  for (const arma of ARMAS) {
    if (arma.tipo === 'hitscan') continue;
    assert.ok(arma.raio > 0, `${arma.id} sem raio de explosão`);
    assert.ok(arma.dano > 0, `${arma.id} sem dano`);
    assert.ok(arma.impulso >= 0, `${arma.id} com impulso inválido`);
  }
});

test('arma hitscan tem alcance, disparos e dica de furo no terreno', () => {
  const hitscan = ARMAS.filter((a) => a.tipo === 'hitscan');
  assert.ok(hitscan.length >= 2, 'esperava pelo menos escopeta e sniper');
  for (const arma of hitscan) {
    assert.ok(arma.alcanceMax > 0, `${arma.id} sem alcance`);
    assert.ok(arma.disparos >= 1, `${arma.id} sem número de disparos`);
    assert.ok(arma.dano > 0, `${arma.id} sem dano`);
    assert.equal(arma.recuoImediato, true, `${arma.id} tem de recuar na hora — não tem tempo de voo`);
  }
});

test('arma que quica (granada, soltavel não-instantâneo) tem restituição e atrito', () => {
  for (const arma of ARMAS) {
    if (arma.tipo !== 'granada' && !(arma.tipo === 'soltavel' && !arma.assentaSemExplodir)) continue;
    if (arma.tipo === 'soltavel' && arma.pavio === undefined && !arma.assentaSemExplodir) continue;
    assert.ok(arma.restituicao >= 0 && arma.restituicao <= 1, `${arma.id}: restituição fora de [0,1]`);
    assert.ok(arma.atrito >= 0 && arma.atrito <= 1, `${arma.id}: atrito fora de [0,1]`);
  }
});

test('a mina explode por proximidade, nunca ao tocar o chão', () => {
  const mina = armaPorId('mina');
  assert.equal(mina.assentaSemExplodir, true);
  assert.ok(mina.proximidade > 0);
  assert.ok(mina.atraso > 0, 'sem atraso, a mina explodiria em quem acabou de largá-la');
});

test('a ovelha e o míssil são dirigíveis, mas com modos diferentes', () => {
  const ovelha = armaPorId('ovelha');
  const missil = armaPorId('missil');
  assert.equal(ovelha.tipo, 'dirigivel');
  assert.equal(ovelha.modo, 'andar');
  assert.equal(missil.tipo, 'dirigivel');
  assert.equal(missil.modo, 'reto');
});

test('a granada de fragmentação declara o cacho de submunições', () => {
  const frag = armaPorId('fragmentacao');
  assert.ok(frag.cacho);
  assert.ok(frag.cacho.quantidade >= 2);
  assert.ok(frag.cacho.velocidadeMax > frag.cacho.velocidadeMin);
});

test('o fragmento do cacho não aparece no arsenal do jogador', () => {
  assert.equal(ARMAS.some((a) => a.id === MINI_FRAGMENTO.id), false);
  assert.equal(MINI_FRAGMENTO.oculta, true);
});

test('armaPorId cai na primeira arma para um id desconhecido', () => {
  assert.equal(armaPorId('não existe'), ARMAS[0]);
});

test('o carrossel de armas percorre a lista inteira e dá a volta', () => {
  let arma = ARMAS[0];
  const vistas = new Set([arma.id]);
  for (let i = 0; i < ARMAS.length; i += 1) {
    arma = armaSeguinte(arma, 1);
    vistas.add(arma.id);
  }
  assert.equal(vistas.size, ARMAS.length, 'o carrossel tem de passar por todas as armas');
  assert.equal(arma, ARMAS[0], 'depois de dar a volta completa, retorna à primeira');
});

test('o carrossel anda para trás simetricamente', () => {
  const a = armaSeguinte(ARMAS[0], 1);
  const voltou = armaSeguinte(a, -1);
  assert.equal(voltou, ARMAS[0]);
});

test('indiceDaArma bate com a posição real na tabela', () => {
  ARMAS.forEach((arma, i) => assert.equal(indiceDaArma(arma), i));
});
