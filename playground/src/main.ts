import './styles.css';

type LocalSignals = {
  pointerX: number;
  pointerY: number;
  pointerSpeed: number;
  scroll: number;
  viewportRatio: number;
  clockPhase: number;
};

type SourceCapture = {
  version: string;
  capturedAt: string;
  local: LocalSignals;
  sourceMaterial: string;
  externalPacket: unknown | null;
  fingerprint: string;
};

type Draft = {
  index: number;
  seed: number;
  chaos: number;
  intent: string;
  mode: string;
  field: number[];
  palette: number[];
  fingerprint: string;
  capture: SourceCapture;
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">AXM EXPERIMENT / SIGNAL MAGNET → LOOM</p>
        <h1>Catch signals first.<br>Make art second.</h1>
        <p class="lede">The prompt is no longer the source. The Magnet captures whatever is available, freezes it into a replayable packet, then the Loom turns that packet into visual drafts.</p>
      </div>
      <div class="status-card">
        <span class="pulse-dot"></span>
        <div>
          <strong>Signal Magnet online</strong>
          <small>explicit sources • frozen capture • replayable</small>
        </div>
      </div>
    </header>

    <section class="workbench">
      <div class="section-title">
        <div>
          <p class="eyebrow">01 / MAGNET</p>
          <h2>Source capture</h2>
        </div>
        <p>Local signals are visible below. Add material from any other source through text or a generic JSON packet.</p>
      </div>

      <div class="signal-strip" id="signalStrip"></div>

      <div class="source-grid">
        <label class="source-field">
          <span>Source material</span>
          <textarea id="sourceMaterial" rows="5" placeholder="Paste anything gathered from the internet, a local file, a connector, another model, notes, sensor output, game state…"></textarea>
          <small>Raw material. It is captured as signal input, not treated as a prompt.</small>
        </label>

        <label class="source-field">
          <span>External signal packet · JSON</span>
          <textarea id="packetInput" rows="5" placeholder='{"source":"web","label":"city weather","payload":{"wind":0.8,"rain":0.2}}'></textarea>
          <small>Generic adapter boundary. Any tool or working chat can provide a packet with its own provenance.</small>
        </label>
      </div>

      <div id="captureError" class="capture-error hidden"></div>

      <div class="capture-row">
        <button id="capture" class="primary">Capture + weave</button>
        <button id="weave" class="secondary">Weave captured</button>
        <span id="captureInfo" class="capture-info">No capture yet</span>
      </div>
    </section>

    <section class="workbench loom-panel">
      <div class="section-title">
        <div>
          <p class="eyebrow">02 / LOOM</p>
          <h2>Interpretation controls</h2>
        </div>
        <p>Intent can gently bias the interpretation, but it does not replace the captured source field.</p>
      </div>

      <label class="intent-field">
        <span>Intent bias · optional</span>
        <input id="intent" value="" placeholder="e.g. eerie architecture, playful machine, no bias…" autocomplete="off" />
      </label>

      <div class="controls">
        <label>
          <span>Seed</span>
          <input id="seed" type="number" value="4837291" step="1" />
        </label>
        <label>
          <span>Chaos <b id="chaosValue">72%</b></span>
          <input id="chaos" type="range" min="0" max="100" value="72" />
        </label>
        <label>
          <span>Drafts</span>
          <select id="count">
            <option value="6">6</option>
            <option value="9">9</option>
            <option value="12" selected>12</option>
            <option value="18">18</option>
          </select>
        </label>
      </div>

      <div class="actions">
        <button id="reroll" class="secondary">New seed</button>
        <span id="runInfo" class="run-info"></span>
      </div>
    </section>

    <section class="results-head">
      <div>
        <p class="eyebrow">03 / TEMPORARY FIELD</p>
        <h2>Visual drafts</h2>
      </div>
      <p>Same frozen capture + seed + settings = same result.</p>
    </section>

    <section id="grid" class="grid" aria-live="polite"></section>

    <section id="inspector" class="inspector hidden" aria-live="polite">
      <div class="inspector-copy">
        <p class="eyebrow">CAPTURED RESULT</p>
        <h2 id="inspectTitle">Draft</h2>
        <p id="inspectMeta"></p>
      </div>
      <div class="inspector-actions">
        <button id="copyRecipe" class="secondary">Copy full packet</button>
        <button id="closeInspector" class="ghost">Close</button>
      </div>
      <pre id="recipe"></pre>
    </section>

    <footer>
      <span>Sources feed the Magnet.</span>
      <span>The Loom proposes. The consuming project decides.</span>
    </footer>
  </main>
`;

const sourceMaterial = document.querySelector<HTMLTextAreaElement>('#sourceMaterial')!;
const packetInput = document.querySelector<HTMLTextAreaElement>('#packetInput')!;
const intentInput = document.querySelector<HTMLInputElement>('#intent')!;
const seedInput = document.querySelector<HTMLInputElement>('#seed')!;
const chaosInput = document.querySelector<HTMLInputElement>('#chaos')!;
const chaosValue = document.querySelector<HTMLElement>('#chaosValue')!;
const countInput = document.querySelector<HTMLSelectElement>('#count')!;
const signalStrip = document.querySelector<HTMLElement>('#signalStrip')!;
const captureInfo = document.querySelector<HTMLElement>('#captureInfo')!;
const captureError = document.querySelector<HTMLElement>('#captureError')!;
const grid = document.querySelector<HTMLElement>('#grid')!;
const runInfo = document.querySelector<HTMLElement>('#runInfo')!;
const inspector = document.querySelector<HTMLElement>('#inspector')!;
const inspectTitle = document.querySelector<HTMLElement>('#inspectTitle')!;
const inspectMeta = document.querySelector<HTMLElement>('#inspectMeta')!;
const recipe = document.querySelector<HTMLElement>('#recipe')!;

let activeCapture: SourceCapture | null = null;
let selected: Draft | null = null;
let pointerX = 0.5;
let pointerY = 0.5;
let pointerSpeed = 0;
let lastPointerX = 0.5;
let lastPointerY = 0.5;
let lastPointerAt = performance.now();

function hashText(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function localSnapshot(): LocalSignals {
  const now = new Date();
  const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
  const pageHeight = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  return {
    pointerX: Number(pointerX.toFixed(5)),
    pointerY: Number(pointerY.toFixed(5)),
    pointerSpeed: Number(Math.min(pointerSpeed, 1).toFixed(5)),
    scroll: Number(Math.min(1, Math.max(0, window.scrollY / pageHeight)).toFixed(5)),
    viewportRatio: Number((window.innerWidth / Math.max(1, window.innerHeight)).toFixed(5)),
    clockPhase: Number((seconds / 60).toFixed(5)),
  };
}

function captureSources(): SourceCapture | null {
  let externalPacket: unknown | null = null;
  const rawPacket = packetInput.value.trim();
  captureError.classList.add('hidden');
  captureError.textContent = '';

  if (rawPacket) {
    try {
      externalPacket = JSON.parse(rawPacket);
    } catch {
      captureError.textContent = 'External packet is not valid JSON. Nothing was captured.';
      captureError.classList.remove('hidden');
      return null;
    }
  }

  const base = {
    version: 'axm.signal-magnet.capture/0.3',
    capturedAt: new Date().toISOString(),
    local: localSnapshot(),
    sourceMaterial: sourceMaterial.value,
    externalPacket,
  };
  const fingerprint = hashText(JSON.stringify(base)).toString(16).padStart(8, '0');
  return { ...base, fingerprint };
}

function sourceVector(capture: SourceCapture, width: number): number[] {
  const sourceSeed = hashText(JSON.stringify({
    local: capture.local,
    sourceMaterial: capture.sourceMaterial,
    externalPacket: capture.externalPacket,
  }));
  const random = mulberry32(sourceSeed);
  const numeric = Object.values(capture.local);
  return Array.from({ length: width }, (_, index) => {
    const local = numeric[index % numeric.length] ?? 0;
    const centered = local * 2 - 1;
    return clamp((random() * 2 - 1) * 0.72 + centered * 0.28);
  });
}

function intentVector(intent: string, width: number): number[] {
  if (!intent.trim()) return Array.from({ length: width }, () => 0);
  const random = mulberry32(hashText(intent.toLowerCase().trim()));
  return Array.from({ length: width }, () => random() * 2 - 1);
}

function makeDraft(capture: SourceCapture, intent: string, rootSeed: number, index: number, chaos: number): Draft {
  const width = 72;
  const source = sourceVector(capture, width);
  const bias = intentVector(intent, width);
  const localSeed = (rootSeed ^ hashText(capture.fingerprint) ^ Math.imul(index + 1, 2654435761)) >>> 0;
  const random = mulberry32(localSeed);
  const field: number[] = [];

  for (let i = 0; i < width; i += 1) {
    const noise = random() * 2 - 1;
    const rhythm = Math.sin((i / (width - 1)) * Math.PI * 2 * (1.3 + chaos * 7.7) + index * 0.37);
    const mixed = (source[i] ?? 0) * 0.62 + (bias[i] ?? 0) * 0.12 + noise * (0.08 + chaos * 0.28) + rhythm * (0.12 + chaos * 0.22);
    field.push(clamp(mixed + (random() * 2 - 1) * chaos * 0.22));
  }

  const hueBase = (hashText(capture.fingerprint) + index * 47 + Math.floor(chaos * 100)) % 360;
  const palette = [
    hueBase,
    (hueBase + 44 + Math.abs(field[5] ?? 0) * 80) % 360,
    (hueBase + 172 + Math.abs(field[19] ?? 0) * 86) % 360,
  ];
  const modes = ['ribbon', 'bloom', 'shards', 'orbit', 'terrain', 'mesh', 'constellation'];
  const mode = modes[Math.floor(random() * modes.length)] ?? 'ribbon';
  const fingerprint = hashText(`${capture.fingerprint}|${intent}|${rootSeed}|${index}|${chaos.toFixed(4)}|${field.map(value => value.toFixed(4)).join(',')}`)
    .toString(16)
    .padStart(8, '0');

  return { index, seed: rootSeed, chaos, intent, mode, field, palette, fingerprint, capture };
}

function color(hue: number, alpha = 1, light = 62): string {
  return `hsla(${hue}, 88%, ${light}%, ${alpha})`;
}

function setupCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; width: number; height: number } {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(260, Math.floor(rect.width));
  const height = Math.max(210, Math.floor(rect.height));
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.scale(ratio, ratio);
  return { ctx, width, height };
}

function background(ctx: CanvasRenderingContext2D, width: number, height: number, draft: Draft): void {
  const gradient = ctx.createRadialGradient(width * 0.45, height * 0.38, 8, width * 0.5, height * 0.5, width * 0.8);
  gradient.addColorStop(0, color(draft.palette[0] ?? 200, 0.24, 22));
  gradient.addColorStop(0.55, color(draft.palette[1] ?? 250, 0.08, 12));
  gradient.addColorStop(1, '#080a0f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawRibbon(ctx: CanvasRenderingContext2D, width: number, height: number, draft: Draft): void {
  for (let layer = 0; layer < 7; layer += 1) {
    ctx.beginPath();
    draft.field.forEach((value, i) => {
      const x = (i / (draft.field.length - 1)) * width;
      const y = height * 0.5 + value * height * (0.18 + layer * 0.018) + Math.sin(i * 0.22 + layer) * 16;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color(draft.palette[layer % 3] ?? 200, 0.18 + layer * 0.07, 58 + layer * 2);
    ctx.lineWidth = 2 + layer * 1.15;
    ctx.stroke();
  }
}

function drawBloom(ctx: CanvasRenderingContext2D, width: number, height: number, draft: Draft): void {
  const cx = width / 2;
  const cy = height / 2;
  const max = Math.min(width, height) * 0.34;
  for (let ring = 0; ring < 5; ring += 1) {
    ctx.beginPath();
    draft.field.forEach((value, i) => {
      const angle = (i / draft.field.length) * Math.PI * 2;
      const radius = max * (0.34 + ring * 0.11 + Math.abs(value) * 0.32);
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = color(draft.palette[ring % 3] ?? 180, 0.55, 66);
    ctx.lineWidth = 1.4 + ring * 0.7;
    ctx.stroke();
  }
}

function drawShards(ctx: CanvasRenderingContext2D, width: number, height: number, draft: Draft): void {
  const random = mulberry32(hashText(draft.fingerprint));
  for (let i = 0; i < 32; i += 1) {
    const value = Math.abs(draft.field[i % draft.field.length] ?? 0);
    const x = random() * width;
    const y = random() * height;
    const size = 18 + value * 68;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size * (0.3 + random() * 0.6), y + size * 0.5);
    ctx.lineTo(x - size * (0.3 + random() * 0.5), y + size * 0.4);
    ctx.closePath();
    ctx.fillStyle = color(draft.palette[i % 3] ?? 210, 0.08 + value * 0.22, 56);
    ctx.strokeStyle = color(draft.palette[(i + 1) % 3] ?? 260, 0.35 + value * 0.35, 68);
    ctx.fill();
    ctx.stroke();
  }
}

function drawOrbit(ctx: CanvasRenderingContext2D, width: number, height: number, draft: Draft): void {
  const cx = width / 2;
  const cy = height / 2;
  draft.field.slice(0, 28).forEach((value, i) => {
    const radius = 24 + i * Math.min(width, height) * 0.012;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius * (1 + Math.abs(value) * 1.4), radius * 0.48, value * 1.8, 0, Math.PI * 2);
    ctx.strokeStyle = color(draft.palette[i % 3] ?? 200, 0.12 + Math.abs(value) * 0.34, 64);
    ctx.lineWidth = 0.8 + Math.abs(value) * 2.4;
    ctx.stroke();
  });
}

function drawTerrain(ctx: CanvasRenderingContext2D, width: number, height: number, draft: Draft): void {
  for (let row = 0; row < 12; row += 1) {
    ctx.beginPath();
    draft.field.forEach((value, i) => {
      const x = (i / (draft.field.length - 1)) * width;
      const shifted = draft.field[(i + row * 3) % draft.field.length] ?? value;
      const y = height * 0.18 + row * height * 0.058 + shifted * 22;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color(draft.palette[row % 3] ?? 190, 0.18 + row * 0.035, 56 + row);
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }
}

function drawMesh(ctx: CanvasRenderingContext2D, width: number, height: number, draft: Draft): void {
  const cols = 9;
  const rows = 7;
  const nodes: Array<{ x: number; y: number; v: number }> = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const index = (y * cols + x) % draft.field.length;
      const v = draft.field[index] ?? 0;
      nodes.push({
        x: 24 + (x / (cols - 1)) * (width - 48) + v * 18,
        y: 24 + (y / (rows - 1)) * (height - 48) + v * 22,
        v,
      });
    }
  }
  nodes.forEach((node, index) => {
    const right = index % cols < cols - 1 ? nodes[index + 1] : undefined;
    const down = index + cols < nodes.length ? nodes[index + cols] : undefined;
    [right, down].forEach(target => {
      if (!target) return;
      ctx.beginPath();
      ctx.moveTo(node.x, node.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = color(draft.palette[index % 3] ?? 200, 0.16 + Math.abs(node.v) * 0.35, 62);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.arc(node.x, node.y, 1.5 + Math.abs(node.v) * 4.5, 0, Math.PI * 2);
    ctx.fillStyle = color(draft.palette[index % 3] ?? 200, 0.75, 72);
    ctx.fill();
  });
}

function drawConstellation(ctx: CanvasRenderingContext2D, width: number, height: number, draft: Draft): void {
  const random = mulberry32(hashText(draft.fingerprint + ':stars'));
  const points = draft.field.slice(0, 42).map(value => ({
    x: width * (0.08 + random() * 0.84),
    y: height * (0.08 + random() * 0.84),
    v: value,
  }));
  points.forEach((point, index) => {
    const next = points[(index + 7) % points.length];
    if (next && Math.abs(point.v) > 0.2) {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(next.x, next.y);
      ctx.strokeStyle = color(draft.palette[index % 3] ?? 200, 0.08 + Math.abs(point.v) * 0.24, 66);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(point.x, point.y, 1.3 + Math.abs(point.v) * 5.5, 0, Math.PI * 2);
    ctx.fillStyle = color(draft.palette[index % 3] ?? 200, 0.6 + Math.abs(point.v) * 0.3, 76);
    ctx.fill();
  });
}

function renderDraft(canvas: HTMLCanvasElement, draft: Draft): void {
  const { ctx, width, height } = setupCanvas(canvas);
  background(ctx, width, height, draft);
  const renderers: Record<string, (context: CanvasRenderingContext2D, w: number, h: number, d: Draft) => void> = {
    ribbon: drawRibbon,
    bloom: drawBloom,
    shards: drawShards,
    orbit: drawOrbit,
    terrain: drawTerrain,
    mesh: drawMesh,
    constellation: drawConstellation,
  };
  (renderers[draft.mode] ?? drawRibbon)(ctx, width, height, draft);
}

function packet(draft: Draft): object {
  return {
    version: 'axm.signal-loom.browser/0.3',
    capture: draft.capture,
    intentBias: draft.intent,
    seed: draft.seed,
    draft: draft.index,
    chaos: Number(draft.chaos.toFixed(4)),
    mode: draft.mode,
    paletteHsl: draft.palette.map(hue => Number(hue.toFixed(2))),
    fingerprint: draft.fingerprint,
    field: draft.field.map(value => Number(value.toFixed(6))),
    boundary: 'proposal-only',
  };
}

function updateSignalStrip(): void {
  const local = localSnapshot();
  signalStrip.innerHTML = [
    ['pointer x', local.pointerX],
    ['pointer y', local.pointerY],
    ['motion', local.pointerSpeed],
    ['scroll', local.scroll],
    ['viewport', local.viewportRatio],
    ['clock phase', local.clockPhase],
  ].map(([label, value]) => `<span><b>${label}</b><code>${value}</code></span>`).join('');
}

function inspectDraft(draft: Draft): void {
  selected = draft;
  inspector.classList.remove('hidden');
  inspectTitle.textContent = `Draft ${String(draft.index + 1).padStart(2, '0')} · ${draft.mode}`;
  inspectMeta.textContent = `capture ${draft.capture.fingerprint} · seed ${draft.seed} · chaos ${Math.round(draft.chaos * 100)}% · result ${draft.fingerprint}`;
  recipe.textContent = JSON.stringify(packet(draft), null, 2);
  inspector.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function render(): void {
  if (!activeCapture) {
    grid.innerHTML = '<div class="empty-field">Capture some signals first.</div>';
    runInfo.textContent = '';
    return;
  }

  const intent = intentInput.value.trim();
  const seed = Number.parseInt(seedInput.value, 10) || 1;
  const chaos = Number.parseInt(chaosInput.value, 10) / 100;
  const count = Number.parseInt(countInput.value, 10);
  const drafts = Array.from({ length: count }, (_, index) => makeDraft(activeCapture!, intent, seed, index, chaos));

  grid.innerHTML = '';
  drafts.forEach(draft => {
    const card = document.createElement('button');
    card.className = 'draft-card';
    card.type = 'button';
    card.innerHTML = `
      <canvas aria-label="Visual draft ${draft.index + 1}"></canvas>
      <span class="draft-meta">
        <span><b>#${String(draft.index + 1).padStart(2, '0')}</b> ${draft.mode}</span>
        <code>${draft.fingerprint}</code>
      </span>
    `;
    grid.appendChild(card);
    const canvas = card.querySelector<HTMLCanvasElement>('canvas')!;
    requestAnimationFrame(() => renderDraft(canvas, draft));
    card.addEventListener('click', () => inspectDraft(draft));
  });

  runInfo.textContent = `${count} drafts · capture ${activeCapture.fingerprint} · seed ${seed}`;
}

function doCapture(): void {
  const capture = captureSources();
  if (!capture) return;
  activeCapture = capture;
  captureInfo.innerHTML = `Frozen capture <code>${capture.fingerprint}</code> · ${new Date(capture.capturedAt).toLocaleTimeString()}`;
  render();
}

function loadQueryInputs(): void {
  const params = new URLSearchParams(window.location.search);
  const source = params.get('source');
  const external = params.get('packet');
  const intent = params.get('intent');
  const seed = params.get('seed');
  const chaos = params.get('chaos');

  if (source) sourceMaterial.value = source;
  if (external) packetInput.value = external;
  if (intent) intentInput.value = intent;
  if (seed && /^-?\d+$/.test(seed)) seedInput.value = seed;
  if (chaos && /^\d+$/.test(chaos)) {
    const value = Math.max(0, Math.min(100, Number.parseInt(chaos, 10)));
    chaosInput.value = String(value);
    chaosValue.textContent = `${value}%`;
  }
}

window.addEventListener('pointermove', event => {
  const now = performance.now();
  const nextX = event.clientX / Math.max(1, window.innerWidth);
  const nextY = event.clientY / Math.max(1, window.innerHeight);
  const distance = Math.hypot(nextX - lastPointerX, nextY - lastPointerY);
  const elapsed = Math.max(1, now - lastPointerAt);
  pointerSpeed = Math.min(1, (distance / elapsed) * 900);
  pointerX = nextX;
  pointerY = nextY;
  lastPointerX = nextX;
  lastPointerY = nextY;
  lastPointerAt = now;
});

chaosInput.addEventListener('input', () => {
  chaosValue.textContent = `${chaosInput.value}%`;
});

document.querySelector('#capture')?.addEventListener('click', doCapture);
document.querySelector('#weave')?.addEventListener('click', render);
document.querySelector('#reroll')?.addEventListener('click', () => {
  seedInput.value = String(Math.floor(Math.random() * 900000000) + 100000000);
  render();
});
document.querySelector('#closeInspector')?.addEventListener('click', () => inspector.classList.add('hidden'));
document.querySelector('#copyRecipe')?.addEventListener('click', async () => {
  if (!selected) return;
  await navigator.clipboard.writeText(JSON.stringify(packet(selected), null, 2));
  const button = document.querySelector<HTMLButtonElement>('#copyRecipe');
  if (!button) return;
  const previous = button.textContent;
  button.textContent = 'Copied';
  window.setTimeout(() => {
    button.textContent = previous;
  }, 900);
});

window.setInterval(updateSignalStrip, 220);
window.addEventListener('resize', updateSignalStrip);

loadQueryInputs();
updateSignalStrip();
doCapture();
