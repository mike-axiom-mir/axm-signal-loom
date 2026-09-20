import './styles.css';

type Draft = {
  index: number;
  seed: number;
  chaos: number;
  prompt: string;
  mode: string;
  field: number[];
  palette: number[];
  fingerprint: string;
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing #app');
}

app.innerHTML = `
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">AXM EXPERIMENT / SIGNAL LOOM</p>
        <h1>Catch a strange signal.</h1>
        <p class="lede">Throw concepts into the loom. It creates replayable visual drafts, not finished art. Keep the accidents you like.</p>
      </div>
      <div class="status-card">
        <span class="pulse-dot"></span>
        <div>
          <strong>Browser loom online</strong>
          <small>offline • seeded • disposable</small>
        </div>
      </div>
    </header>

    <section class="workbench" aria-label="Signal controls">
      <label class="prompt-field">
        <span>Signal prompt</span>
        <input id="prompt" value="storm ceramic insect jazz" autocomplete="off" />
      </label>

      <div class="controls">
        <label>
          <span>Seed</span>
          <input id="seed" type="number" value="4837291" step="1" />
        </label>
        <label class="range-wrap">
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
        <button id="weave" class="primary">Weave signals</button>
        <button id="reroll" class="secondary">New seed</button>
        <span id="runInfo" class="run-info"></span>
      </div>

      <div class="presets" aria-label="Prompt presets">
        <button data-prompt="storm ceramic insect jazz">storm ceramic insect jazz</button>
        <button data-prompt="abandoned carnival radio">abandoned carnival radio</button>
        <button data-prompt="glass insect cathedral">glass insect cathedral</button>
        <button data-prompt="friendly machine dreaming underwater">machine dreaming underwater</button>
      </div>
    </section>

    <section class="results-head">
      <div>
        <p class="eyebrow">TEMPORARY FIELD</p>
        <h2>Visual drafts</h2>
      </div>
      <p>Same recipe = same result. Click one to inspect it.</p>
    </section>

    <section id="grid" class="grid" aria-live="polite"></section>

    <section id="inspector" class="inspector hidden" aria-live="polite">
      <div class="inspector-copy">
        <p class="eyebrow">CAPTURED SIGNAL</p>
        <h2 id="inspectTitle">Draft</h2>
        <p id="inspectMeta"></p>
      </div>
      <div class="inspector-actions">
        <button id="copyRecipe" class="secondary">Copy recipe</button>
        <button id="closeInspector" class="ghost">Close</button>
      </div>
      <pre id="recipe"></pre>
    </section>

    <footer>
      <span>Signal Loom proposes.</span>
      <span>The consuming project decides.</span>
    </footer>
  </main>
`;

const promptInput = document.querySelector<HTMLInputElement>('#prompt')!;
const seedInput = document.querySelector<HTMLInputElement>('#seed')!;
const chaosInput = document.querySelector<HTMLInputElement>('#chaos')!;
const chaosValue = document.querySelector<HTMLElement>('#chaosValue')!;
const countInput = document.querySelector<HTMLSelectElement>('#count')!;
const grid = document.querySelector<HTMLElement>('#grid')!;
const runInfo = document.querySelector<HTMLElement>('#runInfo')!;
const inspector = document.querySelector<HTMLElement>('#inspector')!;
const inspectTitle = document.querySelector<HTMLElement>('#inspectTitle')!;
const inspectMeta = document.querySelector<HTMLElement>('#inspectMeta')!;
const recipe = document.querySelector<HTMLElement>('#recipe')!;

let selected: Draft | null = null;

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

