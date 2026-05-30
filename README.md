# Nau Contraluz

Site estático com galeria fotográfica interativa, publicado em GitHub Pages. Cada fotografia tem um modal com um texto literário real (poema, aforismo ou citação) selecionado por IA, apresentado no idioma original do autor, em português e em inglês.

**URL:** https://diogocarmu.github.io/galeria-fotografica/

---

## Arquitectura

O sistema é um pipeline híbrido (local + nuvem) que transforma fotografias em bruto em cartões digitais interativos.

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
├── index.html              # Shell estático — SEO, Open Graph, JSON-LD
├── sitemap.xml             # Gerado e commitado automaticamente pelo GAS
├── robots.txt              # Permite crawl total; bloqueia /foto/ a crawlers
│
├── foto/                   # Páginas de redirect por foto (geradas pelo GAS)
│   └── <id>.html           # Redirect + Open Graph para partilha em redes sociais
│
└── assets/
    ├── css/
    │   ├── reset.css       # Reset global, scrollbar oculta
    │   ├── gallery.css     # Tokens, cartões, modal lightbox, cartões verso, cabeçalho
    │   └── responsive.css  # CSS Columns para grelha; CSS Grid para slots fractais; breakpoints
    └── js/
        ├── config.js       # Único ficheiro a editar — endpoint GAS e parâmetros
        ├── api.js          # Fetch ao GAS + shuffle Fisher-Yates
        ├── seo.js          # JSON-LD dinâmico (ImageGallery + ImageObject)
        └── gallery.js      # Render de cartões (foto/verso/fractal), modal lightbox,
                            # scroll infinito, partilha via hash e botão ⤴, cabeçalho flutuante
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
| `09_github.gs` | Função partilhada `commitFicheiroGithub()` — integração com GitHub API |

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

Clicar numa fotografia abre um modal a ecrã inteiro com três modos de visualização, alternáveis por ícones na barra superior.

**Estrutura permanente:**
- Barra topo (desktop): `Título da fotografia | ▢ ◫ T ×`
- Barra topo (mobile): linha 1 = título; linha 2 = `▢ ◫ T` (esquerda) + `×` (direita)
- Barra fundo: câmara · data · coordenadas GPS · `⤴` (partilha)

**Modos:**

| Ícone | Modo | Descrição |
|---|---|---|
| `▢` | Só foto | Foto centrada com `object-fit: contain`. Fundo preto. |
| `◫` | Foto + texto | Foto cropped à esquerda (50% desktop, 45vh mobile). Texto, selector de idioma e autor à direita/baixo. |
| `T` | Só texto | Colunas por idioma (original maior, secundárias atenuadas). Autor imediatamente após coluna original. |

O selector de idioma aparece no modo `◫`. O idioma original aparece sempre primeiro. O título na barra troca quando o utilizador muda de idioma (usa `titulo_pt` / `titulo_en`; fallback para `titulo`). Fecha com `×` ou tecla `ESC`.

---

## Grelha

A galeria usa CSS Columns com três tipos de entrada, calculados antes do primeiro render:

- **Cartão foto** (tipo normal): fotografia com `object-fit: cover`.
- **Cartão verso** (máx. 30%): quadrado com cor de fundo da paleta Nau Contraluz, título no idioma original, texto literário e atribuição. Hover revela a fotografia por baixo. Só elegível se a foto tiver `texto_editorial`.
- **Slot fractal** (máx. 30% dos cartões fotográficos): um slot subdividido em subfotos usando CSS Grid interno.
  - `landscape` → 1×2 (2 fotos lado a lado)
  - `portrait` → 2×1 (2 fotos empilhadas)
  - `square` → 2×2 (4 fotos)

Regras de distribuição:
- Nunca dois cartões do mesmo tipo especial (verso ou fractal) consecutivos.
- Verso e fractal podem encostar entre si.
- Cores dos versos em sequência round-robin: vermelho Tenenbaum → amarelo Linha Amarela → azul Marinho → verde Escutismo → rosa Pastel.

