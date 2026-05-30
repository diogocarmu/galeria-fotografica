/**
 * gallery.js — Render de cartões, scroll infinito e modal lightbox.
 *
 * Responsabilidades:
 *   1. Construir cartões DOM: frente (foto), verso (texto) e slots fractais
 *   2. Layout de grelha: 30% verso, 30% fractal (calculado antes do render)
 *   3. Modal com 3 modos: ▢ (só foto) · ◫ (foto + texto) · T (só texto)
 *   4. Selector de idioma no modo ◫
 *   5. Tooltip "via IA" com disclaimer variável por confiança
 *   6. Render em batches via IntersectionObserver
 *   7. Scroll-lock do body quando o modal está aberto
 *   8. Partilha por link directo via URL hash (#<id>)
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
let blocosActivos = [];  // blocos de texto da foto activa

// Layout pré-calculado: array de entradas consumidas pelo renderBatch
// Cada entrada: { tipo: "foto"|"verso"|"fractal", fotos: [...] }
let layoutGrelha = [];

// ── Hash pendente — foto ainda não renderizada ───────────────

let hashPendente = null; // id de foto a abrir assim que for renderizada

// ── Textos do disclaimer por confiança ───────────────────────

const DISCLAIMER = {
  alta:  "Texto seleccionado por IA com alta confiança de fidelidade ao original.",
  media: "Texto seleccionado por IA. A transcrição pode diferir do original.",
  baixa: "Texto seleccionado por IA. A transcrição pode diferir do original.",
};

// ── Paleta Wim Wenders — cores para cartões verso ────────────

const PALETA_WENDERS = [
  "vermelho-tenenbaum",
  "amarelo-linha",
  "azul-marinho",
  "verde-escutismo",
  "rosa-pastel",
];

let _indicePaletaVerso = 0;

function corVersoPróxima() {
  const cor = PALETA_WENDERS[_indicePaletaVerso % PALETA_WENDERS.length];
  _indicePaletaVerso++;
  return cor;
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

  // Bloco original — sempre primeiro
  if (idioma === "pt" && textoOR) {
    blocos.push({ lang: "PT", texto: normalizarTexto(textoOR) });
  } else if (idioma === "en" && textoOR) {
    blocos.push({ lang: "EN", texto: normalizarTexto(textoOR) });
  } else if (idioma && textoOR) {
    blocos.push({ lang: idioma.toUpperCase(), texto: normalizarTexto(textoOR) });
  }

  // Traduções — PT antes de EN, nunca repetir o original
  if (idioma !== "pt" && textoPT) {
    blocos.push({ lang: "PT", texto: normalizarTexto(textoPT) });
  }
  if (idioma !== "en" && textoEN) {
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
// PARTILHA — menu flutuante
// ══════════════════════════════════════════════════════════════

function urlPartilha(foto) {
  const base = window.location.origin + window.location.pathname.replace(/\/?$/, "");
  return `${base}/foto/${foto.id}.html`;
}

function abrirMenuPartilha() {
  if (!fotoActiva) return;
  menuPartilhaAberto = true;
  elMenuPartilha.classList.add("modal__menu-partilha--visivel");
  // Posicionar o menu acima do botão ⤴
  const rect = elBtnPartilha.getBoundingClientRect();
  elMenuPartilha.style.bottom = `${window.innerHeight - rect.top + 6}px`;
  elMenuPartilha.style.right  = `${window.innerWidth - rect.right}px`;
}

function fecharMenuPartilha() {
  menuPartilhaAberto = false;
  elMenuPartilha.classList.remove("modal__menu-partilha--visivel");
}

let _copiarTimeout = null;

function copiarLink() {
  if (!fotoActiva) return;
  const url = urlPartilha(fotoActiva);
  navigator.clipboard.writeText(url).then(() => {
    fecharMenuPartilha();
    elBtnPartilha.textContent = "✓";
    if (_copiarTimeout) clearTimeout(_copiarTimeout);
    _copiarTimeout = setTimeout(() => {
      elBtnPartilha.textContent = "⤴";
      _copiarTimeout = null;
    }, 1800);
  }).catch(() => {
    // Fallback para browsers sem clipboard API (improvável em HTTPS)
    fecharMenuPartilha();
  });
}

// ══════════════════════════════════════════════════════════════
// MODAL — construção estática (uma vez, no DOMContentLoaded)
// ══════════════════════════════════════════════════════════════

let modalEl = null;

// Elementos internos do modal — preenchidos em construirModal()
let elFotoWrap      = null;
let elFotoImg       = null;
let elBarraTitulo   = null;
let elRodapeExif    = null;
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

// Elementos de partilha
let elBtnPartilha   = null;
let elMenuPartilha  = null;
let menuPartilhaAberto = false;

function construirModal() {
  modalEl = document.createElement("div");
  modalEl.id        = "modal";
  modalEl.className = "modal";
  modalEl.setAttribute("role", "dialog");
  modalEl.setAttribute("aria-modal", "true");
  modalEl.setAttribute("aria-label", "Fotografia em destaque");

  // ── Barra superior: modos | título · fechar ──────────────

  const barra = document.createElement("div");
  barra.className = "modal__barra";

  const modos = document.createElement("div");
  modos.className = "modal__modos";

  elBtnFoto      = criarBotaoModo("▢", "foto",       "Modo: só fotografia");
  elBtnFotoTexto = criarBotaoModo("◫", "foto-texto",  "Modo: fotografia e texto");
  elBtnTexto     = criarBotaoModo("T", "texto",       "Modo: só texto");

  modos.appendChild(elBtnFoto);
  modos.appendChild(elBtnFotoTexto);
  modos.appendChild(elBtnTexto);

  // Separador e título na barra
  const barraSep = document.createElement("div");
  barraSep.className = "modal__barra-sep";
  barraSep.setAttribute("aria-hidden", "true");

  elBarraTitulo = document.createElement("span");
  elBarraTitulo.className = "modal__barra-titulo";

  const btnFechar = document.createElement("button");
  btnFechar.className = "modal__fechar";
  btnFechar.setAttribute("aria-label", "Fechar");
  btnFechar.textContent = "×";
  btnFechar.addEventListener("click", fecharModal);

  const barraControlos = document.createElement("div");
  barraControlos.className = "modal__barra-controlos";
  barraControlos.appendChild(modos);
  barraControlos.appendChild(barraSep);
  barraControlos.appendChild(btnFechar);

  barra.appendChild(elBarraTitulo);
  barra.appendChild(barraControlos);

  // ── Rodapé EXIF (modo ▢) — faixa em baixo ───────────────

  elRodapeExif = document.createElement("div");
  elRodapeExif.className = "modal__rodape-exif";

  // Botão de partilha ⤴ — inserido no rodapé após preencherExif()
  elBtnPartilha = document.createElement("button");
  elBtnPartilha.className = "modal__partilha-btn";
  elBtnPartilha.textContent = "⤴";
  elBtnPartilha.setAttribute("aria-label", "Partilhar fotografia");
  elBtnPartilha.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menuPartilhaAberto) {
      fecharMenuPartilha();
    } else {
      abrirMenuPartilha();
    }
  });

  // Menu flutuante de partilha
  elMenuPartilha = document.createElement("div");
  elMenuPartilha.className = "modal__menu-partilha";
  elMenuPartilha.setAttribute("role", "menu");

  const opcaoCopiar = document.createElement("button");
  opcaoCopiar.className = "modal__menu-partilha-item";
  opcaoCopiar.setAttribute("role", "menuitem");
  opcaoCopiar.textContent = "Copiar link";
  opcaoCopiar.addEventListener("click", (e) => {
    e.stopPropagation();
    copiarLink();
  });

  const opcaoWhatsApp = document.createElement("button");
  opcaoWhatsApp.className = "modal__menu-partilha-item";
  opcaoWhatsApp.setAttribute("role", "menuitem");
  opcaoWhatsApp.textContent = "WhatsApp";
  opcaoWhatsApp.addEventListener("click", (e) => {
    e.stopPropagation();
    const url = urlPartilha(fotoActiva);
    window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, "_blank", "noopener");
    fecharMenuPartilha();
  });

  elMenuPartilha.appendChild(opcaoCopiar);
  elMenuPartilha.appendChild(opcaoWhatsApp);

  // ── Corpo ────────────────────────────────────────────────

  elCorpo = document.createElement("div");
  elCorpo.className = "modal__corpo";

  // Área da foto (modos ▢ e ◫)
  elFotoWrap = document.createElement("div");
  elFotoWrap.className = "modal__foto-wrap";

  elFotoImg = document.createElement("img");
  elFotoImg.className = "modal__foto";
  elFotoImg.alt       = "";

  elFotoWrap.appendChild(elFotoImg);

  // Área do texto (modo ◫)
  elTextoWrap = document.createElement("div");
  elTextoWrap.className = "modal__texto-wrap";

  elTitulo = document.createElement("h2");
  elTitulo.className = "modal__titulo";

  elIdiomas = document.createElement("div");
  elIdiomas.className = "modal__idiomas";

  elTexto = document.createElement("p");
  elTexto.className = "modal__texto";

  // Atribuição + via IA
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

  elExifLinha = document.createElement("div");
  elExifLinha.className = "modal__exif-linha";

  elTextoWrap.appendChild(elTitulo);
  elTextoWrap.appendChild(elIdiomas);
  elTextoWrap.appendChild(elTexto);
  elTextoWrap.appendChild(elAttrWrap);
  elTextoWrap.appendChild(elExifLinha);

  // Modo T: título + colunas + rodapé
  elTituloModoT = document.createElement("h2");
  elTituloModoT.className = "modal__titulo-modoT";

  elTextoColunas = document.createElement("div");
  elTextoColunas.className = "modal__texto-colunas";

  elRodapeTexto = document.createElement("div");
  elRodapeTexto.className = "modal__rodape-texto";

  elCorpo.appendChild(elFotoWrap);
  elCorpo.appendChild(elTextoWrap);
  elCorpo.appendChild(elTituloModoT);
  elCorpo.appendChild(elTextoColunas);
  elCorpo.appendChild(elRodapeTexto);

  modalEl.appendChild(barra);
  modalEl.appendChild(elCorpo);
  modalEl.appendChild(elRodapeExif);
  modalEl.appendChild(elMenuPartilha);

  modalEl.addEventListener("click", (e) => {
    if (menuPartilhaAberto && !elMenuPartilha.contains(e.target) && e.target !== elBtnPartilha) {
      fecharMenuPartilha();
    }
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

function abrirModal(foto, modoInicial) {
  fotoActiva = foto;
  const blocos = calcularBlocos(foto);

  // Foto
  elFotoImg.src = foto.url_imagem;
  elFotoImg.alt = escapeHtml(foto.titulo) || "Fotografia";

  // Título na barra (todos os modos)
  elBarraTitulo.textContent = foto.titulo || "";

  // EXIF no rodapé inferior (modo ▢)
  preencherExif(elRodapeExif, foto, false);
  elRodapeExif.appendChild(elBtnPartilha);

  // EXIF em linha (modo ◫)
  preencherExif(elExifLinha, foto, false);

  // Título no modo ◫ e modo T
  elTitulo.textContent      = foto.titulo || "";
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

  // Guardar blocos para uso em definirModo
  blocosActivos = blocos;

  // Selector de idioma
  preencherIdiomas(blocos);

  // Idioma activo por defeito: primeiro bloco (original)
  idiomaActivo = blocos.length > 0 ? blocos[0].lang : null;
  actualizarTextoModoFotoTexto(blocos);

  // Modo de abertura: parâmetro opcional, senão modo ◫
  definirModo(modoInicial || "foto-texto");

  // Escrever hash no URL sem criar entrada no histórico
  history.replaceState(null, "", `#${foto.id}`);

  modalEl.classList.add("modal--aberto");
  bloquearScroll();
  esconderCabecalho();

  // Foco na cruz para acessibilidade
  modalEl.querySelector(".modal__fechar")?.focus();
}

function fecharModal() {
  modalEl.classList.remove("modal--aberto");
  libertarScroll();
  elTooltip.classList.remove("modal__tooltip--visible");
  fecharMenuPartilha();
  fotoActiva = null;

  // Limpar hash sem criar entrada no histórico
  history.replaceState(null, "", window.location.pathname);
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
  elCorpo.classList.remove("modal__corpo--so-foto", "modal__corpo--com-foto", "modal__corpo--so-texto");

  // elRodapeExif sempre visível — está no fluxo flex do modal
  elRodapeExif.style.display = "";

  switch (modo) {

    case "foto":
      elCorpo.classList.add("modal__corpo--so-foto");
      elFotoWrap.style.display     = "";
      elFotoWrap.classList.remove("modal__foto-wrap--crop");
      elFotoWrap.classList.add("modal__foto-wrap--full");
      elTextoWrap.style.display    = "none";
      elTextoColunas.style.display = "none";
      elTituloModoT.style.display  = "none";
      elRodapeTexto.style.display  = "none";
      // Nudge nos botões inativos — uma vez por sessão
      if (!nudgeModosMostrado) {
        nudgeModosMostrado = true;
        [elBtnFotoTexto, elBtnTexto].forEach(btn => {
          btn.classList.remove("modal__modo-btn--nudge");
          void btn.offsetWidth;
          btn.classList.add("modal__modo-btn--nudge");
          btn.addEventListener("animationend", () => {
            btn.classList.remove("modal__modo-btn--nudge");
          }, { once: true });
        });
      }
      break;

    case "foto-texto":
      elCorpo.classList.add("modal__corpo--com-foto");
      elFotoWrap.style.display     = "";
      elFotoWrap.classList.remove("modal__foto-wrap--full");
      elFotoWrap.classList.add("modal__foto-wrap--crop");
      elTextoWrap.style.display    = "";
      elTextoColunas.style.display = "none";
      elTituloModoT.style.display  = "none";
      elRodapeTexto.style.display  = "none";
      // elAttrWrap: garantir que está no elTextoWrap, imediatamente após elTexto
      elTextoWrap.appendChild(elAttrWrap); // move de qualquer sítio para textoWrap
      elTextoWrap.insertBefore(elAttrWrap, elTexto.nextSibling); // reposicionar após texto
      // Nudge no selector de idioma — uma vez por sessão
      if (!nudgeIdiomaMostrado && elIdiomas.children.length > 0) {
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
      elFotoWrap.style.display     = "none";
      elTextoWrap.style.display    = "none";
      elTituloModoT.style.display  = "none";
      elTextoColunas.style.display = "";
      elRodapeTexto.style.display  = "none";
      // Reconstruir colunas agora: elAttrWrap está disponível para inserir na coluna original
      preencherColunas(blocosActivos, fotoActiva);
      break;
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

function resolverTitulo(foto, lang) {
  if (!lang) return foto.titulo || "";
  const l = lang.toLowerCase();
  if (l === "pt" && foto.titulo_pt) return foto.titulo_pt;
  if (l === "en" && foto.titulo_en) return foto.titulo_en;
  return foto.titulo || "";
}

function actualizarTitulo() {
  elBarraTitulo.textContent = resolverTitulo(fotoActiva, idiomaActivo);
}

function actualizarTextoModoFotoTexto(blocos) {
  const bloco = blocos.find(b => b.lang === idiomaActivo) || blocos[0];
  if (bloco) {
    elTexto.textContent = bloco.texto;
  }
  actualizarTitulo();
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

    // Atribuição imediatamente após o texto da coluna original
    if (i === 0) {
      col.appendChild(elAttrWrap);
    }

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
// LAYOUT DA GRELHA — pré-cálculo antes do primeiro render
// ══════════════════════════════════════════════════════════════

// Quantas fotos consome um slot fractal conforme orientação
function fotasPorFractal(orientacao) {
  return orientacao === "square" ? 4 : 2;
}

// Constrói o array de entradas que os batches vão consumir.
// Garante: máx 30% verso · máx 30% fractal · nunca coincidem.
// Fotos com texto em falta não são elegíveis para verso.
function calcularLayoutGrelha(fotos) {
  const total = fotos.length;
  const maxVerso   = Math.floor(total * 0.30);
  const maxFractal = Math.floor(total * 0.30);

  // Índices elegíveis para verso (têm texto literário)
  const elegiveisVerso = fotos
    .map((f, i) => (f.texto_editorial ? i : -1))
    .filter(i => i >= 0);

  // Embaralhar elegíveis para distribuição aleatória
  function shuffleIndices(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const versoCandidatos  = new Set(shuffleIndices(elegiveisVerso).slice(0, maxVerso));
  const fractalCandidatos = new Set();

  // Seleccionar candidatos fractais: não podem ser verso
  // e têm de ter fotos suficientes disponíveis à frente no array
  let contadorFractal = 0;
  let i = 0;
  while (i < total && contadorFractal < maxFractal) {
    if (!versoCandidatos.has(i)) {
      const needed = fotasPorFractal(fotos[i].orientacao);
      // Verificar se há fotos não-verso suficientes a partir de i
      let disponíveis = 0;
      for (let j = i; j < total && disponíveis < needed; j++) {
        if (!versoCandidatos.has(j)) disponíveis++;
      }
      if (disponíveis >= needed && Math.random() < 0.35) {
        fractalCandidatos.add(i);
        contadorFractal++;
        i += needed; // saltar as fotos que este slot vai consumir
        continue;
      }
    }
    i++;
  }

  // Construir o array de entradas com restrição de adjacência:
  // nunca dois slots especiais (verso ou fractal) consecutivos.
  const entradas = [];
  let cursor = 0;

  function ultimoTipo() {
    if (entradas.length === 0) return null;
    return entradas[entradas.length - 1].tipo;
  }

  while (cursor < total) {
    if (versoCandidatos.has(cursor) && ultimoTipo() !== "verso") {
      entradas.push({ tipo: "verso", fotos: [fotos[cursor]] });
      cursor++;
    } else if (fractalCandidatos.has(cursor) && ultimoTipo() !== "fractal") {
      const needed = fotasPorFractal(fotos[cursor].orientacao);
      const subFotos = [];
      let j = cursor;
      while (subFotos.length < needed && j < total) {
        if (!versoCandidatos.has(j)) subFotos.push(fotos[j]);
        j++;
      }
      if (subFotos.length === needed) {
        entradas.push({ tipo: "fractal", fotos: subFotos, orientacao: fotos[cursor].orientacao });
        cursor = j;
      } else {
        entradas.push({ tipo: "foto", fotos: [fotos[cursor]] });
        cursor++;
      }
    } else {
      entradas.push({ tipo: "foto", fotos: [fotos[cursor]] });
      cursor++;
    }
  }

  return entradas;
}

// ══════════════════════════════════════════════════════════════
// CARTÃO VERSO — construção
// ══════════════════════════════════════════════════════════════

function criarCartaoVerso(foto) {
  const article = document.createElement("article");
  article.className  = "card card--verso";
  article.dataset.id = foto.id;
  article.dataset.versoCor = corVersoPróxima();

  // Foto de fundo — sempre presente, revelada no hover
  const fotoEl = document.createElement("img");
  fotoEl.className   = "card__verso-foto";
  fotoEl.src         = foto.url_imagem;
  fotoEl.alt         = "";
  fotoEl.loading     = "lazy";
  fotoEl.decoding    = "async";
  article.appendChild(fotoEl);

  // Camada de conteúdo textual
  const conteudo = document.createElement("div");
  conteudo.className = "card__verso-conteudo";

  // Título no idioma original (foto.titulo)
  if (foto.titulo) {
    const tituloEl = document.createElement("p");
    tituloEl.className   = "card__verso-titulo";
    tituloEl.textContent = foto.titulo;
    conteudo.appendChild(tituloEl);
  }

  const textoEl = document.createElement("p");
  textoEl.className   = "card__verso-texto";
  textoEl.textContent = normalizarTexto(foto.texto_editorial || "");
  conteudo.appendChild(textoEl);

  if (foto.autor_texto) {
    const attrEl = document.createElement("p");
    attrEl.className = "card__verso-attr";
    const ano = foto.ano_texto ? `, ${foto.ano_texto}` : "";
    attrEl.innerHTML = `<em>${escapeHtml(foto.autor_texto)}</em>${escapeHtml(ano)}`;
    conteudo.appendChild(attrEl);
  }

  article.appendChild(conteudo);
  article.addEventListener("click", () => abrirModal(foto, "foto-texto"));

  return article;
}

// ══════════════════════════════════════════════════════════════
// SLOT FRACTAL — construção
// ══════════════════════════════════════════════════════════════

function criarSlotFractal(subFotos, orientacao) {
  const slot = document.createElement("div");
  slot.className = `slot-fractal slot-fractal--${orientacao}`;

  subFotos.forEach((foto) => {
    const cartao = criarCartao(foto);
    slot.appendChild(cartao);
  });

  return slot;
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
  const batch = layoutGrelha.slice(rendered, rendered + CONFIG.BATCH_SIZE);

  if (batch.length === 0) {
    sentinelEl.remove();
    observer.disconnect();
    // Todos os batches renderizados: se ainda há hash pendente, não existe — limpar
    if (hashPendente) {
      hashPendente = null;
      history.replaceState(null, "", window.location.pathname);
    }
    return;
  }

  const fragment = document.createDocumentFragment();

  batch.forEach((entrada) => {
    let el;
    if (entrada.tipo === "verso") {
      el = criarCartaoVerso(entrada.fotos[0]);
    } else if (entrada.tipo === "fractal") {
      el = criarSlotFractal(entrada.fotos, entrada.orientacao);
    } else {
      el = criarCartao(entrada.fotos[0]);
    }
    fragment.appendChild(el);
  });

  galleryEl.appendChild(fragment);
  rendered += batch.length;

  // Verificar se a foto do hash pendente acaba de ser renderizada
  if (hashPendente) {
    const cartao = galleryEl.querySelector(`[data-id="${hashPendente}"]`);
    if (cartao) {
      const foto = allFotos.find(f => f.id === hashPendente);
      hashPendente = null;
      if (foto) {
        cartao.scrollIntoView({ behavior: "smooth", block: "center" });
        // Pequeno delay para o scroll assentar antes de abrir o modal
        setTimeout(() => abrirModal(foto, "foto-texto"), 300);
      }
    }
  }
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

// ══════════════════════════════════════════════════════════════
// HASH — resolução no arranque
// ══════════════════════════════════════════════════════════════

function resolverHashInicial() {
  const hash = window.location.hash.slice(1); // retirar o "#"
  if (!hash) return;

  // Verificar se o id existe em allFotos
  const foto = allFotos.find(f => f.id === hash);
  if (!foto) {
    // Id desconhecido — limpar hash silenciosamente
    history.replaceState(null, "", window.location.pathname);
    return;
  }

  // Verificar se o cartão já está no DOM (primeiro batch)
  const cartao = galleryEl.querySelector(`[data-id="${hash}"]`);
  if (cartao) {
    cartao.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => abrirModal(foto, "foto-texto"), 300);
  } else {
    // Foto em batch posterior — registar como pendente
    // O IntersectionObserver continuará a chamar renderBatch() até a encontrar
    hashPendente = hash;
  }
}

// ── Bootstrap ─────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════
// CABEÇALHO FLUTUANTE
// ══════════════════════════════════════════════════════════════

const cabecalhoEl  = document.getElementById("cabecalho");
const triggerEl    = document.getElementById("cabecalho-trigger");

let _cabecalhoTimeout = null;

function mostrarCabecalho(autoHide = false) {
  if (modalEl?.classList.contains("modal--aberto")) return;
  cabecalhoEl.classList.add("cabecalho--visivel");
  if (autoHide) {
    if (_cabecalhoTimeout) clearTimeout(_cabecalhoTimeout);
    _cabecalhoTimeout = setTimeout(() => {
      cabecalhoEl.classList.remove("cabecalho--visivel");
      _cabecalhoTimeout = null;
    }, 4000);
  }
}

function esconderCabecalho() {
  if (_cabecalhoTimeout) clearTimeout(_cabecalhoTimeout);
  cabecalhoEl.classList.remove("cabecalho--visivel");
}

// Hover na zona de trigger (80px do topo)
triggerEl.addEventListener("mouseenter", () => mostrarCabecalho(false));
triggerEl.addEventListener("mouseleave", () => esconderCabecalho());

// Esconder cabeçalho quando modal abre
// (integrado em abrirModal e fecharModal via chamada directa)

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

  // Pré-calcular layout (verso + fractal) antes do primeiro render
  layoutGrelha = calcularLayoutGrelha(allFotos);

  mostrarLoader(false);
  injectStructuredData(allFotos);
  renderBatch();
  observer.observe(sentinelEl);

  // Cabeçalho: aparecer ao carregar, desaparecer após 4s
  mostrarCabecalho(true);

  // Resolver hash após o primeiro batch estar no DOM
  resolverHashInicial();
}

document.addEventListener("DOMContentLoaded", iniciarGaleria);
