/**
 * api.js — Comunicação com o GAS e ordenação aleatória.
 *
 * Responsabilidades:
 *   1. Fetch ao endpoint GAS (apenas fotos publicada=TRUE)
 *   2. Shuffle Fisher-Yates a cada refresh
 *   3. Validação mínima do schema recebido
 *
 * Não contém lógica de render. Não conhece o DOM.
 */

"use strict";

// ── Validação de schema ──────────────────────────────────────

/**
 * Valida que um objecto recebido do GAS tem os campos mínimos
 * necessários para ser renderizado.
 * @param {unknown} item
 * @returns {item is Foto}
 */
function isFotoValida(item) {
  return (
    item !== null &&
    typeof item === "object" &&
    typeof item.id === "string"                   && item.id.length > 0       &&
    typeof item.url_imagem === "string"            && item.url_imagem.length > 0 &&
    typeof item.titulo === "string"                &&
    typeof item.texto_editorial === "string"       &&
    ["landscape", "portrait", "square"].includes(item.orientacao) &&
    typeof item.camera === "string"
  );
}

// ── Shuffle Fisher-Yates ─────────────────────────────────────

/**
 * Ordena aleatoriamente um array em-place.
 * Complexidade: O(n). Não muta o array original — devolve cópia.
 * @template T
 * @param {T[]} array
 * @returns {T[]}
 */
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Fetch principal ──────────────────────────────────────────

/**
 * Obtém todas as fotos publicadas do GAS, valida e embaralha.
 *
 * @returns {Promise<Foto[]>}
 * @throws {Error} se a rede falhar ou o payload for inválido
 */
async function fetchFotos() {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 10_000); // 10s timeout

  let response;
  try {
    response = await fetch(CONFIG.GAS_ENDPOINT, {
      method: "GET",
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("[api] Timeout: GAS não respondeu em 10s.");
    }
    throw new Error(`[api] Falha de rede: ${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`[api] GAS devolveu HTTP ${response.status}`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("[api] Resposta do GAS não é JSON válido.");
  }

  // O GAS deve devolver { fotos: Foto[] }
  if (!Array.isArray(payload?.fotos)) {
    throw new Error("[api] Payload inesperado: campo 'fotos' ausente ou não é array.");
  }

  // Filtra itens inválidos e avisa no console (não bloqueia)
  const validas = payload.fotos.filter((item) => {
    const ok = isFotoValida(item);
    if (!ok) console.warn("[api] Item ignorado — schema inválido:", item);
    return ok;
  });

  if (validas.length === 0) {
    throw new Error("[api] Nenhuma foto válida recebida do GAS.");
  }

  // Invariante #1: ordem diferente a cada refresh
  return shuffle(validas);
}
