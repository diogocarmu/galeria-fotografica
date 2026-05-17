/**
 * gallery.js — Render de cartões e scroll infinito.
 *
 * Responsabilidades:
 *   1. Construir cartões DOM (frente + verso com flip)
 *   2. Gerir flip — um cartão aberto de cada vez
 *   3. Timer de fecho automático (10s)
 *   4. Render em batches via IntersectionObserver
 */

"use strict";

// ── Referências DOM ──────────────────────────────────────────

const galleryEl  = document.getElementById("gallery");
const sentinelEl = document.getElementById("sentinel");
const loaderEl   = document.getElementById("loader");
const errorEl    = document.getElementById("error-msg");

// ── Estado interno ───────────────────────────────────────────

let allFotos  = [];
let rendered  = 0;
let cardActivo = null;   // Cartão actualmente virado
let timerActivo = null;  // ID do setTimeout do fecho automático

// ── Gestão do flip ───────────────────────────────────────────

/**
 * Abre o verso de um cartão.
 * Fecha o cartão anterior se existir (invariante #20).
 * Inicia o timer de fecho automático (invariante #16).
 *
 * @param {HTMLElement} card
 */
function abrirFlip(card) {
  // Fecha o anterior sem animação de timer
  if (cardActivo && cardActivo !== card) {
    fecharFlip(cardActivo);
  }

  card.classList.add("card--flipped");
  cardActivo = card;

  // Inicia barra de timer
  const timer = card.querySelector(".card__timer");
  if (timer) {
    timer.classList.remove("card__timer--running");
    // Força reflow para reiniciar a transição CSS
    void timer.offsetWidth;
    timer.classList.add("card__timer--running");
  }

  // Timer de fecho automático (invariante #16)
  clearTimeout(timerActivo);
  timerActivo = setTimeout(() => {
    fecharFlip(card);
  }, CONFIG.FLIP_AUTO_CLOSE_MS);
}

/**
 * Fecha o verso de um cartão.
 * Cancela o timer se ainda estiver activo (invariante #17).
 *
 * @param {HTMLElement} card
 */
function fecharFlip(card) {
  card.classList.remove("card--flipped");

  const timer = card.querySelector(".card__timer");
  if (timer) {
    timer.classList.remove("card__timer--running");
  }

  if (cardActivo === card) {
    cardActivo = null;
  }

  clearTimeout(timerActivo);
  timerActivo = null;
}

// ── Construção do verso ──────────────────────────────────────

/**
 * Formata data "YYYY-MM-DD" para "DD MMM YYYY" em pt-PT.
 * @param {string|null} data
 * @returns {string}
 */
function formatarData(data) {
  if (!data) return "";
  try {
    const [ano, mes, dia] = data.split("-");
    const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
    return `${parseInt(dia)} ${meses[parseInt(mes) - 1]} ${ano}`;
  } catch {
    return data;
  }
}

/**
 * Constrói o elemento do verso do cartão.
 * @param {Foto} foto
 * @returns {HTMLElement}
 */
