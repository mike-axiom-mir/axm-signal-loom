import './styles.css';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type LocalSignals = {
  pointerX: number;
  pointerY: number;
  pointerSpeed: number;
  scroll: number;
  viewportRatio: number;
  clockPhase: number;
};

type OrganDefinition = {
  id: string;
  label: string;
  kind: string;
  description: string;
  defaultEnabled: boolean;
  defaultWeight: number;
  provenanceRequired: boolean;
  inputMode: 'local' | 'text' | 'json' | 'internet-eye';
};

type OrganState = {
  enabled: boolean;
  weight: number;
  provenance: string;
  raw: string;
};

type Contribution = {
  organId: string;
  label: string;
  normalizedWeight: number;
  provenance: string;
  packetFingerprint: string;
};

type CaptureSession = {
  version: string;
  capturedAt: string;
  recipeFingerprint: string;
  fingerprint: string;
  contributions: Contribution[];
  packets: Array<{
    source: string;
    label: string;
    payload: JsonValue;
    provenance: string;
  }>;
  local: LocalSignals;
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
  session: CaptureSession;
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing #app');
}

const ORGANS: OrganDefinition[] = [
  {
    id: 'browser-local',
    label: 'Browser Local',
    kind: 'local-live',
    description: 'Pointer, motion, scroll, viewport and clock phase captured visibly from this browser.',
    defaultEnabled: true,
    defaultWeight: 1,
    provenanceRequired: false,
    inputMode: 'local',
  },
  {
    id: 'source-material',
    label: 'Source Material',
    kind: 'manual',
    description: 'Explicit text or structured material supplied by the operator.',
    defaultEnabled: true,
    defaultWeight: 0.7,
    provenanceRequired: false,
    inputMode: 'text',
  },
  {
    id: 'working-chat',
    label: 'Working Chat',
    kind: 'connector',
    description: 'A structured packet supplied by another working chat or model seat.',
    defaultEnabled: false,
    defaultWeight: 0.8,
    provenanceRequired: true,
    inputMode: 'json',
  },
  {
    id: 'simulation-state',
    label: 'Simulation State',
    kind: 'simulation',
    description: 'Game, world, physics or deterministic simulation state.',
    defaultEnabled: false,
    defaultWeight: 0.6,
    provenanceRequired: false,
    inputMode: 'json',
  },
  {
    id: 'internet-eye',
    label: 'Internet Eye',
    kind: 'public-index',
    description: 'Target-blind aggregate influence from Shodan-compatible indexed observations.',
    defaultEnabled: false,
    defaultWeight: 0.55,
    provenanceRequired: true,
    inputMode: 'internet-eye',
  },
  {
    id: 'connector-packet',
    label: 'Connector Packet',
    kind: 'connector',
    description: 'Structured data supplied through any authorized external connector.',
    defaultEnabled: false,
    defaultWeight: 0.6,
    provenanceRequired: true,
    inputMode: 'json',
  },
  {
    id: 'file-packet',
    label: 'File Packet',
    kind: 'local',
    description: 'Content or metadata explicitly extracted from a selected file.',
    defaultEnabled: false,
    defaultWeight: 0.5,
    provenanceRequired: true,
    inputMode: 'json',
  },
  {
    id: 'model-output',
    label: 'Model Output',
    kind: 'model',
    description: 'Output explicitly supplied by an AI/model adapter.',
    defaultEnabled: false,
    defaultWeight: 0.5,
    provenanceRequired: true,
    inputMode: 'json',
  },
  {
    id: 'sensor',
    label: 'Sensor',
    kind: 'sensor',
    description: 'Measurements explicitly supplied through a sensor bridge.',
    defaultEnabled: false,
    defaultWeight: 0.5,
    provenanceRequired: true,
    inputMode: 'json',
  },
  {
    id: 'custom',
    label: 'Custom',
    kind: 'custom',
    description: 'Any caller-defined JSON-serializable signal packet.',
    defaultEnabled: false,
    defaultWeight: 0.5,
    provenanceRequired: true,
    inputMode: 'json',
  },
];

const organStates = new Map<string, OrganState>(
  ORGANS.map((organ) => [
    organ.id,
    {
      enabled: organ.defaultEnabled,
      weight: organ.defaultWeight,
      provenance: '',
      raw: '',
    },
  ]),
);

organStates.get('source-material')!.raw = 'metal rain, tiny impossible garden, repair under pressure';

let activeSession: CaptureSession | null = null;
let selectedDraft: Draft | null = null;
let pointerX = 0.5;
let pointerY = 0.5;
let pointerSpeed = 0;
let lastPointerX = 0.5;
let lastPointerY = 0.5;
let lastPointerAt = performance.now();

