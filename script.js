// ══════════════════════════════════════════════════════════════════
// DARK / LIGHT MODE TOGGLE
// ══════════════════════════════════════════════════════════════════
(function () {
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
  html.setAttribute('data-theme', next);
  localStorage.setItem('mag-null-theme', next);
  updateToggleLabel(next);
}

// ══════════════════════════════════════════════════════════════════
// HERO TYPEWRITER
// ══════════════════════════════════════════════════════════════════
(function () {
  const texts = [
    "This is just the prototype of the software",
    "Passive RF drone detection system",
    "Zero emissions. Legally deployable anywhere.",
    "Built by DIMENSIONERS"
  ];
  const typingSpeed = 55, deletingSpeed = 28, pauseDuration = 2200, initialDelay = 800;
  let textIndex = 0, charIndex = 0, isDeleting = false;

  function tick() {
    const el = document.getElementById('hero-typewriter');
    if (!el) return;
    const full = texts[textIndex];
    if (!isDeleting) {
      charIndex++;
      el.textContent = full.slice(0, charIndex);
      if (charIndex === full.length) {
        setTimeout(() => { isDeleting = true; tick(); }, pauseDuration);
        return;
      }
      setTimeout(tick, typingSpeed + (Math.random() * 30 - 15));
    } else {
      charIndex--;
      el.textContent = full.slice(0, charIndex);
      if (charIndex === 0) {
        isDeleting = false;
        textIndex = (textIndex + 1) % texts.length;
        setTimeout(tick, 400);
        return;
      }
      setTimeout(tick, deletingSpeed);
    }
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(tick, initialDelay));
})();

// ══════════════════════════════════════════════════════════════════
// HERO SCRAMBLE TEXT
// ══════════════════════════════════════════════════════════════════
(function () {
  const CHARS = '.:·×+~%$#@!?', RADIUS = 110, DURATION = 1200, SPEED = 0.5, FPS = 40;

  function splitToChars(el) {
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        [...node.textContent].forEach(ch => {
          if (ch === ' ' || ch === '\u00A0') { frag.appendChild(document.createTextNode(ch)); }
          else { const s = document.createElement('span'); s.className = 'scramble-char'; s.dataset.original = ch; s.textContent = ch; frag.appendChild(s); }
        });
        node.parentNode.replaceChild(frag, node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        [...node.childNodes].forEach(walk);
      }
    }
    [...el.childNodes].forEach(walk);
    return el.querySelectorAll('.scramble-char');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('hero-scramble');
    if (!container) return;
    const state = Array.from(splitToChars(container)).map(el => ({ el, original: el.dataset.original, scrambling: false }));

    function scrambleChar(s) {
      if (s.scrambling) return;
      s.scrambling = true; s.el.classList.add('scrambling');
      const t0 = performance.now();
      (function frame(now) {
        const prog = Math.min(1, (now - t0) / DURATION);
        s.el.textContent = Math.random() < prog * SPEED * 2 ? s.original : CHARS[Math.floor(Math.random() * CHARS.length)];
        if (prog < 1) requestAnimationFrame(frame);
        else { s.el.textContent = s.original; s.el.classList.remove('scrambling'); s.scrambling = false; }
      })(performance.now());
    }

    let lastMove = 0;
    container.addEventListener('pointermove', e => {
      const now = performance.now();
      if (now - lastMove < 1000 / FPS) return;
      lastMove = now;
      state.forEach(s => {
        const r = s.el.getBoundingClientRect();
        if (Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) < RADIUS) scrambleChar(s);
      });
    });
  });
})();

