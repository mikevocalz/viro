import { ACESFilmicToneMapping, Color, PerspectiveCamera, SRGBColorSpace, WebGLRenderer } from "three";
import { createCanvasRasterizer } from "../backend/textRaster";
import { PRIMITIVE_STORIES } from "../primitives";
import { PreviewStage } from "../stage";
import "./styles.css";
import "./gallery.css";

type Card = { stage: PreviewStage; canvas: HTMLCanvasElement; camera: PerspectiveCamera; state: HTMLElement; codes: HTMLElement; settled: boolean };

const grid = document.querySelector<HTMLElement>("#gallery");
if (!grid) throw new Error("Missing #gallery");

// One WebGL context for every card: render each stage, then copy the pixels
// into the card's 2D canvas. Browsers cap live WebGL contexts at about 16.
const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
const rasterizer = createCanvasRasterizer();
const cards: Card[] = [];

for (const story of PRIMITIVE_STORIES) {
  const article = document.createElement("article");
  article.className = "card";
  article.id = story.id;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", story.title + " rendered by the Specs preview");
  const h = document.createElement("h2");
  h.textContent = story.title;
  const p = document.createElement("p");
  p.textContent = story.lens;
  const state = document.createElement("p");
  state.className = "card-state";
  const codes = document.createElement("p");
  codes.className = "card-codes";
  const link = document.createElement("a");
  link.href = "./index.html?scene=" + encodeURIComponent("data:application/json," + JSON.stringify(story.manifest));
  link.textContent = "Open in the preview";
  article.append(canvas, h, p, state, codes, link);
  grid.append(article);

  const stage = new PreviewStage({ rasterizer });
  stage.scene.background = new Color("#2b313a");
  const camera = new PerspectiveCamera(42, 4 / 3, 1, 5000);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -100);
  const card: Card = { stage, canvas, camera, state, codes, settled: false };
  cards.push(card);
  void stage.load(story.manifest, story.id).then(() => {
    card.settled = true;
    describeCard(card);
  });
  stage.controller.addOnLifecycleListener(() => describeCard(card));
}

function describeCard(card: Card): void {
  const lifecycle = card.stage.lifecycle;
  card.state.dataset.state = lifecycle;
  card.state.textContent = lifecycle === "degraded" ? "Ready, with placeholders" : lifecycle === "ready" ? "Ready" : lifecycle;
  const codes = Array.from(new Set(card.stage.diagnostics.map((d) => d.code)));
  card.codes.textContent = codes.length ? "Lens host reports " + codes.join(", ") : "No diagnostics";
}

let last = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  for (const card of cards) {
    const rect = card.canvas.getBoundingClientRect();
    if (rect.width === 0) continue;
    const ratio = Math.min(window.devicePixelRatio, 2);
    const w = Math.round(rect.width * ratio);
    const h = Math.round(rect.height * ratio);
    if (card.canvas.width !== w || card.canvas.height !== h) {
      card.canvas.width = w;
      card.canvas.height = h;
    }
    renderer.setSize(w, h, false);
    card.camera.aspect = w / h;
    card.camera.updateProjectionMatrix();
    card.stage.step(dt, w, h);
    renderer.render(card.stage.scene, card.camera);
    card.canvas.getContext("2d")?.drawImage(renderer.domElement, 0, 0, w, h);
  }
});

declare global {
  interface Window {
    __specsGallery: { readonly settled: boolean; readonly cards: readonly { id: string; lifecycle: string; codes: string[] }[] };
  }
}
window.__specsGallery = {
  get settled() {
    return cards.every((c) => c.settled && c.stage.lifecycle !== "loading");
  },
  get cards() {
    return cards.map((c, i) => ({ id: PRIMITIVE_STORIES[i]?.id ?? "", lifecycle: c.stage.lifecycle, codes: c.stage.diagnostics.map((d) => d.code) }));
  },
};
