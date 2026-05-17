/**
 * seo.js — Structured data dinâmico (JSON-LD).
 *
 * Responsabilidades:
 *   1. Injetar schema.org/ImageGallery no <head> após fetch
 *   2. Complementar o Open Graph e meta tags estáticos do index.html
 *
 * Nota: crawlers que não executam JS vêem apenas os meta tags
 * estáticos do index.html (suficiente para indexação da galeria
 * como entidade). Este ficheiro enriquece para crawlers modernos
 * (Googlebot, GPTBot, ClaudeBot) que executam JS.
 */

"use strict";

/**
 * Injeta um bloco JSON-LD do tipo ImageGallery no <head>.
 * Chamado por gallery.js após fetchFotos() ter sucesso.
 *
 * @param {Foto[]} fotos - Array completo após shuffle
 */
function injectStructuredData(fotos) {
  if (!Array.isArray(fotos) || fotos.length === 0) return;

  const schema = {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    "name": CONFIG.SITE_NAME,
    "description": CONFIG.SITE_DESCRIPTION,
    "url": CONFIG.SITE_URL,
    "numberOfItems": fotos.length,
    "image": fotos.map((foto) => ({
      "@type": "ImageObject",
      "contentUrl": foto.url_imagem,
      "name": foto.titulo,
      "description": foto.texto_editorial,
      "thumbnail": foto.url_imagem,
      ...(foto.coordenadas_gps
        ? {
            "contentLocation": {
              "@type": "Place",
              "geo": {
                "@type": "GeoCoordinates",
                "latitude":  parseFloat(foto.coordenadas_gps.split(",")[0]),
                "longitude": parseFloat(foto.coordenadas_gps.split(",")[1]),
              },
            },
          }
        : {}),
    })),
  };

  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(schema, null, 0); // minified
  document.head.appendChild(script);
}
