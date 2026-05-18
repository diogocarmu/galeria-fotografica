# Galeria Fotográfica

Site estático com galeria fotográfica interativa, publicado em GitHub Pages. Cada fotografia tem um verso com um texto literário real (poema, aforismo ou citação) selecionado por IA, apresentado no idioma original, em português e em inglês.

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
     ↓ endpoint GET público
GitHub Pages            ← site estático
```

---

## Estrutura do Repositório

```
galeria-fotografica/
│
├── index.html              # Shell estático — SEO, Open Graph, JSON-LD
├── sitemap.xml             # Gerado pelo GAS, commitado manualmente
├── robots.txt              # Permite crawl total incluindo bots de IA
│
└── assets/
    ├── css/
    │   ├── reset.css       # Reset global, scrollbar oculta
    │   ├── gallery.css     # Layout, cartões, flip, verso literário, tooltip
    │   └── responsive.css  # Breakpoints mobile → desktop
    └── js/
        ├── config.js       # Único ficheiro a editar — endpoint GAS e parâmetros
        ├── api.js          # Fetch ao GAS + shuffle Fisher-Yates
        ├── seo.js          # JSON-LD dinâmico (ImageGallery + ImageObject)
        └── gallery.js      # Render de cartões, flip, timer, tooltip "via IA"
```

---

## Ficheiros GAS (Google Apps Script)

Vivem no editor web do GAS — **não estão no repositório**. Guardar cópias locais periodicamente.

| Ficheiro | Responsabilidade |
|---|---|
| `01_config.gs` | Lê propriedades do script (SHEET_ID, GEMINI_KEY, SHEET_NAME) |
| `02_sheets.gs` | Leitura e escrita no Google Sheets |
| `03_gemini.gs` | Curadoria literária via Gemini 2.5 Flash |
| `04_webhook.gs` | Receiver do POST do Python |
| `05_api.gs` | Endpoint GET público para o browser |
| `06_gestao.gs` | Menu "Galeria" no Sheets — publicar/despublicar/gerar sitemap |
| `07_sitemap.gs` | Gerador de sitemap.xml com image:image por foto |

**Propriedades do Script** (GAS → Projecto → Propriedades do script):

| Propriedade | Valor |
|---|---|
| `SHEET_ID` | ID do Google Sheets |
| `GEMINI_KEY` | Chave da API Gemini |
| `SHEET_NAME` | `galeria` |

---

## Schema do Google Sheets

Separador: `galeria`

| Col | Campo | Descrição |
|---|---|---|
| A | `id` | Hash MD5 do ficheiro original (12 chars) |
| B | `timestamp` | Data de processamento (ISO 8601) |
| C | `url_imagem` | URL público do Google Drive |
| D | `titulo` | Título gerado pela IA |
| E | `texto_editorial` | Texto literário no idioma original |
| F | `largura_original` | Largura em px antes de redimensionar |
| G | `altura_original` | Altura em px antes de redimensionar |
| H | `orientacao` | `landscape` / `portrait` / `square` |
| I | `camera` | Câmara extraída da EXIF |
| J | `coordenadas_gps` | `lat,lng` ou vazio |
| K | `publicada` | `TRUE` / `FALSE` |
| L | `data_foto` | Data EXIF (`YYYY-MM-DD`) |
| M | `autor_texto` | Autor do texto literário |
| N | `ano_texto` | Ano da obra |
| O | `texto_pt` | Versão portuguesa |
| P | `texto_en` | Versão inglesa |
| Q | `idioma_original` | Código do idioma (`pt`, `en`, `es`, etc.) |
| R | `confianca_texto` | `alta` / `media` / `baixa` |

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
4. Verificar resultado no Google Sheets
5. A foto aparece no site no próximo refresh do browser

### Publicar / despublicar fotos

No Google Sheets → menu **Galeria → ✓ Publicar seleccionadas** ou **✕ Despublicar seleccionadas**

### Actualizar o sitemap

No Google Sheets → menu **Galeria → ↻ Gerar sitemap.xml**

Depois:
1. Descarregar `sitemap.xml` da raiz do Google Drive
2. Copiar para a raiz do repositório
3. Fazer push:
```
git add sitemap.xml
git commit -m "chore: update sitemap"
git push
```

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
GAS_ENDPOINT:       // URL do Web App GAS
BATCH_SIZE: 20      // Fotos carregadas por batch no scroll infinito
FLIP_ENABLED: true  // Activar/desactivar flip dos cartões
FLIP_AUTO_CLOSE_MS: 10000  // Fecho automático do verso (ms)
```

---

## Débitos Conhecidos

- **Layout landscape:** fotos em modo landscape ficam pequenas em grelha de 4 colunas. Solução correcta: migrar para CSS Grid com `grid-auto-flow: dense` (landscape 2 colunas, portrait 1 coluna)
- **Clasp+TS:** os ficheiros GAS não estão no Git. Migrar para Clasp para ter histórico de versões e edição local
- **Regeneração de conteúdo:** não existe mecanismo para regenerar título/texto de fotos já publicadas quando o prompt melhora
- **Notificação de lote:** sem notificação quando o processamento diário termina