app.innerHTML = `
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">AXM SIGNAL MACHINE / v0.6</p>
        <h1>Many eyes.<br>One frozen accident.</h1>
        <p class="lede">Source organs capture only what you explicitly give them. Freeze a replayable session for memory, or watch the same weighted sources move through an ephemeral Live Weave before deciding what deserves to be captured.</p>
      </div>
      <div class="status-card">
        <span class="pulse-dot"></span>
        <div>
          <strong>10 source organs registered</strong>
          <small>explicit sources • frozen replay • live motion</small>
        </div>
      </div>
    </header>

    <section class="machine-panel">
      <div class="section-title">
        <div>
          <p class="eyebrow">01 / SOURCE REGISTRY</p>
          <h2>Choose the eyes</h2>
        </div>
        <p>Nothing is silently connected. Enable only the organs you want in this capture; each source keeps its provenance and influence weight.</p>
      </div>
      <div id="liveSignals" class="live-signals"></div>
      <div id="organGrid" class="organ-grid"></div>
    </section>

    <section class="machine-panel control-panel">
      <div class="section-title">
        <div>
          <p class="eyebrow">02 / CAPTURE RECIPE</p>
          <h2>Freeze the mixture</h2>
        </div>
        <p>Capture freezes the enabled source packets and their weights. Re-weaving never silently recaptures live state.</p>
      </div>

      <label class="intent-field">
        <span>Intent bias · optional, never the source</span>
        <input id="intent" value="" placeholder="e.g. impossible civic garden, no bias…" autocomplete="off" />
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

      <div id="captureError" class="capture-error hidden"></div>

      <div class="actions">
        <button id="capture" class="primary">Capture + weave</button>
        <button id="sampleSignals" class="secondary">Load sample signals</button>
        <button id="weave" class="secondary">Weave frozen session</button>
        <button id="reroll" class="secondary">New seed</button>
        <span id="runInfo" class="run-info">No session yet</span>
      </div>
    </section>

    <section id="sessionPanel" class="session-panel hidden">
      <div class="section-title">
        <div>
          <p class="eyebrow">03 / FROZEN SESSION</p>
          <h2>Influence receipt</h2>
        </div>
        <p id="sessionMeta"></p>
      </div>
      <div id="influenceBars" class="influence-bars"></div>
      <div class="session-actions">
        <button id="copySession" class="secondary">Copy session JSON</button>
        <button id="saveSession" class="secondary">Save session locally</button>
        <button id="loadSession" class="secondary">Load saved session</button>
      </div>
      <details>
        <summary>Inspect frozen source packets</summary>
        <pre id="sessionJson"></pre>
      </details>
    </section>

    <section class="results-head">
      <div>
        <p class="eyebrow">04 / TEMPORARY FIELD</p>
        <h2>Visual proposals</h2>
      </div>
      <p>Same session + seed + intent + chaos = same proposals.</p>
    </section>

    <section id="grid" class="grid" aria-live="polite"></section>

    <section id="inspector" class="inspector hidden" aria-live="polite">
      <div class="inspector-copy">
        <p class="eyebrow">CAPTURED RESULT</p>
        <h2 id="inspectTitle">Draft</h2>
        <p id="inspectMeta"></p>
      </div>
      <div class="inspector-actions">
        <button id="copyDraft" class="secondary">Copy proposal packet</button>
        <button id="closeInspector" class="ghost">Close</button>
      </div>
      <pre id="draftJson"></pre>
    </section>

    <footer>
      <span>Sources feed the Magnet.</span>
      <span>The Loom proposes. The consuming project decides.</span>
    </footer>
  </main>
`;

const organGrid = document.querySelector<HTMLElement>('#organGrid')!;
const liveSignals = document.querySelector<HTMLElement>('#liveSignals')!;
const intentInput = document.querySelector<HTMLInputElement>('#intent')!;
const seedInput = document.querySelector<HTMLInputElement>('#seed')!;
const chaosInput = document.querySelector<HTMLInputElement>('#chaos')!;
const chaosValue = document.querySelector<HTMLElement>('#chaosValue')!;
const countInput = document.querySelector<HTMLSelectElement>('#count')!;
const captureError = document.querySelector<HTMLElement>('#captureError')!;
const runInfo = document.querySelector<HTMLElement>('#runInfo')!;
const sessionPanel = document.querySelector<HTMLElement>('#sessionPanel')!;
const sessionMeta = document.querySelector<HTMLElement>('#sessionMeta')!;
const influenceBars = document.querySelector<HTMLElement>('#influenceBars')!;
const sessionJson = document.querySelector<HTMLElement>('#sessionJson')!;
const grid = document.querySelector<HTMLElement>('#grid')!;
const inspector = document.querySelector<HTMLElement>('#inspector')!;
const inspectTitle = document.querySelector<HTMLElement>('#inspectTitle')!;
const inspectMeta = document.querySelector<HTMLElement>('#inspectMeta')!;
const draftJson = document.querySelector<HTMLElement>('#draftJson')!;

