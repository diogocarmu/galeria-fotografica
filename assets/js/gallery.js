/**
 * gallery.js — Render de cartões e scroll infinito.
 *
 * Responsabilidades:
 *   1. Construir cartões DOM (frente + verso — flip skeleton)
 *   2. Renderizar em batches via IntersectionObserver (invariante #6)
 *   3. Gerir estado de carregamento e erro
 *
 * Não faz fetch. Não conhece o GAS. Lê CONFIG e chama fetchFotos().
 */

"use strict";

// ── Referências DOM ──────────────────────────────────────────

const galleryEl  = document.getElementById("gallery");
const sentinelEl = document.getElementById("sentinel");
const loaderEl   = document.getElementById("loader");
const errorEl    = document.getElementById("error-msg");

// ── Estado interno ───────────────────────────────────────────

let allFotos   = [];   // Array completo após fetch + shuffle
let rendered   = 0;    // Quantas fotos já foram renderizadas

// ── Construção de cartão ─────────────────────────────────────

/**
 * Cria o elemento DOM de um cartão fotográfico.
 * Estrutura preparada para flip (invariante #12).
 *
 * @param {Foto} foto
 * @returns {HTMLElement}
 */
function criarCartao(foto) {
  const article = document.createElement("article");
  article.className = `card card--${foto.orientacao}`;
  article.dataset.id   = foto.id;
  article.dataset.flip = CONFIG.FLIP_ENABLED ? "true" : "false";
  article.style.aspectRatio = CONFIG.RATIOS[foto.orientacao];

  // ── Frente ────────────────────────────────────────────────
  const front = document.createElement("div");
  front.className = "card__face card__face--front";

  const img = document.createElement("img");
  img.src     = foto.url_imagem;
  img.alt     = foto.titulo || "Fotografia";
  img.loading = "lazy";                          // browser-native lazy load
  img.decoding = "async";

  front.appendChild(img);

  // ── Verso (flip skeleton — conteúdo vazio até sessão flip) ─
  const back = document.createElement("div");
  back.className = "card__face card__face--back";
  back.setAttribute("aria-hidden", "true");      // invisível para leitores de ecrã por agora

  // Campos presentes mas sem estilo final — sessão flip completa
  back.innerHTML = `
    <div class="card__back-inner">
      <h2 class="card__titulo">${escapeHtml(foto.titulo)}</h2>
      <p class="card__texto">${escapeHtml(foto.texto_editorial)}</p>
      <p class="card__camera">${escapeHtml(foto.camera)}</p>
    </div>
  `;

  // ── Montagem ───────────────────────────────────────────────
  const inner = document.createElement("div");
  inner.className = "card__inner";
  inner.appendChild(front);
  inner.appendChild(back);
  article.appendChild(inner);

  // Flip listener — só ativa quando FLIP_ENABLED=true
  if (CONFIG.FLIP_ENABLED) {
    article.addEventListener("click", () => {
      article.classList.toggle("card--flipped");
    });
  }

  return article;
}

// ── Render de batch ──────────────────────────────────────────

/**
 * Renderiza o próximo batch de fotos no DOM.
 * Chamado pelo IntersectionObserver quando sentinel entra no viewport.
 */
function renderBatch() {
  const batch = allFotos.slice(rendered, rendered + CONFIG.BATCH_SIZE);

  if (batch.length === 0) {
    // Todas as fotos renderizadas — remove sentinel
    sentinelEl.remove();
    observer.disconnect();
    return;
  }

  // DocumentFragment para inserção única no DOM (performance)
  const fragment = document.createDocumentFragment();
  batch.forEach((foto) => fragment.appendChild(criarCartao(foto)));
  galleryEl.appendChild(fragment);

  rendered += batch.length;
}

// ── IntersectionObserver ─────────────────────────────────────

const observer = new IntersectionObserver(
  (entries) => {
    if (entries[0].isIntersecting) {
      renderBatch();
    }
  },
  {
    root:       null,    // viewport
    rootMargin: "200px", // pré-carrega antes de chegar ao fundo
    threshold:  0,
  }
);

// ── Estado de UI ─────────────────────────────────────────────

function mostrarLoader(visible) {
  loaderEl.style.display = visible ? "block" : "none";
}

function mostrarErro(msg) {
  errorEl.textContent = msg;
  errorEl.style.display = "block";
  loaderEl.style.display = "none";
  sentinelEl.remove();
}

// ── Bootstrap ────────────────────────────────────────────────

/**
 * Ponto de entrada. Chamado quando o DOM está pronto.
 */
async function iniciarGaleria() {
  mostrarLoader(true);

  try {
    allFotos = await fetchFotos();
  } catch (err) {
    console.error(err);
    mostrarErro("Não foi possível carregar a galeria. Tenta novamente mais tarde.");
    return;
  }

  mostrarLoader(false);

  // Primeiro batch imediato; restantes via observer
  renderBatch();
  observer.observe(sentinelEl);
}

// ── Utilitários ──────────────────────────────────────────────

/**
 * Escapa HTML para prevenir XSS nos dados vindos do GAS/Sheets.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── Init ─────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", iniciarGaleria);
