/**
 * gallery.js — Render de cartões e scroll infinito.
 *
 * Responsabilidades:
 *   1. Construir cartões DOM (frente + verso literário PT/EN)
 *   2. Gerir flip — um cartão aberto de cada vez
 *   3. Timer de fecho automático (10s) — pausa com tooltip aberto
 *   4. Tooltip "via IA" com disclaimer variável por confiança
 *   5. Render em batches via IntersectionObserver
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
let timerPausado = false;
let timerRestante = CONFIG.FLIP_AUTO_CLOSE_MS;
let timerInicio = null;

// ── Textos do disclaimer por confiança ───────────────────────

const DISCLAIMER = {
  alta:  "Texto seleccionado por IA com alta confiança de fidelidade ao original.",
  media: "Texto seleccionado por IA. A transcrição pode diferir do original.",
  baixa: "Texto seleccionado por IA. A transcrição pode diferir do original.",
};

// ── Gestão do flip ───────────────────────────────────────────

function abrirFlip(card) {
  if (cardActivo && cardActivo !== card) {
    fecharFlip(cardActivo);
  }

  card.classList.add("card--flipped");
  cardActivo    = card;
  timerPausado  = false;
  timerRestante = CONFIG.FLIP_AUTO_CLOSE_MS;
  timerInicio   = Date.now();

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

  // Fecha tooltip se estiver aberto
  const tooltip = card.querySelector(".card__tooltip");
  if (tooltip) tooltip.classList.remove("card__tooltip--visible");

  const timer = card.querySelector(".card__timer");
  if (timer) timer.classList.remove("card__timer--running");

  if (cardActivo === card) cardActivo = null;
  clearTimeout(timerActivo);
  timerActivo   = null;
  timerPausado  = false;
  timerRestante = CONFIG.FLIP_AUTO_CLOSE_MS;
}

function pausarTimer(card) {
  if (!timerPausado && timerInicio) {
    timerRestante -= Date.now() - timerInicio;
    timerPausado = true;
    clearTimeout(timerActivo);
    timerActivo = null;

    // Para a barra CSS no estado actual
    const timer = card.querySelector(".card__timer");
    if (timer) {
      const computed = getComputedStyle(timer).transform;
      timer.style.transition = "none";
      timer.style.transform  = computed;
      timer.classList.remove("card__timer--running");
    }
  }
}

function retomarTimer(card) {
  if (timerPausado && timerRestante > 0) {
    timerPausado = false;
    timerInicio  = Date.now();

    // Retoma a barra CSS com o tempo restante
    const timer = card.querySelector(".card__timer");
    if (timer) {
      const scaleActual = parseFloat(
        getComputedStyle(timer).transform.match(/matrix\(([^,]+)/)?.[1] || "1"
      );
      timer.style.transition = `transform ${timerRestante / 1000}s linear`;
      timer.style.transform  = "scaleX(0)";
    }

    timerActivo = setTimeout(() => fecharFlip(card), timerRestante);
  }
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

function criarBlocoTexto(lang, texto) {
  const bloco = document.createElement("div");
  bloco.className = "card__texto-bloco";

  const label = document.createElement("span");
  label.className   = "card__texto-lang";
  label.textContent = lang;

  const p = document.createElement("p");
  p.className   = "card__texto";
  p.textContent = (texto || "").replace(/\\n/g, "\n");

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

  // Textos literários — ordem: Original → PT → EN
  const textos = document.createElement("div");
  textos.className = "card__textos";

  const idioma  = (foto.idioma_original || "").toLowerCase();
  const textoOR = foto.texto_editorial || "";
  const textoPT = foto.texto_pt || "";
  const textoEN = foto.texto_en || "";

  const blocos = [];

  if (idioma !== "pt" && idioma !== "en" && textoOR) {
    blocos.push({ lang: idioma.toUpperCase(), texto: textoOR });
  }
  if (idioma === "pt" && textoOR) {
    blocos.push({ lang: "PT", texto: textoOR });
  } else if (idioma !== "pt" && textoPT) {
    blocos.push({ lang: "PT", texto: textoPT });
  }
  if (idioma === "en" && textoOR) {
    blocos.push({ lang: "EN", texto: textoOR });
  } else if (idioma !== "en" && textoEN) {
    blocos.push({ lang: "EN", texto: textoEN });
  }

  blocos.forEach((bloco, i) => {
    if (i > 0) {
      const sep = document.createElement("div");
      sep.className = "card__texto-sep";
      textos.appendChild(sep);
    }
    textos.appendChild(criarBlocoTexto(bloco.lang, bloco.texto));
  });

  // Atribuição — autor, ano e "· via IA"
  if (foto.autor_texto) {
    const attrDiv = document.createElement("div");
    attrDiv.className = "card__atribuicao-wrap";

    const attr = document.createElement("p");
    attr.className = "card__atribuicao";
    const ano = foto.ano_texto ? `, ${foto.ano_texto}` : "";
    attr.innerHTML = `<em>${escapeHtml(foto.autor_texto)}</em>${escapeHtml(ano)}`;

    // "· via IA" — só se houver info de confiança
    const confianca = (foto.confianca_texto || "media").toLowerCase();
    const disclaimer = DISCLAIMER[confianca] || DISCLAIMER.media;

    const viaIA = document.createElement("span");
    viaIA.className   = "card__via-ia";
    viaIA.textContent = " · via IA";
    viaIA.setAttribute("role", "button");
    viaIA.setAttribute("aria-label", "Informação sobre a selecção por IA");
    viaIA.setAttribute("tabindex", "0");

    // Tooltip
    const tooltip = document.createElement("div");
    tooltip.className   = "card__tooltip";
    tooltip.textContent = disclaimer;
    tooltip.setAttribute("role", "tooltip");

    attrDiv.appendChild(attr);
    attr.appendChild(viaIA);
    attrDiv.appendChild(tooltip);
    textos.appendChild(attrDiv);
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

  // Timer
  const timerBar = document.createElement("div");
  timerBar.className = "card__timer";

  // Montagem
  content.appendChild(btnFechar);
  content.appendChild(titulo);
  content.appendChild(textos);
  content.appendChild(meta);

  back.appendChild(thumbDiv);
  back.appendChild(content);
  back.appendChild(timerBar);

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

  // ── Listeners ────────────────────────────────────────────

  article.addEventListener("click", (e) => {
    // Botão fechar
    if (e.target.closest(".card__close")) {
      e.stopPropagation();
      fecharFlip(article);
      return;
    }

    // "via IA" — toggle tooltip + pausa/retoma timer
    const viaIA = e.target.closest(".card__via-ia");
    if (viaIA) {
      e.stopPropagation();
      const tooltip = article.querySelector(".card__tooltip");
      const isOpen  = tooltip?.classList.contains("card__tooltip--visible");

      // Fecha todos os outros tooltips
      document.querySelectorAll(".card__tooltip--visible").forEach(t => {
        t.classList.remove("card__tooltip--visible");
      });

      if (!isOpen) {
        tooltip?.classList.add("card__tooltip--visible");
        pausarTimer(article);
      } else {
        retomarTimer(article);
      }
      return;
    }

    // Clique num link (GPS) — não dispara flip
    if (e.target.closest("a")) return;

    // Fecha tooltip se aberto
    const tooltip = article.querySelector(".card__tooltip--visible");
    if (tooltip) {
      tooltip.classList.remove("card__tooltip--visible");
      retomarTimer(article);
      return;
    }

    // Flip
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