function hashText(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function fingerprint(value: unknown): string {
  return hashText(stableStringify(value)).toString(16).padStart(8, '0');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((item) => stableStringify(item)).join(',') + ']';
  }
  const record = value as Record<string, unknown>;
  return '{' + Object.keys(record).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(record[key])).join(',') + '}';
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

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return entities[character] ?? character;
  });
}

function parseJson(raw: string, label: string): JsonValue {
  try {
    return JSON.parse(raw) as JsonValue;
  } catch {
    throw new Error(`${label} contains invalid JSON.`);
  }
}

function entropy(values: string[]): number {
  if (values.length <= 1) return 0;
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  let result = 0;
  counts.forEach((count) => {
    const p = count / values.length;
    result -= p * Math.log2(p);
  });
  const maximum = Math.log2(Math.max(2, counts.size));
  return maximum === 0 ? 0 : Math.min(1, result / maximum);
}

function topCounts(values: string[], limit = 12): Record<string, number> {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return Object.fromEntries(
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit),
  );
}

function reduceInternetEye(raw: JsonValue): JsonValue {
  let matches: JsonValue[] = [];
  if (Array.isArray(raw)) {
    matches = raw;
  } else if (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, JsonValue>).matches)) {
    matches = (raw as Record<string, JsonValue>).matches as JsonValue[];
  } else {
    throw new Error('Internet Eye expects a Shodan-compatible response or matches array.');
  }

  const ports: string[] = [];
  const transports: string[] = [];
  const countries: string[] = [];
  const products: string[] = [];
  const orgHashes: string[] = [];
  const bannerHashes: string[] = [];
  let tlsCount = 0;
  let observations = 0;

  matches.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const match = item as Record<string, JsonValue>;
    observations += 1;
    if (typeof match.port === 'number') ports.push(String(match.port));
    if (typeof match.transport === 'string' && match.transport) transports.push(match.transport.toLowerCase());
    if (match.location && typeof match.location === 'object' && !Array.isArray(match.location)) {
      const location = match.location as Record<string, JsonValue>;
      const country = location.country_code ?? location.country_name;
      if (typeof country === 'string' && country) countries.push(country.toUpperCase());
    }
    products.push(typeof match.product === 'string' && match.product ? match.product.toLowerCase() : 'unknown');
    if (typeof match.org === 'string' && match.org) orgHashes.push(fingerprint(match.org.toLowerCase().trim()));
    if (typeof match.data === 'string' && match.data) bannerHashes.push(fingerprint(match.data));
    if (match.ssl && typeof match.ssl === 'object') tlsCount += 1;
  });

  if (observations === 0) {
    throw new Error('Internet Eye needs at least one usable observation.');
  }

  const aggregate = {
    mode: 'target-blind-aggregate',
    observationCount: observations,
    portMix: topCounts(ports),
    transportMix: topCounts(transports),
    countryMix: topCounts(countries),
    productMix: topCounts(products),
    orgDiversity: Number(entropy(orgHashes).toFixed(6)),
    bannerDiversity: Number(entropy(bannerHashes).toFixed(6)),
    tlsShare: Number((tlsCount / observations).toFixed(6)),
    uniquePortRatio: Number((new Set(ports).size / observations).toFixed(6)),
    uniqueProductRatio: Number((new Set(products).size / observations).toFixed(6)),
  };

  return {
    ...aggregate,
    fingerprint: fingerprint(aggregate),
  };
}

function organHasSignal(organ: OrganDefinition, state: OrganState): boolean {
  return organ.inputMode === 'local' || state.raw.trim().length > 0;
}

function organReadiness(organ: OrganDefinition, state: OrganState): string {
  if (!state.enabled || state.weight <= 0) return 'off';
  if (!organHasSignal(organ, state)) return 'waiting for signal';
  if (organ.provenanceRequired && !state.provenance.trim()) return 'needs provenance';
  return organ.inputMode === 'local' ? 'live' : 'ready';
}