// ══════════════════════════════════════════════════════════════════
// TAB NAVIGATION
// ══════════════════════════════════════════════════════════════════
function switchTab(id, btn) {
  document.querySelectorAll('.section-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('tab-' + id);
  if (panel) { panel.style.display = 'block'; panel.style.animation = 'fadeUp .4s ease'; }
  if (btn) btn.classList.add('active');
}

// ══════════════════════════════════════════════════════════════════
// PIPELINE
// ══════════════════════════════════════════════════════════════════
const STAGES = [
  { num:'01', title:'SDR Capture', sub:'HackRF One ingestion', icon:'📡', detail:'Raw IQ samples captured at 20 MSPS via HackRF One. The simulator mirrors this exactly — same buffer sizes, same sample rates, ready for hardware swap with one config change.' },
  { num:'02', title:'Decimation', sub:'Sample rate reduction', icon:'⬇', detail:'Downsample by factor 8 using polyphase filterbank. Reduces compute load from 20 MSPS to 2.5 MSPS while preserving all signal content above 1.25 MHz.' },
  { num:'03', title:'FFT Engine', sub:'Spectral analysis', icon:'📊', detail:'512-point FFT computed every 13 Hz tick. Hann window applied before transform to reduce spectral leakage. Output: 512 frequency bins covering 0–2.5 MHz.' },
  { num:'04', title:'Noise Floor', sub:'Adaptive baseline', icon:'📉', detail:'Rolling median across 64 frames establishes adaptive noise floor. Each bin tracked independently. Threshold = noise_floor + 12 dB SNR margin.' },
  { num:'05', title:'Peak Detect', sub:'Signal identification', icon:'🔍', detail:'CFAR detector identifies peaks exceeding adaptive threshold. Minimum peak separation enforced at 50 kHz to prevent single signal splitting into multiple candidates.' },
  { num:'06', title:'Hop Tracker', sub:'Frequency hopping', icon:'🔀', detail:'Cross-frame correlation links peaks into hopping sequences. Kalman filter predicts next hop position. Sequences with < 4 hops discarded as noise.' },
  { num:'07', title:'Protocol Match', sub:'Drone classification', icon:'🎯', detail:'Matched filter bank compares hop sequences against 4 known drone protocols: DJI OcuSync, FrSky FHSS, Spektrum DSM2, FlySky AFHDS. Confidence score per protocol.' },
  { num:'08', title:'RF Silence', sub:'Threat detection', icon:'🔴', detail:'If a tracked drone signal disappears for > 300 ms while heading vector indicates approach, RF Silence alert triggers. This is the MAG-NULL unique detection window.' },
  { num:'09', title:'Threat Score', sub:'Risk assessment', icon:'⚠', detail:'Composite score: signal strength (30%) + hop regularity (25%) + protocol confidence (25%) + silence flag (20%). Score > 0.7 triggers HIGH alert.' },
  { num:'10', title:'WebSocket TX', sub:'Real-time streaming', icon:'🌐', detail:'JSON frames pushed to frontend every 77 ms (13 Hz). Format: {tick, drones[], alerts[], spectrum[]}. RFC 6455 compliant, no framework dependency.' },
  { num:'11', title:'Dashboard', sub:'Live visualization', icon:'🖥', detail:'Pure HTML/CSS/JS frontend. Radar sweep, live spectrum plot, drone track table, and alert log. Opens in any browser. Connects to backend automatically on localhost:8765.' }
];

function renderPipeline() {
  const container = document.getElementById('pipeline-steps');
  if (!container) return;
  container.innerHTML = STAGES.map((s, i) => `
    <button class="step-btn ${i===0?'active':''}" onclick="showStage(${i})">
      <span class="step-num">${s.num}</span>
      <span class="step-info"><span class="step-title">${s.title}</span><span class="step-sub">${s.sub}</span></span>
    </button>`).join('');
  showStage(0);
}

function showStage(idx) {
  const s = STAGES[idx];
  document.querySelectorAll('.step-btn').forEach((b, i) => b.classList.toggle('active', i === idx));
  const d = document.getElementById('stage-detail');
  if (d) d.innerHTML = `<div class="stage-icon">${s.icon}</div><div class="stage-num-label">Stage ${s.num}</div><h3 class="stage-title-big">${s.title}</h3><p class="stage-sub-big">${s.sub}</p><p class="stage-body">${s.detail}</p>`;
}

// ══════════════════════════════════════════════════════════════════
// GALLERY FILTER
// ══════════════════════════════════════════════════════════════════
function filterGal(cat, btn) {
  document.querySelectorAll('.gal-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.gal-card').forEach(card => {
    card.style.display = (cat === 'all' || card.dataset.cat === cat) ? '' : 'none';
  });
}

// ══════════════════════════════════════════════════════════════════
// LIGHTBOX
// ══════════════════════════════════════════════════════════════════
function openLightbox(title, cat, type, src) {
  document.getElementById('lb-title').textContent = title;
  document.getElementById('lb-cat').textContent = cat;
  const media = document.getElementById('lb-media');

  if (type === 'model3d' && src) {
    const views = JSON.parse(src);
    let current = 0;
    function render3d() {
      media.innerHTML = `
        <div style="width:100%;height:100%;display:flex;flex-direction:column;background:#080f1a;position:relative;user-select:none;">
          <div id="lb3d-stage" style="flex:1;position:relative;overflow:hidden;cursor:grab;display:flex;align-items:center;justify-content:center;">
            <img src="${views[current].file}" alt="${views[current].label}" style="max-width:100%;max-height:100%;object-fit:contain;display:block;">
            <div style="position:absolute;bottom:12px;left:50%;transform:translateX(-50%);font-family:var(--f-mono);font-size:9px;letter-spacing:2px;color:rgba(255,255,255,.3);pointer-events:none;">← DRAG TO CYCLE VIEWS →</div>
          </div>
          <div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 16px;background:rgba(0,0,0,.5);border-top:1px solid rgba(255,255,255,.06);">
            ${views.map((v, i) => `<button onclick="lb3dSwitch(${i})" style="font-family:var(--f-mono);font-size:9px;letter-spacing:1.5px;padding:5px 14px;border-radius:4px;border:1px solid ${i===current?'var(--teal)':'rgba(255,255,255,.12)'};background:${i===current?'rgba(126,207,222,.12)':'transparent'};color:${i===current?'var(--teal)':'rgba(255,255,255,.4)'};cursor:pointer;">${v.label}</button>`).join('')}
          </div>
        </div>`;
      const stage = document.getElementById('lb3d-stage');
      let startX = null;
      stage.onmousedown = e => { startX = e.clientX; stage.style.cursor = 'grabbing'; };
      stage.onmousemove = e => {
        if (startX === null) return;
        if (Math.abs(e.clientX - startX) > 40) {
          const dir = e.clientX < startX ? 1 : -1; startX = null; stage.style.cursor = 'grab';
          current = (current + dir + views.length) % views.length; render3d();
        }
      };
      stage.onmouseup = stage.onmouseleave = () => { startX = null; stage.style.cursor = 'grab'; };
    }
    window.lb3dSwitch = i => { current = i; render3d(); };
    render3d();
  } else if (src) {
    if (type === 'video') media.innerHTML = `<video controls autoplay src="${src}" style="max-width:100%;max-height:75vh;display:block;margin:auto;"></video>`;
    else if (type === 'youtube') media.innerHTML = `<iframe src="${src}" style="width:100%;aspect-ratio:16/9;border:none;" allowfullscreen></iframe>`;
    else media.innerHTML = `<img src="${src}" style="max-width:100%;max-height:75vh;width:auto;height:auto;object-fit:contain;display:block;margin:auto;">`;
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

// ══════════════════════════════════════════════════════════════════
// COPY PROMPT
// ══════════════════════════════════════════════════════════════════
function copyPrompt() {
  const el = document.getElementById('rebuild-prompt-text');
  if (!el) return;
  navigator.clipboard.writeText(el.innerText).then(() => {
    const btn = document.querySelector('.copy-btn');
    if (btn) { const o = btn.textContent; btn.textContent = '✓ Copied!'; setTimeout(() => btn.textContent = o, 2000); }
  });
}

// ══════════════════════════════════════════════════════════════════
// SCROLL REVEAL
// ══════════════════════════════════════════════════════════════════
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.style.opacity = '1'; e.target.style.transform = 'translateY(0)'; } });
}, { threshold: 0.1 });

