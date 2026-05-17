/**
 * config.js — Único ficheiro a editar para apontar para o teu GAS.
 *
 * INSTRUÇÃO: substitui o valor de GAS_ENDPOINT pelo URL do teu
 * Web App publicado no Google Apps Script.
 * Formato: https://script.google.com/macros/s/XXXXXXX/exec
 */

const CONFIG = Object.freeze({

  // ── Endpoint GAS ────────────────────────────────────────────
  GAS_ENDPOINT: "https://script.google.com/macros/s/AKfycbwQfTZbfmOif6lsmSC5Zdyh82IGHr41J3HVcix4TDwZ7NdMFT0aWDzD1qvjSduplvG2/exec",

  // ── Scroll infinito ─────────────────────────────────────────
  BATCH_SIZE: 20,

  // ── Layout ──────────────────────────────────────────────────
  GAP_PX: 1,

  // ── Rácios dos cartões por orientação ───────────────────────
  RATIOS: Object.freeze({
    landscape: "4 / 3",
    portrait:  "3 / 4",
    square:    "1 / 1",
  }),

  // ── Flip ────────────────────────────────────────────────────
  FLIP_ENABLED:       true,
  FLIP_AUTO_CLOSE_MS: 10000,   // Fecho automático após 10 segundos

  // ── SEO ─────────────────────────────────────────────────────
  SITE_NAME:        "Galeria",
  SITE_DESCRIPTION: "",
  SITE_URL:         "",

});