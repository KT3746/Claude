# Jogos do KT3746 — contexto do projeto

Repositório de jogos em HTML5 Canvas, em português, cada um na sua pasta,
compartilhando um motor comum em `js/engine/`. Estático: **sem build, sem
dependências, sem `npm install`**. Publicado no GitHub Pages via GitHub
Actions.

**Atenção: o usuário renomeia e reorganiza repositórios com frequência.**
Este aqui já foi `desktop-tutorial`, depois `Arco-e-Flecha`, depois `Claude`
(id interno **1342942892**). Em 2026-09-08 o jogo Arqueiro, que morava na
raiz, foi **extraído para o repositório dedicado `Claude-Arqueiro`**
(id interno **1361028025**, <https://github.com/KT3746/Claude-Arqueiro>,
publicado em <https://kt3746.github.io/Claude-Arqueiro/>) — se alguém
perguntar pelo Arqueiro, é lá que ele está agora, não aqui. Renomear ou
mudar de repositório muda o endereço do jogo
(`https://kt3746.github.io/<nome-atual>/`) e derruba o link antigo — se
disserem que um jogo abre mas não responde a cliques, **a primeira suspeita
é que é um link antigo**, com o navegador mostrando uma cópia em cache sem o
JavaScript. Confirme o nome do repositório atual antes de passar qualquer
link, e pegue o endereço real do último deploy em
`GET /repos/{owner}/{repo}/deployments/{id}/statuses` → `environment_url`.

O usuário é **iniciante em programação e usa celular Android**. Explique em
português, sem jargão, e prefira fazer a ação a mandar ele fazer — só peça
quando for algo que exige o painel web do GitHub (configurações do
repositório), que nenhuma ferramenta alcança.

## Como rodar e testar

```bash
python3 -m http.server 8000   # abre em http://localhost:8000, depois entre na pasta do jogo
node --test                   # runner nativo do Node, sem instalar nada
```

Os módulos de lógica pura (sem DOM) de cada jogo são testados no runner
nativo; o resto se testa dirigindo o jogo num navegador real.

**Chromium para testes de navegador**: já instalado em
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Instale o Playwright no
diretório de rascunho (`npm install playwright --no-save`) e passe
`executablePath` apontando para esse caminho — não rode `playwright install`.

**Lição aprendida, importante**: testes com clique de *mouse* NÃO pegam bugs
de *toque*. Um bug real (nenhum botão respondia no celular, no Arqueiro)
passou por vários testes de mouse. Para qualquer coisa de interface, teste
com toque de verdade: `browser.newPage({ ...devices['Pixel 5'] })` e
`page.touchscreen.tap()`, ou eventos de toque de baixo nível via
`Input.dispatchTouchEvent` (CDP) para arrastar.

## Arquitetura

```
js/engine/loop.js       loop de passo fixo (beginFrame → step* → render → endFrame)
js/engine/input.js      mouse/toque/teclado unificados num "pointer" + ações
js/engine/camera.js     mundo (metros, y para cima) ↔ tela (pixels, y para baixo)
js/engine/rng.js        gerador com semente, para terrenos/partidas reproduzíveis
js/engine/chunks.js     terreno em chunks (usado pelo Minhocas)
js/engine/{audio,particles,storage}.js
minhocas/               casca do jogo Minhocas (index.html, css/)
js/minhocas/            lógica do Minhocas: física de projétil (ballistics.js),
                         dano, arsenal (weapons.js), corda (rope.js), terreno
                         destrutível (mask.js/terrain.js/terrain-gen.js),
                         máquina de turnos (turn.js), partida (match.js)
js/minhocas/ui/         HUD e telas do Minhocas (própria, não compartilhada)
docs/PLANO-TRINCHEIRA.md  plano de design do Minhocas
tests/                  testes do runner nativo do Node
```

`js/engine/*` é compartilhado entre os jogos que vivem neste repositório —
não mexa nele pensando só no jogo que você está vendo na tela, confira quem
mais importa o módulo antes de mudar a assinatura de uma função.

## Fluxo de trabalho

- Desenvolva numa branch `claude/...`, abra PR, espere o CI (`node --test`)
  ficar verde, e mergeie. O usuário já autorizou esse fluxo várias vezes.
- Todo push na `main` publica no GitHub Pages automaticamente.
- `.github/workflows/pages.yml` verifica se o Pages está habilitado antes de
  tentar publicar, e sai com sucesso (deixando um `::notice`) se não estiver
  — o token do workflow não tem permissão para habilitar o Pages sozinho.
- Verifique de verdade antes de afirmar que funciona: rode os testes, dirija
  o jogo no navegador, confira o resultado real do deploy pela API do
  GitHub. A rede desta sandbox **bloqueia `github.io`**, então não dá para
  abrir o site publicado daqui — confirme pelo `deployments/{id}/statuses`
  da API.

## Estado atual

- **Minhocas** (`/minhocas/`): completo, artilharia por turnos estilo
  *Worms*, terreno destrutível, 14 armas, corda ninja, jetpack, teleporte.
- **Arqueiro**: extraído para o repositório `Claude-Arqueiro` em
  2026-09-08 — não vive mais aqui.
- Havia uma PR aberta (#7) trazendo o jogo **Campo Minado** para
  `/campo-minado/`, criada antes desta extração; se ainda estiver aberta,
  ela provavelmente precisa de rebase contra esta mudança antes de
  mergear — confira o estado da PR antes de mexer nela.
