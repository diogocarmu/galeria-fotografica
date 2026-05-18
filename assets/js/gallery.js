/**
 * gallery.js — Render de cartões e scroll infinito.
 *
 * Responsabilidades:
 *   1. Construir cartões DOM (frente + verso literário PT/EN)
 *   2. Gerir flip — um cartão aberto de cada vez
 *   3. Timer de fecho automático (10s)
 *   4. Render em batches via IntersectionObserver
 */

"use strict";

// ── Referências DOM ──────────────────────────────────────────

const galleryEl   = document.getElementById("gallery");
const sentinelEl  = document.getElementById("sentinel");
const loaderEl    = document.getElementById("loader");
const errorEl     = document.getElementById("error-msg");

// ── Estado interno ───────────────────────────────────────────

let allFotos    = [];
let rendered    = 0;
let cardActivo  = null;
let timerActivo = null;

// ── Gestão do flip ───────────────────────────────────────────

function abrirFlip(card) {
  if (cardActivo && cardActivo !== card) {
    fecharFlip(cardActivo);
  }

  card.classList.add("card--flipped");
  cardActivo = card;

  const timer = card.querySelector(".card__timer");
  if (timer) {
    timer.classList.remove("card__timer--running");
    void timer.offsetWidth;
    timer.classList.add("card__timer--running");
  }

  clearTimeout(timerActivo);
  timerActivo = setTimeout(() => fecharFlip(card), CONFIG.FLIP_AUTO_CLOSE_MS);
}

function fecharFlip(card) {
  card.classList.remove("card--flipped");

  const timer = card.querySelector(".card__timer");
  if (timer) timer.classList.remove("card__timer--running");

  if (cardActivo === card) cardActivo = null;
  clearTimeout(timerActivo);
  timerActivo = null;
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

// ── Construção do bloco de texto literário ───────────────────

/**
 * Cria um bloco com label de língua + texto do poema/citação.
 * Usa textContent para segurança XSS — white-space:pre-wrap
 * preserva as quebras de linha (\n) do texto literário.
 *
 * @param {string} lang   — ex: "PT" ou "EN"
 * @param {string} texto  — texto com \n para quebras de linha
 * @returns {HTMLElement}
 */
function criarBlocoTexto(lang, texto) {
  const bloco = document.createElement("div");
  bloco.className = "card__texto-bloco";

  const label = document.createElement("span");
  label.className   = "card__texto-lang";
  label.textContent = lang;

  const p = document.createElement("p");
  p.className   = "card__texto";
  p.textContent = texto || ""; // textContent respeita \n com white-space:pre-wrap

  bloco.appendChild(label);
  bloco.appendChild(p);
  return bloco;
}

// ── Construção do verso ──────────────────────────────────────

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

  // Conteúdo
  const content = document.createElement("div");
  content.className = "card__back-content";

  // Botão fechar
  const btnFechar = document.createElement("button");
  btnFechar.className = "card__close";
  btnFechar.setAttribute("aria-label", "Fechar");
  btnFechar.textContent = "✕";

  // Título
  const titulo = document.createElement("h2");
  titulo.className   = "card__titulo";
  titulo.textContent = foto.titulo || "";

  // Textos literários PT + EN
  const textos = document.createElement("div");
  textos.className = "card__textos";

  const idioma = (foto.idioma_original || "").toLowerCase();

  // Determina ordem e conteúdo PT/EN
  // Regra: mostra sempre PT e EN, nunca o original separado
  // Se original é PT → texto_pt é o original, texto_en é tradução
  // Se original é EN → texto_en é o original, texto_pt é tradução
  // Se outro idioma → texto_pt e texto_en são ambos traduções
  const textoPT = foto.texto_pt || foto.texto_editorial || "";
  const textoEN = foto.texto_en || "";

  if (textoPT) {
    textos.appendChild(criarBlocoTexto("PT", textoPT));
  }

  if (textoEN && textoPT) {
    const sep = document.createElement("div");
    sep.className = "card__texto-sep";
    textos.appendChild(sep);
  }

  if (textoEN) {
    textos.appendChild(criarBlocoTexto("EN", textoEN));
  }

  // Atribuição — autor e ano
  if (foto.autor_texto) {
    const attr = document.createElement("p");
    attr.className = "card__atribuicao";
    const ano = foto.ano_texto ? `, ${foto.ano_texto}` : "";
    attr.innerHTML = `<em>${escapeHtml(foto.autor_texto)}</em>${escapeHtml(ano)}`;
    textos.appendChild(attr);
  }

  // Metadados — câmara, data, GPS
  const meta = document.createElement("div");
  meta.className = "card__meta";

  if (foto.camera && foto.camera !== "desconhecida") {
    const itemCamera = document.createElement("span");
    itemCamera.className   = "card__meta-item";
    itemCamera.textContent = foto.camera;
    meta.appendChild(itemCamera);
  }

  const dataFormatada = formatarData(foto.data_foto);
  if (dataFormatada) {
    const itemData = document.createElement("span");
    itemData.className   = "card__meta-item";
    itemData.textContent = dataFormatada;
    meta.appendChild(itemData);
  }

  if (foto.coordenadas_gps) {
    const [lat, lng] = foto.coordenadas_gps.split(",");
    const itemGps = document.createElement("span");
    itemGps.className = "card__meta-item";
    const linkGps = document.createElement("a");
    linkGps.href    = `https://www.google.com/maps?q=${lat},${lng}`;
    linkGps.target  = "_blank";
    linkGps.rel     = "noopener noreferrer";
    linkGps.textContent = `${parseFloat(lat).toFixed(4)}°, ${parseFloat(lng).toFixed(4)}°`;
    itemGps.appendChild(linkGps);
    meta.appendChild(itemGps);
  }

  // Timer — filho directo do .card__face--back
  const timerBar = document.createElement("div");
  timerBar.className = "card__timer";

  // Montagem
  content.appendChild(btnFechar);
  content.appendChild(titulo);
  content.appendChild(textos);
  content.appendChild(meta);

  back.appendChild(thumbDiv);
  back.appendChild(content);
  back.appendChild(timerBar);  // fora do content — não sobe com scroll

  return back;
}

// ── Construção do cartão ─────────────────────────────────────

function criarCartao(foto) {
  const article = document.createElement("article");
  article.className         = `card card--${foto.orientacao}`;
  article.dataset.id        = foto.id;
  article.style.aspectRatio = CONFIG.RATIOS[foto.orientacao];

  const front = document.createElement("div");
  front.className = "card__face card__face--front";

  const img = document.createElement("img");
  img.src      = foto.url_imagem;
  img.alt      = escapeHtml(foto.titulo) || "Fotografia";
  img.loading  = "lazy";
  img.decoding = "async";
  front.appendChild(img);

  const back  = criarVerso(foto);
  const inner = document.createElement("div");
  inner.className = "card__inner";
  inner.appendChild(front);
  inner.appendChild(back);
  article.appendChild(inner);

  article.addEventListener("click", (e) => {
    if (e.target.closest(".card__close")) {
      e.stopPropagation();
      fecharFlip(article);
      return;
    }
    if (e.target.closest("a")) return;

    article.classList.contains("card--flipped")
      ? fecharFlip(article)
      : abrirFlip(article);
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
  (entries) => { if (entries[0].isIntersecting) renderBatch(); },
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

document.addEventListener("DOMContentLoaded", iniciarGaleria);