function makeDraft(
  prompt: string,
  rootSeed: number,
  index: number,
  chaos: number
): Draft {
  const promptSeed = hashText(prompt.toLowerCase().trim());
  const localSeed =
    (rootSeed ^ promptSeed ^ Math.imul(index + 1, 2654435761)) >>> 0;
  const random = mulberry32(localSeed);
  const length = 72;
  const conceptRandom = mulberry32(promptSeed ^ 0xa53a9e1d);
  const field: number[] = [];

  for (let i = 0; i < length; i += 1) {
    const concept = conceptRandom() * 2 - 1;
    const noise = random() * 2 - 1;
    const rhythm = Math.sin(
      (i / (length - 1)) * Math.PI * 2 * (1.6 + chaos * 7.2) + index * 0.37
    );
    const mixed =
      concept * 0.52 +
      noise * (0.12 + chaos * 0.48) +
      rhythm * (0.18 + chaos * 0.28);
    const mutation = (random() * 2 - 1) * chaos * 0.35;
    field.push(clamp(mixed + mutation));
  }

  const hueBase = (promptSeed + index * 47 + Math.floor(chaos * 100)) % 360;
  const palette = [
    hueBase,
    (hueBase + 38 + Math.abs(field[5]) * 72) % 360,
    (hueBase + 170 + Math.abs(field[19]) * 80) % 360,
  ];

  const modes = [
    'ribbon',
    'bloom',
    'shards',
    'orbit',
    'terrain',
    'mesh',
    'constellation',
  ];
  const mode = modes[Math.floor(random() * modes.length)] ?? 'ribbon';
  const fingerprint = hashText(
    `${prompt}|${rootSeed}|${index}|${chaos.toFixed(4)}|${field.map(value => value.toFixed(4)).join(',')}`
  )
    .toString(16)
    .padStart(8, '0');

  return {
    index,
    seed: rootSeed,
    chaos,
    prompt,
    mode,
    field,
    palette,
    fingerprint,
  };
}

function color(hue: number, alpha = 1, light = 62): string {
  return `hsla(${hue}, 88%, ${light}%, ${alpha})`;
}

function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(260, Math.floor(rect.width));
  const height = Math.max(210, Math.floor(rect.height));
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas unavailable');
  }
  ctx.scale(ratio, ratio);
  return ctx;
}

function background(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  draft: Draft
): void {
  const gradient = ctx.createRadialGradient(
    width * 0.45,
    height * 0.38,
    10,
    width * 0.5,
    height * 0.5,
    width * 0.75
  );
  gradient.addColorStop(0, color(draft.palette[0] ?? 200, 0.22, 22));
  gradient.addColorStop(0.55, color(draft.palette[1] ?? 250, 0.08, 12));
  gradient.addColorStop(1, '#080a0f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawRibbon(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  draft: Draft
): void {
  for (let layer = 0; layer < 7; layer += 1) {
    ctx.beginPath();
    draft.field.forEach((value, i) => {
      const x = (i / (draft.field.length - 1)) * width;
      const y =
        height * 0.5 +
        value * height * (0.18 + layer * 0.018) +
        Math.sin(i * 0.22 + layer) * 16;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color(
      draft.palette[layer % 3] ?? 200,
      0.18 + layer * 0.07,
      58 + layer * 2
    );
    ctx.lineWidth = 2 + layer * 1.2;
    ctx.stroke();
  }
}

function drawBloom(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  draft: Draft
): void {
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

function drawShards(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  draft: Draft
): void {
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
    ctx.strokeStyle = color(
      draft.palette[(i + 1) % 3] ?? 260,
      0.35 + value * 0.35,
      68
    );
    ctx.fill();
    ctx.stroke();
  }
}

function drawOrbit(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  draft: Draft
): void {
  const cx = width / 2;
  const cy = height / 2;
  draft.field.slice(0, 28).forEach((value, i) => {
    const radius = 24 + i * Math.min(width, height) * 0.012;
    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy,
      radius * (1 + Math.abs(value) * 1.4),
      radius * 0.48,
      value * 1.8,
      0,
      Math.PI * 2
    );
    ctx.strokeStyle = color(
      draft.palette[i % 3] ?? 200,
      0.12 + Math.abs(value) * 0.34,
      64
    );
    ctx.lineWidth = 0.8 + Math.abs(value) * 2.4;
    ctx.stroke();
  });
}

function drawTerrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  draft: Draft
): void {
  for (let row = 0; row < 12; row += 1) {
    ctx.beginPath();
    draft.field.forEach((value, i) => {
      const x = (i / (draft.field.length - 1)) * width;
      const shifted = draft.field[(i + row * 3) % draft.field.length] ?? value;
      const y = height * 0.18 + row * height * 0.058 + shifted * 22;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color(
      draft.palette[row % 3] ?? 190,
      0.18 + row * 0.035,
      56 + row
    );
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }
}

function drawMesh(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  draft: Draft
): void {
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
      ctx.strokeStyle = color(
        draft.palette[index % 3] ?? 200,
        0.16 + Math.abs(node.v) * 0.35,
        62
      );
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.arc(node.x, node.y, 1.5 + Math.abs(node.v) * 4.5, 0, Math.PI * 2);
    ctx.fillStyle = color(draft.palette[index % 3] ?? 200, 0.75, 72);
    ctx.fill();
  });
}

function drawConstellation(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  draft: Draft
): void {
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
      ctx.strokeStyle = color(
        draft.palette[index % 3] ?? 200,
        0.08 + Math.abs(point.v) * 0.24,
        66
      );
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(point.x, point.y, 1.3 + Math.abs(point.v) * 5.5, 0, Math.PI * 2);
    ctx.fillStyle = color(
      draft.palette[index % 3] ?? 200,
      0.6 + Math.abs(point.v) * 0.3,
      76
    );
    ctx.fill();
  });
}