document.querySelectorAll('.card, .proto-card, .ref-card, .gal-card').forEach(el => {
  el.style.opacity = '0'; el.style.transform = 'translateY(16px)'; el.style.transition = 'opacity .4s ease, transform .4s ease';
  revealObs.observe(el);
});

document.addEventListener('DOMContentLoaded', renderPipeline);

// ══════════════════════════════════════════════════════════════════
// SPLASH CURSOR — WebGL fluid simulation
// ══════════════════════════════════════════════════════════════════
(function () {
  const canvas = document.getElementById('fluid');
  if (!canvas) return;

  const SIM_RES = 128, DYE_RES = 1440, DENSITY_DISS = 3.5, VEL_DISS = 2;
  const PRESSURE = 0.1, PRESSURE_ITER = 20, CURL = 3;
  const SPLAT_RADIUS = 0.2, SPLAT_FORCE = 6000, COLOR_SPEED = 10;

  function Ptr() { this.texcoordX=0;this.texcoordY=0;this.prevTexcoordX=0;this.prevTexcoordY=0;this.deltaX=0;this.deltaY=0;this.moved=false;this.color={r:0,g:0,b:0}; }
  const ptrs = [new Ptr()];

  const params = {alpha:true,depth:false,stencil:false,antialias:false,preserveDrawingBuffer:false};
  let gl = canvas.getContext('webgl2', params);
  const isGL2 = !!gl;
  if (!isGL2) gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);
  if (!gl) return;

  let halfFloat, supLinear;
  if (isGL2) { gl.getExtension('EXT_color_buffer_float'); supLinear = gl.getExtension('OES_texture_float_linear'); }
  else { halfFloat = gl.getExtension('OES_texture_half_float'); supLinear = gl.getExtension('OES_texture_half_float_linear'); }
  gl.clearColor(0,0,0,1);
  const HFT = isGL2 ? gl.HALF_FLOAT : (halfFloat && halfFloat.HALF_FLOAT_OES);

  function testFmt(iF,f,t){const tx=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tx);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,iF,4,4,0,f,t,null);const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tx,0);return gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;}
  function getFmt(iF,f,t){if(testFmt(iF,f,t))return{internalFormat:iF,format:f};if(iF===gl.R16F)return getFmt(gl.RG16F,gl.RG,t);if(iF===gl.RG16F)return getFmt(gl.RGBA16F,gl.RGBA,t);return null;}

  let fRGBA,fRG,fR;
  if(isGL2){fRGBA=getFmt(gl.RGBA16F,gl.RGBA,HFT);fRG=getFmt(gl.RG16F,gl.RG,HFT);fR=getFmt(gl.R16F,gl.RED,HFT);}
  else{fRGBA=fRG=fR=getFmt(gl.RGBA,gl.RGBA,HFT);}
  if(!fRGBA||!fRG||!fR)return;

  function cs(type,src,kw){if(kw)src=kw.map(k=>'#define '+k+'\n').join('')+src;const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s;}
  function mkProg(vs,fs){const p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);return p;}
  function getU(p){const u={},n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(let i=0;i<n;i++){const nm=gl.getActiveUniform(p,i).name;u[nm]=gl.getUniformLocation(p,nm);}return u;}
  class Prog{constructor(vs,fs){this.p=mkProg(vs,fs);this.u=getU(this.p);}bind(){gl.useProgram(this.p);}}
  class Mat{constructor(vs,fsSrc){this.vs=vs;this.fsSrc=fsSrc;this.progs={};this.active=null;this.u={};}setKw(kw){let h=0;kw.forEach(k=>{for(let i=0;i<k.length;i++){h=(h<<5)-h+k.charCodeAt(i);h|=0;}});if(!this.progs[h])this.progs[h]=mkProg(this.vs,cs(gl.FRAGMENT_SHADER,this.fsSrc,kw));if(this.progs[h]===this.active)return;this.u=getU(this.progs[h]);this.active=this.progs[h];}bind(){gl.useProgram(this.active);}}

  const bVS=cs(gl.VERTEX_SHADER,`precision highp float;attribute vec2 aPosition;varying vec2 vUv,vL,vR,vT,vB;uniform vec2 texelSize;void main(){vUv=aPosition*.5+.5;vL=vUv-vec2(texelSize.x,0.);vR=vUv+vec2(texelSize.x,0.);vT=vUv+vec2(0.,texelSize.y);vB=vUv-vec2(0.,texelSize.y);gl_Position=vec4(aPosition,0.,1.);}`);
  const copyFS =cs(gl.FRAGMENT_SHADER,`precision mediump float;precision mediump sampler2D;varying highp vec2 vUv;uniform sampler2D uTexture;void main(){gl_FragColor=texture2D(uTexture,vUv);}`);
  const clearFS=cs(gl.FRAGMENT_SHADER,`precision mediump float;precision mediump sampler2D;varying highp vec2 vUv;uniform sampler2D uTexture;uniform float value;void main(){gl_FragColor=value*texture2D(uTexture,vUv);}`);
  const splatFS=cs(gl.FRAGMENT_SHADER,`precision highp float;precision highp sampler2D;varying vec2 vUv;uniform sampler2D uTarget;uniform float aspectRatio;uniform vec3 color;uniform vec2 point;uniform float radius;void main(){vec2 p=vUv-point.xy;p.x*=aspectRatio;vec3 splat=exp(-dot(p,p)/radius)*color;vec3 base=texture2D(uTarget,vUv).xyz;gl_FragColor=vec4(base+splat,1.);}`);
  const advFS  =cs(gl.FRAGMENT_SHADER,`precision highp float;precision highp sampler2D;varying vec2 vUv;uniform sampler2D uVelocity,uSource;uniform vec2 texelSize,dyeTexelSize;uniform float dt,dissipation;vec4 bl(sampler2D s,vec2 uv,vec2 ts){vec2 st=uv/ts-.5;vec2 i=floor(st);vec2 f=fract(st);vec4 a=texture2D(s,(i+vec2(.5,.5))*ts);vec4 b=texture2D(s,(i+vec2(1.5,.5))*ts);vec4 c=texture2D(s,(i+vec2(.5,1.5))*ts);vec4 d=texture2D(s,(i+vec2(1.5,1.5))*ts);return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}void main(){#ifdef MF\nvec2 co=vUv-dt*bl(uVelocity,vUv,texelSize).xy*texelSize;vec4 r=bl(uSource,co,dyeTexelSize);\n#else\nvec2 co=vUv-dt*texture2D(uVelocity,vUv).xy*texelSize;vec4 r=texture2D(uSource,co);\n#endif\ngl_FragColor=r/(1.+dissipation*dt);}`,supLinear?null:['MF']);
  const divFS  =cs(gl.FRAGMENT_SHADER,`precision mediump float;precision mediump sampler2D;varying highp vec2 vUv,vL,vR,vT,vB;uniform sampler2D uVelocity;void main(){float L=texture2D(uVelocity,vL).x,R=texture2D(uVelocity,vR).x,T=texture2D(uVelocity,vT).y,B=texture2D(uVelocity,vB).y;vec2 C=texture2D(uVelocity,vUv).xy;if(vL.x<0.)L=-C.x;if(vR.x>1.)R=-C.x;if(vT.y>1.)T=-C.y;if(vB.y<0.)B=-C.y;gl_FragColor=vec4(.5*(R-L+T-B),0.,0.,1.);}`);
  const curlFS =cs(gl.FRAGMENT_SHADER,`precision mediump float;precision mediump sampler2D;varying highp vec2 vUv,vL,vR,vT,vB;uniform sampler2D uVelocity;void main(){float L=texture2D(uVelocity,vL).y,R=texture2D(uVelocity,vR).y,T=texture2D(uVelocity,vT).x,B=texture2D(uVelocity,vB).x;gl_FragColor=vec4(.5*(R-L-T+B),0.,0.,1.);}`);
  const vortFS =cs(gl.FRAGMENT_SHADER,`precision highp float;precision highp sampler2D;varying vec2 vUv,vL,vR,vT,vB;uniform sampler2D uVelocity,uCurl;uniform float curl,dt;void main(){float L=texture2D(uCurl,vL).x,R=texture2D(uCurl,vR).x,T=texture2D(uCurl,vT).x,B=texture2D(uCurl,vB).x,C=texture2D(uCurl,vUv).x;vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L));f/=length(f)+.0001;f*=curl*C;f.y*=-1.;vec2 v=texture2D(uVelocity,vUv).xy+f*dt;v=min(max(v,-1000.),1000.);gl_FragColor=vec4(v,0.,1.);}`);
  const presFS =cs(gl.FRAGMENT_SHADER,`precision mediump float;precision mediump sampler2D;varying highp vec2 vUv,vL,vR,vT,vB;uniform sampler2D uPressure,uDivergence;void main(){float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x,div=texture2D(uDivergence,vUv).x;gl_FragColor=vec4((L+R+B+T-div)*.25,0.,0.,1.);}`);
  const gradFS =cs(gl.FRAGMENT_SHADER,`precision mediump float;precision mediump sampler2D;varying highp vec2 vUv,vL,vR,vT,vB;uniform sampler2D uPressure,uVelocity;void main(){float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x;vec2 v=texture2D(uVelocity,vUv).xy;v.xy-=vec2(R-L,T-B);gl_FragColor=vec4(v,0.,1.);}`);
  const dispSrc=`precision highp float;precision highp sampler2D;varying vec2 vUv,vL,vR,vT,vB;uniform sampler2D uTexture;uniform vec2 texelSize;void main(){vec3 c=texture2D(uTexture,vUv).rgb;#ifdef SHADING\nvec3 lc=texture2D(uTexture,vL).rgb,rc=texture2D(uTexture,vR).rgb,tc=texture2D(uTexture,vT).rgb,bc=texture2D(uTexture,vB).rgb;float dx=length(rc)-length(lc),dy=length(tc)-length(bc);vec3 n=normalize(vec3(dx,dy,length(texelSize)));float d=clamp(dot(n,vec3(0.,0.,1.))+.7,.7,1.);c*=d;\n#endif\nfloat a=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c,a);}`;

  const copyPr=new Prog(bVS,copyFS),clearPr=new Prog(bVS,clearFS),splatPr=new Prog(bVS,splatFS);
  const advPr=new Prog(bVS,advFS),divPr=new Prog(bVS,divFS),curlPr=new Prog(bVS,curlFS);
  const vortPr=new Prog(bVS,vortFS),presPr=new Prog(bVS,presFS),gradPr=new Prog(bVS,gradFS);
  const dispMat=new Mat(bVS,dispSrc);
  dispMat.setKw(['SHADING']);

  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,-1,1,1,1,1,-1]),gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array([0,1,2,0,2,3]),gl.STATIC_DRAW);
  gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  gl.enableVertexAttribArray(0);

  function blit(tgt){if(tgt==null){gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);gl.bindFramebuffer(gl.FRAMEBUFFER,null);}else{gl.viewport(0,0,tgt.width,tgt.height);gl.bindFramebuffer(gl.FRAMEBUFFER,tgt.fbo);}gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,0);}

  function mkFBO(w,h,iF,f,t,param){gl.activeTexture(gl.TEXTURE0);const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,param);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,param);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,iF,w,h,0,f,t,null);const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT);return{texture:tex,fbo,width:w,height:h,texelSizeX:1/w,texelSizeY:1/h,attach(id){gl.activeTexture(gl.TEXTURE0+id);gl.bindTexture(gl.TEXTURE_2D,tex);return id;}};}
  function mkDFBO(w,h,iF,f,t,p){let a=mkFBO(w,h,iF,f,t,p),b=mkFBO(w,h,iF,f,t,p);return{width:w,height:h,texelSizeX:a.texelSizeX,texelSizeY:a.texelSizeY,get read(){return a;},set read(v){a=v;},get write(){return b;},set write(v){b=v;},swap(){let tmp=a;a=b;b=tmp;}};}
  function resizeFBO(tgt,w,h,iF,f,t,p){const n=mkFBO(w,h,iF,f,t,p);copyPr.bind();gl.uniform1i(copyPr.u.uTexture,tgt.attach(0));blit(n);return n;}
  function resizeDFBO(tgt,w,h,iF,f,t,p){if(tgt.width===w&&tgt.height===h)return tgt;tgt.read=resizeFBO(tgt.read,w,h,iF,f,t,p);tgt.write=mkFBO(w,h,iF,f,t,p);tgt.width=w;tgt.height=h;tgt.texelSizeX=1/w;tgt.texelSizeY=1/h;return tgt;}
  function getRes(r){let ar=gl.drawingBufferWidth/gl.drawingBufferHeight;if(ar<1)ar=1/ar;const mn=Math.round(r),mx=Math.round(r*ar);return gl.drawingBufferWidth>gl.drawingBufferHeight?{width:mx,height:mn}:{width:mn,height:mx};}

  let dye,vel,diverge,curlB,press;
  function initFBOs(){const sR=getRes(SIM_RES),dR=getRes(DYE_RES),fil=supLinear?gl.LINEAR:gl.NEAREST;gl.disable(gl.BLEND);dye=dye?resizeDFBO(dye,dR.width,dR.height,fRGBA.internalFormat,fRGBA.format,HFT,fil):mkDFBO(dR.width,dR.height,fRGBA.internalFormat,fRGBA.format,HFT,fil);vel=vel?resizeDFBO(vel,sR.width,sR.height,fRG.internalFormat,fRG.format,HFT,fil):mkDFBO(sR.width,sR.height,fRG.internalFormat,fRG.format,HFT,fil);diverge=mkFBO(sR.width,sR.height,fR.internalFormat,fR.format,HFT,gl.NEAREST);curlB=mkFBO(sR.width,sR.height,fR.internalFormat,fR.format,HFT,gl.NEAREST);press=mkDFBO(sR.width,sR.height,fR.internalFormat,fR.format,HFT,gl.NEAREST);}
  initFBOs();

  function step(dt){
    gl.disable(gl.BLEND);
    curlPr.bind();gl.uniform2f(curlPr.u.texelSize,vel.texelSizeX,vel.texelSizeY);gl.uniform1i(curlPr.u.uVelocity,vel.read.attach(0));blit(curlB);
    vortPr.bind();gl.uniform2f(vortPr.u.texelSize,vel.texelSizeX,vel.texelSizeY);gl.uniform1i(vortPr.u.uVelocity,vel.read.attach(0));gl.uniform1i(vortPr.u.uCurl,curlB.attach(1));gl.uniform1f(vortPr.u.curl,CURL);gl.uniform1f(vortPr.u.dt,dt);blit(vel.write);vel.swap();
    divPr.bind();gl.uniform2f(divPr.u.texelSize,vel.texelSizeX,vel.texelSizeY);gl.uniform1i(divPr.u.uVelocity,vel.read.attach(0));blit(diverge);
    clearPr.bind();gl.uniform1i(clearPr.u.uTexture,press.read.attach(0));gl.uniform1f(clearPr.u.value,PRESSURE);blit(press.write);press.swap();
    presPr.bind();gl.uniform2f(presPr.u.texelSize,vel.texelSizeX,vel.texelSizeY);gl.uniform1i(presPr.u.uDivergence,diverge.attach(0));
    for(let i=0;i<PRESSURE_ITER;i++){gl.uniform1i(presPr.u.uPressure,press.read.attach(1));blit(press.write);press.swap();}
    gradPr.bind();gl.uniform2f(gradPr.u.texelSize,vel.texelSizeX,vel.texelSizeY);gl.uniform1i(gradPr.u.uPressure,press.read.attach(0));gl.uniform1i(gradPr.u.uVelocity,vel.read.attach(1));blit(vel.write);vel.swap();
    advPr.bind();gl.uniform2f(advPr.u.texelSize,vel.texelSizeX,vel.texelSizeY);if(!supLinear)gl.uniform2f(advPr.u.dyeTexelSize,vel.texelSizeX,vel.texelSizeY);const vid=vel.read.attach(0);gl.uniform1i(advPr.u.uVelocity,vid);gl.uniform1i(advPr.u.uSource,vid);gl.uniform1f(advPr.u.dt,dt);gl.uniform1f(advPr.u.dissipation,VEL_DISS);blit(vel.write);vel.swap();
    if(!supLinear)gl.uniform2f(advPr.u.dyeTexelSize,dye.texelSizeX,dye.texelSizeY);gl.uniform1i(advPr.u.uVelocity,vel.read.attach(0));gl.uniform1i(advPr.u.uSource,dye.read.attach(1));gl.uniform1f(advPr.u.dissipation,DENSITY_DISS);blit(dye.write);dye.swap();
  }

  function render(){gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.enable(gl.BLEND);dispMat.bind();gl.uniform2f(dispMat.u.texelSize,1/gl.drawingBufferWidth,1/gl.drawingBufferHeight);gl.uniform1i(dispMat.u.uTexture,dye.read.attach(0));blit(null);}

  function splat(x,y,dx,dy,color){splatPr.bind();gl.uniform1i(splatPr.u.uTarget,vel.read.attach(0));gl.uniform1f(splatPr.u.aspectRatio,canvas.width/canvas.height);gl.uniform2f(splatPr.u.point,x,y);gl.uniform3f(splatPr.u.color,dx,dy,0);let r=SPLAT_RADIUS/100;if(canvas.width/canvas.height>1)r*=canvas.width/canvas.height;gl.uniform1f(splatPr.u.radius,r);blit(vel.write);vel.swap();gl.uniform1i(splatPr.u.uTarget,dye.read.attach(0));gl.uniform3f(splatPr.u.color,color.r,color.g,color.b);blit(dye.write);dye.swap();}

  function genColor(){const h=Math.random();let r,g,b,i=Math.floor(h*6),f=h*6-i,p=0,q=1-f,t=f;switch(i%6){case 0:r=1;g=t;b=p;break;case 1:r=q;g=1;b=p;break;case 2:r=p;g=1;b=t;break;case 3:r=p;g=q;b=1;break;case 4:r=t;g=p;b=1;break;default:r=1;g=p;b=q;}return{r:r*.15,g:g*.15,b:b*.15};}
  function scl(v){return Math.floor(v*(window.devicePixelRatio||1));}

  let firstMove=false;
  window.addEventListener('mousemove',e=>{
    const p=ptrs[0],px=scl(e.clientX),py=scl(e.clientY);
    if(!firstMove){p.texcoordX=px/canvas.width;p.texcoordY=1-py/canvas.height;p.prevTexcoordX=p.texcoordX;p.prevTexcoordY=p.texcoordY;firstMove=true;p.color=genColor();return;}
    p.prevTexcoordX=p.texcoordX;p.prevTexcoordY=p.texcoordY;
    p.texcoordX=px/canvas.width;p.texcoordY=1-py/canvas.height;
    let dx=p.texcoordX-p.prevTexcoordX,dy=p.texcoordY-p.prevTexcoordY;
    const ar=canvas.width/canvas.height;if(ar<1)dx*=ar;if(ar>1)dy/=ar;
    p.deltaX=dx;p.deltaY=dy;p.moved=Math.abs(dx)>0||Math.abs(dy)>0;
  });
  window.addEventListener('mousedown',e=>{
    const p=ptrs[0],px=scl(e.clientX),py=scl(e.clientY);
    p.texcoordX=px/canvas.width;p.texcoordY=1-py/canvas.height;
    const c=genColor();c.r*=10;c.g*=10;c.b*=10;
    splat(p.texcoordX,p.texcoordY,10*(Math.random()-.5),30*(Math.random()-.5),c);
  });
  window.addEventListener('touchstart',e=>{const t=e.targetTouches[0],p=ptrs[0];p.texcoordX=scl(t.clientX)/canvas.width;p.texcoordY=1-scl(t.clientY)/canvas.height;p.prevTexcoordX=p.texcoordX;p.prevTexcoordY=p.texcoordY;p.color=genColor();},{passive:true});
  window.addEventListener('touchmove',e=>{const t=e.targetTouches[0],p=ptrs[0];p.prevTexcoordX=p.texcoordX;p.prevTexcoordY=p.texcoordY;p.texcoordX=scl(t.clientX)/canvas.width;p.texcoordY=1-scl(t.clientY)/canvas.height;let dx=p.texcoordX-p.prevTexcoordX,dy=p.texcoordY-p.prevTexcoordY;const ar=canvas.width/canvas.height;if(ar<1)dx*=ar;if(ar>1)dy/=ar;p.deltaX=dx;p.deltaY=dy;p.moved=true;},{passive:true});

  let lastT=Date.now(),colorT=0;
  function frame(){
    const now=Date.now(),dt=Math.min((now-lastT)/1000,0.016666);lastT=now;
    const w=scl(canvas.clientWidth),h=scl(canvas.clientHeight);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;initFBOs();}
    colorT+=dt*COLOR_SPEED;if(colorT>=1){colorT=0;ptrs.forEach(p=>p.color=genColor());}
    ptrs.forEach(p=>{if(p.moved){p.moved=false;splat(p.texcoordX,p.texcoordY,p.deltaX*SPLAT_FORCE,p.deltaY*SPLAT_FORCE,p.color);}});
    step(dt);render();requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

})();

