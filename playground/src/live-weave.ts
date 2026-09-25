import './live-weave.css';

type LiveMode = 'flow' | 'particles' | 'mesh';

type LiveSource = {
  id: string;
  label: string;
  enabled: boolean;
  weight: number;
  readiness: string;
  payload: unknown;
  provenance: string;
  valid: boolean;
  error: string;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
};

const FIELD_WIDTH = 96;
const SAMPLE_INTERVAL_MS = 100;

function hashText(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const record = value as Record<string, unknown>;
  return '{' + Object.keys(record)
    .sort()
    .map((key) => JSON.stringify(key) + ':' + stableStringify(record[key]))
    .join(',') + '}';
}

function clamp(value: number, min = -1, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function vectorFrom(value: unknown, label: string): number[] {
  const random = mulberry32(hashText(label + ':' + stableStringify(value)));
  return Array.from({ length: FIELD_WIDTH }, () => random() * 2 - 1);
}

function topCounts(values: string[], limit = 10): Record<string, number> {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return Object.fromEntries(
    [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, limit),
  );
}

function diversity(values: string[]): number {
  if (values.length <= 1) return 0;
  const unique = new Set(values).size;
  return Number((unique / values.length).toFixed(6));
}

function reduceInternetEye(raw: unknown): unknown {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : null;
  const matches = Array.isArray(raw)
    ? raw
    : record && Array.isArray(record.matches)
      ? record.matches
      : null;

  if (!matches) throw new Error('invalid Shodan-compatible observation packet');

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
    const match = item as Record<string, unknown>;
    observations += 1;
    if (typeof match.port === 'number') ports.push(String(match.port));
    if (typeof match.transport === 'string' && match.transport) transports.push(match.transport.toLowerCase());
    if (match.location && typeof match.location === 'object' && !Array.isArray(match.location)) {
      const location = match.location as Record<string, unknown>;
      const country = location.country_code ?? location.country_name;
      if (typeof country === 'string' && country) countries.push(country.toUpperCase());
    }
    products.push(typeof match.product === 'string' && match.product ? match.product.toLowerCase() : 'unknown');
    if (typeof match.org === 'string' && match.org) orgHashes.push(String(hashText(match.org.toLowerCase().trim())));
    if (typeof match.data === 'string' && match.data) bannerHashes.push(String(hashText(match.data)));
    if (match.ssl && typeof match.ssl === 'object') tlsCount += 1;
  });

  if (observations === 0) throw new Error('no usable indexed observations');

  return {
    mode: 'target-blind-aggregate',
    observationCount: observations,
    portMix: topCounts(ports),
    transportMix: topCounts(transports),
    countryMix: topCounts(countries),
    productMix: topCounts(products),
    orgDiversity: diversity(orgHashes),
    bannerDiversity: diversity(bannerHashes),
    tlsShare: Number((tlsCount / observations).toFixed(6)),
    uniquePortRatio: Number((new Set(ports).size / observations).toFixed(6)),
    uniqueProductRatio: Number((new Set(products).size / observations).toFixed(6)),
  };
}

