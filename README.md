# Nau Contraluz

Galeria fotográfica estática publicada em GitHub Pages. Cada fotografia é acompanhada de um texto literário real selecionado por IA no idioma original do autor, com tradução para português e inglês.

**[Ver galeria](https://naucontraluz.diogocarmo.cc/)**

---

A fotografia entra numa pasta local. O resto acontece sozinho: Python extrai EXIF, converte para WebP e faz POST a um Google Apps Script, que chama o Gemini 2.5 Flash para selecionar o texto literário, grava no Sheets e commita sitemap e página de partilha diretamente no repositório via GitHub API.

O Gemini não corre no browser. É chamado durante a ingestão, uma vez por fotografia. O nível de confiança da seleção (alta, média ou baixa) fica gravado e é exposto ao visitante no front-end.

Cada fotografia tem uma página de redirect própria com Open Graph individual, gerada e commitada programaticamente. Isto permite pré-visualização correta ao partilhar em WhatsApp, Telegram ou LinkedIn sem qualquer servidor.

O ID de cada fotografia é um hash MD5 do ficheiro original: determinístico, reproduzível e imune a duplicados.

---

© Diogo Carmo, 2017-2026 · [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/)

---

## Arquitectura

O sistema é um pipeline híbrido (local + nuvem) que transforma fotografias em bruto em cartões digitais interactivos.

```
Google Fotos
     ↓ transferência manual
Entrada_Fotos/          ← pasta local de entrada
     ↓ Python (processar_galeria.bat)
Fotos_WebP/             ← pasta sincronizada com Google Drive
     ↓ webhook HTTP POST
Google Apps Script      ← orquestração na nuvem
     ↓ Gemini 2.5 Flash (curadoria literária)
Google Sheets           ← base de dados
     ↓ GitHub API (commit automático)
GitHub Pages            ← site estático
```

---

## Estrutura do Repositório

```
galeria-fotografica/
│
├── index.html              # Shell estático — SEO, Open Graph, JSON-LD, licença
├── sitemap.xml             # Gerado e commitado pelo GAS via GitHub API
├── robots.txt              # Permite crawl total; bloqueia /foto/ a crawlers
│
├── foto/                   # Páginas de redirect por foto (geradas pelo GAS via GitHub API)
│   └── <id>.html           # Redirect + Open Graph para partilha em redes sociais
│
└── assets/
    ├── favicon.svg         # Ícone de modo misto dourado sobre fundo transparente
    ├── img/
    │   └── preview.jpg     # Imagem de preview para Open Graph do site (1200x630px)
    ├── css/
    │   ├── reset.css       # Reset global, scrollbar oculta
    │   ├── gallery.css     # Tokens, cartões, modal lightbox, cartões verso, cabeçalho, ficha técnica
    │   └── responsive.css  # CSS Columns para grelha; CSS Grid para slots fractais; breakpoints
    └── js/
        ├── config.js       # Único ficheiro a editar — endpoint GAS e parâmetros
        ├── api.js          # Fetch ao GAS + shuffle Fisher-Yates
        ├── seo.js          # JSON-LD dinâmico (ImageGallery + ImageObject)
        └── gallery.js      # Render de cartões (foto/verso/fractal), modal lightbox,
                            # scroll infinito, partilha via hash e botão, cabeçalho flutuante,
                            # ficha técnica
```

---

## Ficheiros GAS (Google Apps Script)

Vivem no editor web do GAS — **não estão no repositório**. Guardar cópias locais periodicamente.

| Ficheiro | Responsabilidade |
|---|---|
| `01_config.gs` | Lê propriedades do script (SHEET_ID, GEMINI_KEY, SHEET_NAME, GITHUB_TOKEN, GITHUB_REPO) |
| `02_sheets.gs` | Leitura e escrita no Google Sheets |
| `03_gemini.gs` | Curadoria literária via Gemini 2.5 Flash |
| `04_webhook.gs` | Receiver do POST do Python; orquestra pipeline completo |
| `05_api.gs` | Endpoint GET público para o browser |
| `06_gestao.gs` | Menu "Galeria" no Sheets — publicar/despublicar/gerar sitemap/gerar páginas de partilha/corrigir textos em falta |
| `07_sitemap.gs` | Gerador de sitemap.xml com image:image por foto; commit via GitHub API |
| `08_redirect_pages.gs` | Gerador de páginas de redirect por foto com Open Graph; commit via GitHub API |
| `09_github.gs` | Função partilhada commitFicheiroGithub() — integração com GitHub API |

**Propriedades do Script** (GAS → Projecto → Propriedades do script):

| Propriedade | Valor |
|---|---|
| `SHEET_ID` | ID do Google Sheets |
| `GEMINI_KEY` | Chave da API Gemini |
| `SHEET_NAME` | `galeria` |
| `GITHUB_TOKEN` | Personal Access Token (scope: Contents read & write) |
| `GITHUB_REPO` | `diogocarmu/galeria-fotografica` |
| `GITHUB_BRANCH` | `main` (opcional — default: main) |

**Como criar o GITHUB_TOKEN:**
1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Repository access: apenas `galeria-fotografica`
3. Permissions → Repository permissions → Contents: Read and write
4. Copiar o token gerado para a propriedade `GITHUB_TOKEN`

---

## Schema do Google Sheets

Separador: `galeria` — 20 colunas (A-T)

| Col | Campo | Descrição |
|---|---|---|
| A | `id` | Hash MD5 do ficheiro original (12 chars) |
| B | `timestamp` | Data de processamento (ISO 8601) |
| C | `url_imagem` | URL público do Google Drive |
| D | `titulo` | Título no idioma nativo do autor |
| E | `texto_editorial` | Texto literário no idioma nativo do autor |
| F | `largura_original` | Largura em px antes de redimensionar |
| G | `altura_original` | Altura em px antes de redimensionar |
| H | `orientacao` | `landscape` / `portrait` / `square` |
| I | `camera` | Câmara extraída da EXIF |
| J | `coordenadas_gps` | `lat,lng` ou vazio |
| K | `publicada` | `TRUE` / `FALSE` |
| L | `data_foto` | Data EXIF (`YYYY-MM-DD`) |
| M | `autor_texto` | Autor do texto literário |
| N | `ano_texto` | Ano da obra |
| O | `texto_pt` | Versão portuguesa (vazio se idioma_original=pt) |
| P | `texto_en` | Versão inglesa (vazio se idioma_original=en) |
| Q | `idioma_original` | Código do idioma nativo do autor (`pt`, `en`, `es`, etc.) |
| R | `confianca_texto` | `alta` / `media` / `baixa` |
| S | `titulo_pt` | Título em português de Portugal |
| T | `titulo_en` | Título em inglês |

**Regra de idiomas:**
- `titulo` e `texto_editorial` estão sempre no idioma nativo do autor.
- Se `idioma_original=pt`: `texto_pt` vazio, `texto_en` preenchido.
- Se `idioma_original=en`: `texto_en` vazio, `texto_pt` preenchido.
- Qualquer outro idioma: `texto_pt` e `texto_en` ambos preenchidos.

---

## Modal Lightbox

Clicar numa fotografia abre um modal a ecrã inteiro com três modos de visualização, alternáveis por ícones na barra superior. O modal abre sempre em modo foto+texto.

**Estrutura permanente:**
- Barra topo (desktop): Título | modos de visualização | ⓘ | x
- Barra topo (mobile): linha 1 = título; linha 2 = modos (esquerda) + ⓘ x (direita)
- Barra fundo: câmara · data · coordenadas GPS · botão de partilha

**Modos:**

| Ícone | Modo | Descrição |
|---|---|---|
| só foto | Foto centrada com object-fit: contain. Fundo preto. |
| foto + texto | Foto cropped à esquerda (50% desktop, 45vh mobile). Texto, selector de idioma e autor à direita/baixo. |
| só texto | Colunas por idioma (original maior, secundárias atenuadas). Autor imediatamente após coluna original. |

O selector de idioma aparece no modo foto+texto. O idioma original aparece sempre primeiro. O título na barra troca quando o utilizador muda de idioma (usa `titulo_pt` / `titulo_en`; fallback para `titulo`). Fecha com x ou tecla ESC.

O botão ⓘ abre a ficha técnica do projecto.

---

## Ficha Técnica

Acessível via botão ⓘ na barra superior do modal. Painel sobreposto com:

- Nome e tagline do projecto
- Conceito
- Autoria: © Diogo Carmo, 2017-2026
- Licença: Creative Commons BY-NC-ND 4.0
- Link para o repositório GitHub

Fecha com x, ESC, ou clique fora do painel.

---

## Grelha

A galeria usa CSS Columns com três tipos de entrada, calculados antes do primeiro render:

- **Cartão foto** (tipo normal): fotografia com object-fit: cover.
- **Cartão verso** (máx. 30%): quadrado com cor de fundo da paleta Nau Contraluz, título no idioma original, texto literário e atribuição. Hover revela a fotografia por baixo. Só elegível se a foto tiver `texto_editorial`.
- **Slot fractal** (máx. 30% dos cartões fotográficos): um slot subdividido em subfotos usando CSS Grid interno.
  - landscape: 2 fotos lado a lado
  - portrait: 2 fotos empilhadas
  - square: 4 fotos em 2x2

Regras de distribuição:
- Nunca dois cartões do mesmo tipo especial (verso ou fractal) consecutivos.
- Verso e fractal podem encostar entre si.
- Cores dos versos em sequência round-robin: vermelho Tenenbaum → amarelo Linha Amarela → azul Marinho → verde Escutismo → rosa Pastel.

**Nota:** a classificação `square` em `processor.py` usa tolerância de 2%. Fotos com diferença inferior a 2% entre largura e altura são classificadas como `square`. Fotos antigas incorrectamente classificadas devem ser corrigidas manualmente na coluna H do Sheets.

---

## Cabeçalho Flutuante

Barra fina no topo da página (estilo modal), com o nome **Nau Contraluz** e a tagline.

- Aparece ao carregar a página, desaparece após 4 segundos.
- Reaparece com hover nos primeiros 80px do topo.
- Nunca aparece quando o modal está aberto.
- Em mobile: mostra apenas o nome, sem tagline.

---

## Partilha por Link Directo

Cada fotografia tem um URL de partilha único com duas camadas:

**URL da galeria com hash:**
```
https://diogocarmu.github.io/galeria-fotografica/#<id>
```
Abre a galeria com o modal da foto em modo foto+texto. Gerado automaticamente ao abrir qualquer modal; limpo ao fechar.

**URL de redirect com Open Graph:**
```
https://diogocarmu.github.io/galeria-fotografica/foto/<id>.html
```
Usado para partilha em WhatsApp, iMessage, Telegram, LinkedIn, etc. Mostra pré-visualização com foto, título e descrição. Redireciona automaticamente para o URL da galeria com hash.

O botão de partilha na barra de fundo do modal oferece duas opções: copiar link e WhatsApp.

**Atenção:** o pipeline automático (webhook) tem um problema conhecido em que as páginas de redirect não são geradas para algumas fotos novas. Após cada lote de fotos novas, correr manualmente **Galeria → ↻ Gerar páginas de partilha** para garantir que todas as fotos têm página de redirect.

---

## Pipeline Python

**Localização:** `I:\O meu disco\Galeria_Online\galeria-python\`

**Ficheiros:**

| Ficheiro | Responsabilidade |
|---|---|
| `config.py` | Caminhos, endpoint GAS, limites — único ficheiro a editar |
| `processor.py` | Extracção EXIF, redimensionamento, conversão WebP, classificação de orientação |
| `uploader.py` | POST ao GAS com retry |
| `main.py` | Pipeline em lote — processa até 5 fotos por execução |
| `processar_galeria.bat` | Lançador para Task Scheduler |

**Limites operacionais:**
- Máx. 5 fotos por execução (nunca excede 20 RPD do Gemini)
- 30s de espera para sincronização do Drive antes do POST
- 12s entre POSTs (respeita 5 RPM do Gemini 2.5 Flash)

**Task Scheduler:** corre `processar_galeria.bat` diariamente às 23h.

---

## Fluxo de Publicação

### Adicionar fotos novas

1. Transferir foto do Google Fotos usando o **botão de transferência** (não botão direito → guardar — perde EXIF)
2. Colocar em `I:\O meu disco\Galeria_Online\Entrada_Fotos\`
3. O Task Scheduler processa automaticamente às 23h (ou correr o `.bat` manualmente)
4. O GAS processa a foto, grava no Sheets, e tenta commit automático do sitemap e da página de redirect
5. Correr **Galeria → ↻ Gerar páginas de partilha** para garantir que a página de redirect foi criada (ver Pendências)
6. A foto aparece no site e o link de partilha está disponível no próximo refresh do browser

### Publicar / despublicar fotos

No Google Sheets → menu **Galeria → ✓ Publicar seleccionadas** ou **✕ Despublicar seleccionadas**

### Regenerar sitemap manualmente

No Google Sheets → menu **Galeria → ↻ Gerar sitemap.xml**

O GAS lê todas as fotos publicadas, gera o `sitemap.xml` e faz commit directamente no repositório via GitHub API. Não é necessário fazer mais nada.

Quando usar: após corrigir textos em falta (o sitemap inclui os títulos das fotos), ou após publicar/despublicar fotos fora do pipeline automático.

### Corrigir textos em falta

No Google Sheets → menu **Galeria → ✦ Corrigir textos em falta**

Detecta fotos publicadas sem `titulo` ou `texto_editorial` e chama o Gemini para preencher todos os campos literários (colunas D, E, M, N, O, P, Q, R, S, T). Processa no máximo 5 fotos por execução. Correr novamente se houver mais. Regenerar o sitemap depois.

### Regenerar todas as páginas de partilha

No Google Sheets → menu **Galeria → ↻ Gerar páginas de partilha**

O GAS gera a página `foto/<id>.html` para todas as fotos publicadas e faz commit directamente no repositório via GitHub API. Não é necessário fazer mais nada.

Útil após alterações ao template Open Graph, após corrigir textos em falta, ou sempre que houver dúvida sobre se todas as fotos têm página de redirect.

---

## Manutenção do Site

### Editar ficheiros do site

```
cd "I:\O meu disco\Galeria_Online\galeria-fotografica"
# editar ficheiros no VS Code
git add .
git commit -m "tipo: descrição"
git pull --rebase
git push
```

**Nota:** o GAS faz commits directamente no repositório via GitHub API (sitemap, páginas de redirect). Antes de cada `git push`, correr sempre `git pull --rebase` para evitar rejeição por divergência. Para configurar este comportamento por defeito:

```
git config --global pull.rebase true
```

### Editar ficheiros GAS

1. Abrir [script.google.com](https://script.google.com)
2. Editar o ficheiro `.gs` correspondente
3. Para alterações a `doPost` ou `doGet`: **Implementar → Gerir implementações → Nova versão → Implementar**
4. Para funções de menu ou de teste: não é necessário republicar; recarregar o Sheets é suficiente

---

## Configuração (config.js)

```javascript
GAS_ENDPOINT:   // URL do Web App GAS
BATCH_SIZE: 20  // Fotos carregadas por batch no scroll infinito
```

---

## Pendências Conhecidas

- **Páginas de redirect no webhook (prioridade alta):** o pipeline automático não gera consistentemente as páginas `foto/<id>.html` para fotos novas. Até estar corrigido, regenerar manualmente após cada lote via **Galeria → ↻ Gerar páginas de partilha**.
- **Clasp+TS:** os ficheiros GAS não estão no Git. Migrar para Clasp para ter histórico de versões e edição local.
- **Notificação de lote:** sem notificação quando o processamento diário termina.
- **config.js obsoleto:** `FLIP_ENABLED` e `FLIP_AUTO_CLOSE_MS` já não são usados. Remover numa iteração futura.
- **Páginas de redirect ao despublicar:** ao despublicar uma foto, a página `foto/<id>.html` não é removida do repositório automaticamente. Remoção manual via Git se necessário.
- **Cabeçalho em mobile com touch:** o cabeçalho reaparece com hover (mouse), mas não há equivalente touch em mobile. A considerar numa iteração futura.
- **Fractais em mobile:** slots fractais com aspect-ratio podem criar espaços em mobile com uma coluna se as proporções das imagens forem muito diferentes. A monitorizar com o crescimento da galeria.
