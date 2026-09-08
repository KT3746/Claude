# Jogos do KT3746

Repositório com jogos em HTML5 Canvas, cada um na sua própria pasta,
compartilhando um motor comum em `js/engine/`. **Sem build, sem
dependências, sem `npm install`.**

## Jogos

- **[Minhocas](minhocas/README.md)** — artilharia por turnos no estilo
  *Worms*, em `/minhocas/`.

O **Arqueiro** (arco e flecha) morava aqui e se mudou para o repositório
dedicado [`Claude-Arqueiro`](https://github.com/KT3746/Claude-Arqueiro) —
jogue em <https://kt3746.github.io/Claude-Arqueiro/>.

## Como rodar

O motor usa módulos ES, que os navegadores não carregam pelo protocolo
`file://`. Suba um servidor local:

```bash
npm start            # http://localhost:8000
```

Depois abra a pasta do jogo que quiser, por exemplo
`http://localhost:8000/minhocas/`.

## Testes

```bash
npm test
```

`node --test` roda no runner nativo do Node, sem instalar nada. Cada jogo
mantém seus próprios testes em `tests/`, cobrindo as partes puras e sem DOM
do motor (física, dano, geração de terreno, armas, etc).

## Estrutura

```
js/engine/     motor compartilhado: loop de passo fixo, entrada, câmera,
               partículas, áudio, save, RNG com semente, chunks de terreno
minhocas/      casca e telas do jogo Minhocas
js/minhocas/   lógica do jogo Minhocas
docs/          planos e notas de design
tests/         testes do runner nativo do Node
```