function initLiveWeave(shell: HTMLElement): void {
  const hero = shell.querySelector<HTMLElement>('.hero');
  const captureButton = shell.querySelector<HTMLButtonElement>('#capture');
  const sampleButton = shell.querySelector<HTMLButtonElement>('#sampleSignals');
  const captureError = shell.querySelector<HTMLElement>('#captureError');
  const sessionPanel = shell.querySelector<HTMLElement>('#sessionPanel');

  if (!hero || !captureButton || !sessionPanel) return;
  const frozenCaptureButton = captureButton as HTMLButtonElement;
  const frozenSessionPanel = sessionPanel as HTMLElement;

  const frozenElements: HTMLElement[] = [
    ...Array.from(shell.querySelectorAll<HTMLElement>('.machine-panel')),
    frozenSessionPanel,
    ...Array.from(shell.querySelectorAll<HTMLElement>('.results-head')),
    shell.querySelector<HTMLElement>('#grid'),
    shell.querySelector<HTMLElement>('#inspector'),
  ].filter((item): item is HTMLElement => item !== null);

  const modeBar = document.createElement('section');
  modeBar.className = 'weave-mode-bar';
  modeBar.innerHTML = `
    <div class="weave-mode-tabs" role="tablist" aria-label="Signal Machine presentation mode">
      <button class="weave-mode-tab active" data-mode="frozen" type="button" role="tab" aria-selected="true">
        <span>Frozen Weave</span>
        <small>FROZEN / REPLAYABLE</small>
      </button>
      <button class="weave-mode-tab" data-mode="live" type="button" role="tab" aria-selected="false">
        <span>Live Weave</span>
        <small>LIVE / EPHEMERAL</small>
      </button>
    </div>
    <p>Two views of one Signal Machine. Live motion stays disposable until you explicitly freeze the current source state.</p>
  `;
  hero.insertAdjacentElement('afterend', modeBar);

  const livePanel = document.createElement('section');
  livePanel.className = 'live-weave-panel hidden';
  livePanel.innerHTML = `
    <div class="live-weave-head">
      <div>
        <p class="live-kicker">LIVE WEAVE / v0.6</p>
        <h2>Signals in motion</h2>
        <p>Source organs keep their latest valid signal. The field moves continuously; it does not become memory unless you freeze it.</p>
      </div>
      <div class="live-truth-badge">
        <i></i>
        <div><strong>LIVE / EPHEMERAL</strong><small>not replayable by default</small></div>
      </div>
    </div>

    <div class="live-weave-layout">
      <aside class="live-source-panel">
        <div class="live-panel-title">
          <span>Current influence</span>
          <button id="liveDemo" type="button">Load demo signals</button>
        </div>
        <div id="liveInfluenceList" class="live-influence-list"></div>

        <details class="live-injector">
          <summary>Inject / replace a live packet</summary>
          <label>
            <span>Source organ</span>
            <select id="liveInjectSource">
              <option value="working-chat">Working Chat</option>
              <option value="simulation-state">Simulation State</option>
              <option value="connector-packet">Connector Packet</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label>
            <span>Packet JSON</span>
            <textarea id="liveInjectPacket" rows="5">{"themes":["rain","repair","glass"],"energy":0.81,"tension":0.44}</textarea>
          </label>
          <label>
            <span>Provenance</span>
            <input id="liveInjectProvenance" value="manual Live Weave injection" />
          </label>
          <button id="liveInject" class="live-action" type="button">Inject packet</button>
        </details>
      </aside>

      <div class="live-visual-column">
        <div id="liveStage" class="live-stage">
          <canvas id="liveCanvas" aria-label="Live evolving signal field"></canvas>
          <div id="liveHud" class="live-hud">
            <span><b id="liveHudSources">0</b> sources</span>
            <span id="liveHudMode">Flow Field</span>
            <span>LIVE / EPHEMERAL</span>
          </div>
          <button id="liveHudToggle" class="live-hud-toggle" type="button">Hide HUD</button>
        </div>
        <div id="liveNotice" class="live-notice">Move the pointer, adjust a weight, or inject a packet to bend the field.</div>
      </div>
    </div>

    <div class="live-controls">
      <button id="livePlay" class="live-action live-primary" type="button">Pause</button>
      <label>
        <span>Render mode</span>
        <select id="liveRenderMode">
          <option value="flow">Flow Field</option>
          <option value="particles">Particle Current</option>
          <option value="mesh">Liquid Mesh</option>
        </select>
      </label>
      <label>
        <span>Smoothing <b id="liveSmoothValue">24%</b></span>
        <input id="liveSmoothing" type="range" min="4" max="80" value="24" />
      </label>
      <label>
        <span>Trail / memory <b id="liveTrailValue">72%</b></span>
        <input id="liveTrail" type="range" min="0" max="96" value="72" />
      </label>
      <label>
        <span>Intensity <b id="liveIntensityValue">100%</b></span>
        <input id="liveIntensity" type="range" min="40" max="180" value="100" />
      </label>
      <label>
        <span>Chaos <b id="liveChaosValue">36%</b></span>
        <input id="liveChaos" type="range" min="0" max="100" value="36" />
      </label>
      <label>
        <span>Speed <b id="liveSpeedValue">100%</b></span>
        <input id="liveSpeed" type="range" min="25" max="220" value="100" />
      </label>
      <label>
        <span>Color drift <b id="liveColorValue">48%</b></span>
        <input id="liveColorDrift" type="range" min="0" max="100" value="48" />
      </label>
      <button id="liveFreeze" class="live-action live-freeze" type="button">Freeze this moment</button>
      <button id="liveFullscreen" class="live-action" type="button">Fullscreen</button>
    </div>
  `;
  modeBar.insertAdjacentElement('afterend', livePanel);

  const canvas = livePanel.querySelector<HTMLCanvasElement>('#liveCanvas')!;
  const stage = livePanel.querySelector<HTMLElement>('#liveStage')!;
  const influenceList = livePanel.querySelector<HTMLElement>('#liveInfluenceList')!;
  const notice = livePanel.querySelector<HTMLElement>('#liveNotice')!;
  const playButton = livePanel.querySelector<HTMLButtonElement>('#livePlay')!;
  const modeSelect = livePanel.querySelector<HTMLSelectElement>('#liveRenderMode')!;
  const smoothingInput = livePanel.querySelector<HTMLInputElement>('#liveSmoothing')!;
  const trailInput = livePanel.querySelector<HTMLInputElement>('#liveTrail')!;
  const intensityInput = livePanel.querySelector<HTMLInputElement>('#liveIntensity')!;
  const chaosInput = livePanel.querySelector<HTMLInputElement>('#liveChaos')!;
  const speedInput = livePanel.querySelector<HTMLInputElement>('#liveSpeed')!;
  const colorInput = livePanel.querySelector<HTMLInputElement>('#liveColorDrift')!;
  const hud = livePanel.querySelector<HTMLElement>('#liveHud')!;
  const hudToggle = livePanel.querySelector<HTMLButtonElement>('#liveHudToggle')!;
  const hudSources = livePanel.querySelector<HTMLElement>('#liveHudSources')!;
  const hudMode = livePanel.querySelector<HTMLElement>('#liveHudMode')!;
  const injectSource = livePanel.querySelector<HTMLSelectElement>('#liveInjectSource')!;
  const injectPacketInput = livePanel.querySelector<HTMLTextAreaElement>('#liveInjectPacket')!;
  const injectProvenance = livePanel.querySelector<HTMLInputElement>('#liveInjectProvenance')!;

  const context = canvas.getContext('2d');
  if (!context) return;
  const ctx = context;

  let currentPresentation: 'frozen' | 'live' = 'frozen';
  let playing = true;
  let renderMode: LiveMode = 'flow';
  let liveSeed = 4837291;
  let time = 0;
  let lastFrame = performance.now();
  let canvasWidth = 1;
  let canvasHeight = 1;
  let pointerX = 0.5;
  let pointerY = 0.5;
  let pointerSpeed = 0;
  let lastPointerX = 0.5;
  let lastPointerY = 0.5;
  let lastPointerAt = performance.now();
  let targetField = Array.from({ length: FIELD_WIDTH }, () => 0);
  let smoothedField = Array.from({ length: FIELD_WIDTH }, () => 0);
  let sourceSignature = '';
  const sourceUpdatedAt = new Map<string, number>();
  const sourcePayloadSignatures = new Map<string, string>();
  const particles: Particle[] = [];
  const particleRandom = mulberry32(liveSeed ^ 0x51f15e);

  function setPresentation(mode: 'frozen' | 'live'): void {
    const previousPresentation = currentPresentation;

    if (mode === 'live' && previousPresentation !== 'live') {
      frozenElements.forEach((element) => {
        element.dataset.liveWeaveWasHidden = String(element.classList.contains('hidden'));
        element.classList.add('hidden');
      });
    } else if (mode === 'frozen' && previousPresentation === 'live') {
      frozenElements.forEach((element) => {
        const wasHidden = element.dataset.liveWeaveWasHidden === 'true';
        element.classList.toggle('hidden', wasHidden);
        delete element.dataset.liveWeaveWasHidden;
      });
    }

    currentPresentation = mode;
    livePanel.classList.toggle('hidden', mode !== 'live');
    modeBar.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    if (mode === 'live') {
      resizeCanvas();
      sampleSources(true);
      requestAnimationFrame(renderFrame);
    }
  }

  function localPayload(): Record<string, number> {
    const pageHeight = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const now = new Date();
    const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
    return {
      pointerX: Number(pointerX.toFixed(5)),
      pointerY: Number(pointerY.toFixed(5)),
      pointerSpeed: Number(pointerSpeed.toFixed(5)),
      scroll: Number(clamp(window.scrollY / pageHeight, 0, 1).toFixed(5)),
      viewportRatio: Number((window.innerWidth / Math.max(1, window.innerHeight)).toFixed(5)),
      clockPhase: Number((seconds / 60).toFixed(5)),
    };
  }

  function readSources(): LiveSource[] {
    return Array.from(shell.querySelectorAll<HTMLElement>('[data-organ-card]')).map((card) => {
      const id = card.dataset.organCard ?? '';
      const label = card.querySelector<HTMLElement>('.organ-head strong')?.textContent?.trim() || id;
      const enabled = card.querySelector<HTMLInputElement>('[data-enabled]')?.checked ?? false;
      const weightValue = card.querySelector<HTMLInputElement>('[data-weight]')?.value ?? '0';
      const weight = Number(weightValue) / 100;
      const readiness = card.querySelector<HTMLElement>('[data-readiness]')?.textContent?.trim().toLowerCase() ?? 'waiting';
      const raw = card.querySelector<HTMLTextAreaElement>('[data-raw]')?.value ?? '';
      const provenance = card.querySelector<HTMLInputElement>('[data-provenance]')?.value ?? '';

      if (!enabled || weight <= 0) {
        return { id, label, enabled, weight, readiness: 'off', payload: null, provenance, valid: false, error: '' };
      }

      if (readiness.includes('waiting')) {
        return { id, label, enabled, weight, readiness: 'waiting', payload: null, provenance, valid: false, error: '' };
      }

      if (readiness.includes('provenance')) {
        return { id, label, enabled, weight, readiness: 'invalid', payload: null, provenance, valid: false, error: 'provenance required' };
      }

      try {
        let payload: unknown;
        if (id === 'browser-local') {
          payload = localPayload();
        } else if (id === 'source-material') {
          payload = raw;
        } else {
          const parsed = JSON.parse(raw) as unknown;
          payload = id === 'internet-eye' ? reduceInternetEye(parsed) : parsed;
        }
        return { id, label, enabled, weight, readiness: id === 'browser-local' ? 'live' : 'ready', payload, provenance, valid: true, error: '' };
      } catch (error) {
        return {
          id,
          label,
          enabled,
          weight,
          readiness: 'invalid',
          payload: null,
          provenance,
          valid: false,
          error: error instanceof Error ? error.message : 'invalid signal',
        };
      }
    });
  }

  function recomputeTarget(sources: LiveSource[]): void {
    const usable = sources.filter((source) => source.valid && source.weight > 0);
    const total = usable.reduce((sum, source) => sum + source.weight, 0);

    if (usable.length === 0 || total <= 0) {
      targetField = Array.from({ length: FIELD_WIDTH }, () => 0);
      return;
    }

    const vectors = usable.map((source) => vectorFrom(source.payload, source.id));
    targetField = Array.from({ length: FIELD_WIDTH }, (_, index) => {
      let combined = 0;
      usable.forEach((source, sourceIndex) => {
        combined += (vectors[sourceIndex]?.[index] ?? 0) * (source.weight / total);
      });
      return clamp(combined);
    });
  }

  function sampleSources(force = false): void {
    const sources = readSources();
    sources.forEach((source) => {
      if (!source.valid) return;
      const payloadSignature = stableStringify(source.payload);
      if (sourcePayloadSignatures.get(source.id) !== payloadSignature) {
        sourcePayloadSignatures.set(source.id, payloadSignature);
        sourceUpdatedAt.set(source.id, performance.now());
      }
    });

    const nextSignature = stableStringify(
      sources.map((source) => ({
        id: source.id,
        enabled: source.enabled,
        weight: Number(source.weight.toFixed(4)),
        readiness: source.readiness,
        payload: source.valid ? source.payload : null,
      })),
    );

    if (force || nextSignature !== sourceSignature) {
      sourceSignature = nextSignature;
      recomputeTarget(sources);
      renderInfluences(sources);
    }
  }

  function setUnderlyingWeight(id: string, value: number): void {
    const input = shell.querySelector<HTMLInputElement>(`[data-weight="${id}"]`);
    if (!input) return;
    input.value = String(Math.round(value * 100));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    sampleSources(true);
  }

  function setUnderlyingEnabled(id: string, enabled: boolean): void {
    const input = shell.querySelector<HTMLInputElement>(`[data-enabled="${id}"]`);
    if (!input) return;
    input.checked = enabled;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    sampleSources(true);
  }

  function sourceAge(id: string): string {
    const stamp = sourceUpdatedAt.get(id);
    if (stamp === undefined) return '—';
    const seconds = Math.max(0, (performance.now() - stamp) / 1000);
    if (seconds < 1) return 'now';
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    return `${Math.floor(seconds / 60)}m`;
  }

  function renderInfluences(sources: LiveSource[]): void {
    const usable = sources.filter((source) => source.valid && source.weight > 0);
    const total = usable.reduce((sum, source) => sum + source.weight, 0);
    hudSources.textContent = String(usable.length);

    influenceList.innerHTML = sources.map((source) => {
      const percent = source.valid && total > 0 ? Math.round((source.weight / total) * 100) : 0;
      const status = source.error ? `${source.readiness} · ${source.error}` : source.readiness;
      return `
        <div class="live-source-row" data-live-source="${source.id}">
          <div class="live-source-top">
            <label class="live-source-toggle">
              <input type="checkbox" data-live-enabled="${source.id}" ${source.enabled ? 'checked' : ''} />
              <span></span>
            </label>
            <div class="live-source-name"><b>${source.label}</b><small>${status}</small></div>
            <strong class="live-source-percent">${percent}%</strong>
          </div>
          <div class="live-source-weight">
            <input data-live-weight="${source.id}" type="range" min="0" max="100" value="${Math.round(source.weight * 100)}" />
            <code>${sourceAge(source.id)}</code>
          </div>
        </div>
      `;
    }).join('');

    influenceList.querySelectorAll<HTMLInputElement>('[data-live-weight]').forEach((input) => {
      input.addEventListener('input', () => {
        const id = input.dataset.liveWeight;
        if (id) setUnderlyingWeight(id, Number(input.value) / 100);
      });
    });

    influenceList.querySelectorAll<HTMLInputElement>('[data-live-enabled]').forEach((input) => {
      input.addEventListener('change', () => {
        const id = input.dataset.liveEnabled;
        if (id) setUnderlyingEnabled(id, input.checked);
      });
    });
  }

  function resizeCanvas(): void {
    const rect = stage.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width));
    const height = Math.max(300, Math.floor(rect.height));
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (canvasWidth === width && canvasHeight === height && canvas.width === Math.floor(width * ratio)) return;
    canvasWidth = width;
    canvasHeight = height;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, width, height);
    particles.length = 0;
  }

  function fieldAt(position: number): number {
    const wrapped = ((position % 1) + 1) % 1;
    const index = Math.floor(wrapped * (smoothedField.length - 1));
    return smoothedField[index] ?? 0;
  }

  function hueBase(): number {
    const drift = Number(colorInput.value) / 100;
    return (205 + (liveSeed % 97) + time * 18 * drift + fieldAt(0.37) * 38 + 360) % 360;
  }

  function fadeBackground(): void {
    const trail = Number(trailInput.value) / 100;
    const alpha = 0.28 - trail * 0.245;
    ctx.fillStyle = `rgba(5,7,12,${clamp(alpha, 0.025, 0.3)})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  function drawFlow(): void {
    fadeBackground();
    const intensity = Number(intensityInput.value) / 100;
    const chaos = Number(chaosInput.value) / 100;
    const hue = hueBase();

    for (let lane = 0; lane < 26; lane += 1) {
      const laneRatio = lane / 25;
      ctx.beginPath();
      for (let step = 0; step <= 74; step += 1) {
        const x = (step / 74) * canvasWidth;
        const sample = fieldAt(step / 74 + laneRatio * 0.07 + time * 0.011);
        const cross = fieldAt(laneRatio + step * 0.008);
        const wave = Math.sin(step * 0.22 + lane * 0.57 + time * (0.9 + chaos * 1.8));
        const y = canvasHeight * (0.08 + laneRatio * 0.84)
          + sample * 42 * intensity
          + cross * 18
          + wave * (6 + chaos * 18);
        if (step === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `hsla(${(hue + lane * 4.7) % 360},88%,${58 + (lane % 5) * 4}%,${0.08 + Math.abs(fieldAt(laneRatio)) * 0.34})`;
      ctx.lineWidth = 0.8 + Math.abs(fieldAt(laneRatio + 0.1)) * 2.8;
      ctx.stroke();
    }
  }

  function resetParticle(particle: Particle, edge = false): void {
    particle.x = edge ? -0.02 : particleRandom();
    particle.y = particleRandom();
    particle.vx = 0.001 + particleRandom() * 0.004;
    particle.vy = (particleRandom() - 0.5) * 0.003;
    particle.life = 0.4 + particleRandom() * 0.6;
  }

  function ensureParticles(): void {
    while (particles.length < 420) {
      const particle: Particle = { x: 0, y: 0, vx: 0, vy: 0, life: 1 };
      resetParticle(particle);
      particles.push(particle);
    }
  }

  function drawParticles(delta: number): void {
    fadeBackground();
    ensureParticles();
    const intensity = Number(intensityInput.value) / 100;
    const chaos = Number(chaosInput.value) / 100;
    const hue = hueBase();

    particles.forEach((particle, index) => {
      const field = fieldAt(particle.y + particle.x * 0.13);
      const secondary = fieldAt(particle.x + index * 0.003);
      const angle = field * Math.PI * (1.5 + chaos * 2.7) + Math.sin(time + particle.y * 8) * chaos;
      particle.vx = particle.vx * 0.92 + Math.cos(angle) * 0.0008 * intensity;
      particle.vy = particle.vy * 0.92 + Math.sin(angle) * 0.0008 * intensity + secondary * 0.0005;
      particle.x += particle.vx * delta * 60;
      particle.y += particle.vy * delta * 60;
      particle.life -= delta * (0.035 + chaos * 0.04);

      if (particle.x > 1.04 || particle.x < -0.05 || particle.y > 1.06 || particle.y < -0.06 || particle.life <= 0) {
        resetParticle(particle, true);
      }

      const x = particle.x * canvasWidth;
      const y = particle.y * canvasHeight;
      const size = 0.7 + Math.abs(field) * 2.6 * intensity;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${(hue + index * 0.61 + field * 42) % 360},92%,70%,${0.14 + Math.abs(field) * 0.62})`;
      ctx.fill();
    });
  }

  function drawMesh(): void {
    fadeBackground();
    const columns = 22;
    const rows = 14;
    const intensity = Number(intensityInput.value) / 100;
    const chaos = Number(chaosInput.value) / 100;
    const hue = hueBase();
    const nodes: Array<{ x: number; y: number; value: number }> = [];

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const u = column / (columns - 1);
        const v = row / (rows - 1);
        const field = fieldAt(u * 0.68 + v * 0.32 + time * 0.012);
        const ripple = Math.sin(u * 13 + v * 9 + time * 1.4) * chaos;
        const displacement = (field * 30 + ripple * 12) * intensity;
        nodes.push({
          x: 22 + u * (canvasWidth - 44) + displacement * 0.42,
          y: 22 + v * (canvasHeight - 44) + displacement,
          value: field,
        });
      }
    }

    nodes.forEach((node, index) => {
      const column = index % columns;
      const right = column < columns - 1 ? nodes[index + 1] : undefined;
      const down = index + columns < nodes.length ? nodes[index + columns] : undefined;
      [right, down].forEach((target) => {
        if (!target) return;
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = `hsla(${(hue + index * 0.27) % 360},82%,64%,${0.08 + Math.abs(node.value) * 0.31})`;
        ctx.lineWidth = 0.65 + Math.abs(node.value) * 1.45;
        ctx.stroke();
      });
    });
  }

  function advanceField(delta: number): void {
    const smoothing = Number(smoothingInput.value) / 100;
    const memory = Number(trailInput.value) / 100;
    const alpha = clamp(smoothing * (1 - memory * 0.68) * delta * 60, 0.002, 0.88);
    smoothedField = smoothedField.map((value, index) => {
      const target = targetField[index] ?? 0;
      return clamp(value * (1 - alpha) + target * alpha);
    });
  }

  function renderFrame(now: number): void {
    if (currentPresentation !== 'live') return;
    resizeCanvas();
    const delta = clamp((now - lastFrame) / 1000, 0, 0.05);
    lastFrame = now;

    if (playing) {
      const speed = Number(speedInput.value) / 100;
      time += delta * speed;
      advanceField(delta);
      if (renderMode === 'flow') drawFlow();
      else if (renderMode === 'particles') drawParticles(delta);
      else drawMesh();
    }

    requestAnimationFrame(renderFrame);
  }

  function applyInjection(): void {
    const id = injectSource.value;
    const rawTarget = shell.querySelector<HTMLTextAreaElement>(`[data-raw="${id}"]`);
    const provenanceTarget = shell.querySelector<HTMLInputElement>(`[data-provenance="${id}"]`);
    const enabledTarget = shell.querySelector<HTMLInputElement>(`[data-enabled="${id}"]`);

    if (!rawTarget || !enabledTarget) {
      notice.textContent = 'That source organ is not available in this machine.';
      return;
    }

    try {
      JSON.parse(injectPacketInput.value);
    } catch {
      notice.textContent = 'Packet was not injected: JSON is invalid.';
      return;
    }

    rawTarget.value = injectPacketInput.value;
    rawTarget.dispatchEvent(new Event('input', { bubbles: true }));
    if (provenanceTarget) {
      provenanceTarget.value = injectProvenance.value;
      provenanceTarget.dispatchEvent(new Event('input', { bubbles: true }));
    }
    enabledTarget.checked = true;
    enabledTarget.dispatchEvent(new Event('change', { bubbles: true }));
    sampleSources(true);
    notice.textContent = `${id} updated without restarting Live Weave.`;
  }

  function freezeMoment(): void {
    sampleSources(true);
    frozenCaptureButton.click();
    if (!frozenSessionPanel.classList.contains('hidden')) {
      notice.textContent = 'Live source state frozen into a normal replayable CaptureSession.';
      frozenSessionPanel.dataset.liveWeaveWasHidden = 'false';
      setPresentation('frozen');
      frozenSessionPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    notice.textContent = captureError?.textContent?.trim() || 'Freeze failed; Live Weave kept running.';
  }

  modeBar.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => setPresentation(button.dataset.mode === 'live' ? 'live' : 'frozen'));
  });

  window.addEventListener('pointermove', (event) => {
    const now = performance.now();
    const nextX = event.clientX / Math.max(1, window.innerWidth);
    const nextY = event.clientY / Math.max(1, window.innerHeight);
    const distance = Math.hypot(nextX - lastPointerX, nextY - lastPointerY);
    const elapsed = Math.max(1, now - lastPointerAt);
    pointerSpeed = clamp((distance / elapsed) * 900, 0, 1);
    pointerX = nextX;
    pointerY = nextY;
    lastPointerX = nextX;
    lastPointerY = nextY;
    lastPointerAt = now;
  });

  playButton.addEventListener('click', () => {
    playing = !playing;
    playButton.textContent = playing ? 'Pause' : 'Play';
    notice.textContent = playing ? 'Live motion resumed.' : 'Presentation paused; incoming source state can still update.';
  });

  modeSelect.addEventListener('change', () => {
    renderMode = modeSelect.value as LiveMode;
    hudMode.textContent = modeSelect.selectedOptions[0]?.textContent ?? 'Live mode';
    particles.length = 0;
  });

  const valueBindings: Array<[HTMLInputElement, HTMLElement | null, (value: number) => string]> = [
    [smoothingInput, livePanel.querySelector('#liveSmoothValue'), (value) => `${value}%`],
    [trailInput, livePanel.querySelector('#liveTrailValue'), (value) => `${value}%`],
    [intensityInput, livePanel.querySelector('#liveIntensityValue'), (value) => `${value}%`],
    [chaosInput, livePanel.querySelector('#liveChaosValue'), (value) => `${value}%`],
    [speedInput, livePanel.querySelector('#liveSpeedValue'), (value) => `${value}%`],
    [colorInput, livePanel.querySelector('#liveColorValue'), (value) => `${value}%`],
  ];
  valueBindings.forEach(([input, output, format]) => {
    input.addEventListener('input', () => {
      if (output) output.textContent = format(Number(input.value));
    });
  });

  livePanel.querySelector<HTMLButtonElement>('#liveInject')?.addEventListener('click', applyInjection);
  livePanel.querySelector<HTMLButtonElement>('#liveFreeze')?.addEventListener('click', freezeMoment);
  livePanel.querySelector<HTMLButtonElement>('#liveDemo')?.addEventListener('click', () => {
    sampleButton?.click();
    sampleSources(true);
    notice.textContent = 'Built-in fixtures loaded. They are demos, not live external sources.';
  });
  livePanel.querySelector<HTMLButtonElement>('#liveFullscreen')?.addEventListener('click', () => {
    void stage.requestFullscreen();
  });

  hudToggle.addEventListener('click', () => {
    hud.classList.toggle('hidden');
    hudToggle.textContent = hud.classList.contains('hidden') ? 'Show HUD' : 'Hide HUD';
  });

  document.addEventListener('fullscreenchange', resizeCanvas);
  window.addEventListener('resize', resizeCanvas);

  window.setInterval(() => {
    if (currentPresentation === 'live') sampleSources();
  }, SAMPLE_INTERVAL_MS);

  window.setInterval(() => {
    if (currentPresentation === 'live') renderInfluences(readSources());
  }, 1000);

  liveSeed = hashText('axm-live-weave-v0.6');
  sampleSources(true);
  setPresentation('frozen');
}

function boot(): void {
  const shell = document.querySelector<HTMLElement>('#app .shell');
  if (!shell) {
    requestAnimationFrame(boot);
    return;
  }
  initLiveWeave(shell);
}

boot();
