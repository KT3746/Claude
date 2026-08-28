/**
 * A partida: mundo, equipes, ordem de jogo, vento, água e regras.
 *
 * É aqui que os módulos puros se encontram com a câmera, as partículas e o
 * som. A lógica que dá para testar sem navegador mora nos outros arquivos —
 * este é o fio que costura tudo.
 */

import { createRng, randomSeed } from '../engine/rng.js';
import { sfx } from '../engine/audio.js';

import { gerarTerreno } from './terrain-gen.js';
import { createTerrain } from './terrain.js';
import { createTurnMachine, FASE } from './turn.js';
import { ARMAS, armaPorId } from './weapons.js';
import { createProjectile, atualizarProjetil, projetilParado, desenharProjetil } from './projectile.js';
import { explosao } from './damage.js';
import { GRAVIDADE, ARRASTO } from './ballistics.js';
import * as Worm from './worm.js';

const NOMES = [
  'Tico', 'Bala', 'Rabo', 'Zé', 'Pipa', 'Nino', 'Vovô', 'Chico',
  'Dona', 'Lelê', 'Bento', 'Tuca', 'Juju', 'Meme', 'Zóio', 'Pila',
];

/** Explosão da minhoca que morre — é o que encadeia mortes. */
const EXPLOSAO_DE_MORTE = { raio: 1.9, dano: 28, impulso: 8 };

/** A água sobe isto por turno depois da morte súbita. */
const SUBIDA_AGUA = 0.22;

/** Forma de uma nuvem: deslocamento e raio de cada bolha, em unidades de escala. */
const BOLHAS_DE_NUVEM = [
  [-1.6, 0.15, 0.85],
  [-0.6, -0.25, 1.15],
  [0.6, -0.1, 1.0],
  [1.7, 0.2, 0.75],
];

