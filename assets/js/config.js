/**
 * config.js — Único ficheiro a editar para apontar para o teu GAS.
 *
 * INSTRUÇÃO: substitui o valor de GAS_ENDPOINT pelo URL do teu
 * Web App publicado no Google Apps Script.
 * Formato: https://script.google.com/macros/s/XXXXXXX/exec
 */

const CONFIG = Object.freeze({

  // ── Endpoint GAS ────────────────────────────────────────────
  GAS_ENDPOINT: "https://script.google.com/macros/s/SUBSTITUIR_AQUI/exec",

  // ── Scroll infinito ─────────────────────────────────────────
  BATCH_SIZE: 20,               // Fotos renderizadas por batch

  // ── Layout ──────────────────────────────────────────────────
  GAP_PX: 1,                    // Intervalo entre cartões (px) — invariante #5

  // ── Rácios dos cartões por orientação ───────────────────────
  // Usados como aspect-ratio CSS. Ajustar se necessário.
  RATIOS: Object.freeze({
    landscape: "4 / 3",
    portrait:  "3 / 4",
    square:    "1 / 1",
  }),

  // ── Flip ────────────────────────────────────────────────────
  FLIP_ENABLED: false,          // Ativar na sessão dedicada ao flip

  // ── SEO ─────────────────────────────────────────────────────
  SITE_NAME:        "Galeria",  // Substituir pelo nome real
  SITE_DESCRIPTION: "",         // Substituir pela descrição real
  SITE_URL:         "",         // Substituir pelo URL GitHub Pages

});
