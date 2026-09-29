/* Sadeem Aljufran · portfolio interactions
   One rAF loop drives everything scroll-linked. Each module registers a
   `read` (layout reads) and `write` (style writes) step so the loop never
   interleaves the two. Every effect has a static fallback under
   prefers-reduced-motion. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const root = document.documentElement;

  let vw = innerWidth, vh = innerHeight;

  /* ---------------------------------------------------------------- loop */
  const tasks = [];          // {read(y), write(y)}
  const tickers = [];        // per-frame callbacks (time, dt)
  let lastY = -1, dirty = true, lastT = performance.now();

  function frame(t) {
    const dt = Math.min(64, t - lastT); lastT = t;
    if (lenis) lenis.raf(t);
    const y = scrollY;
    if (y !== lastY || dirty) {
      for (const k of tasks) k.read && k.read(y);
      for (const k of tasks) k.write && k.write(y);
      lastY = y; dirty = false;
    }
    for (const f of tickers) f(t, dt);
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------ smooth scroll */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
  }

  function scrollToEl(el, immediate) {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { immediate: !!immediate, offset: 0 });
    else el.scrollIntoView({ behavior: reduce || immediate ? 'auto' : 'smooth' });
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const el = document.getElementById(id.slice(1));
    if (!el) return;
    e.preventDefault();
    closeMenu();
    if (id === '#top') { lenis ? lenis.scrollTo(0) : scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); }
    else scrollToEl(el);
    history.pushState(null, '', id);
    // move focus for keyboard + screen-reader users without a second jump
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  });

  /* ------------------------------------------------- progress + nav */
  const nav = $('.nav');
  const bar = $('.progress span');
  const navLinks = $$('.nav-links a');
  const navPill = $('.nav-pill');
  const sectionIds = ['about', 'ai', 'projects', 'experience', 'skills', 'contact'];
  const sections = sectionIds.map(id => document.getElementById(id));
  const paper = $('.paper');
  let docH = 1, prevY = 0, active = '', onPaper = false, navHidden = false;

  function movePill(a) {
    if (!a) { navPill.classList.remove('on'); return; }
    navPill.style.setProperty('--x', a.offsetLeft + 'px');
    navPill.style.setProperty('--w', a.offsetWidth + 'px');
    navPill.classList.add('on');
  }

  let secTops = [], paperBox = null;
  tasks.push({
    read(y) {
      docH = document.documentElement.scrollHeight - vh;
      secTops = sections.map(s => s.getBoundingClientRect().top);
      paperBox = paper.getBoundingClientRect();
    },
    write(y) {
      bar.style.setProperty('--p', clamp(y / docH, 0, 1));
      const d = y - prevY;
      if (!menuOpen) {
        if (y > vh * .7 && d > 4 && !navHidden) { nav.classList.add('is-hidden'); navHidden = true; }
        else if ((d < -4 || y < vh * .7) && navHidden) { nav.classList.remove('is-hidden'); navHidden = false; }
      }
      prevY = y;
      nav.classList.toggle('is-scrolled', y > 20);
      const p = paperBox.top < 40 && paperBox.bottom > 40;
      if (p !== onPaper) { onPaper = p; nav.classList.toggle('on-paper', p); }
      let cur = '';
      secTops.forEach((t, i) => { if (t < vh * .45) cur = sectionIds[i]; });
      if (cur !== active) {
        active = cur;
        let hit = null;
        navLinks.forEach(a => { const on = a.getAttribute('href') === '#' + cur; a.classList.toggle('is-active', on); if (on) { hit = a; a.setAttribute('aria-current', 'true'); } else a.removeAttribute('aria-current'); });
        movePill(hit);
      }
    }
  });
  if (fine) {
    const list = $('.nav-links');
    navLinks.forEach(a => a.addEventListener('mouseenter', () => movePill(a)));
    list.addEventListener('mouseleave', () => movePill(navLinks.find(a => a.classList.contains('is-active'))));
  }

  /* ------------------------------------------------------ mobile menu */
  const menu = $('#menu'), toggle = $('.nav-toggle');
  let menuOpen = false, menuTimer;
  function openMenu() {
    clearTimeout(menuTimer);
    menuOpen = true; menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add('is-open'));
    toggle.setAttribute('aria-expanded', 'true'); toggle.setAttribute('aria-label', 'Close menu');
    nav.classList.remove('is-hidden'); navHidden = false;
    document.body.style.overflow = 'hidden'; lenis && lenis.stop();
    setTimeout(() => { const f = $('a', menu); f && f.focus(); }, 80);
  }
  function closeMenu() {
    if (!menuOpen) return;
    menuOpen = false; menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Open menu');
    document.body.style.overflow = ''; lenis && lenis.start();
    menuTimer = setTimeout(() => { menu.hidden = true; }, 450);
  }
  toggle.addEventListener('click', () => menuOpen ? (closeMenu(), toggle.focus()) : openMenu());
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen) { closeMenu(); toggle.focus(); } });
  menu.addEventListener('keydown', e => {           // simple focus trap
    if (e.key !== 'Tab') return;
    const f = [toggle, ...$$('a', menu)];
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  });

  /* ------------------------------------------------ reveal on enter */
  const io = new IntersectionObserver(entries => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }, { threshold: .15, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal, .reveal-scale, .path-step, .pcard, .tl-item, .gpa-ring, [data-probs], .flow, .ct-title').forEach(el => io.observe(el));

  /* ------------------------------------------------------- count up */
  const fmt = (v, dec) => dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US');
  const countIO = new IntersectionObserver(entries => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      countIO.unobserve(en.target);
      const el = en.target, to = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0);
      if (reduce) continue;
      const t0 = performance.now(), dur = 1400 + Math.min(800, to / 30);
      const step = t => {
        const p = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - p, 4);
        el.textContent = fmt(to * e, dec);
        if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(to, dec);
      };
      el.textContent = fmt(0, dec);
      requestAnimationFrame(step);
    }
  }, { threshold: .6 });
  $$('[data-count]').forEach(el => countIO.observe(el));

  /* ------------------------------------------------------ hero: words */
  const rot = $$('.rot-word');
  const hero = $('.hero');
  let heroVisible = true, rotPaused = false;
  new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; }).observe(hero);
  if (!reduce && rot.length) {
    let ri = 0;
    const rotator = $('.rotator');
    rotator.addEventListener('mouseenter', () => rotPaused = true);
    rotator.addEventListener('mouseleave', () => rotPaused = false);
    setInterval(() => {
      if (!heroVisible || rotPaused || document.hidden) return;
      const prev = rot[ri]; ri = (ri + 1) % rot.length; const next = rot[ri];
      prev.classList.remove('is-on'); prev.classList.add('is-out');
      next.classList.remove('is-out'); next.classList.add('is-on');
      setTimeout(() => prev.classList.remove('is-out'), 700);
    }, 2600);
  }
  const hello = $('.hello');
  hello.addEventListener('click', () => hello.classList.toggle('flip'));

  /* --------------------------------------------- hero: pose + particles
     A stylised replay of Hakaya's pipeline: 17 MediaPipe-style landmarks
     animated procedurally, a "detection box", and a particle field that
     links to the joints it passes. */
  const canvas = $('.hero-canvas');
  const ctx = canvas.getContext('2d');
  const visual = $('.hero-visual');
  const hud = { move: $('.hud-move'), p: $('.hud-p'), bar: $('.hud-bar'), reps: $('.hud-reps') };
  const chips = $$('.hud-chips button');
  const MOVES = { march: 1700, squat: 2300, jump: 1150 };
  const BASE = {
    nose: [0, .085], eyeL: [-.025, .07], eyeR: [.025, .07], earL: [-.052, .08], earR: [.052, .08],
    shL: [-.125, .2], shR: [.125, .2], elL: [-.155, .35], elR: [.155, .35], wrL: [-.165, .49], wrR: [.165, .49],
    hipL: [-.085, .52], hipR: [.085, .52], knL: [-.09, .74], knR: [.09, .74], anL: [-.09, .96], anR: [.09, .96]
  };
  const BONES = [['shL', 'shR'], ['shL', 'elL'], ['elL', 'wrL'], ['shR', 'elR'], ['elR', 'wrR'], ['shL', 'hipL'], ['shR', 'hipR'], ['hipL', 'hipR'],
    ['hipL', 'knL'], ['knL', 'anL'], ['hipR', 'knR'], ['knR', 'anR'], ['eyeL', 'eyeR'], ['eyeL', 'earL'], ['eyeR', 'earR'], ['nose', 'eyeL'], ['nose', 'eyeR']];
  const JOINTS = Object.keys(BASE);

  let move = 'march', phase = 0, reps = 0, pMove = 0, pTarget = .95, lookX = 0;
  const pose = {};
  const mouse = { x: -9999, y: -9999, on: false };

  function computePose(m, ph) {
    for (const k of JOINTS) pose[k] = [BASE[k][0], BASE[k][1]];
    const s = Math.sin(ph), d = (1 - Math.cos(ph)) / 2;
    const add = (k, x, y) => { pose[k][0] += x; pose[k][1] += y; };
    if (m === 'march') {
      const l = Math.max(0, s), r = Math.max(0, -s);
      add('knL', .01, -.13 * l); add('anL', .02, -.17 * l);
      add('knR', -.01, -.13 * r); add('anR', -.02, -.17 * r);
      add('elR', .01, -.05 * l); add('wrR', -.05 * l, -.15 * l);
      add('elL', -.01, -.05 * r); add('wrL', .05 * r, -.15 * r);
      const bob = -.012 * Math.abs(s);
      for (const k of JOINTS) if (!/^(an|kn)/.test(k)) pose[k][1] += bob;
    } else if (m === 'squat') {
      const up = ['nose', 'eyeL', 'eyeR', 'earL', 'earR', 'shL', 'shR', 'elL', 'elR', 'wrL', 'wrR'];
      for (const k of up) pose[k][1] += .17 * d;
      add('hipL', -.02 * d, .19 * d); add('hipR', .02 * d, .19 * d);
      add('knL', -.06 * d, .06 * d); add('knR', .06 * d, .06 * d);
      add('elL', .03 * d, -.1 * d); add('elR', -.03 * d, -.1 * d);
      add('wrL', .07 * d, -.24 * d); add('wrR', -.07 * d, -.24 * d);
    } else {
      const lift = -.05 * Math.abs(Math.sin(ph));
      pose.elL = [lerp(BASE.elL[0], -.22, d), lerp(BASE.elL[1], .12, d)];
      pose.elR = [lerp(BASE.elR[0], .22, d), lerp(BASE.elR[1], .12, d)];
      pose.wrL = [lerp(BASE.wrL[0], -.2, d), lerp(BASE.wrL[1], -.03, d)];
      pose.wrR = [lerp(BASE.wrR[0], .2, d), lerp(BASE.wrR[1], -.03, d)];
      add('knL', -.06 * d, 0); add('knR', .06 * d, 0);
      add('anL', -.12 * d, 0); add('anR', .12 * d, 0);
      for (const k of JOINTS) pose[k][1] += lift;
    }
    for (const k of ['nose', 'eyeL', 'eyeR', 'earL', 'earR']) pose[k][0] += lookX * .018;
  }

  let dpr = 1, W = 0, H = 0, fig = { x: 0, y: 0, h: 0 }, parts = [];
  function sizeCanvas() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = hero.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const v = visual.getBoundingClientRect(), hudEl = $('.hud').getBoundingClientRect();
    const avail = (hudEl.top - v.top) - 20;
    fig.h = clamp(Math.min(avail, v.height * .8), 180, 470);
    fig.x = v.left - r.left + v.width * (vw > 900 ? .42 : .5);
    fig.y = v.top - r.top + Math.max(10, (avail - fig.h) * .45);
    const n = Math.round(clamp(W * H / 16000, 34, 100));
    parts = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .18, vy: (Math.random() - .5) * .18, r: Math.random() * 1.3 + .4 }));
  }

  function drawHero() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const px = mouse.on ? (mouse.x / W - .5) * 14 : 0, py = mouse.on ? (mouse.y / H - .5) * 10 : 0;
    const P = {};
    for (const k of JOINTS) P[k] = [fig.x + px + pose[k][0] * fig.h, fig.y + py + pose[k][1] * fig.h];

    // particles
    const link = 110, link2 = link * link;
    for (const p of parts) {
      if (!reduce) {
        p.x += p.vx; p.y += p.vy;
        if (mouse.on) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y, dd = dx * dx + dy * dy;
          if (dd < 19600) { const f = (1 - Math.sqrt(dd) / 140) * .9; p.x += dx / 140 * f; p.y += dy / 140 * f; }
        }
        if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
      }
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < parts.length; i++) {
      const a = parts[i];
      for (let j = i + 1; j < parts.length; j++) {
        const b = parts[j], dx = a.x - b.x, dy = a.y - b.y, dd = dx * dx + dy * dy;
        if (dd < link2) { ctx.strokeStyle = `rgba(255,255,255,${(1 - dd / link2) * .07})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
      // particle → landmark "attention" lines
      for (const k of JOINTS) {
        const dx = a.x - P[k][0], dy = a.y - P[k][1], dd = dx * dx + dy * dy;
        if (dd < 14400) { ctx.strokeStyle = `rgba(94,234,212,${(1 - dd / 14400) * .28})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(P[k][0], P[k][1]); ctx.stroke(); }
      }
      if (mouse.on) {
        const dx = a.x - mouse.x, dy = a.y - mouse.y, dd = dx * dx + dy * dy;
        if (dd < 32400) { ctx.strokeStyle = `rgba(255,158,122,${(1 - dd / 32400) * .3})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke(); }
      }
      ctx.fillStyle = 'rgba(214,226,238,.45)';
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.283); ctx.fill();
    }

    // detection box with corner brackets
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const k of JOINTS) { x0 = Math.min(x0, P[k][0]); y0 = Math.min(y0, P[k][1]); x1 = Math.max(x1, P[k][0]); y1 = Math.max(y1, P[k][1]); }
    const pad = fig.h * .07; x0 -= pad; y0 -= pad * 1.3; x1 += pad; y1 += pad * .6;
    const c = Math.min(22, (x1 - x0) * .18);
    ctx.strokeStyle = 'rgba(94,234,212,.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + c); ctx.lineTo(x0, y0); ctx.lineTo(x0 + c, y0);
    ctx.moveTo(x1 - c, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + c);
    ctx.moveTo(x1, y1 - c); ctx.lineTo(x1, y1); ctx.lineTo(x1 - c, y1);
    ctx.moveTo(x0 + c, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - c);
    ctx.stroke();
    ctx.font = '500 10.5px "Geist Mono", ui-monospace, monospace';
    const tag = `person ${pMove.toFixed(2)} · ${move}`;
    const tw = ctx.measureText(tag).width + 12;
    ctx.fillStyle = 'rgba(94,234,212,.92)'; ctx.fillRect(x0, y0 - 20, tw, 17);
    ctx.fillStyle = '#03211d'; ctx.fillText(tag, x0 + 6, y0 - 8);

    // skeleton
    ctx.lineCap = 'round';
    const neck = [(P.shL[0] + P.shR[0]) / 2, (P.shL[1] + P.shR[1]) / 2];
    ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(94,234,212,.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(P.nose[0], P.nose[1]); ctx.lineTo(neck[0], neck[1]); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(94,234,212,.85)'; ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (const [a, b] of BONES) { ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]); }
    ctx.stroke();
    for (const k of JOINTS) {
      const small = /eye|ear|nose/.test(k);
      ctx.fillStyle = 'rgba(94,234,212,.18)';
      ctx.beginPath(); ctx.arc(P[k][0], P[k][1], small ? 5 : 8, 0, 6.283); ctx.fill();
      ctx.fillStyle = k === 'wrL' || k === 'wrR' || k === 'anL' || k === 'anR' ? '#ff9e7a' : '#eafffb';
      ctx.beginPath(); ctx.arc(P[k][0], P[k][1], small ? 2 : 3.2, 0, 6.283); ctx.fill();
    }
  }

  function setMove(m, silent) {
    if (!MOVES[m]) return;
    move = m; phase = 0; reps = 0; pMove = .2;
    hud.move.textContent = m; hud.reps.textContent = '0';
    chips.forEach(b => b.setAttribute('aria-checked', String(b.dataset.move === m)));
    if (reduce) { computePose(m, Math.PI * .6); pMove = .95; updateHud(); drawHero(); }
  }
  function updateHud() {
    hud.p.textContent = pMove.toFixed(2);
    hud.bar.style.setProperty('--pv', pMove.toFixed(3));
  }
  chips.forEach(b => b.addEventListener('click', () => setMove(b.dataset.move)));
  $('.hud-chips').addEventListener('keydown', e => {   // radio-group arrow keys
    if (!/Arrow(Left|Right|Up|Down)/.test(e.key)) return;
    e.preventDefault();
    const i = chips.indexOf(document.activeElement), n = chips.length;
    const j = (i + (/Right|Down/.test(e.key) ? 1 : n - 1)) % n;
    chips[j].focus(); setMove(chips[j].dataset.move);
  });

  hero.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const r = hero.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true;
  });
  hero.addEventListener('pointerleave', () => { mouse.on = false; });

  let heroReady = false;
  function heroInit() { sizeCanvas(); heroReady = true; computePose(move, reduce ? Math.PI * .6 : 0); if (reduce) { pMove = .95; updateHud(); } drawHero(); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(heroInit); else heroInit();

  if (!reduce) tickers.push((t, dt) => {
    if (!heroReady || !heroVisible || document.hidden) return;
    const prev = phase;
    phase += dt / MOVES[move] * Math.PI * 2;
    if (phase >= Math.PI * 2) {
      phase -= Math.PI * 2; reps++;
      hud.reps.textContent = reps;
      hud.reps.classList.remove('bump'); void hud.reps.offsetWidth; hud.reps.classList.add('bump');
    }
    const target = mouse.on ? clamp((mouse.x - fig.x) / (W * .5), -1, 1) : 0;
    lookX = lerp(lookX, target, .06);
    pTarget = .93 + Math.sin(t / 700) * .03 + Math.sin(t / 230) * .015;
    pMove = lerp(pMove, pTarget, .04);
    computePose(move, phase);
    updateHud();
    drawHero();
  });

  /* ---------------------------------------------------------- ticker */
  const track = $('.ticker-track');
  if (track) {
    track.append(...Array.from(track.children).map(n => n.cloneNode(true)));
    let tx = 0, tdir = -1, tickVis = false, vel = 0, lastSY = scrollY;
    new IntersectionObserver(([en]) => tickVis = en.isIntersecting).observe(track);
    if (!reduce) tickers.push((t, dt) => {
      const sy = scrollY, dv = sy - lastSY; lastSY = sy;
      if (dv) tdir = dv > 0 ? -1 : 1;
      vel = lerp(vel, Math.abs(dv), .1);
      if (!tickVis) return;
      tx += tdir * (0.04 * dt + vel * .5);
      const half = track.scrollWidth / 2;
      if (tx <= -half) tx += half; else if (tx > 0) tx -= half;
      track.style.transform = `translate3d(${tx}px,0,0)`;
    });
  }

  /* ------------------------------------------------ about: scrub text */
  const scrub = $('[data-scrub-text]');
  const words = [];
  (function split(node) {
    Array.from(node.childNodes).forEach(ch => {
      if (ch.nodeType === 3) {
        const frag = document.createDocumentFragment();
        ch.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(part); return; }
          const s = document.createElement('span'); s.className = 'w'; s.textContent = part; frag.append(s); words.push(s);
        });
        ch.replaceWith(frag);
      } else if (ch.nodeType === 1) split(ch);
    });
  })(scrub);
  const scrubWrap = $('.scrub-wrap');
  let scrubP = 0;
  if (!reduce) tasks.push({
    read() { const r = scrubWrap.getBoundingClientRect(); scrubP = clamp(-r.top / Math.max(1, r.height - vh), 0, 1); },
    write() {
      const n = words.length, lit = scrubP * n * 1.25;
      words.forEach((w, i) => w.style.setProperty('--o', (.14 + .86 * clamp(lit - i, 0, 1)).toFixed(3)));
    }
  });

  /* path line fills as the four steps come into view */
  const path = $('[data-path]'), pathLine = $('.path-line span');
  let pathP = 0;
  if (!reduce) tasks.push({
    read() { const r = path.getBoundingClientRect(); pathP = clamp((vh * .85 - r.top) / (vh * .45), 0, 1); },
    write() { pathLine.style.setProperty('--pl', pathP.toFixed(3)); }
  });

  /* --------------------------------------------- tilt, spot, magnetic */
  if (fine && !reduce) {
    $$('.tilt').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.classList.add('is-tilting');
        el.style.setProperty('--rx', ((.5 - y) * 7).toFixed(2) + 'deg');
        el.style.setProperty('--ry', ((x - .5) * 9).toFixed(2) + 'deg');
        el.style.setProperty('--mx', x * 100 + '%'); el.style.setProperty('--my', y * 100 + '%');
      });
      el.addEventListener('pointerleave', () => { el.classList.remove('is-tilting'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    });
    $$('.magnetic').forEach(el => {
      const inner = el.firstElementChild;
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        el.style.transition = 'transform .2s cubic-bezier(.16,1,.3,1)';
        el.style.transform = `translate(${dx * .28}px,${dy * .38}px)`;
        if (inner) inner.style.transform = `translate(${dx * .1}px,${dy * .12}px)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transition = 'transform .7s cubic-bezier(.16,1,.3,1)';
        el.style.transform = '';
        if (inner) { inner.style.transition = 'transform .7s cubic-bezier(.16,1,.3,1)'; inner.style.transform = ''; }
      });
    });
  }
  if (fine) $$('.spot').forEach(el => el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', e.clientX - r.left + 'px'); el.style.setProperty('--my', e.clientY - r.top + 'px');
  }));

  /* ---------------------------------------------------------- cursor */
  if (fine && !reduce) {
    root.classList.add('has-cursor');
    const cur = $('.cursor'), label = $('.cursor-label');
    let cx = -100, cy = -100, tx = -100, ty = -100;
    addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; cur.classList.remove('is-hidden'); }, { passive: true });
    document.addEventListener('pointerleave', () => cur.classList.add('is-hidden'));
    document.addEventListener('mouseover', e => {
      const t = e.target;
      const lab = t.closest('[data-cursor]');
      const zoom = t.closest('.zoom, .stage-imgs');
      const hov = t.closest('a, button, .eco-node, [role="tab"]');
      const text = lab ? lab.dataset.cursor : zoom ? 'Zoom' : '';
      label.textContent = text;
      cur.classList.toggle('has-label', !!text);
      cur.classList.toggle('is-hover', !!hov && !text);
      cur.classList.toggle('on-paper', !!t.closest('.paper'));
    });
    tickers.push(() => {
      cx = lerp(cx, tx, .2); cy = lerp(cy, ty, .2);
      cur.style.transform = `translate3d(${cx}px,${cy}px,0)`;
    });
  }

  /* -------------------------------------------------- AI ecosystem */
  const ECO = [
    { id: 'cv', label: 'Computer Vision', body: 'Pose estimation, sequence models and image classification with TensorFlow, MediaPipe and OpenCV.', tags: ['MediaPipe Pose', 'OpenCV', 'TensorFlow', 'YOLOv8', 'EfficientNetB0'], proof: 'Built <a href="#hakaya">Hakaya’s movement model</a> and <a href="#dermascan">DermaScan’s classifier</a>.' },
    { id: 'agents', label: 'AI Agents', body: 'In Hakaya, an AI agent writes a new story for each child, and the story only moves on when the webcam sees the child really move.', tags: ['LangGraph', 'OpenAI API'], proof: 'Capstone: <a href="#hakaya">Hakaya</a>, built in a team of four.' },
    { id: 'agentic', label: 'Agentic AI', body: 'Multi-agent pipelines with LangGraph and the OpenAI API, with rule-based checks around every LLM output.', tags: ['LangGraph', 'OpenAI API', 'Multi-agent pipelines'], proof: '<a href="#experience">SDA Agentic AI Bootcamp</a>: designing, building and evaluating LLM-based multi-agent systems.' },
    { id: 'llm', label: 'LLMs', body: 'Using LLMs inside products through the OpenAI API, with rule-based checks around every LLM output.', tags: ['OpenAI API', 'Generative AI with AWS'], proof: 'Hakaya’s story generation · Udacity: Introducing Generative AI with AWS.' },
    { id: 'rag', label: 'RAG', exploring: true, body: 'Retrieval-augmented generation: grounding LLM answers in real documents. It is on my learning path, and not yet part of a shipped project.', tags: [], proof: 'Next step after my LLM and agent work.' },
    { id: 'nlp', label: 'NLP', body: 'A conversational chatbot in Python that uses NLP techniques to simulate natural, real-world conversations.', tags: ['Python', 'NLP'], proof: '<a href="#projects">Chatbot</a>, May 2024.' },
    { id: 'gov', label: 'AI Governance', body: 'Reviewing AI use cases against policy, data protection and responsible-AI principles, and documenting guidelines for compliant, ethical AI deployment.', tags: ['AI use-case review', 'Responsible AI', 'Data protection'], proof: '<a href="#experience">6-month AI governance internship</a> at the Ministry of Human Resources.' },
    { id: 'product', label: 'AI Products', body: 'I turn AI models into products people can use: multi-role platforms, saved sessions, dashboards and live difficulty adaptation.', tags: ['React', 'FastAPI', 'PHP', 'MySQL'], proof: '<a href="#dermascan">DermaScan</a> (patient, doctor, admin) · <a href="#hakaya">Hakaya</a>’s parent dashboard.' }
  ];
  const LINKS = [['cv', 'product'], ['cv', 'agents'], ['agents', 'agentic'], ['agents', 'llm'], ['llm', 'rag'], ['llm', 'nlp'], ['gov', 'product'], ['agentic', 'llm']];
  const svgNS = 'http://www.w3.org/2000/svg';
  const eSvg = $('.eco-svg'), gNodes = $('.eco-nodes'), gSpokes = $('.eco-spokes'), gLinks = $('.eco-links');
  const list = $('.eco-list'), detail = $('.eco-detail');
  const mk = (tag, attrs, parent) => { const el = document.createElementNS(svgNS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); parent && parent.append(el); return el; };
  const R = 212;
  ECO.forEach((n, i) => {
    n.a = -Math.PI / 2 + i * (Math.PI * 2 / ECO.length);
    n.x = Math.cos(n.a) * R; n.y = Math.sin(n.a) * R;
    n.spoke = mk('line', { x1: 0, y1: 0 }, gSpokes);
    n.flow = mk('line', { x1: 0, y1: 0, class: 'flow' }, gSpokes);
    const g = mk('g', { class: 'eco-node' + (n.exploring ? ' exploring' : ''), tabindex: 0, role: 'button', 'aria-label': n.label + (n.exploring ? ' (learning)' : '') }, gNodes);
    mk('circle', { r: 30, class: 'hit' }, g);
    mk('circle', { r: 14, class: 'halo' }, g);
    mk('circle', { r: 9, class: 'dot' }, g);
    const below = Math.sin(n.a) > .2;
    const txt = mk('text', { y: below ? 32 : -20 }, g); txt.textContent = n.label;
    n.g = g;
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = n.label;
    if (n.exploring) b.classList.add('exploring');
    list.append(b); n.btn = b;
    const act = () => { stopAuto(); setEco(i); };
    g.addEventListener('click', act);
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
    if (fine) g.addEventListener('mouseenter', act);
    b.addEventListener('click', act);
  });
  LINKS.forEach(([a, b]) => { const A = ECO.find(n => n.id === a), B = ECO.find(n => n.id === b); const l = mk('line', {}, gLinks); l.dataset.a = a; l.dataset.b = b; (A.links ||= []).push(l); (B.links ||= []).push(l); A.near = (A.near || []).concat(B); B.near = (B.near || []).concat(A); });

  function placeEco(t) {
    ECO.forEach((n, i) => {
      const w = reduce ? 0 : Math.sin(t / 2600 + i * 1.7);
      const a = n.a + (reduce ? 0 : Math.sin(t / 4100 + i) * .035), r = R + w * 7;
      n.x = Math.cos(a) * r; n.y = Math.sin(a) * r;
      n.g.setAttribute('transform', `translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})`);
      n.spoke.setAttribute('x2', n.x.toFixed(1)); n.spoke.setAttribute('y2', n.y.toFixed(1));
      n.flow.setAttribute('x2', n.x.toFixed(1)); n.flow.setAttribute('y2', n.y.toFixed(1));
    });
    $$('line', gLinks).forEach(l => {
      const A = ECO.find(n => n.id === l.dataset.a), B = ECO.find(n => n.id === l.dataset.b);
      l.setAttribute('x1', A.x.toFixed(1)); l.setAttribute('y1', A.y.toFixed(1)); l.setAttribute('x2', B.x.toFixed(1)); l.setAttribute('y2', B.y.toFixed(1));
    });
  }
  const tagHTML = arr => arr.map(t => `<span>${t}</span>`).join('');
  let ecoIdx = -1, swapT;
  function setEco(i) {
    if (i === ecoIdx) return;
    ecoIdx = i; const n = ECO[i];
    eSvg.classList.add('has-active');
    ECO.forEach((m, j) => {
      m.g.classList.toggle('is-active', j === i);
      m.g.classList.toggle('is-linked', (n.near || []).includes(m));
      m.flow.classList.toggle('on', j === i);
      m.btn.setAttribute('aria-selected', String(j === i));
    });
    $$('line', gLinks).forEach(l => l.classList.toggle('on', l.dataset.a === n.id || l.dataset.b === n.id));
    detail.classList.add('swap');
    clearTimeout(swapT);
    swapT = setTimeout(() => {
      const st = $('.ed-status', detail);
      st.textContent = n.exploring ? 'Learning' : 'In my work';
      st.classList.toggle('exploring', !!n.exploring);
      $('.ed-title', detail).textContent = n.label;
      $('.ed-body', detail).textContent = n.body;
      const tg = $('.ed-tags', detail); tg.innerHTML = tagHTML(n.tags); tg.hidden = !n.tags.length;
      $('.ed-proof', detail).innerHTML = n.proof;
      detail.classList.remove('swap');
    }, reduce ? 0 : 200);
  }
  let autoT = null, ecoVis = false;
  function stopAuto() { clearInterval(autoT); autoT = null; }
  setEco(0);
  placeEco(0);
  new IntersectionObserver(([en]) => {
    ecoVis = en.isIntersecting;
    if (ecoVis && !autoT && autoT !== false && !reduce) autoT = setInterval(() => { if (!document.hidden) { const k = (ecoIdx + 1) % ECO.length; ecoIdx = -1; setEco(k); } }, 3600);
    if (!ecoVis && autoT) stopAuto();
  }, { threshold: .35 }).observe($('.eco-map'));
  const origStop = stopAuto;
  // once the visitor picks a node, never auto-advance again
  $('.eco').addEventListener('pointerdown', () => { origStop(); autoT = false; });
  $('.eco').addEventListener('keydown', () => { origStop(); autoT = false; });
  if (!reduce) tickers.push(t => { if (ecoVis) placeEco(t); });

  /* ------------------------------------- projects: horizontal track */
  const hs = $('[data-hscroll]'), hsTrack = $('.hs-track'), hsSticky = $('.hs-sticky');
  const hsCount = $('.hs-count'), hsBar = $('.hs-bar'), hsHint = $('.hs-hint');
  const cards = $$('.pcard', hsTrack);
  let hsOn = false, hsDist = 0, hsTop = 0, hsP = 0;
  function hsLayout() {
    hsOn = vw >= 1024 && !reduce;
    hs.classList.toggle('hs-on', hsOn);
    if (hsOn) {
      hsTrack.style.setProperty('--hx', '0px');
      hsDist = Math.max(0, hsTrack.scrollWidth - vw);
      hs.style.height = (vh + hsDist) + 'px';
      hsHint.textContent = 'scroll →';
    } else {
      hs.style.height = '';
      hsHint.textContent = 'swipe →';
    }
  }
  function hsSet(p, offset) {
    hsBar.style.setProperty('--hp', p.toFixed(3));
    // the counter follows whichever card sits closest to the viewport centre
    let idx = 1, best = Infinity;
    cards.forEach((c, i) => { const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - offset - vw / 2); if (d < best) { best = d; idx = i + 1; } });
    hsCount.textContent = String(idx).padStart(2, '0') + ' / ' + String(cards.length).padStart(2, '0');
  }
  tasks.push({
    read() { if (!hsOn) return; const r = hs.getBoundingClientRect(); hsTop = r.top + scrollY; hsP = clamp(-r.top / Math.max(1, hsDist), 0, 1); },
    write() { if (!hsOn) return; hsTrack.style.setProperty('--hx', (-hsP * hsDist).toFixed(1) + 'px'); hsSet(hsP, hsP * hsDist); }
  });
  hsTrack.addEventListener('scroll', () => { if (!hsOn) hsSet(hsTrack.scrollLeft / Math.max(1, hsTrack.scrollWidth - hsTrack.clientWidth), hsTrack.scrollLeft); }, { passive: true });
  // keyboard focus inside the pinned track: scroll the page to that card instead of letting the browser shift the clipped container
  hsTrack.addEventListener('focusin', e => {
    if (!hsOn) return;
    hsSticky.scrollLeft = 0;
    const card = e.target.closest('.pcard'); if (!card) return;
    const p = clamp((card.offsetLeft - vw * .25) / Math.max(1, hsDist), 0, 1);
    lenis ? lenis.scrollTo(hsTop + p * hsDist, { immediate: true }) : scrollTo(0, hsTop + p * hsDist);
  });

  /* ---------------------------------------------- case-study stories */
  $$('.story').forEach(story => {
    const steps = $$('.step', story), imgs = $$('.stage-imgs img', story), dots = $$('.stage-dots i', story);
    const frameEl = $('.stage-frame', story);
    let cur = -1;
    const set = i => {
      if (i === cur) return; cur = i;
      steps.forEach((s, j) => s.classList.toggle('is-active', j === i));
      imgs.forEach((im, j) => im.classList.toggle('is-on', j === i));
      dots.forEach((d, j) => d.classList.toggle('is-on', j === i));
    };
    const sio = new IntersectionObserver(entries => {
      for (const en of entries) if (en.isIntersecting) set(steps.indexOf(en.target));
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(s => sio.observe(s));
    set(0);
    story.classList.add('story-on');
    $('.stage-imgs', story).addEventListener('click', () => {
      const fig = $('.step-fig', steps[cur]);
      openLightbox($('img', fig));
    });
    if (!reduce) {
      let sp = 0;
      tasks.push({
        read() { if (vw < 1024) return; const r = story.getBoundingClientRect(); sp = clamp((vh - r.top) / (r.height + vh), 0, 1); },
        write() { if (vw < 1024) return; frameEl.style.setProperty('--sy', ((sp - .5) * -36).toFixed(1) + 'px'); }
      });
    }
  });

  /* -------------------------------------------------------- lightbox */
  const lb = $('.lightbox'), lbImg = $('img', lb), lbCap = $('.lb-cap', lb);
  function openLightbox(img) {
    if (!img || !lb.showModal) return;
    lbImg.src = img.currentSrc || img.src; lbImg.alt = img.alt;
    const fc = img.closest('figure') && $('figcaption', img.closest('figure'));
    lbCap.textContent = fc ? fc.textContent : img.alt;
    lb.showModal(); lenis && lenis.stop();
  }
  lb.addEventListener('close', () => lenis && lenis.start());
  $('.lb-close', lb).addEventListener('click', () => lb.close());
  lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });
  $$('.step-fig.zoom').forEach(f => {
    f.setAttribute('tabindex', '0'); f.setAttribute('role', 'button'); f.setAttribute('aria-label', 'Enlarge image: ' + $('img', f).alt);
    f.addEventListener('click', () => openLightbox($('img', f)));
    f.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox($('img', f)); } });
  });

  /* ------------------------------------------- paper curtain + timeline */
  const curtain = $('[data-curtain]');
  let cP = 1;
  if (!reduce) tasks.push({
    read() { const r = curtain.getBoundingClientRect(); cP = clamp(1 - r.top / vh, 0, 1); },
    write() {
      const e = 1 - Math.pow(1 - cP, 2);
      curtain.style.setProperty('--cx', ((1 - e) * Math.min(vw * .045, 56)).toFixed(1) + 'px');
      curtain.style.setProperty('--cr', ((1 - e) * 48).toFixed(1) + 'px');
    }
  });
  const tl = $('[data-timeline]'), tlLine = $('.tl-line span', tl), tlItems = $$('.tl-item', tl);
  let tlP = 1, tlH = 1;
  tasks.push({
    read() { const r = tl.getBoundingClientRect(); tlH = r.height; tlP = reduce ? 1 : clamp((vh * .62 - r.top) / r.height, 0, 1); },
    write() {
      tlLine.style.setProperty('--tl', tlP.toFixed(3));
      const reach = tlP * tlH;
      tlItems.forEach(it => it.classList.toggle('lit', it.offsetTop + 34 <= reach + 1));
    }
  });

  /* GPA ring value from data */
  $$('.gpa-ring').forEach(g => g.style.setProperty('--g', (parseFloat(g.dataset.gpa) / parseFloat(g.dataset.max)).toFixed(3)));

  /* ------------------------------------------------ contact letters */
  const ct = $('[data-letters]');
  if (ct) {
    const text = ct.textContent;
    ct.setAttribute('aria-label', text);
    ct.textContent = '';
    const chars = Array.from(text).map((c, i) => {
      const s = document.createElement('span');
      s.className = 'ch' + (c === ' ' ? ' sp' : ''); s.textContent = c === ' ' ? ' ' : c; s.setAttribute('aria-hidden', 'true');
      ct.append(s); return s;
    });
    if (fine && !reduce) {
      const sec = $('.contact');
      let mx = null;
      sec.addEventListener('pointermove', e => { mx = e.clientX; });
      sec.addEventListener('pointerleave', () => { mx = null; chars.forEach(s => { s.style.setProperty('--cy', '0'); s.style.setProperty('--cz', '0deg'); }); });
      tickers.push(() => {
        if (mx === null) return;
        chars.forEach(s => {
          const r = s.getBoundingClientRect(), dx = mx - (r.left + r.width / 2);
          const f = Math.max(0, 1 - Math.abs(dx) / 260);
          s.style.setProperty('--cy', (-f * f * 12).toFixed(1) + '%');
          s.style.setProperty('--cz', (dx > 0 ? -1 : 1) * f * 3 + 'deg');
        });
      });
    }
  }

  /* ---------------------------------------------------- copy email */
  const toastEl = $('.toast');
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }
  (function () {
    const b = $('#copy'), m = $('#mail'), label = $('span', b);
    b.addEventListener('click', () => {
      const ok = () => { label.textContent = 'Copied ✓'; b.classList.add('done'); toast('Email copied. Looking forward to hearing from you.'); setTimeout(() => { label.textContent = 'Copy email'; b.classList.remove('done'); }, 1800); };
      const sel = () => { const r = document.createRange(); r.selectNodeContents(m); const s = getSelection(); s.removeAllRanges(); s.addRange(r); label.textContent = 'Press Ctrl+C'; };
      try { navigator.clipboard.writeText(m.textContent).then(ok, sel); } catch (e) { sel(); }
    });
  })();

  /* ------------------------------------ easter egg: the logo counts reps */
  const logo = $('.logo'), logoReps = $('.logo-reps');
  let repN = 0, repT;
  logo.addEventListener('click', () => {
    repN++;
    logo.classList.remove('rep'); void logo.offsetWidth; logo.classList.add('rep');
    logoReps.textContent = repN + '/5'; logoReps.classList.add('show');
    clearTimeout(repT); repT = setTimeout(() => { repN = 0; logoReps.classList.remove('show'); }, 2200);
    if (repN >= 5) {
      repN = 0; logoReps.classList.remove('show');
      toast('5 / 5 squats. Hakaya would let you move on to the next chapter ✦');
      setMove('squat');
    }
  });

  console.log('%cHi, fellow engineer 👋', 'font:600 16px system-ui;color:#5eead4');
  console.log('This site is hand-built: vanilla JS, one rAF loop, no framework. The pose in the hero replays Hakaya’s landmark pipeline.\nSay hi: sadeemjuf@gmail.com');

  /* ------------------------------------------------------ resize + go */
  let rzT;
  function onResize() {
    vw = innerWidth; vh = innerHeight;
    if (vw > 900 && menuOpen) closeMenu();
    hsLayout(); sizeCanvas(); computePose(move, phase); drawHero();
    movePill(navLinks.find(a => a.classList.contains('is-active')));
    dirty = true;
  }
  addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(onResize, 120); });
  hsLayout();
  // the pinned track changes page height, so honour a deep link after layout
  if (location.hash.length > 1) { const el = document.getElementById(location.hash.slice(1)); if (el) setTimeout(() => scrollToEl(el, true), 60); }
  addEventListener('load', () => { dirty = true; if (hsOn) hsLayout(); });
  requestAnimationFrame(frame);
})();