function updateOrganReadiness(id: string): void {
  const organ = ORGANS.find((item) => item.id === id);
  const state = organStates.get(id);
  const node = document.querySelector<HTMLElement>(`[data-readiness="${id}"]`);
  if (!organ || !state || !node) return;
  const readiness = organReadiness(organ, state);
  node.textContent = readiness;
  node.dataset.state = readiness.replaceAll(' ', '-');
}

function renderOrganCards(): void {
  organGrid.innerHTML = ORGANS.map((organ) => {
    const state = organStates.get(organ.id)!;
    const isLocal = organ.inputMode === 'local';
    const placeholder = organ.inputMode === 'internet-eye'
      ? '{"matches":[{"port":443,"transport":"tcp","location":{"country_code":"NL"},"product":"nginx","ssl":{"enabled":true}}]}'
      : organ.inputMode === 'text'
        ? 'Material, notes, observations…'
        : '{"signal":"value"}';
    const input = isLocal
      ? '<div class="local-source-note">Captured from the visible local signal strip at capture time.</div>'
      : `<textarea data-raw="${organ.id}" rows="4" placeholder="${escapeHtml(placeholder)}">${escapeHtml(state.raw)}</textarea>`;
    const provenance = organ.provenanceRequired
      ? `<input data-provenance="${organ.id}" class="provenance-input" value="${escapeHtml(state.provenance)}" placeholder="Provenance required" />`
      : '';

    return `
      <article class="organ-card ${state.enabled ? 'enabled' : ''}" data-organ-card="${organ.id}">
        <div class="organ-head">
          <label class="toggle">
            <input data-enabled="${organ.id}" type="checkbox" ${state.enabled ? 'checked' : ''} />
            <span></span>
          </label>
          <div>
            <strong>${organ.label}</strong>
            <small>${organ.kind}</small>
          </div>
        </div>
        <p>${organ.description}</p>
        <label class="weight-field">
          <span>Influence weight <b data-weight-value="${organ.id}">${state.weight.toFixed(2)}</b></span>
          <input data-weight="${organ.id}" type="range" min="0" max="100" value="${Math.round(state.weight * 100)}" />
        </label>
        ${input}
        ${provenance}
        ${organ.id === 'internet-eye' ? '<div class="eye-boundary">Native reducer: raw targets never enter the frozen session.</div>' : ''}
        <div class="organ-readiness" data-readiness="${organ.id}"></div>
      </article>
    `;
  }).join('');

  organGrid.querySelectorAll<HTMLInputElement>('[data-enabled]').forEach((input) => {
    input.addEventListener('change', () => {
      const id = input.dataset.enabled!;
      const state = organStates.get(id)!;
      state.enabled = input.checked;
      document.querySelector<HTMLElement>(`[data-organ-card="${id}"]`)?.classList.toggle('enabled', input.checked);
      updateOrganReadiness(id);
    });
  });

  organGrid.querySelectorAll<HTMLInputElement>('[data-weight]').forEach((input) => {
    input.addEventListener('input', () => {
      const id = input.dataset.weight!;
      const state = organStates.get(id)!;
      state.weight = Number(input.value) / 100;
      const value = document.querySelector<HTMLElement>(`[data-weight-value="${id}"]`);
      if (value) value.textContent = state.weight.toFixed(2);
      updateOrganReadiness(id);
    });
  });

  organGrid.querySelectorAll<HTMLTextAreaElement>('[data-raw]').forEach((input) => {
    input.addEventListener('input', () => {
      const id = input.dataset.raw!;
      organStates.get(id)!.raw = input.value;
      updateOrganReadiness(id);
    });
  });

  organGrid.querySelectorAll<HTMLInputElement>('[data-provenance]').forEach((input) => {
    input.addEventListener('input', () => {
      const id = input.dataset.provenance!;
      organStates.get(id)!.provenance = input.value;
      updateOrganReadiness(id);
    });
  });

  ORGANS.forEach((organ) => updateOrganReadiness(organ.id));
}