function renderDraft(canvas: HTMLCanvasElement, draft: Draft): void {
  const ctx = setupCanvas(canvas);
  const width = canvas.width / Math.min(window.devicePixelRatio || 1, 2);
  const height = canvas.height / Math.min(window.devicePixelRatio || 1, 2);
  background(ctx, width, height, draft);

  const renderers: Record<
    string,
    (context: CanvasRenderingContext2D, w: number, h: number, d: Draft) => void
  > = {
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
    version: 'axm.signal-loom.browser/0.2',
    prompt: draft.prompt,
    seed: draft.seed,
    draft: draft.index,
    chaos: Number(draft.chaos.toFixed(4)),
    mode: draft.mode,
    palette_hsl: draft.palette.map(hue => Number(hue.toFixed(2))),
    fingerprint: draft.fingerprint,
    field: draft.field.map(value => Number(value.toFixed(6))),
    boundary: 'proposal-only',
  };
}

function inspectDraft(draft: Draft): void {
  selected = draft;
  inspector.classList.remove('hidden');
  inspectTitle.textContent = `Draft ${String(draft.index + 1).padStart(2, '0')} · ${draft.mode}`;
  inspectMeta.textContent = `seed ${draft.seed} · chaos ${Math.round(draft.chaos * 100)}% · fingerprint ${draft.fingerprint}`;
  recipe.textContent = JSON.stringify(packet(draft), null, 2);
  inspector.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function render(): void {
  const prompt = promptInput.value.trim() || 'silence';
  const seed = Number.parseInt(seedInput.value, 10) || 1;
  const chaos = Number.parseInt(chaosInput.value, 10) / 100;
  const count = Number.parseInt(countInput.value, 10);
  const drafts = Array.from({ length: count }, (_, index) =>
    makeDraft(prompt, seed, index, chaos)
  );

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

  runInfo.textContent = `${count} drafts · seed ${seed}`;
}

chaosInput.addEventListener('input', () => {
  chaosValue.textContent = `${chaosInput.value}%`;
});

document.querySelector('#weave')?.addEventListener('click', render);
document.querySelector('#reroll')?.addEventListener('click', () => {
  const nextSeed = Math.floor(Math.random() * 900000000) + 100000000;
  seedInput.value = String(nextSeed);
  render();
});

document
  .querySelectorAll<HTMLButtonElement>('[data-prompt]')
  .forEach(button => {
    button.addEventListener('click', () => {
      promptInput.value = button.dataset.prompt ?? '';
      render();
    });
  });

document.querySelector('#closeInspector')?.addEventListener('click', () => {
  inspector.classList.add('hidden');
});

document.querySelector('#copyRecipe')?.addEventListener('click', async () => {
  if (!selected) return;
  const value = JSON.stringify(packet(selected), null, 2);
  await navigator.clipboard.writeText(value);
  const button = document.querySelector<HTMLButtonElement>('#copyRecipe');
  if (button) {
    const old = button.textContent;
    button.textContent = 'Copied';
    window.setTimeout(() => {
      button.textContent = old;
    }, 900);
  }
});

promptInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') render();
});

window.addEventListener('resize', () => {
  window.clearTimeout(Number(document.body.dataset.resizeTimer ?? '0'));
  const timer = window.setTimeout(render, 140);
  document.body.dataset.resizeTimer = String(timer);
});

render();
