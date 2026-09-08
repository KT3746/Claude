# Arqueiro — contexto do projeto

Jogo de arco e flecha em HTML5 Canvas, em português. Estático: **sem build, sem
dependências, sem `npm install`**. Publicado em
https://kt3746.github.io/Arco-e-Flecha/ via GitHub Actions.

O usuário é **iniciante em programação e usa celular Android**. Explique em
português, sem jargão, e prefira fazer a ação a mandar ele fazer — só peça
quando for algo que exige o painel web do GitHub (configurações do
repositório), que nenhuma ferramenta alcança.

## Como rodar e testar

```bash
python3 -m http.server 8000   # abre em http://localhost:8000
node --test                   # 22 testes, runner nativo do Node, sem instalar nada
```

`js/game/physics.js` e `js/game/scoring.js` são funções puras sem DOM — por isso
dá para testá-las no runner nativo. O resto se testa dirigindo o jogo num
navegador real.

**Chromium para testes de navegador**: já instalado em
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Instale o Playwright no
diretório de rascunho (`npm install playwright --no-save`) e passe
`executablePath` apontando para esse caminho — não rode `playwright install`.

**Lição aprendida, importante**: testes com clique de *mouse* NÃO pegam bugs de
*toque*. Um bug real (nenhum botão respondia no celular) passou por vários
testes de mouse. Para qualquer coisa de interface, teste com toque de verdade:
`browser.newPage({ ...devices['Pixel 5'] })` e `page.touchscreen.tap()`, ou
eventos de toque de baixo nível via `Input.dispatchTouchEvent` (CDP) para
arrastar.

## Arquitetura

```
index.html            página e canvas
css/style.css         casca e telas de interface
js/main.js            liga tudo: canvas, entrada, loop, telas; expõe window.__game (depuração)
js/engine/loop.js     loop de passo fixo (beginFrame → step* → render → endFrame)
js/engine/input.js    mouse/toque/teclado unificados num "pointer" + ações
js/engine/camera.js   mundo (metros, y para cima) ↔ tela (pixels, y para baixo)
js/engine/{audio,particles,storage}.js
js/game/physics.js    integração da flecha (gravidade, arrasto, vento)   [PURO, testado]
js/game/scoring.js    anéis, X, combo, estrelas                          [PURO, testado]
js/game/level.js      máquina de estados: aiming → flying → settling → finished
js/game/levels.js     os 12 níveis, em tabela declarativa
js/game/{arrow,bow,target,scenery}.js
js/ui/hud.js          HUD desenhado no canvas (pontos, vento, luneta)
js/ui/screens.js      menus como elementos do DOM (acessíveis por teclado)
tests/                testes do runner nativo do Node
```

Decisões que não são óbvias:

- **Velocidade da flecha 16–46 m/s** (`bow.js`), não os ~60 m/s reais: na
  velocidade real a trajetória fica quase reta nessas distâncias e a mira perde
  a graça.
- **Colisão testa o segmento percorrido no passo**, não a posição final — sem
  isso a flecha atravessa o alvo entre dois quadros.
- **O vento age sobre a velocidade relativa ao ar**, então vento de cauda e de
  frente saem do mesmo cálculo, sem regra extra.
- `arrow.stop()` zera `vx`/`vy`, então o ângulo do impacto é congelado em
  `finalHeading` antes disso — o getter `heading` leria `atan2(0,0) = 0`.
- Em `input.js`, `onUp` só chama `preventDefault()` quando encerra um arrasto
  **nosso** (`pointer.down` era true). Cancelar um `touchend` qualquer suprime o
  `click` sintético do navegador e mata todos os botões da interface no celular.

## Fluxo de trabalho

- Desenvolva numa branch `claude/...`, abra PR, espere o CI (`node --test`)
  ficar verde, e mergeie. O usuário já autorizou esse fluxo várias vezes.
- Todo push na `main` publica no GitHub Pages automaticamente.
- `.github/workflows/pages.yml` verifica se o Pages está habilitado antes de
  tentar publicar, e sai com sucesso (deixando um `::notice`) se não estiver —
  o token do workflow não tem permissão para habilitar o Pages sozinho.
- Verifique de verdade antes de afirmar que funciona: rode os testes, dirija o
  jogo no navegador, confira o resultado real do deploy pela API do GitHub.
  A rede desta sandbox **bloqueia `github.io`**, então não dá para abrir o site
  publicado daqui — confirme pelo `deployments/{id}/statuses` da API.

## Estado atual

Jogo completo e no ar: 12 níveis, modo prática, progresso salvo, vento,
alvos móveis, obstáculos, balões de bônus, luneta, som sintetizado.

Bugs já corrigidos: ângulo da flecha cravada, arrasto perdido ao segurar o
clique entre estados, botão errado na vitória do último nível, e o toque que
não respondia em nenhum botão.

**Pendência aberta**: depois da correção do toque (commit `bded752`), o usuário
relatou que no celular dele *ainda* não respondia. A hipótese principal é cache
do Chrome guardando o `input.js` antigo; ele ia testar numa aba anônima e
reportar. Se em aba anônima **funcionar**, era cache — explique como limpar o
cache do site. Se **não funcionar**, o problema é outro e a investigação
recomeça (o bug do `preventDefault` está comprovadamente corrigido e verificado
com toque real).
