/**
 * Telas de interface (menu, seleção de níveis, pausa, resultado).
 *
 * São elementos do DOM sobre o canvas, e não desenho no canvas: assim
 * os botões são navegáveis por teclado e lidos por leitores de tela de graça.
 */

import { LEVELS } from '../game/levels.js';
import { save } from '../engine/storage.js';
import { sfx } from '../engine/audio.js';

export function createScreens(root, actions) {
  let current = null;

  function clear() {
    root.innerHTML = '';
    root.hidden = true;
    current = null;
  }

  function panel(title, subtitle) {
    root.innerHTML = '';
    root.hidden = false;
    const box = el('div', 'panel');
    if (title) box.append(el('h1', 'panel-title', title));
    if (subtitle) box.append(el('p', 'panel-subtitle', subtitle));
    root.append(box);
    return box;
  }

  function button(label, onClick, variant = '') {
    const btn = el('button', `btn ${variant}`.trim(), label);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      sfx.click();
      onClick();
    });
    return btn;
  }

  const screens = {
    get current() {
      return current;
    },

    hide: clear,

    menu() {
      current = 'menu';
      const box = panel('Arqueiro', 'Puxe a corda, leia o vento, acerte o X.');

      const stars = el('p', 'stars-total', `★ ${save.totalStars()} / ${LEVELS.length * 3}`);
      box.append(stars);

      const actionsRow = el('div', 'actions');
      actionsRow.append(
        button('Jogar', () => actions.playNext(), 'primary'),
        button('Níveis', () => screens.levelSelect()),
        button('Prática', () => actions.practice()),
      );
      box.append(actionsRow);

      const settingsRow = el('div', 'actions secondary-actions');
      settingsRow.append(
        toggle('Som', save.settings.sound, (value) => {
          save.setSetting('sound', value);
          sfx.setEnabled(value);
        }),
        toggle('Efeitos de câmera', save.settings.motion, (value) => {
          save.setSetting('motion', value);
          actions.setMotion(value);
        }),
      );
      box.append(settingsRow);

      box.append(el('p', 'hint-text',
        'Mouse ou dedo: arraste para trás do arco e solte. ' +
        'Teclado: ← → mira, ↑ ↓ força, Espaço dispara, P pausa, R reinicia.'));
    },

    levelSelect() {
      current = 'levels';
      const box = panel('Níveis', `★ ${save.totalStars()} de ${LEVELS.length * 3}`);
      const grid = el('div', 'level-grid');

      LEVELS.forEach((level, index) => {
        const unlocked = save.isUnlocked(index, LEVELS);
        const result = save.levelResult(level.id);
        const card = el('button', `level-card${unlocked ? '' : ' locked'}`);
        card.type = 'button';
        card.disabled = !unlocked;
        card.append(
          el('span', 'level-number', String(index + 1)),
          el('span', 'level-name', level.name),
          el('span', 'level-stars', unlocked ? starString(result.stars) : '🔒'),
        );
        if (unlocked) {
          card.addEventListener('click', () => {
            sfx.click();
            actions.playLevel(index);
          });
        }
        grid.append(card);
      });

      box.append(grid);
      box.append(el('div', 'actions').also((row) => row.append(button('Voltar', () => screens.menu()))));
    },

    pause() {
      current = 'pause';
      const box = panel('Pausa');
      const row = el('div', 'actions');
      row.append(
        button('Continuar', () => actions.resume(), 'primary'),
        button('Reiniciar', () => actions.restart()),
        button('Menu', () => actions.toMenu()),
      );
      box.append(row);
    },

    /**
     * Resultado do nível.
     * @param {{levelName:string, score:number, stars:number, shots:Array, isLast:boolean, record:boolean, practice?:boolean}} data
     */
    result(data) {
      current = 'result';
      const success = data.stars > 0;
      const box = panel(
        success ? 'Nível concluído' : 'Fim das flechas',
        data.levelName,
      );

      box.append(el('div', 'stars-big', starString(data.stars)));
      box.append(el('p', 'score-big', `${data.score} pontos`));
      if (data.record) box.append(el('p', 'record', 'Novo recorde!'));

      const hits = data.shots.filter((s) => s.ring > 0).length;
      const xs = data.shots.filter((s) => s.bullseye).length;
      box.append(el('p', 'stats',
        `${hits}/${data.shots.length} no alvo · ${xs} no X · melhor combo ×${(1 + data.bestCombo * 0.5).toFixed(1)}`));

      if (!success) {
        box.append(el('p', 'hint-text', `Faça ${data.targetScore} pontos para destravar o próximo nível.`));
      } else if (data.isLast) {
        box.append(el('p', 'hint-text', 'Você zerou o Arqueiro! Pode repetir qualquer nível para melhorar as estrelas.'));
      }

      const row = el('div', 'actions');
      if (success && !data.isLast) {
        row.append(button('Próximo nível', () => actions.playNext(), 'primary'));
        row.append(button('Repetir', () => actions.restart()));
      } else if (success) {
        // Último nível vencido: não há "tentar de novo" a fazer, só melhorar.
        row.append(button('Repetir', () => actions.restart(), 'primary'));
      } else {
        row.append(button('Tentar de novo', () => actions.restart(), 'primary'));
      }
      row.append(button('Menu', () => actions.toMenu()));
      box.append(row);
    },
  };

  return screens;
}

function starString(stars) {
  return '★'.repeat(stars) + '☆'.repeat(3 - stars);
}

function toggle(label, initial, onChange) {
  const wrapper = el('label', 'toggle');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = initial;
  input.addEventListener('change', () => onChange(input.checked));
  wrapper.append(input, el('span', '', label));
  return wrapper;
}

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  // Pequeno açúcar para encadear composição sem variáveis temporárias.
  node.also = (fn) => {
    fn(node);
    return node;
  };
  return node;
}
