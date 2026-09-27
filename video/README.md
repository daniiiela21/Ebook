# Reel 9:16 — "100 Hortaliças, Ervas e Frutas para Cultivar Dentro de Casa"

Anúncio vertical para Instagram Reels, feito 100% por código: cena 3D isométrica em estilo
"clay" (Three.js) renderizada quadro a quadro no Chromium headless, narração neural PT-BR
offline (Kokoro, voz feminina `pf_dora`), música lo-fi/acústica e sons ambientes sintetizados.

**Saídas** (em `../out/`): 1080×1920 · 30 fps · 18 s · H.264 High + AAC 48 kHz · −14 LUFS

| Arquivo | Hook (0–2,8 s) |
|---|---|
| `reel_horta_principal.mp4` | "Comecei com um vasinho na janela…" (roteiro original) |
| `reel_horta_hook_A.mp4` | "Comecei com um vasinho na janela e agora olha isso…" |
| `reel_horta_hook_B.mp4` | "Eu não sabia que dava pra plantar isso dentro de casa…" |
| `reel_horta_hook_C.mp4` | "Esse cantinho da minha casa ficou meio fora de controle… 🌱" |

A partir de 2,8 s as quatro versões são idênticas quadro a quadro e no áudio.

## ⚠️ Capa oficial

A capa oficial e a imagem de referência não vieram junto com o pedido. O tablet exibe
um **placeholder** ("CAPA OFICIAL — assets/capa.png"). Para usar a capa verdadeira:

1. Salve o arquivo original como `video/assets/capa.png` (qualquer proporção).
2. Apague `video/build/silent_*.mp4` e rode `./build.sh`.

A capa é aplicada sem recorte nem distorção (encaixe "contain" na tela do tablet),
sem redesenho nem alteração de texto.

## Linha do tempo

Os cortes caem na grade da música (85,7 BPM → meio tempo = 0,35 s).

| Tempo | Cena | Texto na tela | Narração |
|---|---|---|---|
| 0,0–2,8 | 1 Hook — ela coloca a muda de manjericão no único vaso da janela, dolly-in | hook | hook |
| 2,8–5,25 | 2 Macro na mesa — terra, furo com o dedo, sementes, cobre, rega com regador sálvia | "…e descobri que dava pra plantar MUITA coisa." | "E descobri que dava pra plantar muita coisa." |
| 5,25–7,0 | 3 Time-lapse na janela — vasos surgem, brotos crescem, sol varre o cômodo; ~1 s sem texto, depois etiquetas 🌱 manjericão · 🌿 cebolinha · 🥬 alface | etiquetas | "Algumas são bem mais fáceis do que eu imaginava." |
| 7,0–9,8 | 4 Câmera se afasta: horta completa (manjericão, cebolinha, alface, hortelã, tomate-cereja, morangos); ela atravessa com o regador | "E você não precisa de um quintal." | "E o mais legal: você não precisa de quintal." |
| 9,8–11,35 | 5a Closes: tesoura no manjericão → tomate-cereja → morango | "Plantar → cuidar → colher ♡" | "Colher o que você mesma plantou tem outra graça." |
| 11,35–12,6 | 5b Na mesa: coloca tomates e manjericão sobre as bruschettas, pequeno gesto de satisfação | (continua) | (continua) |
| 12,6–14,7 | 6 Plano geral: ela rega os morangos | "Foi assim que eu comecei." → "Mas eu queria saber o que mais dava pra plantar…" | "Aí fui descobrir o que mais dava pra cultivar." |
| 14,7–18,0 | 7 Câmera desliza até a mesa do mesmo cômodo: tablet com a capa, guias ao fundo, o prato colhido ao lado | título → "+ Guias práticos" → "R$24,90" → botão "QUERO COMEÇAR 🌱" | "Esse guia reúne cem opções pra cultivar em casa." (termina ~17,3 s; ~0,7 s de silêncio para o CTA) |

Nas variações B e C (e na segunda metade da A) o hook mostra a horta já crescida, para que
"isso" / "fora de controle" / "olha isso" façam sentido visualmente; o restante é idêntico.

### Ajustes de roteiro necessários para caber em 18 s

A narração original completa soma ~24 s de fala natural. Para manter os 18 s exigidos
(e 0,7 s final sem voz), algumas frases foram encurtadas mantendo o sentido e o tom:

| Original | Usado |
|---|---|
| "E descobri que dava pra plantar muita coisa dentro de casa." | "E descobri que dava pra plantar muita coisa." |
| "Algumas são muito mais fáceis do que eu imaginava." | "Algumas são bem mais fáceis do que eu imaginava." |
| "E o mais legal é que você não precisa ter um quintal." | "E o mais legal: você não precisa de quintal." |
| "Tem uma satisfação diferente em colher algo que você mesma plantou." | "Colher o que você mesma plantou tem outra graça." |
| "Foi aí que eu fui descobrir o que mais dava pra cultivar dentro de casa." | "Aí fui descobrir o que mais dava pra cultivar." |
| "Se você também quer começar, esse guia reúne 100 opções e mostra como cultivar dentro de casa." | "Esse guia reúne cem opções pra cultivar em casa." |

Mesmo assim, a voz roda a 1,05–1,25× para caber nos slots. Para uma locução mais calma,
grave uma voz humana (ou outra TTS) por cima; os tempos de entrada estão em `LINES` em
`audio/audio.py`. Os textos na tela seguem o roteiro original.

## Áreas seguras

Todo texto fica entre y≈250 e y≈1510 px, centralizado, com largura máx. ~820 px:
fora da barra superior do Reels, da legenda/CTA inferior (~410 px) e da coluna de
ícones à direita.

## Como renderizar

```bash
cd video
npm install
pip install kokoro-onnx soundfile numpy
curl -L -o audio/kokoro.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -L -o audio/voices.bin  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
FFMPEG=/caminho/para/ffmpeg ./build.sh            # todas as versões
FFMPEG=/caminho/para/ffmpeg ./build.sh base       # só a principal
node render.mjs frames base 0,150,500 /tmp/prev   # quadros avulsos para revisão
```

O ffmpeg precisa ter libx264. A renderização em software (SwiftShader) leva ~1,5 s por quadro.

## Estrutura

- `src/world.js` — cômodo, vasos, plantas procedurais (com crescimento), adereços, personagem com IK
- `src/main.js` — linha do tempo, câmeras, estados do mundo por cena, textos por cena
- `src/overlay.js` — cartões de texto, etiquetas, botão (fonte Fredoka, emojis Twemoji)
- `audio/audio.py` — narração, música, foley e mixagem com ducking
- `render.mjs` — servidor local + Chromium headless + pipe para o ffmpeg