function captureSession(): CaptureSession | null {
  captureError.classList.add('hidden');
  captureError.textContent = '';

  try {
    const local = localSnapshot();
    const enabled = ORGANS.filter((organ) => organStates.get(organ.id)!.enabled && organStates.get(organ.id)!.weight > 0);
    const usable = enabled.filter((organ) => organHasSignal(organ, organStates.get(organ.id)!));
    if (usable.length === 0) {
      throw new Error('No enabled source organ currently has a usable signal.');
    }

    const totalWeight = usable.reduce((sum, organ) => sum + organStates.get(organ.id)!.weight, 0);
    const packets: CaptureSession['packets'] = [];
    const contributions: Contribution[] = [];

    usable.forEach((organ) => {
      const state = organStates.get(organ.id)!;
      if (organ.provenanceRequired && !state.provenance.trim()) {
        throw new Error(`${organ.label} requires provenance for the data you entered.`);
      }

      let payload: JsonValue;
      if (organ.inputMode === 'local') {
        payload = local as unknown as JsonValue;
      } else if (organ.inputMode === 'text') {
        payload = state.raw;
      } else {
        const parsed = parseJson(state.raw, organ.label);
        payload = organ.inputMode === 'internet-eye' ? reduceInternetEye(parsed) : parsed;
      }

      const packet = {
        source: organ.id,
        label: organ.label,
        payload,
        provenance: state.provenance,
      };
      const normalizedWeight = state.weight / totalWeight;
      packets.push(packet);
      contributions.push({
        organId: organ.id,
        label: organ.label,
        normalizedWeight,
        provenance: state.provenance,
        packetFingerprint: fingerprint(packet),
      });
    });

    const recipe = {
      version: 'axm.signal-machine.recipe/0.5',
      inputs: contributions.map((contribution, index) => ({
        organId: contribution.organId,
        weight: contribution.normalizedWeight,
        packetFingerprint: contribution.packetFingerprint,
        provenance: contribution.provenance,
        packet: packets[index],
      })),
    };
    const recipeFingerprint = fingerprint(recipe);
    const base = {
      version: 'axm.signal-machine.session/0.5',
      recipeFingerprint,
      contributions,
      packets,
      local,
    };
    return {
      ...base,
      capturedAt: new Date().toISOString(),
      fingerprint: fingerprint(base),
    };
  } catch (error) {
    captureError.textContent = error instanceof Error ? error.message : 'Capture failed.';
    captureError.classList.remove('hidden');
    return null;
  }
}

function sourceVector(session: CaptureSession, width: number): number[] {
  const randomizers = session.packets.map((packet) => mulberry32(hashText(stableStringify(packet))));
  return Array.from({ length: width }, () => {
    let combined = 0;
    randomizers.forEach((random, index) => {
      const contribution = session.contributions[index];
      combined += (random() * 2 - 1) * (contribution?.normalizedWeight ?? 0);
    });
    return clamp(combined);
  });
}

function intentVector(intent: string, width: number): number[] {
  if (!intent.trim()) return Array.from({ length: width }, () => 0);
  const random = mulberry32(hashText(intent.toLowerCase().trim()));
  return Array.from({ length: width }, () => random() * 2 - 1);
}

