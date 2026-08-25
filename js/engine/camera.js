/**
 * Câmera 2D: converte metros (mundo, y para cima) em pixels (tela, y para baixo),
 * com suavização, zoom e tremida de impacto.
 */

export function createCamera() {
  const cam = {
    x: 0, // centro da vista, em metros
    y: 0,
    targetX: 0,
    targetY: 0,
    scale: 20, // pixels por metro
    targetScale: 20,
    width: 800, // tamanho do viewport, em pixels de CSS
    height: 450,
    shake: 0,
    shakeX: 0,
    shakeY: 0,
    smoothing: 6, // maior = mais rápido para alcançar o alvo
    shakeEnabled: true,

    resize(width, height) {
      cam.width = width;
      cam.height = height;
    },

    /** Define para onde a câmera deve caminhar. */
    lookAt(x, y, scale = cam.targetScale) {
      cam.targetX = x;
      cam.targetY = y;
      cam.targetScale = scale;
    },

    /** Vai direto, sem suavizar (troca de nível, início de tiro). */
    snap(x, y, scale = cam.targetScale) {
      cam.lookAt(x, y, scale);
      cam.x = x;
      cam.y = y;
      cam.scale = scale;
    },

    addShake(amount) {
      if (!cam.shakeEnabled) return;
      cam.shake = Math.min(1.2, cam.shake + amount);
    },

    update(dt) {
      const t = 1 - Math.exp(-cam.smoothing * dt); // suavização estável em qualquer FPS
      cam.x += (cam.targetX - cam.x) * t;
      cam.y += (cam.targetY - cam.y) * t;
      cam.scale += (cam.targetScale - cam.scale) * t;

      cam.shake = Math.max(0, cam.shake - dt * 2.2);
      const magnitude = cam.shake * cam.shake * 14;
      cam.shakeX = (Math.random() * 2 - 1) * magnitude;
      cam.shakeY = (Math.random() * 2 - 1) * magnitude;
    },

    /** Mundo (m) → tela (px). */
    toScreen(x, y) {
      return {
        x: (x - cam.x) * cam.scale + cam.width / 2 + cam.shakeX,
        y: cam.height / 2 - (y - cam.y) * cam.scale + cam.shakeY,
      };
    },

    /** Tela (px) → mundo (m). */
    toWorld(px, py) {
      return {
        x: (px - cam.width / 2 - cam.shakeX) / cam.scale + cam.x,
        y: (cam.height / 2 + cam.shakeY - py) / cam.scale + cam.y,
      };
    },

    /** Metade da largura/altura visível, em metros. */
    get halfWidth() {
      return cam.width / 2 / cam.scale;
    },
    get halfHeight() {
      return cam.height / 2 / cam.scale;
    },
  };

  return cam;
}
