/**
 * Cenário: céu, montanhas, árvores, grama e a bandeira do vento.
 * Tudo procedural e determinístico — o mesmo nível desenha sempre igual.
 */

/** Gerador pseudoaleatório com semente, para o cenário não "piscar" entre quadros. */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function createScenery(level, seed = 1234) {
  const random = seeded(seed);
  const span = level.distance + 40;

  const hills = Array.from({ length: 14 }, (_, i) => ({
    x: -20 + (i / 13) * (span + 30),
    height: 8 + random() * 16,
    width: 18 + random() * 22,
  }));

  const trees = Array.from({ length: 18 }, () => ({
    x: -12 + random() * (span + 20),
    height: 2.5 + random() * 3.5,
    depth: 0.35 + random() * 0.4, // parallax: 0 = longe, 1 = perto
  })).filter((t) => Math.abs(t.x - level.distance) > 3 && t.x > 3);

  const grass = Array.from({ length: 160 }, () => ({
    x: -15 + random() * (span + 25),
    height: 0.18 + random() * 0.25,
    lean: random() * 0.6 - 0.3,
  }));

  return { hills, trees, grass, span };
}

export function drawSky(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#1d3557');
  gradient.addColorStop(0.45, '#457b9d');
  gradient.addColorStop(0.8, '#8fc0c9');
  gradient.addColorStop(1, '#e9d8a6');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Sol baixo, atrás de tudo.
  const sun = ctx.createRadialGradient(width * 0.78, height * 0.3, 4, width * 0.78, height * 0.3, height * 0.35);
  sun.addColorStop(0, 'rgba(255, 236, 180, 0.85)');
  sun.addColorStop(1, 'rgba(255, 236, 180, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, width, height);
}

export function drawScenery(ctx, camera, scenery, time, windSpeed) {
  const horizon = camera.toScreen(0, 0).y;

  // Montanhas ao fundo, com parallax (movem-se menos que o mundo).
  for (const hill of scenery.hills) {
    const parallax = 0.35;
    const x = camera.toScreen(camera.x + (hill.x - camera.x) * parallax, 0).x;
    const peak = horizon - hill.height * camera.scale * parallax;
    const half = hill.width * camera.scale * parallax * 0.5;
    ctx.fillStyle = 'rgba(40, 70, 90, 0.55)';
    ctx.beginPath();
    ctx.moveTo(x - half, horizon);
    ctx.lineTo(x, peak);
    ctx.lineTo(x + half, horizon);
    ctx.closePath();
    ctx.fill();
  }

  // Chão.
  ctx.fillStyle = '#3f6b3a';
  ctx.fillRect(0, horizon, camera.width, camera.height - horizon);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, horizon, camera.width, Math.max(1, 0.06 * camera.scale));

  // Árvores, com parallax leve e balanço no vento.
  for (const tree of scenery.trees) {
    const parallax = 0.6 + tree.depth * 0.4;
    const base = camera.toScreen(camera.x + (tree.x - camera.x) * parallax, 0);
    const h = tree.height * camera.scale * parallax;
    if (base.x < -60 || base.x > camera.width + 60) continue;

    const sway = Math.sin(time * 1.4 + tree.x) * windSpeed * 0.006 * h;

    ctx.strokeStyle = '#4a3722';
    ctx.lineWidth = Math.max(1, h * 0.07);
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(base.x + sway * 0.4, base.y - h * 0.45);
    ctx.stroke();

    ctx.fillStyle = tree.depth > 0.6 ? '#2f5b31' : '#27492a';
    ctx.beginPath();
    ctx.ellipse(base.x + sway, base.y - h * 0.7, h * 0.3, h * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Grama em primeiro plano.
  ctx.strokeStyle = '#4e7f41';
  ctx.lineWidth = Math.max(0.8, 0.02 * camera.scale);
  ctx.beginPath();
  for (const blade of scenery.grass) {
    const base = camera.toScreen(blade.x, 0);
    if (base.x < -20 || base.x > camera.width + 20) continue;
    const h = blade.height * camera.scale;
    const lean = blade.lean + Math.sin(time * 2.2 + blade.x * 1.7) * windSpeed * 0.02;
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(base.x + lean * h, base.y - h);
  }
  ctx.stroke();
}

/**
 * Bandeira do vento ao lado do alvo: o jogador lê a força e a direção
 * antes de soltar a flecha.
 */
export function drawWindFlag(ctx, camera, x, wind, time) {
  const base = camera.toScreen(x, 0);
  const top = camera.toScreen(x, 3.2);
  const scale = camera.scale;

  ctx.strokeStyle = '#cfd6de';
  ctx.lineWidth = Math.max(1.5, 0.04 * scale);
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.lineTo(top.x, top.y);
  ctx.stroke();

  const strength = Math.min(1, Math.abs(wind) / 8);
  const direction = Math.sign(wind) || 1;
  const length = (0.4 + strength * 1.3) * scale;
  const droop = (1 - strength) * 0.8 * scale;
  const flutter = Math.sin(time * (4 + strength * 6)) * strength * 0.12 * scale;

  ctx.fillStyle = wind >= 0 ? 'rgba(126, 224, 129, 0.9)' : 'rgba(226, 69, 60, 0.9)';
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.quadraticCurveTo(
    top.x + direction * length * 0.5,
    top.y + droop * 0.4 + flutter,
    top.x + direction * length,
    top.y + droop + flutter,
  );
  ctx.lineTo(top.x + direction * length * 0.85, top.y + droop * 0.5 + flutter);
  ctx.quadraticCurveTo(
    top.x + direction * length * 0.4,
    top.y + droop * 0.2,
    top.x,
    top.y + 0.35 * scale,
  );
  ctx.closePath();
  ctx.fill();
}
