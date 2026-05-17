/**
 * mock.js — Dados fictícios para teste do front-end.
 *
 * INSTRUÇÃO: inclui este ficheiro no index.html ANTES de api.js.
 * Remove (ou comenta) quando o GAS estiver pronto.
 *
 * Sobrescreve fetchFotos() definida em api.js — o gallery.js
 * não sabe a diferença.
 */

"use strict";

// Fotos reais do Unsplash — sem autenticação, sem quota
// Mistura de orientações para testar o layout
const MOCK_FOTOS = [
  {
    id: "m01",
    url_imagem: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200",
    titulo: "Névoa nas Montanhas",
    texto_editorial: "A luz da manhã dissolve-se entre os picos, criando uma fronteira incerta entre o mundo e o céu.",
    orientacao: "landscape",
    camera: "Sony A7IV",
    coordenadas_gps: "46.8182,8.2275",
  },
  {
    id: "m02",
    url_imagem: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800",
    titulo: "Floresta Vertical",
    texto_editorial: "Os troncos esticam-se em silêncio, cada um a contar décadas de chuva e luz filtrada.",
    orientacao: "portrait",
    camera: "Fujifilm X-T5",
    coordenadas_gps: "47.3769,8.5417",
  },
  {
    id: "m03",
    url_imagem: "https://images.unsplash.com/photo-1511884642898-4c92249e20b6?w=800",
    titulo: "Espelho de Água",
    texto_editorial: "O reflexo perfeito confunde o real com o imaginado.",
    orientacao: "square",
    camera: "Nikon Z8",
    coordenadas_gps: null,
  },
  {
    id: "m04",
    url_imagem: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200",
    titulo: "Horizonte Dourado",
    texto_editorial: "O sol despede-se com uma generosidade que só quem espera consegue apreciar.",
    orientacao: "landscape",
    camera: "Canon R5",
    coordenadas_gps: "38.7169,-9.1395",
  },
  {
    id: "m05",
    url_imagem: "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=800",
    titulo: "Queda Perpétua",
    texto_editorial: "A água não hesita. Encontra sempre o caminho, mesmo quando o caminho é o vazio.",
    orientacao: "portrait",
    camera: "Sony A7IV",
    coordenadas_gps: "46.5958,7.9747",
  },
  {
    id: "m06",
    url_imagem: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1200",
    titulo: "Luz Entre Árvores",
    texto_editorial: "A floresta filtra o sol em fragmentos — cada raio uma promessa de claridade.",
    orientacao: "landscape",
    camera: "Fujifilm X-T5",
    coordenadas_gps: null,
  },
  {
    id: "m07",
    url_imagem: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800",
    titulo: "Pico Isolado",
    texto_editorial: "Há uma solidão nos cumes que não é tristeza — é presença absoluta.",
    orientacao: "portrait",
    camera: "Nikon Z8",
    coordenadas_gps: "45.8326,6.8652",
  },
  {
    id: "m08",
    url_imagem: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800",
    titulo: "Caminho de Terra",
    texto_editorial: "O destino importa menos do que o ritmo dos passos sobre a terra vermelha.",
    orientacao: "square",
    camera: "Canon R5",
    coordenadas_gps: null,
  },
  {
    id: "m09",
    url_imagem: "https://images.unsplash.com/photo-1520962880247-cfaf541c8724?w=1200",
    titulo: "Costa Selvagem",
    texto_editorial: "O oceano não pede licença. Chega, parte, e deixa o sal como memória.",
    orientacao: "landscape",
    camera: "Sony A7IV",
    coordenadas_gps: "39.6995,-8.1309",
  },
  {
    id: "m10",
    url_imagem: "https://images.unsplash.com/photo-1501696461415-6bd6660c6742?w=800",
    titulo: "Reflexo Urbano",
    texto_editorial: "A cidade duplica-se na poça — arquitectura acidental de água e asfalto.",
    orientacao: "portrait",
    camera: "Fujifilm X-T5",
    coordenadas_gps: "41.1579,-8.6291",
  },
  {
    id: "m11",
    url_imagem: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200",
    titulo: "Tempestade no Cume",
    texto_editorial: "As nuvens acumulam-se com uma urgência que só a montanha conhece.",
    orientacao: "landscape",
    camera: "Nikon Z8",
    coordenadas_gps: "46.0207,7.7491",
  },
  {
    id: "m12",
    url_imagem: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800",
    titulo: "Praia Vazia",
    texto_editorial: "Antes de o mundo acordar, a praia pertence apenas à maré.",
    orientacao: "square",
    camera: "Canon R5",
    coordenadas_gps: "37.0179,-7.9307",
  },
];

// Sobrescreve fetchFotos() de api.js
async function fetchFotos() {
  // Simula latência de rede (500ms)
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Reutiliza o shuffle de api.js — Fisher-Yates
  return shuffle(MOCK_FOTOS);
}