// ══════════════════════════════════════════════════════════════════
// GALLERY SCROLL-IN ANIMATION
// ══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function () {
  const gallery = document.getElementById('gallery');
  if (!gallery) return;

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        gallery.classList.add('in-view');
        observer.disconnect();
      }
    });
  }, { threshold: 0.05 });

  observer.observe(gallery);
});

// ══════════════════════════════════════════════════════════════════
// MAG-NULL TEXT PRESSURE EFFECT
// ══════════════════════════════════════════════════════════════════
(function () {
  const container = document.getElementById('mag-null-pressure');
  if (!container) return;

  // Each letter gets its own gradient color (teal → purple → pink like the screenshot)
  const letterColors = [
    '#7ECFDE', // M - teal
    '#6EC6E8', // A - light blue
    '#A78BFA', // G - purple
    '#ffffff', // - (dash) - white
    '#C084FC', // N - violet
    '#E879A0', // U - pink-purple
    '#F472B6', // L - pink
    '#7ECFDE', // L - teal
  ];

  const text = 'MAG-NULL';
  const h1 = document.createElement('h1');

  text.split('').forEach((ch, i) => {
    const span = document.createElement('span');
    span.textContent = ch;
    span.dataset.char = ch;
    span.style.color = letterColors[i] || '#ffffff';
    // Start thick
    span.style.fontVariationSettings = "'wght' 750, 'wdth' 140, 'ital' 0";
    h1.appendChild(span);
  });

  container.appendChild(h1);

  const spanEls = Array.from(h1.querySelectorAll('span'));
  const mouse = { x: 0, y: 0 };
  const cursor = { x: 0, y: 0 };

  const r = container.getBoundingClientRect();
  mouse.x = cursor.x = r.left + r.width / 2;
  mouse.y = cursor.y = r.top + r.height / 2;

  window.addEventListener('mousemove', e => { cursor.x = e.clientX; cursor.y = e.clientY; });
  window.addEventListener('touchmove', e => { cursor.x = e.touches[0].clientX; cursor.y = e.touches[0].clientY; }, { passive: true });

  function dist(a, b) { return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2); }
  function getAttr(d, maxD, minV, maxV) { return Math.max(minV, (maxV - Math.abs(maxV * d / maxD)) + minV); }

  function animate() {
    mouse.x += (cursor.x - mouse.x) / 15;
    mouse.y += (cursor.y - mouse.y) / 15;

    const maxDist = h1.getBoundingClientRect().width / 2;

    spanEls.forEach(span => {
      const sr = span.getBoundingClientRect();
      const d = dist(mouse, { x: sr.x + sr.width / 2, y: sr.y + sr.height / 2 });
      const wght = Math.floor(getAttr(d, maxDist, 200, 900));
      const wdth = Math.floor(getAttr(d, maxDist, 60, 200));
      const ital = getAttr(d, maxDist, 0, 1).toFixed(2);
      span.style.fontVariationSettings = `'wght' ${wght}, 'wdth' ${wdth}, 'ital' ${ital}`;
    });

    requestAnimationFrame(animate);
  }

  animate();
})();