function criarVerso(foto) {
  const back = document.createElement("div");
  back.className = "card__face card__face--back";

  // Thumbnail
  const thumbDiv = document.createElement("div");
  thumbDiv.className = "card__back-thumb";
  const thumbImg = document.createElement("img");
  thumbImg.src     = foto.url_imagem;
  thumbImg.alt     = "";
  thumbImg.loading = "lazy";
  thumbDiv.appendChild(thumbImg);

  // Conteúdo textual
  const content = document.createElement("div");
  content.className = "card__back-content";

  // Botão fechar (invariante #17)
  const btnFechar = document.createElement("button");
  btnFechar.className = "card__close";
  btnFechar.setAttribute("aria-label", "Fechar");
  btnFechar.textContent = "✕";

  // Título
  const titulo = document.createElement("h2");
  titulo.className   = "card__titulo";
  titulo.textContent = escapeHtml(foto.titulo) || "";

  // Texto editorial
  const texto = document.createElement("p");
  texto.className   = "card__texto";
  texto.textContent = escapeHtml(foto.texto_editorial) || "";

  // Metadados
  const meta = document.createElement("div");
  meta.className = "card__meta";

  // Câmara
  if (foto.camera && foto.camera !== "desconhecida") {
    const itemCamera = document.createElement("span");
    itemCamera.className   = "card__meta-item";
    itemCamera.textContent = foto.camera;
    meta.appendChild(itemCamera);
  }

  // Data EXIF
  const dataFormatada = formatarData(foto.data_foto);
  if (dataFormatada) {
    const itemData = document.createElement("span");
    itemData.className   = "card__meta-item";
    itemData.textContent = dataFormatada;
    meta.appendChild(itemData);
  }

  // GPS — link para Google Maps (invariante #18 e #19)
  if (foto.coordenadas_gps) {
    const [lat, lng] = foto.coordenadas_gps.split(",");
    const itemGps = document.createElement("span");
    itemGps.className = "card__meta-item";
    const linkGps = document.createElement("a");
    linkGps.href   = `https://www.google.com/maps?q=${lat},${lng}`;
    linkGps.target = "_blank";
    linkGps.rel    = "noopener noreferrer";
    linkGps.textContent = `${parseFloat(lat).toFixed(4)}°, ${parseFloat(lng).toFixed(4)}°`;
    itemGps.appendChild(linkGps);
    meta.appendChild(itemGps);
  }

  // Barra de timer
  const timerBar = document.createElement("div");
  timerBar.className = "card__timer";

  // Montagem
  content.appendChild(btnFechar);
  content.appendChild(titulo);
  content.appendChild(texto);
  content.appendChild(meta);
  content.appendChild(timerBar);

  back.appendChild(thumbDiv);
  back.appendChild(content);

  return back;
}

// ── Construção do cartão ─────────────────────────────────────

/**
 * Cria o elemento DOM completo de um cartão fotográfico.
 * @param {Foto} foto
 * @returns {HTMLElement}
 */
function criarCartao(foto) {
  const article = document.createElement("article");
  article.className    = `card card--${foto.orientacao}`;
  article.dataset.id   = foto.id;
  article.style.aspectRatio = CONFIG.RATIOS[foto.orientacao];

  // Frente
  const front = document.createElement("div");
  front.className = "card__face card__face--front";

  const img = document.createElement("img");
  img.src      = foto.url_imagem;
  img.alt      = escapeHtml(foto.titulo) || "Fotografia";
  img.loading  = "lazy";
  img.decoding = "async";
  front.appendChild(img);

  // Verso
  const back = criarVerso(foto);

  // Inner
  const inner = document.createElement("div");
  inner.className = "card__inner";
  inner.appendChild(front);
  inner.appendChild(back);
  article.appendChild(inner);

  // Listeners de flip (invariantes #15, #17, #20)
  article.addEventListener("click", (e) => {
    // Clique no botão fechar
    if (e.target.closest(".card__close")) {
      e.stopPropagation();
      fecharFlip(article);
      return;
    }
    // Clique no link GPS — não dispara flip
    if (e.target.closest("a")) return;

    if (article.classList.contains("card--flipped")) {
      fecharFlip(article);
    } else {
      abrirFlip(article);
    }
  });

  return article;
}

// ── Render de batch ──────────────────────────────────────────

function renderBatch() {
  const batch = allFotos.slice(rendered, rendered + CONFIG.BATCH_SIZE);

  if (batch.length === 0) {
    sentinelEl.remove();
    observer.disconnect();
    return;
  }

  const fragment = document.createDocumentFragment();
  batch.forEach((foto) => fragment.appendChild(criarCartao(foto)));
  galleryEl.appendChild(fragment);

  rendered += batch.length;
}

// ── IntersectionObserver ─────────────────────────────────────

const observer = new IntersectionObserver(
  (entries) => {
    if (entries[0].isIntersecting) renderBatch();
  },
  { root: null, rootMargin: "200px", threshold: 0 }
);

// ── Estado de UI ─────────────────────────────────────────────

function mostrarLoader(visible) {
  loaderEl.style.display = visible ? "block" : "none";
}

function mostrarErro(msg) {
  errorEl.textContent    = msg;
  errorEl.style.display  = "block";
  loaderEl.style.display = "none";
  sentinelEl.remove();
}

// ── Bootstrap ────────────────────────────────────────────────

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
  injectStructuredData(allFotos);
  renderBatch();
  observer.observe(sentinelEl);
}

// ── Utilitários ──────────────────────────────────────────────

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