export function createMatch({
  semente = randomSeed(),
  equipes = [
    { nome: 'Vermelhos', minhocas: 4 },
    { nome: 'Azuis', minhocas: 4 },
  ],
  camera,
  particles,
  motionEnabled = true,
  tempoTurno = 45,
} = {}) {
  const rng = createRng(semente);
  const dados = gerarTerreno({ rng });
  const terreno = createTerrain(dados);
  terreno.repintarTudo(); // ainda na tela de carregamento: nenhum quadro de jogo paga por isto

  camera.setBounds({ minX: 0, maxX: terreno.largura, minY: 0, maxY: terreno.altura });

  // ---------------------------------------------------------- equipes

  const nomesDisponiveis = rng.shuffle([...NOMES]);
  let contadorNomes = 0;

  const pontos = escolherNascimentos(
    terreno.nascimentos,
    equipes.reduce((n, e) => n + e.minhocas, 0),
    rng,
  );

  let p = 0;
  const times = equipes.map((cfg, indice) => {
    const minhocas = [];
    for (let i = 0; i < cfg.minhocas; i += 1) {
      const ponto = pontos[p] ?? terreno.nascimentos[0];
      p += 1;
      minhocas.push(Worm.createWorm({
        nome: nomesDisponiveis[contadorNomes++ % nomesDisponiveis.length],
        equipe: indice,
        x: ponto.x,
        y: ponto.y + 0.1,
      }));
    }
    return {
      nome: cfg.nome,
      indice,
      cores: Worm.coresDaEquipe(indice),
      minhocas,
      atual: -1,
      get vida() {
        return minhocas.reduce((s, w) => s + (w.vivo ? Math.max(0, w.vida) : 0), 0);
      },
      get viva() {
        return minhocas.some((w) => w.vivo);
      },
    };
  });

  const todas = times.flatMap((t) => t.minhocas);

  // ------------------------------------------------------------ estado

  const estado = {
    semente,
    terreno,
    times,
    todas,
    projeteis: [],
    vento: 0,
    nivelAgua: terreno.nivelAgua,
    ativa: null,
    equipeDaVez: -1,
    arma: ARMAS[0],
    pavio: 3,
    carga: 0,
    carregando: false,
    mensagem: '',
    tempoMensagem: 0,
    motionEnabled,
    slowmo: 1,
    tempoAgua: 0,
    fimDeJogo: false,
    vencedor: null,
  };

  const ambiente = () => ({ gravidade: GRAVIDADE, arrasto: ARRASTO, vento: estado.vento });

  // ------------------------------------------------------- turnos

  const turnos = createTurnMachine({
    tempoTurno,
    equipes: times.length,
    hooks: {
      aoPreparar() {
        estado.carga = 0;
        estado.carregando = false;
        estado.arma = ARMAS[0];
        estado.pavio = ARMAS[1].pavio;
        estado.vento = Math.round(rng.range(-9, 9) * 10) / 10;
        estado.ativa = proximaMinhoca();
        if (estado.ativa) {
          camera.lookAt(estado.ativa.x, estado.ativa.y + 1, 26);
          sfx.vez();
        }
      },
      aoDisparar() {
        estado.carregando = false;
      },
      aoResolver: resolverConsequencias,
      aoMorteSubita() {
        anunciar('Morte súbita! A água está subindo.');
        sfx.sirene();
      },
      aoSubirAgua() {
        estado.nivelAgua += SUBIDA_AGUA;
      },
      aoFim(vencedor) {
        estado.fimDeJogo = true;
        estado.vencedor = vencedor;
      },
    },
  });

  function proximaMinhoca() {
    for (let salto = 1; salto <= times.length; salto += 1) {
      const idx = (estado.equipeDaVez + salto) % times.length;
      const time = times[idx];
      if (!time.viva) continue;
      estado.equipeDaVez = idx;
      for (let k = 1; k <= time.minhocas.length; k += 1) {
        const j = (time.atual + k) % time.minhocas.length;
        if (time.minhocas[j].vivo) {
          time.atual = j;
          return time.minhocas[j];
        }
      }
    }
    return null;
  }

  function anunciar(texto, segundos = 2.6) {
    estado.mensagem = texto;
    estado.tempoMensagem = segundos;
  }

  // ---------------------------------------------------- consequências

  /**
   * Roda entre o "tudo parou" e o próximo turno: mata quem chegou a zero,
   * afoga quem passou da linha d'água e devolve `true` se algo aconteceu —
   * o que faz a máquina esperar tudo assentar de novo (mortes em cadeia).
   */
  function resolverConsequencias() {
    let houve = false;

    for (const w of todas) {
      if (!w.vivo) continue;

      if (w.y < estado.nivelAgua) {
        w.vivo = false;
        respingar(w.x, estado.nivelAgua);
        sfx.respingo();
        anunciar(`${w.nome} se afogou.`);
        houve = true;
        continue;
      }

      if (w.vida <= 0) {
        w.vivo = false;
        w.vida = 0;
        detonar(w.x, w.y + Worm.ALTURA * 0.4, EXPLOSAO_DE_MORTE);
        anunciar(`${w.nome} explodiu.`);
        houve = true;
      }
    }

    return houve;
  }

  function contexto() {
    const vivas = times.filter((t) => t.viva);
    return {
      tudoParado: todas.every(Worm.estaParada) && estado.projeteis.every(projetilParado),
      projeteisAtivos: estado.projeteis.length,
      equipesVivas: vivas.length,
      equipeVencedora: vivas.length === 1 ? vivas[0] : null,
    };
  }

  // ------------------------------------------------------- explosões

  function detonar(x, y, arma) {
    terreno.explodir(x, y, arma.raio);

    for (const efeito of explosao(todas, x, y, arma)) {
      const w = efeito.corpo;
      w.vida -= efeito.dano;
      w.piscar = 0.45;
      Worm.empurrar(w, efeito.impulso.x, efeito.impulso.y);
      if (efeito.dano > 4) sfx.ai();
    }

    // Detritos com a cor de quem foi atingido, fumaça e clarão.
    const quantidade = Math.round(24 + arma.raio * 12);
    for (let i = 0; i < quantidade; i += 1) {
      const a = rng.range(0, Math.PI * 2);
      const v = rng.range(2, 4 + arma.raio * 2.2);
      particles.spawn({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v + 2,
        life: rng.range(0.5, 1.4),
        size: rng.range(0.05, 0.16),
        color: i % 4 === 0 ? '#6aa84f' : '#96653e',
        gravity: 11,
        drag: 0.5,
      });
    }
    for (let i = 0; i < 14; i += 1) {
      particles.spawn({
        x: x + rng.range(-arma.raio, arma.raio) * 0.5,
        y: y + rng.range(-arma.raio, arma.raio) * 0.5,
        vx: rng.range(-1.2, 1.2),
        vy: rng.range(0.6, 2.4),
        life: rng.range(0.7, 1.6),
        size: rng.range(0.2, 0.5),
        color: 'rgba(226, 226, 226, 0.45)',
        gravity: -1.2,
        drag: 1.6,
      });
    }

    camera.addShake(Math.min(1, arma.raio * 0.22));
    sfx.explosao(arma.raio);
  }

  function respingar(x, y) {
    for (let i = 0; i < 26; i += 1) {
      particles.spawn({
        x: x + rng.range(-0.4, 0.4),
        y,
        vx: rng.range(-2.4, 2.4),
        vy: rng.range(2.5, 6.5),
        life: rng.range(0.4, 1),
        size: rng.range(0.05, 0.13),
        color: '#7fc4e8',
        gravity: 12,
        drag: 0.6,
      });
    }
  }

  // ---------------------------------------------------------- comandos

  const comandos = {
    andar(dir, dt) {
      if (!podeAgir()) return;
      Worm.andar(estado.ativa, terreno, dir, dt);
    },

    mirar(delta) {
      if (!podeAgir()) return;
      const w = estado.ativa;
      w.angulo = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, w.angulo + delta));
    },

    virar(dir) {
      if (!podeAgir()) return;
      estado.ativa.direcao = dir;
    },

    pular(tipo) {
      if (!podeAgir()) return;
      Worm.pular(estado.ativa, terreno, tipo);
    },

    trocarArma(id) {
      if (!turnos.podeAtirar || estado.carregando) return;
      estado.arma = armaPorId(id);
    },

    ajustarPavio(segundos) {
      if (!turnos.podeAtirar) return;
      estado.pavio = Math.max(1, Math.min(5, segundos));
    },

    /** Começa a carregar a força do tiro. */
    carregar() {
      if (!turnos.podeAtirar || !estado.ativa) return;
      if (estado.arma.tipo === 'soltavel') {
        soltar();
        return;
      }
      estado.carregando = true;
      estado.carga = 0;
    },

    /** Solta e dispara com a força acumulada. */
    disparar() {
      if (!estado.carregando) return;
      soltar();
    },
  };

  function podeAgir() {
    return turnos.podeControlar && estado.ativa?.vivo && !estado.fimDeJogo;
  }

  function soltar() {
    const w = estado.ativa;
    if (!w || !turnos.podeAtirar) return;
    const arma = estado.arma;
    const boca = Worm.bocaDaArma(w);

    let projetil;
    if (arma.tipo === 'soltavel') {
      projetil = createProjectile({
        arma,
        x: w.x + w.direcao * 0.35,
        y: w.y + 0.25,
        vx: 0,
        vy: 0,
        dono: w,
        pavio: arma.pavio,
      });
    } else {
      const velocidade = arma.velocidadeMax * Math.max(0.12, estado.carga);
      projetil = createProjectile({
        arma,
        x: boca.x,
        y: boca.y,
        vx: Math.cos(w.angulo) * w.direcao * velocidade,
        vy: Math.sin(w.angulo) * velocidade,
        dono: w,
        pavio: arma.tipo === 'granada' ? estado.pavio : arma.pavio,
      });
      sfx.disparo();
    }

    estado.projeteis.push(projetil);
    estado.carregando = false;
    estado.carga = 0;
    turnos.disparou(arma);
  }

  // ------------------------------------------------------------ update

  function update(dt) {
    estado.tempoAgua += dt;
    if (estado.tempoMensagem > 0) estado.tempoMensagem -= dt;

    for (const w of todas) {
      if (w.piscar > 0) w.piscar -= dt;
      const queda = Worm.atualizar(w, terreno, dt, ambiente());
      if (queda) {
        w.vida -= queda.dano;
        w.piscar = 0.4;
        sfx.ai();
      }
      // Passou da linha d'água: some na hora, o resto resolve na fase certa.
      if (w.vivo && w.y < estado.nivelAgua - 0.6) {
        w.vy = Math.max(w.vy, -1.5);
      }
    }

    if (estado.carregando) {
      estado.carga = Math.min(1, estado.carga + dt * 1.35);
      if (estado.carga >= 1) soltar();
    }

    atualizarProjeteis(dt);
    particles.update(dt);
    turnos.update(dt, contexto());
    seguirCamera(dt);

    // Câmera lenta no instante em que um tiro decide a partida.
    estado.slowmo = 1;
    camera.update(dt);
  }

  function atualizarProjeteis(dt) {
    for (let i = estado.projeteis.length - 1; i >= 0; i -= 1) {
      const p = estado.projeteis[i];
      const antes = Math.hypot(p.vx, p.vy);
      const r = atualizarProjetil(p, terreno, dt, ambiente());

      // Rastro de fumaça do foguete.
      p.fumaca -= dt;
      if (p.arma.tipo === 'projetil' && p.fumaca <= 0) {
        p.fumaca = 0.02;
        particles.spawn({
          x: p.x,
          y: p.y,
          vx: rng.range(-0.3, 0.3),
          vy: rng.range(0, 0.6),
          life: rng.range(0.4, 0.9),
          size: rng.range(0.08, 0.2),
          color: 'rgba(220, 220, 220, 0.5)',
          gravity: -0.8,
          drag: 1.8,
        });
      }
      if (antes > 2 && Math.hypot(p.vx, p.vy) < antes * 0.7 && p.arma.pavio) sfx.quique();

      // Caiu na água: apaga sem explodir.
      if (p.y < estado.nivelAgua) {
        respingar(p.x, estado.nivelAgua);
        sfx.respingo();
        estado.projeteis.splice(i, 1);
        continue;
      }

      if (r === 'explodir') {
        detonar(p.x, p.y, p.arma);
        estado.projeteis.splice(i, 1);
      }
    }
  }

  function seguirCamera(dt) {
    if (estado.projeteis.length > 0) {
      // Segue o projétil mais alto — é o que o jogador está acompanhando.
      const alvo = estado.projeteis.reduce((a, b) => (b.y > a.y ? b : a));
      camera.lookAt(alvo.x, alvo.y, 24);
      return;
    }
    if (estado.ativa?.vivo) {
      camera.lookAt(estado.ativa.x, estado.ativa.y + 1.2, 26);
    }
  }

  // ------------------------------------------------------------ desenho

  function desenhar(ctx) {
    desenharCeu(ctx);
    terreno.repintar(2);
    terreno.desenhar(ctx, camera);
    desenharAgua(ctx);

    for (const time of times) {
      for (const w of time.minhocas) {
        Worm.desenharMinhoca(ctx, w, camera, {
          ativa: w === estado.ativa && turnos.podeControlar,
          cores: time.cores,
        });
      }
    }

    if (podeAgir() && estado.ativa) desenharMira(ctx);

    particles.draw(ctx, camera);

    for (const p of estado.projeteis) desenharProjetil(ctx, p, camera);
  }

  function desenharCeu(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, camera.height);
    g.addColorStop(0, '#1d3c63');
    g.addColorStop(0.55, '#4d7ea8');
    g.addColorStop(1, '#9dbfc9');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, camera.width, camera.height);

    // Nuvens em parallax: cada uma é um punhado de bolhas sobrepostas, porque
    // uma elipse sozinha lê como mancha de interface, não como nuvem.
    for (let i = 0; i < 10; i += 1) {
      const base = (i * 31.7) % terreno.largura;
      const camadaY = terreno.altura * (0.74 + (i % 3) * 0.08);
      const fator = 0.2 + (i % 3) * 0.14;   // camadas mais distantes andam menos
      const x = base - camera.x * fator + camera.x;
      const centro = camera.toScreen(x, camadaY);
      if (centro.x < -300 || centro.x > camera.width + 300) continue;

      const escala = camera.scale * (1.1 + (i % 4) * 0.3);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + (i % 3) * 0.035})`;
      ctx.beginPath();
      for (const [dx, dy, r] of BOLHAS_DE_NUVEM) {
        ctx.ellipse(centro.x + dx * escala, centro.y + dy * escala, r * escala, r * escala * 0.62, 0, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }

  function desenharAgua(ctx) {
    const topo = camera.toScreen(0, estado.nivelAgua).y;
    if (topo > camera.height) return;

    const g = ctx.createLinearGradient(0, topo, 0, camera.height);
    g.addColorStop(0, 'rgba(64, 150, 196, 0.62)');
    g.addColorStop(1, 'rgba(16, 52, 92, 0.92)');
    ctx.fillStyle = g;

    ctx.beginPath();
    ctx.moveTo(0, camera.height);
    ctx.lineTo(0, topo);
    // Duas senoides somadas dão uma ondulação que não parece um metrônomo.
    for (let x = 0; x <= camera.width; x += 8) {
      const onda =
        Math.sin(x * 0.018 + estado.tempoAgua * 1.6) * 3 +
        Math.sin(x * 0.007 - estado.tempoAgua * 0.9) * 5;
      ctx.lineTo(x, topo + onda);
    }
    ctx.lineTo(camera.width, camera.height);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(226, 245, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= camera.width; x += 8) {
      const onda =
        Math.sin(x * 0.018 + estado.tempoAgua * 1.6) * 3 +
        Math.sin(x * 0.007 - estado.tempoAgua * 0.9) * 5;
      if (x === 0) ctx.moveTo(x, topo + onda);
      else ctx.lineTo(x, topo + onda);
    }
    ctx.stroke();
  }

  /**
   * Mira: uma cruz na direção apontada e a barra de força carregando.
   * De propósito NÃO existe linha de trajetória — adivinhar o arco é o jogo.
   */
  function desenharMira(ctx) {
    const w = estado.ativa;
    if (!estado.arma.miravel) return;

    const boca = Worm.bocaDaArma(w, 0);
    const alcance = 2.6;
    const alvoX = boca.x + Math.cos(w.angulo) * w.direcao * alcance;
    const alvoY = boca.y + Math.sin(w.angulo) * alcance;
    const origem = camera.toScreen(boca.x, boca.y);
    const ponta = camera.toScreen(alvoX, alvoY);

    ctx.save();
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(origem.x, origem.y);
    ctx.lineTo(ponta.x, ponta.y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = '#ffd24a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ponta.x, ponta.y, 7, 0, Math.PI * 2);
    ctx.moveTo(ponta.x - 11, ponta.y);
    ctx.lineTo(ponta.x - 3, ponta.y);
    ctx.moveTo(ponta.x + 3, ponta.y);
    ctx.lineTo(ponta.x + 11, ponta.y);
    ctx.stroke();

    if (estado.carregando) {
      const largura = camera.scale * 1.8;
      const altura = 7;
      const x = origem.x - largura / 2;
      const y = camera.toScreen(w.x, w.y + Worm.ALTURA + 1.4).y;
      ctx.fillStyle = 'rgba(9, 16, 26, 0.6)';
      ctx.fillRect(x - 1, y - 1, largura + 2, altura + 2);
      const cor = estado.carga < 0.45 ? '#7bc65f' : estado.carga < 0.8 ? '#ffd24a' : '#e2453c';
      ctx.fillStyle = cor;
      ctx.fillRect(x, y, largura * estado.carga, altura);
    }

    ctx.restore();
  }

  return {
    estado,
    turnos,
    terreno,
    comandos,
    times,
    update,
    desenhar,
    get FASE() {
      return FASE;
    },
    get fase() {
      return turnos.fase;
    },
    get relogio() {
      return turnos.relogio;
    },
    get fimDeJogo() {
      return estado.fimDeJogo;
    },
  };
}

/**
 * Escolhe pontos de nascimento espalhados: pega o candidato mais distante de
 * todos os já escolhidos, para nenhuma equipe começar encurralada num canto.
 */
function escolherNascimentos(candidatos, quantos, rng) {
  if (candidatos.length === 0) return [];
  const restantes = [...candidatos];
  const escolhidos = [restantes.splice(rng.int(0, restantes.length), 1)[0]];

  while (escolhidos.length < quantos && restantes.length > 0) {
    let melhor = 0;
    let melhorDistancia = -1;
    for (let i = 0; i < restantes.length; i += 1) {
      let perto = Infinity;
      for (const e of escolhidos) {
        perto = Math.min(perto, Math.abs(restantes[i].x - e.x));
      }
      if (perto > melhorDistancia) {
        melhorDistancia = perto;
        melhor = i;
      }
    }
    escolhidos.push(restantes.splice(melhor, 1)[0]);
  }

  // Alterna a ordem para as equipes ficarem intercaladas no mapa.
  return rng.shuffle(escolhidos);
}