function makeDraft(session: CaptureSession, intent: string, rootSeed: number, index: number, chaos: number): Draft {
  const width = 72;
  const source = sourceVector(session, width);
  const bias = intentVector(intent, width);
  const localSeed = (rootSeed ^ hashText(session.fingerprint) ^ Math.imul(index + 1, 2654435761)) >>> 0;
  const random = mulberry32(localSeed);
  const field: number[] = [];

  for (let i = 0; i < width; i += 1) {
    const noise = random() * 2 - 1;
    const rhythm = Math.sin((i / (width - 1)) * Math.PI * 2 * (1.3 + chaos * 7.7) + index * 0.37);
    const mixed =
      (source[i] ?? 0) * 0.66 +
      (bias[i] ?? 0) * 0.1 +
      noise * (0.07 + chaos * 0.27) +
      rhythm * (0.12 + chaos * 0.2);
    field.push(clamp(mixed + (random() * 2 - 1) * chaos * 0.2));
  }

  const hueBase = (hashText(session.fingerprint) + index * 47 + Math.floor(chaos * 100)) % 360;
  const palette = [
    hueBase,
    (hueBase + 44 + Math.abs(field[5] ?? 0) * 80) % 360,
    (hueBase + 172 + Math.abs(field[19] ?? 0) * 86) % 360,
  ];
  const modes = ['ribbon', 'bloom', 'shards', 'orbit', 'terrain', 'mesh', 'constellation'];
  const mode = modes[Math.floor(random() * modes.length)] ?? 'ribbon';
  const resultFingerprint = fingerprint({
    session: session.fingerprint,
    intent,
    rootSeed,
    index,
    chaos: Number(chaos.toFixed(4)),
    field: field.map((value) => Number(value.toFixed(5))),
  });

  return {
    index,
    seed: rootSeed,
    chaos,
    intent,
    mode,
    field,
    palette,
    fingerprint: resultFingerprint,
    session,
  };
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

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, draft: Draft): void {
  const gradient = ctx.createRadialGradient(width * 0.45, height * 0.38, 8, width * 0.5, height * 0.5, width * 0.8);
  gradient.addColorStop(0, color(draft.palette[0] ?? 200, 0.26, 22));
  gradient.addColorStop(0.55, color(draft.palette[1] ?? 250, 0.09, 12));
  gradient.addColorStop(1, '#080a0f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawRibbon(ctx: CanvasRenderingContext2D, width: number, height: number, draft: Draft): void {
  for (let layer = 0; layer < 7; layer += 1) {
    ctx.beginPath();
    draft.field.forEach((value, index) => {
      const x = (index / (draft.field.length - 1)) * width;
      const y = height * 0.5 + value * height * (0.18 + layer * 0.018) + Math.sin(index * 0.22 + layer) * 16;
      if (index === 0) ctx.moveTo(x, y);
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
  const maximum = Math.min(width, height) * 0.34;
  for (let ring = 0; ring < 5; ring += 1) {
    ctx.beginPath();
    draft.field.forEach((value, index) => {
      const angle = (index / draft.field.length) * Math.PI * 2;
      const radius = maximum * (0.34 + ring * 0.11 + Math.abs(value) * 0.32);
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (index === 0) ctx.moveTo(x, y);
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
  for (let index = 0; index < 32; index += 1) {
    const value = Math.abs(draft.field[index % draft.field.length] ?? 0);
    const x = random() * width;
    const y = random() * height;
    const size = 18 + value * 68;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size * (0.3 + random() * 0.6), y + size * 0.5);
    ctx.lineTo(x - size * (0.3 + random() * 0.5), y + size * 0.4);
    ctx.closePath();
    ctx.fillStyle = color(draft.palette[index % 3] ?? 210, 0.08 + value * 0.22, 56);
    ctx.strokeStyle = color(draft.palette[(index + 1) % 3] ?? 260, 0.35 + value * 0.35, 68);
    ctx.fill();
    ctx.stroke();
  }
}

function drawOrbit(ctx: CanvasRenderingContext2D, width: number, height: number, draft: Draft): void {
  const cx = width / 2;
  const cy = height / 2;
  draft.field.slice(0, 28).forEach((value, index) => {
    const radius = 24 + index * Math.min(width, height) * 0.012;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius * (1 + Math.abs(value) * 1.4), radius * 0.48, value * 1.8, 0, Math.PI * 2);
    ctx.strokeStyle = color(draft.palette[index % 3] ?? 200, 0.12 + Math.abs(value) * 0.34, 64);
    ctx.lineWidth = 0.8 + Math.abs(value) * 2.4;
    ctx.stroke();
  });
}

function drawTerrain(ctx: CanvasRenderingContext2D, width: number, height: number, draft: Draft): void {
  for (let row = 0; row < 12; row += 1) {
    ctx.beginPath();
    draft.field.forEach((value, index) => {
      const x = (index / (draft.field.length - 1)) * width;
      const shifted = draft.field[(index + row * 3) % draft.field.length] ?? value;
      const y = height * 0.18 + row * height * 0.058 + shifted * 22;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color(draft.palette[row % 3] ?? 190, 0.18 + row * 0.035, 56 + row);
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }
}

function drawMesh(ctx: CanvasRenderingContext2D, width: number, height: number, draft: Draft): void {
  const columns = 9;
  const rows = 7;
  const nodes: Array<{ x: number; y: number; v: number }> = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const index = (y * columns + x) % draft.field.length;
      const value = draft.field[index] ?? 0;
      nodes.push({
        x: 24 + (x / (columns - 1)) * (width - 48) + value * 18,
        y: 24 + (y / (rows - 1)) * (height - 48) + value * 22,
        v: value,
      });
    }
  }
  nodes.forEach((node, index) => {
    const right = index % columns < columns - 1 ? nodes[index + 1] : undefined;
    const down = index + columns < nodes.length ? nodes[index + columns] : undefined;
    [right, down].forEach((target) => {
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
  const points = draft.field.slice(0, 42).map((value) => ({
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
  drawBackground(ctx, width, height, draft);
  const renderers: Record<string, (context: CanvasRenderingContext2D, w: number, h: number, item: Draft) => void> = {
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

function proposalPacket(draft: Draft): JsonValue {
  return {
    version: 'axm.signal-loom.browser/0.5',
    sessionFingerprint: draft.session.fingerprint,
    recipeFingerprint: draft.session.recipeFingerprint,
    influence: draft.session.contributions.map((item) => ({
      organId: item.organId,
      weight: Number(item.normalizedWeight.toFixed(6)),
      packetFingerprint: item.packetFingerprint,
      provenance: item.provenance,
    })),
    intentBias: draft.intent,
    seed: draft.seed,
    draft: draft.index,
    chaos: Number(draft.chaos.toFixed(4)),
    mode: draft.mode,
    paletteHsl: draft.palette.map((hue) => Number(hue.toFixed(2))),
    fingerprint: draft.fingerprint,
    field: draft.field.map((value) => Number(value.toFixed(6))),
    boundary: 'proposal-only',
  };
}

function renderSession(): void {
  if (!activeSession) {
    sessionPanel.classList.add('hidden');
    return;
  }
  sessionPanel.classList.remove('hidden');
  sessionMeta.textContent = `session ${activeSession.fingerprint} · recipe ${activeSession.recipeFingerprint} · ${activeSession.contributions.length} organs`;
  influenceBars.innerHTML = activeSession.contributions.map((contribution) => {
    const percent = Math.round(contribution.normalizedWeight * 100);
    return `
      <div class="influence-row">
        <div class="influence-label"><b>${contribution.label}</b><span>${percent}%</span></div>
        <div class="influence-track"><span style="width:${percent}%"></span></div>
        <code>${contribution.packetFingerprint}</code>
      </div>
    `;
  }).join('');
  sessionJson.textContent = JSON.stringify(activeSession, null, 2);
}

function renderProposals(): void {
  if (!activeSession) {
    grid.innerHTML = '<div class="empty-field">Capture a source recipe first.</div>';
    return;
  }

  const intent = intentInput.value.trim();
  const seed = Number.parseInt(seedInput.value, 10) || 1;
  const chaos = Number.parseInt(chaosInput.value, 10) / 100;
  const count = Number.parseInt(countInput.value, 10);
  const drafts = Array.from({ length: count }, (_, index) => makeDraft(activeSession!, intent, seed, index, chaos));

  grid.innerHTML = '';
  drafts.forEach((draft) => {
    const card = document.createElement('button');
    card.className = 'draft-card';
    card.type = 'button';
    card.innerHTML = `
      <canvas aria-label="Visual proposal ${draft.index + 1}"></canvas>
      <span class="draft-meta">
        <span><b>#${String(draft.index + 1).padStart(2, '0')}</b> ${draft.mode}</span>
        <code>${draft.fingerprint}</code>
      </span>
    `;
    grid.appendChild(card);
    const canvas = card.querySelector<HTMLCanvasElement>('canvas')!;
    requestAnimationFrame(() => renderDraft(canvas, draft));
    card.addEventListener('click', () => {
      selectedDraft = draft;
      inspector.classList.remove('hidden');
      inspectTitle.textContent = `Proposal ${String(draft.index + 1).padStart(2, '0')} · ${draft.mode}`;
      inspectMeta.textContent = `session ${draft.session.fingerprint} · seed ${draft.seed} · chaos ${Math.round(draft.chaos * 100)}% · result ${draft.fingerprint}`;
      draftJson.textContent = JSON.stringify(proposalPacket(draft), null, 2);
      inspector.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  runInfo.textContent = `${count} proposals · frozen session ${activeSession.fingerprint} · seed ${seed}`;
}

function loadSampleSignals(): void {
  const samples: Record<string, { raw: string; provenance?: string }> = {
    'source-material': { raw: 'metal rain, tiny impossible garden, repair under pressure' },
    'working-chat': { raw: '{"themes":["glass forest","repair"],"energy":0.8}', provenance: 'built-in demo fixture, not live' },
    'simulation-state': { raw: '{"storm":0.65,"crowding":0.42,"motion":0.81}' },
    'internet-eye': { raw: '{"matches":[{"port":443,"transport":"tcp","location":{"country_code":"NL"},"product":"nginx","ssl":{"enabled":true}},{"port":22,"transport":"tcp","location":{"country_code":"DE"},"product":"OpenSSH"}]}', provenance: 'built-in demo fixture, not live Shodan retrieval' },
    'connector-packet': { raw: '{"temperature":0.42,"pulse":0.77}', provenance: 'built-in demo connector fixture' },
    'file-packet': { raw: '{"name":"imaginary-notes.txt","density":0.36,"rhythm":0.71}', provenance: 'built-in demo file fixture' },
    'model-output': { raw: '{"motifs":["repair","fracture","garden"],"confidence":0.68}', provenance: 'built-in demo model fixture' },
    sensor: { raw: '{"light":0.31,"motion":0.74,"noise":0.46}', provenance: 'built-in demo sensor fixture' },
    custom: { raw: '{"strangeness":0.93,"coherence":0.51}', provenance: 'built-in demo custom fixture' },
  };

  ORGANS.forEach((organ) => {
    const state = organStates.get(organ.id)!;
    state.enabled = true;
    const sample = samples[organ.id];
    if (sample) {
      state.raw = sample.raw;
      state.provenance = sample.provenance ?? state.provenance;
    }
  });
  renderOrganCards();
  runInfo.textContent = 'Sample signals loaded — fixtures only, not live external sources.';
}

function doCapture(): void {
  const session = captureSession();
  if (!session) return;
  activeSession = session;
  renderSession();
  renderProposals();
}

async function copyText(text: string, button: HTMLButtonElement): Promise<void> {
  await navigator.clipboard.writeText(text);
  const previous = button.textContent;
  button.textContent = 'Copied';
  window.setTimeout(() => {
    button.textContent = previous;
  }, 900);
}

function loadSessionFromStorage(): void {
  const raw = localStorage.getItem('axm-signal-machine-session-v0.5');
  if (!raw) {
    captureError.textContent = 'No explicitly saved local session exists.';
    captureError.classList.remove('hidden');
    return;
  }
  try {
    const parsed = JSON.parse(raw) as CaptureSession;
    activeSession = parsed;
    captureError.classList.add('hidden');
    renderSession();
    renderProposals();
  } catch {
    captureError.textContent = 'Saved local session is invalid.';
    captureError.classList.remove('hidden');
  }
}

function loadQueryInputs(): void {
  const params = new URLSearchParams(window.location.search);
  const packet = params.get('packet');
  const source = params.get('source');
  const intent = params.get('intent');
  const seed = params.get('seed');
  const chaos = params.get('chaos');

  if (source) {
    const state = organStates.get('source-material')!;
    state.enabled = true;
    state.raw = source;
  }
  if (packet) {
    const state = organStates.get('working-chat')!;
    state.enabled = true;
    state.raw = packet;
    state.provenance = 'URL working-chat bridge';
  }
  if (intent) intentInput.value = intent;
  if (seed && /^-?\d+$/.test(seed)) seedInput.value = seed;
  if (chaos && /^\d+$/.test(chaos)) {
    const value = Math.max(0, Math.min(100, Number.parseInt(chaos, 10)));
    chaosInput.value = String(value);
    chaosValue.textContent = `${value}%`;
  }
}

function updateLiveSignals(): void {
  const local = localSnapshot();
  liveSignals.innerHTML = [
    ['pointer x', local.pointerX],
    ['pointer y', local.pointerY],
    ['motion', local.pointerSpeed],
    ['scroll', local.scroll],
    ['viewport', local.viewportRatio],
    ['clock', local.clockPhase],
  ].map(([label, value]) => `<span><b>${label}</b><code>${value}</code></span>`).join('');
}

window.addEventListener('pointermove', (event) => {
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
document.querySelector('#sampleSignals')?.addEventListener('click', loadSampleSignals);
document.querySelector('#weave')?.addEventListener('click', renderProposals);
document.querySelector('#reroll')?.addEventListener('click', () => {
  seedInput.value = String(Math.floor(Math.random() * 900000000) + 100000000);
  renderProposals();
});
document.querySelector('#closeInspector')?.addEventListener('click', () => inspector.classList.add('hidden'));

document.querySelector<HTMLButtonElement>('#copySession')?.addEventListener('click', (event) => {
  if (!activeSession) return;
  void copyText(JSON.stringify(activeSession, null, 2), event.currentTarget as HTMLButtonElement);
});
document.querySelector<HTMLButtonElement>('#saveSession')?.addEventListener('click', (event) => {
  if (!activeSession) return;
  localStorage.setItem('axm-signal-machine-session-v0.5', JSON.stringify(activeSession));
  const button = event.currentTarget as HTMLButtonElement;
  const previous = button.textContent;
  button.textContent = 'Saved explicitly';
  window.setTimeout(() => {
    button.textContent = previous;
  }, 1000);
});
document.querySelector('#loadSession')?.addEventListener('click', loadSessionFromStorage);
document.querySelector<HTMLButtonElement>('#copyDraft')?.addEventListener('click', (event) => {
  if (!selectedDraft) return;
  void copyText(JSON.stringify(proposalPacket(selectedDraft), null, 2), event.currentTarget as HTMLButtonElement);
});

loadQueryInputs();
renderOrganCards();
updateLiveSignals();
window.setInterval(updateLiveSignals, 250);
grid.innerHTML = '<div class="empty-field">Capture a source recipe first.</div>';
