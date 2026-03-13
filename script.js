// ══════════════════════════════════════════════════════════════════
// DARK / LIGHT MODE TOGGLE
// ══════════════════════════════════════════════════════════════════
(function() {
  // Default to dark on first load, respect stored preference after
  const stored = localStorage.getItem('mag-null-theme');
  const theme = stored || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  updateToggleLabel(theme);
})();

function updateToggleLabel(theme) {
  const label = document.getElementById('toggle-label');
  if (label) label.textContent = theme === 'dark' ? 'DARK' : 'LIGHT';
}

function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';

  // Ripple animation
  const ripple = document.getElementById('toggle-ripple');
  ripple.classList.remove('active');
  void ripple.offsetWidth; // reflow to restart
  ripple.classList.add('active');

  // Apply theme with a brief flash transition
  html.style.transition = 'none';
  requestAnimationFrame(() => {
    html.setAttribute('data-theme', next);
    localStorage.setItem('mag-null-theme', next);
    updateToggleLabel(next);
  });
}

// ── Tab Switching ──────────────────────────────────────────────────
function switchTab(id, btn) {
  document.querySelectorAll('.section-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  btn.classList.add('active');
  window.scrollTo({top: document.getElementById('nav').offsetTop, behavior:'smooth'});
}

// ── Pipeline Data ──────────────────────────────────────────────────
const STAGES = [
  {num:'01',name:'SDR Scan / Simulator',tagline:'Raw IQ sample capture',title:'Stage 1: IQ Signal Acquisition',sub:'The starting point — raw complex samples from hardware or simulation.',body:`<p>In simulation mode, the signal simulator generates mathematically accurate IQ (in-phase/quadrature) sample streams for each drone protocol. In hardware mode, a HackRF One SDR captures real signals at 20 million samples per second via USB 2.0.</p><p>IQ samples are complex64 numbers — each has a real component (I) and an imaginary component (Q). Together they encode both the amplitude and phase of the radio signal at each instant in time.</p><p>The simulator builds each protocol's signal from first principles — a seeded linear congruential RNG generates the hop table, Gaussian window shapes the burst envelope, and protocol-specific features (LoRa chirp sweep for ELRS, flat OFDM for DJI) are added mathematically.</p>`,code:`# Hardware mode — one change from simulation
sdr = SoapySDR.Device({'driver': 'hackrf'})
sdr.setSampleRate(SOAPY_SDR_RX, 0, 20e6)
sdr.setCenterFreq(SOAPY_SDR_RX, 0, 2.44e9)
buff = np.zeros(512, dtype=np.complex64)
sdr.readStream(rx_stream, [buff], 512)`,tags:[{t:'20 MSPS',c:'blue'},{t:'complex64',c:'blue'},{t:'2.4 GHz ISM',c:'blue'}]},
  {num:'02',name:'FFT Engine',tagline:'Time → frequency domain',title:'Stage 2: 512-Point Windowed FFT',sub:'Converts the raw sample stream into a power spectrum — the frequency "fingerprint."',body:`<p>A 512-point Fast Fourier Transform (FFT) converts the time-domain IQ buffer into a frequency-domain power spectrum. The output is 512 power values in dBm, each representing the signal strength in a 156.25 kHz wide frequency bin.</p><p>A Hanning window is applied before the FFT to reduce spectral leakage — without it, strong signals would "bleed" into neighboring bins and mask weaker signals. The window is pre-computed once at startup and reused every tick.</p><p>The full 80 MHz band (2400–2480 MHz) is covered in a single FFT call. Time per call on laptop hardware: approximately 0.008ms — over 9,000 times faster than the available 75ms budget.</p>`,code:`def compute_spectrum(iq_buffer):
    windowed = iq_buffer[:512] * np.hanning(512)
    fft_out  = np.fft.fft(windowed, n=512)
    power    = np.abs(fft_out) ** 2
    return 10 * np.log10(power + 1e-12)  # dBm`,tags:[{t:'0.008ms',c:'green'},{t:'156 kHz/bin',c:'blue'},{t:'Hanning window',c:'blue'}]},
  {num:'03',name:'Noise Floor Estimator',tagline:'Dynamic rolling baseline',title:'Stage 3: Adaptive Noise Floor',sub:'Separates real signals from background noise dynamically — no fixed threshold.',body:`<p>A fixed noise threshold would fail as temperature, interference, and environment change. DIMENSIONERS uses a rolling adaptive estimator: it stores the last 30 spectra and computes the 12th percentile value per bin.</p><p>The 12th percentile means: "in 88% of recent scans, this bin was at or above this level." This captures the true noise floor per bin rather than a global average — important because the 2.4 GHz ISM band has uneven interference from Wi-Fi, Bluetooth, and microwave ovens.</p><p>The result is a 512-element noise floor array that updates every tick and adapts automatically to the RF environment — whether tested in an anechoic chamber or a crowded city center.</p>`,code:`class NoiseFloorEstimator:
    def update(self, spectrum):
        self.history.append(spectrum)
        if len(self.history) > 30:
            self.history.pop(0)
        if len(self.history) >= 5:
            self.floor = np.percentile(
                np.array(self.history), 12, axis=0)
        return self.floor`,tags:[{t:'12th percentile',c:'blue'},{t:'Per-bin adaptive',c:'green'},{t:'30-frame window',c:'blue'}]},
  {num:'04',name:'Energy Detector',tagline:'Find bins above threshold',title:'Stage 4: Burst Detection',sub:'Identifies frequency clusters where a drone is actively transmitting.',body:`<p>The energy detector compares each bin in the current spectrum against its corresponding noise floor value. Any bin exceeding noise_floor + 6 dB is flagged as "above threshold."</p><p>The 6 dB threshold provides a 4× power margin — strong enough to reject noise spikes while sensitive enough to catch low-power frequency-hopping bursts. Adjacent flagged bins (within 3 bins of each other) are merged into a single "cluster" representing one transmission burst.</p><p>Each cluster has a center bin, a width in bins, and a peak power in dBm. These clusters are passed to the feature extractor to measure hop timing and bandwidth.</p>`,code:`def detect_clusters(spectrum, noise_floor, threshold_db=6.0):
    above = spectrum > (noise_floor + threshold_db)
    clusters = []
    in_cl, start = False, 0
    for i in range(512):
        if above[i] and not in_cl:
            start, in_cl = i, True
        elif not above[i] and in_cl:
            if i - start >= 2:
                clusters.append((start, i - 1))
            in_cl = False
    return clusters`,tags:[{t:'+6 dB threshold',c:'amber'},{t:'Cluster merge',c:'blue'},{t:'0.05ms',c:'green'}]},
  {num:'05',name:'Feature Extractor',tagline:'Measure hop interval & bandwidth',title:'Stage 5: Feature Extraction',sub:'Converts raw burst measurements into the features that identify drone protocols.',body:`<p>Three features are extracted per tracked contact: hop interval (how often the drone changes frequency), bandwidth (how wide each burst is in kHz), and modulation type (chirp pattern for LoRa CSS, flat wide spectrum for OFDM).</p><p>Hop interval is measured by recording timestamps when each contact appears in a new frequency bin and computing the median interval across the last 32 observations. Median is used instead of mean to resist outliers from missed detections.</p><p>Chirp detection works by checking if the instantaneous frequency increases linearly across the burst — a Pearson correlation above 0.85 flags it as LoRa CSS. OFDM detection checks if bandwidth exceeds 5 MHz.</p>`,code:`def extract_features(hop_history, timestamps, bw_bins):
    intervals = np.diff(timestamps)
    hop_ms    = float(np.median(intervals))
    bw_khz    = float(np.median(bw_bins)) * (80/512) * 1000
    return dict(hop_ms=hop_ms, bw_khz=bw_khz)

# Chirp detection
corr = np.corrcoef(range(N), inst_freq)[0,1]
is_chirp = corr > 0.85`,tags:[{t:'Median hop interval',c:'blue'},{t:'Chirp correlation',c:'amber'},{t:'OFDM BW check',c:'red'}]},
  {num:'06',name:'Protocol Classifier',tagline:'Match to known signatures',title:'Stage 6: Protocol Classification',sub:'Identifies the exact drone protocol from its RF fingerprint.',body:`<p>The rule-based classifier matches extracted features against the four known protocol signatures. Decision priority runs from most-distinctive (OFDM bandwidth is unmistakable for DJI) to least-distinctive (hop interval ranges for AFHDS and FASST overlap slightly).</p><p>Confidence builds over time — early ticks have low confidence (0.04 + hops × 0.055) because few hops have been observed. By 15–20 hops the confidence converges to the protocol-specific ceiling (96% for DJI, 88% for AFHDS).</p><p>The ML upgrade path replaces this with a MobileNetV2 CNN trained on spectrogram images — same inputs, probabilistic outputs. The simulator generates perfectly labeled training data automatically.</p>`,code:`def classify_protocol(hop_ms, bw_khz, chirp, ofdm):
    if ofdm and bw_khz > 5000:
        return "DJI",   0.96
    if chirp:
        return "ELRS",  0.93
    if 18 <= hop_ms <= 22 and bw_khz < 700:
        return "AFHDS", 0.88
    if  5 <= hop_ms <=  9 and bw_khz < 1400:
        return "FASST", 0.83
    return "UNKNOWN", 0.40`,tags:[{t:'96% DJI',c:'red'},{t:'93% ELRS',c:'amber'},{t:'88% AFHDS',c:'green'},{t:'83% FASST',c:'amber'}]},
  {num:'07',name:'Threat Assessor',tagline:'LOW / MEDIUM / HIGH scoring',title:'Stage 7: Threat Assessment',sub:'Translates protocol classification into actionable threat levels.',body:`<p>Threat level is determined per contact based on protocol — AFHDS (hobby remote controls) = LOW, ELRS and FASST (FPV/racing drones) = MEDIUM, DJI OcuSync (commercial platforms capable of carrying payloads) = HIGH.</p><p>The global threat level aggregates across all active contacts: any HIGH contact triggers CRITICAL, any MEDIUM contact triggers WARNING, RF silence on any contact triggers TERMINAL. The TERMINAL state is the most dangerous — it means a drone has locked onto a target and severed all radio links.</p><p>Threat levels drive the dashboard visuals: green for LOW, amber for MEDIUM, red for HIGH, pulsing red for TERMINAL. The header STATUS badge updates instantly on every tick.</p>`,code:`# Global threat calculation
if any(c['rf_silent'] for c in contacts):
    return "TERMINAL"
elif any(c['tl'] >= 3 for c in contacts):
    return "CRITICAL"
elif any(c['tl'] >= 2 for c in contacts):
    return "WARNING"
elif contacts:
    return "ACTIVE"
else:
    return "CLEAR"`,tags:[{t:'CLEAR',c:'green'},{t:'WARNING',c:'amber'},{t:'CRITICAL',c:'red'},{t:'TERMINAL',c:'red'}]},
  {num:'08',name:'RF Silence Watchdog',tagline:'2.5s timeout → verdict',title:'Stage 8: RF Silence Detection',sub:'The most critical stage — detects terminal guidance mode.',body:`<p>Every tracked contact has a last_seen timestamp. If 2,500ms passes with no new transmission detected, the watchdog fires and evaluates why using linear regression on the RSSI history.</p><p>A positive slope (signal was growing stronger — drone was approaching) combined with sudden silence = TERMINAL_GUIDANCE. This is the kill phase. The drone has locked its onboard camera onto the target and no longer needs the operator's radio link.</p><p>A negative slope (signal was fading — drone was moving away) = OUT_OF_RANGE. No threat. The watchdog triggers the global RF SILENCE banner, changes the contact status to RF SILENT, and lights up Pipeline Stage 7 on the dashboard.</p>`,code:`def check_silence(self, current_time_ms):
    for cid, data in self.contacts.items():
        if current_time_ms - data['last_seen'] > 2500:
            if not data['rf_silent']:
                data['rf_silent'] = True
                h = data['rssi_history']
                slope = np.polyfit(range(len(h)), h, 1)[0]
                if slope > 0.3:
                    verdict = "TERMINAL_GUIDANCE"
                else:
                    verdict = "OUT_OF_RANGE"`,tags:[{t:'2500ms timeout',c:'amber'},{t:'RSSI slope',c:'blue'},{t:'Linear regression',c:'blue'}]},
  {num:'09',name:'Swarm Analyzer',tagline:'Five-factor 0–100 score',title:'Stage 9: Swarm Behavior Analysis',sub:'Detects coordinated multi-drone attacks that rule-based systems miss.',body:`<p>The swarm analyzer scores five independent behavioral signals: how many contacts are active (up to 25 pts), how many different protocols are in use — a sophisticated attacker uses diverse hardware to defeat single-protocol detection (25 pts), how tightly clustered the drone appearances are in time (25 pts), what mix of threat levels is present (15 pts), and how many drones appeared within an 800ms simultaneous-entry window (10 pts).</p><p>Four hobbyists coincidentally flying in the same area would score ~25 — all the same protocol, spread arrival times. Four coordinated drones with mixed protocols arriving within 800ms scores 82–95 = ORGANIZED INTRUSION. The difference is statistically unambiguous.</p>`,code:`def compute_swarm(contacts):
    N = len(contacts)
    count_s = min(25.0, N * 6.25)
    div_s   = min(25.0, (len(set(c.proto for c in contacts)) / 4) * 25)
    spread  = max(c.first_seen for c in contacts) - min(...)
    temp_s  = min(25.0, 25.0 * (1 - spread / 4000)) if N >= 2 else 0
    avg_tl  = sum(c.tl for c in contacts) / N
    thr_s   = min(15.0, ((avg_tl - 1) / 2) * 15)
    simul_s = min(10.0, simultaneous_count * 5)
    return count_s + div_s + temp_s + thr_s + simul_s`,tags:[{t:'5 factors',c:'blue'},{t:'0–100 score',c:'amber'},{t:'800ms window',c:'red'}]},
  {num:'10',name:'WebSocket Server',tagline:'75ms broadcast loop',title:'Stage 10: Real-Time Data Delivery',sub:'Pure Python RFC 6455 WebSocket — zero external dependencies.',body:`<p>The WebSocket server broadcasts the full pipeline state to every connected browser every 75ms (13 Hz). It is implemented from scratch using only Python stdlib — socket, threading, hashlib, base64, struct — so it works on any machine with Python installed, no pip install required.</p><p>The handshake is standard RFC 6455: extract Sec-WebSocket-Key, compute SHA1(key + MAGIC_STRING), base64 encode, return HTTP 101. Frame encoding prepends FIN+opcode byte and length byte to the JSON payload. Dead clients are detected on send failure and removed from the broadcast set.</p><p>The entire JSON state dict (spectrum[512], contacts[], swarm scores, alerts) is serialized and broadcast in under 0.5ms. Multiple browser tabs all receive the same data simultaneously.</p>`,code:`def ws_send(conn, message):
    data   = message.encode('utf-8')
    header = bytearray([0x81])  # FIN + text
    if len(data) <= 125:
        header.append(len(data))
    elif len(data) <= 65535:
        header.append(126)
        header += struct.pack('>H', len(data))
    conn.sendall(bytes(header) + data)`,tags:[{t:'RFC 6455',c:'blue'},{t:'0 dependencies',c:'green'},{t:'<0.5ms broadcast',c:'green'}]},
  {num:'11',name:'Dashboard Frontend',tagline:'Single HTML file, live render',title:'Stage 11: Live Dashboard',sub:'Everything rendered in the browser from the WebSocket stream.',body:`<p>The frontend receives each tick's JSON state and renders six visual elements simultaneously: the spectrogram waterfall (canvas, thermal colormap, 140-row history), spectrum bar chart (48 bars), threat contact table (animated rows, confidence bars), hop pattern timeline (scatter canvas per selected contact), swarm score ring (canvas arc with factor bars), and detection pipeline status (7 stage indicators).</p><p>The waterfall uses a single ImageData.putImageData() call per render — building the entire 512×160 pixel image in JavaScript then committing it to canvas in one GPU-accelerated call. This is 40× faster than per-pixel setPixel calls and allows smooth 13 Hz rendering without dropped frames.</p><p>WebSocket auto-reconnects every 2 seconds if the backend stops — enabling live reload during development without refreshing the browser.</p>`,code:`function handleState(state) {
  wfHistory.push(state.wf_row);
  if (wfHistory.length > 140) wfHistory.shift();
  drawWF();           // single putImageData call
  drawBars(state.spectrum);
  drawMarkers(state.contacts);
  renderTable(state.contacts);
  updateSwarm(state.swarm);
  updatePipe(state.pipe_flags);
  updateHeader(state);
}`,tags:[{t:'13 Hz render',c:'green'},{t:'Single putImageData',c:'blue'},{t:'Auto-reconnect',c:'blue'}]}
];

function renderPipeline() {
  const container = document.getElementById('pipeline-steps');
  container.innerHTML = '';
  STAGES.forEach((s, i) => {
    if (i > 0) {
      const conn = document.createElement('div');
      conn.className = 'step-connector';
      container.appendChild(conn);
    }
    const btn = document.createElement('button');
    btn.className = 'step-btn';
    btn.dataset.idx = i;
    btn.innerHTML = `<div class="step-num">${s.num}</div><div class="step-info"><div class="step-name">${s.name}</div><div class="step-tagline">${s.tagline}</div></div>`;
    btn.onclick = () => showStage(i);
    container.appendChild(btn);
  });
}

function showStage(idx) {
  document.querySelectorAll('.step-btn').forEach((b,i) => b.classList.toggle('active', i === idx));
  const s = STAGES[idx];
  const pane = document.getElementById('step-detail');
  const tagsHTML = s.tags.map(t => `<span class="tag ${t.c}">${t.t}</span>`).join('');
  pane.innerHTML = `
    <div class="detail-header">
      <div class="detail-num">STAGE ${s.num}</div>
      <div class="detail-title">${s.title}</div>
      <div class="detail-sub">${s.sub}</div>
    </div>
    <div class="detail-body">${s.body}</div>
    <pre class="code-block">${s.code}</pre>
    <div style="margin-top:12px">${tagsHTML}</div>
  `;
}

renderPipeline();

function copyPrompt() {
  const text = document.getElementById('prompt-text').innerText;
  navigator.clipboard.writeText(text).then(() => {
    const t = document.getElementById('copy-toast');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  });
}

function filterGal(cat, btn) {
  document.querySelectorAll('#gal-filters .gal-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.gal-card').forEach(card => {
    card.style.display = (cat === 'all' || card.dataset.cat === cat) ? '' : 'none';
  });
}

function openLightbox(title, cat, type, src) {
  document.getElementById('lb-title').textContent = title;
  document.getElementById('lb-cat').textContent = cat;
  const media = document.getElementById('lb-media');
  if (src) {
    if (type === 'video') media.innerHTML = `<video controls src="${src}" style="width:100%;height:100%;object-fit:contain"></video>`;
    else if (type === 'youtube') media.innerHTML = `<iframe src="${src}" style="width:100%;height:100%;border:none" allowfullscreen></iframe>`;
    else media.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:contain">`;
  } else {
    media.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;height:100%"><svg width="56" height="56" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="1.2" viewBox="0 0 56 56"><circle cx="28" cy="28" r="24"/><polygon points="22,18 42,28 22,38" fill="rgba(255,255,255,.25)"/></svg><span style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:rgba(255,255,255,.3)">NO MEDIA ATTACHED</span></div>`;
  }
  document.getElementById('gal-lightbox').classList.add('open');
}

function closeLightbox() {
  document.getElementById('gal-lightbox').classList.remove('open');
  document.getElementById('lb-media').innerHTML = '';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

// Scroll reveal
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
    }
  });
}, {threshold: 0.1});

document.querySelectorAll('.card, .proto-card, .ref-card, .gal-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(16px)';
  el.style.transition = 'opacity .4s ease, transform .4s ease';
  observer.observe(el);
});