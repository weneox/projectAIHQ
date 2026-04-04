<!DOCTYPE html>
<html lang="az">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ÆTHER AI Widget</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #050508;
      font-family: 'Syne', sans-serif;
    }

    :root {
      --void: #050508;
      --deep: #0b0c14;
      --surface: #12131f;
      --rim: #1e2035;
      --accent1: #5b8fff;
      --accent2: #a78bfa;
      --bright: #e8eeff;
      --muted: #7b82a8;
    }

    .ai-root {
      width: 380px;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 3rem 1.5rem 3.5rem;
      background: var(--void);
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(91,143,255,0.12);
      border-radius: 4px;
    }

    .grid-bg {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(91,143,255,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(91,143,255,0.04) 1px, transparent 1px);
      background-size: 40px 40px;
      pointer-events: none;
    }

    .scanline {
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg, transparent, transparent 2px,
        rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px
      );
      pointer-events: none;
      z-index: 10;
    }

    .corner { position: absolute; width: 18px; height: 18px; }
    .corner::before, .corner::after { content: ''; position: absolute; background: var(--accent1); }
    .corner.tl { top: 1.2rem; left: 1.2rem; }
    .corner.tr { top: 1.2rem; right: 1.2rem; transform: rotate(90deg); }
    .corner.bl { bottom: 1.2rem; left: 1.2rem; transform: rotate(-90deg); }
    .corner.br { bottom: 1.2rem; right: 1.2rem; transform: rotate(180deg); }
    .corner::before { width: 100%; height: 1px; top: 0; left: 0; }
    .corner::after  { width: 1px; height: 100%; top: 0; left: 0; }

    /* ───── Entity wrap ───── */
    .entity-wrap {
      position: relative;
      width: 200px;
      height: 200px;
      margin-bottom: 2rem;
    }

    .orbit-ring {
      position: absolute;
      border-radius: 50%;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
    }
    .orbit-ring.r1 { width: 240px; height: 240px; border: 1px solid rgba(91,143,255,0.10); animation: spin 18s linear infinite; }
    .orbit-ring.r2 { width: 280px; height: 280px; border: 1px solid rgba(167,139,250,0.08); animation: spin 28s linear infinite reverse; }
    .orbit-ring.r3 { width: 320px; height: 320px; border: 1px solid rgba(91,143,255,0.05); animation: spin 40s linear infinite; }

    .orbit-dot {
      position: absolute;
      border-radius: 50%;
    }
    .orbit-dot.d1 { width: 6px; height: 6px; background: #5b8fff; box-shadow: 0 0 8px #5b8fff; top: -3px; left: calc(50% - 3px); }
    .orbit-dot.d2 { width: 4px; height: 4px; background: #a78bfa; top: -2px; left: calc(50% - 2px); }
    .orbit-dot.d3 { width: 5px; height: 5px; background: #38d9a9; top: -2.5px; left: calc(50% - 2.5px); }

    @keyframes spin {
      from { transform: translate(-50%,-50%) rotate(0deg); }
      to   { transform: translate(-50%,-50%) rotate(360deg); }
    }

    /* ───── Entity body ───── */
    .entity-body {
      position: absolute;
      width: 200px; height: 200px;
      border-radius: 50%;
      background: radial-gradient(ellipse at 35% 30%, #1a1d30 0%, #0d0e1a 60%, #050508 100%);
      border: 1px solid rgba(91,143,255,0.25);
      top: 0; left: 0;
      animation: breathe 4s ease-in-out infinite;
      overflow: hidden;
      box-shadow:
        0 0 0 1px rgba(91,143,255,0.08),
        0 0 30px rgba(91,143,255,0.12),
        0 0 80px rgba(91,143,255,0.06),
        inset 0 1px 0 rgba(255,255,255,0.06),
        inset 0 -1px 0 rgba(0,0,0,0.4);
      cursor: crosshair;
    }

    .entity-sheen {
      position: absolute;
      top: -30%; left: -20%;
      width: 80%; height: 60%;
      background: radial-gradient(ellipse, rgba(255,255,255,0.04) 0%, transparent 70%);
      border-radius: 50%;
      transform: rotate(-20deg);
      pointer-events: none;
    }

    @keyframes breathe {
      0%, 100% {
        transform: scale(1);
        box-shadow: 0 0 0 1px rgba(91,143,255,0.08), 0 0 30px rgba(91,143,255,0.12),
                    0 0 80px rgba(91,143,255,0.06), inset 0 1px 0 rgba(255,255,255,0.06),
                    inset 0 -1px 0 rgba(0,0,0,0.4);
      }
      50% {
        transform: scale(1.018);
        box-shadow: 0 0 0 1px rgba(91,143,255,0.15), 0 0 40px rgba(91,143,255,0.18),
                    0 0 100px rgba(91,143,255,0.10), inset 0 1px 0 rgba(255,255,255,0.08),
                    inset 0 -1px 0 rgba(0,0,0,0.4);
      }
    }

    /* ───── Eyes ───── */
    .eyes-row {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -58%);
      display: flex;
      align-items: center;
      gap: 30px;
    }

    .eye-lid-wrap {
      width: 36px; height: 36px;
      border-radius: 50%;
      overflow: hidden;
      position: relative;
      background: #000;
      border: 1px solid rgba(91,143,255,0.3);
      box-shadow: 0 0 12px rgba(91,143,255,0.2);
    }

    .eye-lid-top, .eye-lid-bot {
      position: absolute;
      width: 100%; height: 50%;
      background: radial-gradient(ellipse at 50% 100%, #12131f 0%, #0b0c14 100%);
      left: 0;
      transition: transform 0.12s cubic-bezier(0.4,0,0.2,1);
      z-index: 3;
    }
    .eye-lid-top { top: 0;    transform-origin: top; }
    .eye-lid-bot { bottom: 0; transform-origin: bottom; }

    .iris {
      position: absolute;
      width: 24px; height: 24px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #7ab0ff, #3b6fd4 50%, #1a3a7a 100%);
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1;
      animation: irisGlow 4s ease-in-out infinite;
    }

    @keyframes irisGlow {
      0%, 100% { box-shadow: 0 0 6px rgba(91,143,255,0.6); }
      50%       { box-shadow: 0 0 14px rgba(91,143,255,0.9), 0 0 4px rgba(150,180,255,0.5); }
    }

    .pupil {
      position: absolute;
      width: 10px; height: 10px;
      border-radius: 50%;
      background: #000;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 2;
      transition: transform 0.3s ease;
    }

    .pupil-shine {
      position: absolute;
      width: 4px; height: 4px;
      border-radius: 50%;
      background: rgba(255,255,255,0.8);
      top: 18%; left: 22%;
      z-index: 3;
    }

    .nose-mark {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, 10%);
      width: 6px; height: 6px;
      border-radius: 50%;
      background: rgba(91,143,255,0.2);
      border: 1px solid rgba(91,143,255,0.3);
    }

    .mouth-arc {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, 28px);
      width: 40px; height: 12px;
      border-bottom: 1.5px solid rgba(91,143,255,0.35);
      border-left:   1.5px solid rgba(91,143,255,0.1);
      border-right:  1.5px solid rgba(91,143,255,0.1);
      border-radius: 0 0 50% 50%;
      transition: all 0.6s ease;
    }

    /* ───── Labels & status ───── */
    .entity-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.3em;
      color: var(--muted);
      text-transform: uppercase;
      margin-bottom: 0.5rem;
    }

    .entity-name {
      font-size: 28px;
      font-weight: 800;
      color: var(--bright);
      letter-spacing: -0.02em;
      margin-bottom: 0.15rem;
      text-align: center;
    }
    .entity-name span { color: var(--accent1); }

    .status-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 1.2rem 0 1.8rem;
    }

    .status-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      background: #38d9a9;
      animation: pulseDot 2s ease-in-out infinite;
    }

    @keyframes pulseDot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.5; transform: scale(0.7); }
    }

    .status-text {
      font-size: 12px;
      color: var(--muted);
      letter-spacing: 0.08em;
      transition: opacity 0.4s;
    }

    /* ───── Waveform ───── */
    .waveform {
      display: flex;
      align-items: center;
      gap: 3px;
      margin-bottom: 1.8rem;
      height: 32px;
    }

    .waveform-bar {
      width: 3px;
      border-radius: 2px;
      background: var(--accent1);
      opacity: 0.5;
      animation: wave 1.4s ease-in-out infinite;
    }

    @keyframes wave {
      0%, 100% { transform: scaleY(0.3); }
      50%       { transform: scaleY(1); }
    }

    /* ───── Data strip ───── */
    .data-strip {
      display: flex;
      gap: 1px;
      margin-bottom: 1.8rem;
      width: 100%;
    }

    .data-block {
      flex: 1;
      background: var(--surface);
      border: 1px solid var(--rim);
      padding: 0.75rem 0.5rem;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .data-block:first-child { border-radius: 4px 0 0 4px; }
    .data-block:last-child  { border-radius: 0 4px 4px 0; }

    .data-val {
      display: block;
      font-size: 18px;
      font-weight: 700;
      color: var(--bright);
      line-height: 1;
      margin-bottom: 4px;
      font-variant-numeric: tabular-nums;
    }

    .data-key {
      display: block;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.15em;
      color: var(--muted);
      text-transform: uppercase;
    }

    .data-bar {
      position: absolute;
      bottom: 0; left: 0;
      height: 2px;
      background: linear-gradient(90deg, var(--accent1), var(--accent2));
      animation: barGrow 3s ease-in-out infinite;
    }

    @keyframes barGrow {
      0%   { width: 20%; opacity: 0.4; }
      50%  { width: 85%; opacity: 1;   }
      100% { width: 20%; opacity: 0.4; }
    }

    /* ───── Button ───── */
    .interact-btn {
      background: transparent;
      border: 1px solid rgba(91,143,255,0.35);
      color: var(--accent1);
      font-family: 'Syne', sans-serif;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      padding: 0.75rem 2rem;
      border-radius: 2px;
      cursor: pointer;
      transition: border-color 0.2s, color 0.2s, background 0.2s;
    }

    .interact-btn:hover {
      border-color: var(--accent1);
      color: var(--bright);
      background: rgba(91,143,255,0.08);
    }

    .interact-btn:active { transform: scale(0.97); }
  </style>
</head>
<body>

<div class="ai-root" id="root">
  <div class="grid-bg"></div>
  <div class="scanline"></div>
  <div class="corner tl"></div>
  <div class="corner tr"></div>
  <div class="corner bl"></div>
  <div class="corner br"></div>

  <!-- Entity -->
  <div class="entity-wrap">
    <div class="orbit-ring r1"><div class="orbit-dot d1"></div></div>
    <div class="orbit-ring r2"><div class="orbit-dot d2"></div></div>
    <div class="orbit-ring r3"><div class="orbit-dot d3"></div></div>

    <div class="entity-body" id="body">
      <div class="entity-sheen"></div>

      <div class="eyes-row">
        <!-- Left eye -->
        <div>
          <div class="eye-lid-wrap" id="leftWrap">
            <div class="eye-lid-top" id="lTop"></div>
            <div class="eye-lid-bot" id="lBot"></div>
            <div class="iris">
              <div class="pupil" id="lPupil">
                <div class="pupil-shine"></div>
              </div>
            </div>
          </div>
        </div>
        <!-- Right eye -->
        <div>
          <div class="eye-lid-wrap" id="rightWrap">
            <div class="eye-lid-top" id="rTop"></div>
            <div class="eye-lid-bot" id="rBot"></div>
            <div class="iris">
              <div class="pupil" id="rPupil">
                <div class="pupil-shine"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="nose-mark"></div>
      <div class="mouth-arc" id="mouth"></div>
    </div>
  </div>

  <!-- Text -->
  <div class="entity-label">Neural Entity ◈ v4.1</div>
  <div class="entity-name">ÆTHER <span>AI</span></div>

  <div class="status-row">
    <div class="status-dot"></div>
    <span class="status-text" id="statusText">Aktiv · Dinləyir</span>
  </div>

  <div class="waveform" id="waveform"></div>

  <div class="data-strip">
    <div class="data-block">
      <span class="data-val" id="v1">98.7</span>
      <span class="data-key">Bilinç %</span>
      <div class="data-bar" style="animation-delay:0s"></div>
    </div>
    <div class="data-block">
      <span class="data-val">12ms</span>
      <span class="data-key">Cavab</span>
      <div class="data-bar" style="animation-delay:0.4s"></div>
    </div>
    <div class="data-block">
      <span class="data-val">∞</span>
      <span class="data-key">Model</span>
      <div class="data-bar" style="animation-delay:0.8s"></div>
    </div>
    <div class="data-block">
      <span class="data-val">4.1K</span>
      <span class="data-key">Neyron</span>
      <div class="data-bar" style="animation-delay:1.2s"></div>
    </div>
  </div>

  <button class="interact-btn" onclick="triggerSurprise()">◈ Aktivləşdir</button>
</div>

<script>
  /* ── Waveform bars ── */
  const wf = document.getElementById('waveform');
  const NUM = 20;
  const barEls = [];
  for (let i = 0; i < NUM; i++) {
    const b = document.createElement('div');
    b.className = 'waveform-bar';
    const h = 8 + Math.random() * 24;
    b.style.height = h + 'px';
    b.style.animationDelay = (i * 0.07) + 's';
    b.style.opacity = String(0.3 + Math.abs(i - NUM / 2) / NUM * 0.5);
    wf.appendChild(b);
    barEls.push(b);
  }

  /* ── Eyelid helpers ── */
  const lTop = document.getElementById('lTop');
  const lBot = document.getElementById('lBot');
  const rTop = document.getElementById('rTop');
  const rBot = document.getElementById('rBot');
  const lPupil = document.getElementById('lPupil');
  const rPupil = document.getElementById('rPupil');
  const mouth  = document.getElementById('mouth');
  const statusText = document.getElementById('statusText');
  const v1 = document.getElementById('v1');

  function closeLids(left, right) {
    if (left)  { lTop.style.transform = 'scaleY(2.2)'; lBot.style.transform = 'scaleY(2.2)'; }
    if (right) { rTop.style.transform = 'scaleY(2.2)'; rBot.style.transform = 'scaleY(2.2)'; }
  }

  function openLids() {
    [lTop, lBot, rTop, rBot].forEach(el => el.style.transform = '');
  }

  function blink(both) {
    closeLids(true, both !== false);
    setTimeout(openLids, 130);
  }

  /* ── Auto-blink scheduler ── */
  function scheduleBlink() {
    const delay = 2200 + Math.random() * 4000;
    setTimeout(() => {
      blink(Math.random() > 0.15);
      scheduleBlink();
    }, delay);
  }

  scheduleBlink();
  setTimeout(() => blink(false), 600);

  /* ── Pupil tracking ── */
  document.getElementById('body').addEventListener('mousemove', function(e) {
    const r  = this.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width  / 2)) / r.width;
    const dy = (e.clientY - (r.top  + r.height / 2)) / r.height;
    const px = dx * 5, py = dy * 5;
    [lPupil, rPupil].forEach(p => {
      p.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`;
    });
  });

  document.getElementById('body').addEventListener('mouseleave', function() {
    [lPupil, rPupil].forEach(p => {
      p.style.transition = 'transform 0.5s ease';
      p.style.transform  = 'translate(-50%, -50%)';
    });
    setTimeout(() => {
      [lPupil, rPupil].forEach(p => p.style.transition = 'transform 0.3s ease');
    }, 500);
  });

  /* ── Status cycle ── */
  const statuses = ['Aktiv · Dinləyir', 'Düşünür...', 'Analiz edir', 'Hazır', 'Öyrənir'];
  let si = 0;
  setInterval(() => {
    si = (si + 1) % statuses.length;
    statusText.style.opacity = '0';
    setTimeout(() => {
      statusText.textContent = statuses[si];
      statusText.style.opacity = '1';
    }, 200);
  }, 4000);

  /* ── Live data flicker ── */
  setInterval(() => {
    v1.textContent = (96 + Math.random() * 3.8).toFixed(1);
  }, 1800);

  /* ── Activate button ── */
  window.triggerSurprise = function () {
    blink(true);
    setTimeout(() => blink(true), 200);
    setTimeout(() => blink(true), 450);

    mouth.style.transform   = 'translate(-50%, 24px) scaleY(1.6)';
    mouth.style.borderColor = 'rgba(91,143,255,0.7)';
    statusText.textContent  = '✦ Aktivləşdi ✦';
    statusText.style.color  = '#7ab0ff';

    barEls.forEach((b, i) => {
      b.style.animation = 'none';
      b.style.background = '#5b8fff';
      b.style.opacity = '1';
      b.style.height  = (10 + Math.abs(Math.sin(i * 0.5)) * 28) + 'px';
      setTimeout(() => {
        b.style.animation = '';
        b.style.opacity   = '';
      }, 1200);
    });

    setTimeout(() => {
      mouth.style.transform   = '';
      mouth.style.borderColor = '';
      statusText.style.color  = '';
    }, 2000);
  };
</script>

</body>
</html>