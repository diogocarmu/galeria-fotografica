/**
 * gallery.js — Render de cartões, scroll infinito e modal lightbox.
 *
 * Responsabilidades:
 *   1. Construir cartões DOM (só frente — sem verso)
 *   2. Modal com 3 modos: ▢ (só foto) · ◫ (foto + texto) · T (só texto)
 *   3. Selector de idioma no modo ◫
 *   4. Tooltip "via IA" com disclaimer variável por confiança
 *   5. Render em batches via IntersectionObserver
 *   6. Scroll-lock do body quando o modal está aberto
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
let fotoActiva = null;   // objecto foto actualmente no modal
let modoActivo = "foto"; // "foto" | "foto-texto" | "texto"
let idiomaActivo = null; // código do idioma activo no modo ◫

// ── Textos do disclaimer por confiança ───────────────────────

const DISCLAIMER = {
  alta:  "Texto seleccionado por IA com alta confiança de fidelidade ao original.",
  media: "Texto seleccionado por IA. A transcrição pode diferir do original.",
  baixa: "Texto seleccionado por IA. A transcrição pode diferir do original.",
};

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

function normalizarTexto(str) {
  return (str || "").replace(/\\n/g, "\n");
}

// ── Construção dos blocos de idioma ──────────────────────────
//
// Devolve array de { lang, texto } na ordem:
//   original → PT → EN
// Reutiliza a lógica já validada do gallery.js anterior.

function calcularBlocos(foto) {
  const idioma  = (foto.idioma_original || "").toLowerCase();
  const textoOR = foto.texto_editorial || "";
  const textoPT = foto.texto_pt || "";
  const textoEN = foto.texto_en || "";

  const blocos = [];

  if (idioma !== "pt" && idioma !== "en" && textoOR) {
    blocos.push({ lang: idioma.toUpperCase(), texto: normalizarTexto(textoOR) });
  }
  if (idioma === "pt" && textoOR) {
    blocos.push({ lang: "PT", texto: normalizarTexto(textoOR) });
  } else if (idioma !== "pt" && textoPT) {
    blocos.push({ lang: "PT", texto: normalizarTexto(textoPT) });
  }
  if (idioma === "en" && textoOR) {
    blocos.push({ lang: "EN", texto: normalizarTexto(textoOR) });
  } else if (idioma !== "en" && textoEN) {
    blocos.push({ lang: "EN", texto: normalizarTexto(textoEN) });
  }

  return blocos;
}

// ── Scroll-lock ───────────────────────────────────────────────

function bloquearScroll() {
  document.body.style.overflow = "hidden";
}

function libertarScroll() {
  document.body.style.overflow = "";
}

// ══════════════════════════════════════════════════════════════
// MODAL — construção estática (uma vez, no DOMContentLoaded)
// ══════════════════════════════════════════════════════════════

let modalEl = null;

// Elementos internos do modal — preenchidos em construirModal()
let elFotoWrap      = null;
let elFotoInner     = null;
let elFotoImg       = null;
let elTituloOverlay = null;
let elExifOverlay   = null;
let elCorpo         = null;
let elTextoWrap     = null;
let elTitulo        = null;
let elTexto         = null;
let elAttrWrap      = null;
let elAttr          = null;
let elViaIa         = null;
let elTooltip       = null;
let elExifLinha     = null;
let elTextoColunas  = null;
let elIdiomas       = null;
let elRodapeTexto   = null;
let elTituloModoT   = null;
let elBtnFoto       = null;
let elBtnFotoTexto  = null;
let elBtnTexto      = null;

// Flags de nudge — disparam uma vez por sessão de navegação
let nudgeModosMostrado  = false;
let nudgeIdiomaMostrado = false;

function construirModal() {
  modalEl = document.createElement("div");
  modalEl.id        = "modal";
  modalEl.className = "modal";
  modalEl.setAttribute("role", "dialog");
  modalEl.setAttribute("aria-modal", "true");
  modalEl.setAttribute("aria-label", "Fotografia em destaque");

  // ── Barra superior ───────────────────────────────────────

  const barra = document.createElement("div");
  barra.className = "modal__barra";

  // Botões de modo
  const modos = document.createElement("div");
  modos.className = "modal__modos";

  elBtnFoto = criarBotaoModo("▢", "foto", "Modo: só fotografia");
  elBtnFotoTexto = criarBotaoModo("◫", "foto-texto", "Modo: fotografia e texto");
  elBtnTexto = criarBotaoModo("T", "texto", "Modo: só texto");

  modos.appendChild(elBtnFoto);
  modos.appendChild(elBtnFotoTexto);
  modos.appendChild(elBtnTexto);

  // Botão fechar
  const btnFechar = document.createElement("button");
  btnFechar.className = "modal__fechar";
  btnFechar.setAttribute("aria-label", "Fechar");
  btnFechar.textContent = "×";
  btnFechar.addEventListener("click", fecharModal);

  barra.appendChild(modos);
  barra.appendChild(btnFechar);

  // ── Corpo ────────────────────────────────────────────────

  elCorpo = document.createElement("div");
  elCorpo.className = "modal__corpo";

  // Área da foto
  elFotoWrap = document.createElement("div");
  elFotoWrap.className = "modal__foto-wrap";

  // Wrapper interno que abraça a foto real — overlays ancorados aqui
  elFotoInner = document.createElement("div");
  elFotoInner.className = "modal__foto-inner";

  elFotoImg = document.createElement("img");
  elFotoImg.className = "modal__foto";
  elFotoImg.alt       = "";

  // Título sobreimposto (modo ▢)
  elTituloOverlay = document.createElement("div");
  elTituloOverlay.className = "modal__titulo-overlay";

  // EXIF overlay (modo ▢)
  elExifOverlay = document.createElement("div");
  elExifOverlay.className = "modal__exif-overlay";

  elFotoInner.appendChild(elFotoImg);
  elFotoInner.appendChild(elTituloOverlay);
  elFotoInner.appendChild(elExifOverlay);
  elFotoWrap.appendChild(elFotoInner);

  // Área do texto (modo ◫)
  elTextoWrap = document.createElement("div");
  elTextoWrap.className = "modal__texto-wrap";

  elTitulo = document.createElement("h2");
  elTitulo.className = "modal__titulo";

  elTexto = document.createElement("p");
  elTexto.className = "modal__texto";

  // Atribuição + via IA (partilhada entre ◫ e T)
  elAttrWrap = document.createElement("div");
  elAttrWrap.className = "modal__atribuicao-wrap";

  elAttr = document.createElement("p");
  elAttr.className = "modal__atribuicao";

  elViaIa = document.createElement("span");
  elViaIa.className = "modal__via-ia";
  elViaIa.textContent = " · via IA";
  elViaIa.setAttribute("role", "button");
  elViaIa.setAttribute("aria-label", "Informação sobre a selecção por IA");
  elViaIa.setAttribute("tabindex", "0");
  elViaIa.addEventListener("click", (e) => {
    e.stopPropagation();
    elTooltip.classList.toggle("modal__tooltip--visible");
  });

  elTooltip = document.createElement("div");
  elTooltip.className = "modal__tooltip";
  elTooltip.setAttribute("role", "tooltip");

  elAttr.appendChild(elViaIa);
  elAttrWrap.appendChild(elAttr);
  elAttrWrap.appendChild(elTooltip);

  // EXIF em linha (modos ◫ e T)
  elExifLinha = document.createElement("div");
  elExifLinha.className = "modal__exif-linha";

  // Selector de idioma — entre título e texto, dentro da área de texto
  elIdiomas = document.createElement("div");
  elIdiomas.className = "modal__idiomas";

  elTextoWrap.appendChild(elTitulo);
  elTextoWrap.appendChild(elIdiomas);
  elTextoWrap.appendChild(elTexto);
  elTextoWrap.appendChild(elAttrWrap);
  elTextoWrap.appendChild(elExifLinha);

  // Título no modo T — acima das colunas
  elTituloModoT = document.createElement("h2");
  elTituloModoT.className = "modal__titulo-modoT";

  // Colunas para modo T
  elTextoColunas = document.createElement("div");
  elTextoColunas.className = "modal__texto-colunas";

  // Rodapé modo T: atribuição + EXIF em linha horizontal abaixo das colunas
  elRodapeTexto = document.createElement("div");
  elRodapeTexto.className = "modal__rodape-texto";

  elCorpo.appendChild(elFotoWrap);
  elCorpo.appendChild(elTextoWrap);
  elCorpo.appendChild(elTituloModoT);
  elCorpo.appendChild(elTextoColunas);
  elCorpo.appendChild(elRodapeTexto);

  modalEl.appendChild(barra);
  modalEl.appendChild(elCorpo);

  // ── Fechar ao clicar no fundo (fora do conteúdo) ────────
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) fecharModal();
  });

  document.body.appendChild(modalEl);
}

function criarBotaoModo(simbolo, modo, label) {
  const btn = document.createElement("button");
  btn.className = "modal__modo-btn";
  btn.textContent = simbolo;
  btn.setAttribute("aria-label", label);
  btn.dataset.modo = modo;
  btn.addEventListener("click", () => definirModo(modo));
  return btn;
}

// ══════════════════════════════════════════════════════════════
// MODAL — abrir / fechar
// ══════════════════════════════════════════════════════════════

function abrirModal(foto) {
  fotoActiva = foto;
  const blocos = calcularBlocos(foto);

  // Foto
  elFotoImg.src = foto.url_imagem;
  elFotoImg.alt = escapeHtml(foto.titulo) || "Fotografia";

  // Título overlay (modo ▢)
  elTituloOverlay.textContent = foto.titulo || "";

  // EXIF overlay (modo ▢)
  preencherExif(elExifOverlay, foto, true);

  // EXIF linha (modos ◫ e T)
  preencherExif(elExifLinha, foto, false);

  // Título no modo ◫ e modo T
  elTitulo.textContent    = foto.titulo || "";
  elTituloModoT.textContent = foto.titulo || "";

  // Atribuição + via IA
  if (foto.autor_texto) {
    const ano = foto.ano_texto ? `, ${foto.ano_texto}` : "";
    elAttr.innerHTML = `<em>${escapeHtml(foto.autor_texto)}</em>${escapeHtml(ano)}`;
    elAttr.appendChild(elViaIa);
    const confianca = (foto.confianca_texto || "media").toLowerCase();
    elTooltip.textContent = DISCLAIMER[confianca] || DISCLAIMER.media;
    elAttrWrap.style.display = "";
  } else {
    elAttrWrap.style.display = "none";
  }
  elTooltip.classList.remove("modal__tooltip--visible");

  // Selector de idioma
  preencherIdiomas(blocos);

  // Colunas modo T
  preencherColunas(blocos, foto);

  // Idioma activo por defeito: primeiro bloco (original)
  idiomaActivo = blocos.length > 0 ? blocos[0].lang : null;
  actualizarTextoModoFotoTexto(blocos);

  // Abre sempre em modo ▢
  definirModo("foto");

  modalEl.classList.add("modal--aberto");
  bloquearScroll();

  // Foco na cruz para acessibilidade
  modalEl.querySelector(".modal__fechar")?.focus();
}

function fecharModal() {
  modalEl.classList.remove("modal--aberto");
  libertarScroll();
  elTooltip.classList.remove("modal__tooltip--visible");
  fotoActiva = null;
}

// ══════════════════════════════════════════════════════════════
// MODAL — modos
// ══════════════════════════════════════════════════════════════

function definirModo(modo) {
  modoActivo = modo;

  // Actualizar botões
  [elBtnFoto, elBtnFotoTexto, elBtnTexto].forEach(btn => {
    btn.classList.toggle("modal__modo-btn--activo", btn.dataset.modo === modo);
  });

  // Selector de idioma: visível só no modo ◫
  elIdiomas.style.display = modo === "foto-texto" ? "" : "none";

  // Limpar classes do corpo
  elCorpo.classList.remove("modal__corpo--com-foto", "modal__corpo--so-texto");

  // Visibilidade dos elementos
  switch (modo) {

    case "foto":
      elCorpo.classList.add("modal__corpo--com-foto");
      elFotoWrap.style.display      = "";
      elFotoWrap.classList.remove("modal__foto-wrap--crop");
      elFotoWrap.classList.add("modal__foto-wrap--full");
      // Modo ▢: usa elFotoInner para ancorar overlays à foto real
      elFotoInner.style.display     = "";
      elTituloOverlay.style.display = "";
      elExifOverlay.style.display   = "";
      elTextoWrap.style.display     = "none";
      elTextoColunas.style.display  = "none";
      elTituloModoT.style.display   = "none";
      elRodapeTexto.style.display   = "none";
      // Nudge nos botões inativos — uma vez por sessão
      if (!nudgeModosMostrado) {
        nudgeModosMostrado = true;
        [elBtnFotoTexto, elBtnTexto].forEach(btn => {
          btn.classList.remove("modal__modo-btn--nudge");
          void btn.offsetWidth; // reflow para reiniciar animação
          btn.classList.add("modal__modo-btn--nudge");
          btn.addEventListener("animationend", () => {
            btn.classList.remove("modal__modo-btn--nudge");
          }, { once: true });
        });
      }
      break;

    case "foto-texto":
      elCorpo.classList.add("modal__corpo--com-foto");
      elFotoWrap.style.display      = "";
      elFotoWrap.classList.remove("modal__foto-wrap--full");
      elFotoWrap.classList.add("modal__foto-wrap--crop");
      // Modo ◫: foto vai directo ao wrap (sem inner), overlays escondidos
      elFotoInner.style.display     = "none";
      elTituloOverlay.style.display = "none";
      elExifOverlay.style.display   = "none";
      elTextoWrap.style.display     = "";
      elTextoColunas.style.display  = "none";
      elTituloModoT.style.display   = "none";
      elRodapeTexto.style.display   = "none";
      // Nudge no selector de idioma — uma vez por sessão
      if (!nudgeIdiomaMostrado && elIdiomas.style.display !== "none") {
        nudgeIdiomaMostrado = true;
        elIdiomas.querySelectorAll(".modal__idioma-btn").forEach(btn => {
          btn.classList.remove("modal__idioma-btn--nudge");
          void btn.offsetWidth;
          btn.classList.add("modal__idioma-btn--nudge");
          btn.addEventListener("animationend", () => {
            btn.classList.remove("modal__idioma-btn--nudge");
          }, { once: true });
        });
      }
      break;

    case "texto":
      elCorpo.classList.add("modal__corpo--so-texto");
      elFotoWrap.style.display      = "none";
      elTextoWrap.style.display     = "none";
      elTituloModoT.style.display   = "";
      elTextoColunas.style.display  = "";
      elRodapeTexto.style.display   = "";
      // Mover atribuição e EXIF para o rodapé do modo T
      elRodapeTexto.appendChild(elAttrWrap);
      elRodapeTexto.appendChild(elExifLinha);
      break;
  }

  // Quando sai do modo texto, devolve atribuição e EXIF ao textoWrap
  if (modo !== "texto") {
    elTextoWrap.appendChild(elAttrWrap);
    elTextoWrap.appendChild(elExifLinha);
  }
}

// ══════════════════════════════════════════════════════════════
// MODAL — selector de idioma
// ══════════════════════════════════════════════════════════════

function preencherIdiomas(blocos) {
  elIdiomas.innerHTML = "";

  if (blocos.length <= 1) {
    elIdiomas.style.display = "none";
    return;
  }

  blocos.forEach((bloco, i) => {
    if (i > 0) {
      const sep = document.createElement("span");
      sep.className   = "modal__idioma-sep";
      sep.textContent = "·";
      elIdiomas.appendChild(sep);
    }

    const btn = document.createElement("button");
    btn.className   = "modal__idioma-btn";
    btn.textContent = bloco.lang;
    btn.dataset.lang = bloco.lang;
    btn.addEventListener("click", () => {
      idiomaActivo = bloco.lang;
      actualizarTextoModoFotoTexto(blocos);
      actualizarBotoesIdioma();
    });
    elIdiomas.appendChild(btn);
  });

  actualizarBotoesIdioma();
}

function actualizarBotoesIdioma() {
  elIdiomas.querySelectorAll(".modal__idioma-btn").forEach(btn => {
    btn.classList.toggle("modal__idioma-btn--activo", btn.dataset.lang === idiomaActivo);
  });
}

function actualizarTextoModoFotoTexto(blocos) {
  const bloco = blocos.find(b => b.lang === idiomaActivo) || blocos[0];
  if (bloco) {
    elTexto.textContent = bloco.texto;
  }
}

// ══════════════════════════════════════════════════════════════
// MODAL — colunas modo T
// ══════════════════════════════════════════════════════════════

function preencherColunas(blocos, foto) {
  elTextoColunas.innerHTML = "";

  blocos.forEach((bloco, i) => {
    const col = document.createElement("div");
    col.className = i === 0
      ? "modal__coluna modal__coluna--original"
      : "modal__coluna modal__coluna--secundaria";

    const lang = document.createElement("span");
    lang.className   = "modal__coluna-lang";
    lang.textContent = bloco.lang;

    const texto = document.createElement("p");
    texto.className   = "modal__coluna-texto";
    texto.textContent = bloco.texto;

    col.appendChild(lang);
    col.appendChild(texto);
    elTextoColunas.appendChild(col);
  });
}

// ══════════════════════════════════════════════════════════════
// MODAL — EXIF
// ══════════════════════════════════════════════════════════════

function preencherExif(container, foto, overlay) {
  container.innerHTML = "";

  const items = [];

  if (foto.camera && foto.camera !== "desconhecida") {
    items.push({ texto: foto.camera, link: null });
  }

  const dataFormatada = formatarData(foto.data_foto);
  if (dataFormatada) {
    items.push({ texto: dataFormatada, link: null });
  }

  if (foto.coordenadas_gps) {
    const [lat, lng] = foto.coordenadas_gps.split(",");
    const lat4 = parseFloat(lat).toFixed(4);
    const lng4 = parseFloat(lng).toFixed(4);
    items.push({
      texto: `${lat4}°, ${lng4}°`,
      link:  `https://www.google.com/maps?q=${lat},${lng}`,
    });
  }

  items.forEach((item) => {
    if (item.link) {
      const a = document.createElement("a");
      a.href    = item.link;
      a.target  = "_blank";
      a.rel     = "noopener noreferrer";
      a.textContent = item.texto;
      container.appendChild(a);
    } else {
      const span = document.createElement("span");
      span.textContent = item.texto;
      container.appendChild(span);
    }
  });
}

// ══════════════════════════════════════════════════════════════
// CARTÃO — construção (só frente)
// ══════════════════════════════════════════════════════════════

function criarCartao(foto) {
  const article = document.createElement("article");
  article.className  = `card card--${foto.orientacao}`;
  article.dataset.id = foto.id;
  // aspectRatio e height controlados em responsive.css

  const face = document.createElement("div");
  face.className = "card__face card__face--front";

  const img = document.createElement("img");
  img.src      = foto.url_imagem;
  img.alt      = escapeHtml(foto.titulo) || "Fotografia";
  img.loading  = "lazy";
  img.decoding = "async";
  face.appendChild(img);

  article.appendChild(face);

  article.addEventListener("click", () => abrirModal(foto));

  return article;
}

// ══════════════════════════════════════════════════════════════
// RENDER — batch + IntersectionObserver
// ══════════════════════════════════════════════════════════════

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

const observer = new IntersectionObserver(
  (entries) => { if (entries[0].isIntersecting) renderBatch(); },
  { root: null, rootMargin: "200px", threshold: 0 }
);

// ── Estado de UI ─────────────────────────────────────────────

function mostrarLoader(visible) {
  loaderEl.style.display = visible ? "block" : "none";
}

function mostrarErro(msg) {
  errorEl.textContent   = msg;
  errorEl.style.display = "block";
  loaderEl.style.display = "none";
  sentinelEl.remove();
}

// ── ESC para fechar modal ─────────────────────────────────────

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalEl?.classList.contains("modal--aberto")) {
    fecharModal();
  }
});

// ── Bootstrap ─────────────────────────────────────────────────

async function iniciarGaleria() {
  construirModal();
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
