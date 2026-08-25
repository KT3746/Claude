# Arqueiro

Jogo de arco e flecha em HTML5 Canvas: mire, leia o vento, acerte o X.
Roda direto no navegador, no computador e no celular. **Sem build, sem
dependências, sem instalar nada.**

## Como jogar

Abra `index.html` num navegador — ou sirva a pasta, que é o jeito recomendado
porque o jogo usa módulos ES:

```bash
python3 -m http.server 8000   # depois abra http://localhost:8000
```

### Controles

| Ação | Mouse / toque | Teclado |
| --- | --- | --- |
| Mirar e escolher a força | arraste para trás do arco (como um estilingue) | ← → mira · ↑ ↓ força |
| Ajuste fino | — | segure Shift junto com as setas |
| Disparar | solte | Espaço |
| Pausar | botão no canto | P |
| Reiniciar o nível | menu de pausa | R |

Quanto mais longe você puxa, mais força. O arco de mira aparece em verde
(fraco), amarelo e vermelho (máximo).

### O que está acontecendo na tela

- **Luneta (canto superior esquerdo)** — o alvo ampliado, com as flechas já
  cravadas. É por ela que você corrige a mira depois de cada tiro.
- **Bandeira e seta do vento** — verde significa vento de cauda (a flecha vai
  mais longe), vermelho é vento de frente. O número é a velocidade em m/s.
- **Marcador na borda direita** — quando o alvo não cabe na tela, mostra a que
  distância ele está.
- **Linha pontilhada** — a trajetória prevista. Aparece só nos primeiros
  níveis; depois é você e seu olho.

### Pontuação

Anéis de 1 (borda) a 10 (centro), como na World Archery. O miolo do 10 é o
**X**, que dá 5 pontos de bônus. Acertos seguidos em 9 ou 10 acumulam combo,
que multiplica os pontos em até 5×. Balões valem bônus e não gastam o tiro:
a flecha atravessa e segue voando.

Cada nível tem uma meta. Bater a meta dá 1 estrela, 130% da meta dá 2 e 165%
dá 3. O próximo nível destrava com pelo menos 1 estrela. O progresso fica
salvo no navegador.

## Como funciona

A flecha é integrada com passo fixo (Euler semi-implícito, 1/120 s), sujeita a
gravidade, arrasto quadrático e vento. O vento entra pela velocidade
*relativa ao ar*, então empurrar a flecha e frear a flecha são o mesmo
fenômeno, não duas regras separadas. A colisão testa o **segmento** percorrido
no passo contra o plano do alvo — sem isso, uma flecha rápida atravessaria o
alvo entre dois quadros.

```
index.html            página e canvas
css/style.css         casca e telas de interface
js/main.js            liga tudo: canvas, entrada, loop, telas
js/engine/            loop de passo fixo, entrada, câmera, partículas, áudio, save
js/game/physics.js    integração da flecha           (puro, testado)
js/game/scoring.js    anéis, combo, estrelas         (puro, testado)
js/game/level.js      máquina de estados do nível
js/game/levels.js     os 12 níveis, em tabela
js/ui/                HUD no canvas, telas no DOM
tests/                testes com o runner nativo do Node
```

Nada de imagens ou arquivos de som: o cenário é desenhado no Canvas e os
efeitos sonoros são sintetizados com WebAudio.

## Testes

Os módulos de física e pontuação são funções puras sem DOM, e rodam no runner
nativo do Node (sem `npm install`):

```bash
node --test        # ou: npm test
```

## Acessibilidade

Dá para jogar inteiro pelo teclado. As telas de menu são elementos do DOM,
navegáveis por Tab e legíveis por leitor de tela. Quem tem
`prefers-reduced-motion` ativado não recebe tremida de câmera nem câmera
lenta — e o efeito pode ser ligado ou desligado no menu.