**Nota:** a classificação `square` em `processor.py` usa tolerância de 2% — fotos com diferença inferior a 2% entre largura e altura são classificadas como `square`. Fotos antigas incorrectamente classificadas devem ser corrigidas manualmente na coluna H do Sheets.

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
Abre a galeria com o modal da foto em modo `◫` (foto + texto). Gerado automaticamente ao abrir qualquer modal; limpo ao fechar.

**URL de redirect com Open Graph:**
```
https://diogocarmu.github.io/galeria-fotografica/foto/<id>.html
```
Usado para partilha em WhatsApp, iMessage, Telegram, LinkedIn, etc. Mostra pré-visualização com foto, título e descrição ("Uma fotografia, um texto de [Autor], [Ano]."). Redireciona automaticamente para o URL da galeria com hash.

Ambos os URLs são gerados e commitados automaticamente pelo GAS após cada foto nova.

---

## Pipeline Python

**Localização:** `I:\O meu disco\Galeria_Online\galeria-python\`

**Ficheiros:**

| Ficheiro | Responsabilidade |
|---|---|
| `config.py` | Caminhos, endpoint GAS, limites — único ficheiro a editar |
| `processor.py` | Extracção EXIF, redimensionamento, conversão WebP |
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
4. O GAS processa a foto, grava no Sheets, e faz commit automático do sitemap e da página de redirect
5. A foto aparece no site e o link de partilha está disponível no próximo refresh do browser

### Publicar / despublicar fotos

No Google Sheets → menu **Galeria → ✓ Publicar seleccionadas** ou **✕ Despublicar seleccionadas**

### Regenerar sitemap manualmente

No Google Sheets → menu **Galeria → ↻ Gerar sitemap.xml**

Faz commit directo para o repositório — não é necessário push manual.

### Corrigir textos em falta

No Google Sheets → menu **Galeria → ✦ Corrigir textos em falta**

Detecta fotos publicadas sem `titulo` ou `texto_editorial` e chama o Gemini para preencher todos os campos literários (colunas D, E, M, N, O, P, Q, R, S, T). Processa no máximo 5 fotos por execução. Correr novamente se houver mais.

### Regenerar todas as páginas de partilha

No Google Sheets → menu **Galeria → ↻ Gerar páginas de partilha**

Útil após alterações ao template Open Graph ou ao texto de descrição.
Faz commit de todas as páginas de redirect para o repositório.

---

## Manutenção do Site

### Editar ficheiros do site

```
cd "I:\O meu disco\Galeria_Online\galeria-fotografica"
# editar ficheiros no VS Code
git add .
git commit -m "tipo: descrição"
git push
```

### Editar ficheiros GAS

1. Abrir [script.google.com](https://script.google.com)
2. Editar o ficheiro `.gs` correspondente
3. Para alterações a `doPost` ou `doGet`: **Implementar → Gerir implementações → Nova versão → Implementar**
4. Para funções de teste: correr directamente no editor sem republicar

---

## Configuração (config.js)

```javascript
GAS_ENDPOINT:   // URL do Web App GAS
BATCH_SIZE: 20  // Fotos carregadas por batch no scroll infinito
```

---

## Débitos Conhecidos

- **Clasp+TS:** os ficheiros GAS não estão no Git. Migrar para Clasp para ter histórico de versões e edição local.
- **Notificação de lote:** sem notificação quando o processamento diário termina.
- **config.js obsoleto:** `FLIP_ENABLED` e `FLIP_AUTO_CLOSE_MS` já não são usados. Remover numa iteração futura.
- **Páginas de redirect ao despublicar:** ao despublicar uma foto, a página `foto/<id>.html` não é removida do repositório automaticamente. Remoção manual via Git se necessário.
- **Cabeçalho em mobile com touch:** o cabeçalho reaparece com hover (mouse), mas não há equivalente touch em mobile. A considerar numa iteração futura (ex: tap no topo da página).
- **Fractais em mobile:** slots fractais com `aspect-ratio` podem criar espaços em mobile com uma coluna se as proporções das imagens forem muito diferentes. A monitorizar com o crescimento da galeria.
