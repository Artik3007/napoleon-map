/* =========================================================
   Режимы: экскурсия, график Минара, викторина, летопись.
   ========================================================= */
const body = document.body;
const byId = id => document.getElementById(id);

function exitMode() {
  if (App.mode === 'tour') endTour();
  if (App.mode === 'minard') endMinard();
  if (App.mode === 'quiz') endQuiz();
  App.mode = null;
}
App.exitMode = exitMode;

/* ================= Экскурсия ================= */
const TOUR = ['toulon', 'lodi', 'arcole', 'pyramids', 'brumaire', 'marengo', 'coronation', 'trafalgar', 'austerlitz', 'jena', 'tilsit', 'somosierra', 'wagram',
  'neman', 'smolensk', 'borodino', 'moscow', 'maloyaroslavets', 'berezina', 'leipzig', 'paris1814', 'hundreddays', 'waterloo', 'sthelena'];
const tour = { i: 0, token: 0, paused: false, timer: null };
const tourCard = byId('tour-card');

function startTour() {
  exitMode();
  App.mode = 'tour'; byId('b-tour').classList.add('active'); body.classList.add('tour-mode');
  tour.paused = false;
  Sound.unlock();
  tourStep(0);
}
function endTour() {
  tour.token++; clearTimeout(tour.timer); Sound.hush();
  tourCard.classList.add('hidden'); byId('b-tour').classList.remove('active'); body.classList.remove('tour-mode');
}
function tourStep(i) {
  if (i < 0) i = 0;
  if (i >= TOUR.length) { tourFinish(); return; }
  const tk = ++tour.token; tour.i = i; clearTimeout(tour.timer); Sound.hush();
  const e = EVById[TOUR[i]];
  App.stop();
  App.smoothTo(e.t + 0.0005, 1700);
  App.flyTo(e.p, e.inset ? 2.4 : (e.p[0] > 30 ? 3.6 : 3.2), 1800);
  tourCard.classList.remove('hidden');
  tourCard.innerHTML = `<div class="tk"><span>ЭКСКУРСИЯ · ${i + 1} / ${TOUR.length}</span><span>${(e.campaign || TYPE_NAMES[e.type]).toUpperCase()}</span></div>
    <h3>${e.title}</h3><div class="td">${e.dateLabel} · ${e.place}</div><p>${e.lead}</p>
    <div class="row">
      <button class="pbtn" id="tr-prev" title="Назад">⏮</button>
      <button class="pbtn" id="tr-pause">${tour.paused ? '▶ Продолжить' : '❚❚ Пауза'}</button>
      <button class="pbtn" id="tr-next" title="Дальше">⏭</button>
      <span class="grow"></span>
      <button class="pbtn primary" id="tr-more">Подробнее →</button>
      <button class="pbtn" id="tr-exit" title="Завершить экскурсию">✕</button>
    </div>
    <div class="tour-progress"><i id="tr-bar"></i></div>`;
  byId('tr-prev').onclick = () => tourStep(tour.i - 1);
  byId('tr-next').onclick = () => tourStep(tour.i + 1);
  byId('tr-exit').onclick = () => { exitMode(); App.resetZoom(); };
  byId('tr-more').onclick = () => { pauseTour(); App.openEvent(e.id); };
  byId('tr-pause').onclick = () => tour.paused ? resumeTour() : pauseTour();
  setTimeout(() => {
    if (tk !== tour.token) return;
    e.el.classed('flash', false); void e.el.node().getBBox(); e.el.classed('flash', true);
    if (['battle', 'siege', 'naval'].includes(e.type)) Sound.boom(.8);
  }, 1500);
  if (tour.paused) return;
  setTimeout(() => {
    if (tk !== tour.token || tour.paused) return;
    narrate(e, tk);
  }, 1900);
}
function narrate(e, tk) {
  const text = `${e.title}. ${e.dateLabel.replace(/\(.*?\)/g, '')}. ${e.lead}`;
  const bar = byId('tr-bar');
  const startBar = ms => { if (!bar) return; bar.style.transition = 'none'; bar.style.width = '0'; void bar.offsetWidth; bar.style.transition = `width ${ms}ms linear`; bar.style.width = '100%'; };
  const spoke = Sound.speak(text, ok => {
    if (tk !== tour.token || tour.paused) return;
    tour.timer = setTimeout(() => { if (tk === tour.token && !tour.paused) tourStep(tour.i + 1); }, ok ? 1400 : 6000);
  });
  if (spoke) startBar(Math.max(5000, text.length * 65));
  else { startBar(9000); tour.timer = setTimeout(() => { if (tk === tour.token && !tour.paused) tourStep(tour.i + 1); }, 9000); }
}
function pauseTour() {
  if (App.mode !== 'tour') return;
  tour.paused = true; tour.token++; clearTimeout(tour.timer); Sound.hush();
  const b = byId('tr-pause'); if (b) b.textContent = '▶ Продолжить';
  const bar = byId('tr-bar'); if (bar) { bar.style.transition = 'none'; }
}
function resumeTour() { tour.paused = false; tourStep(tour.i); }
App.pauseTour = pauseTour;
function tourFinish() {
  tour.token++;
  App.resetZoom();
  tourCard.innerHTML = `<div class="tk"><span>ЭКСКУРСИЯ ЗАВЕРШЕНА</span><span>1793–1821</span></div>
    <h3>«Что за роман — моя жизнь!»</h3><p>За 20 лет войн Наполеон дал около 60 сражений и изменил карту Европы. Но его империя рухнула после похода в Россию 1812 года. Попробуйте проверить свои знания в викторине!</p>
    <div class="row"><span class="grow"></span><button class="pbtn primary" id="tr-quiz">Начать викторину</button><button class="pbtn" id="tr-exit">Закрыть</button></div>`;
  Sound.speak('Экскурсия завершена. Попробуйте проверить свои знания в викторине!');
  byId('tr-quiz').onclick = () => startQuiz();
  byId('tr-exit').onclick = () => exitMode();
}

/* ================= График Минара ================= */
const minardPanel = byId('minard-panel');
let minardTimer = null;
function startMinard() {
  exitMode();
  App.mode = 'minard'; body.classList.add('minard-mode'); byId('b-minard').classList.add('active');
  App.stop();
  App.smoothTo(D('1812-12-14'), 1000);
  const k = App.flyBounds([[23.4, 53.9], [37.9, 56.0]], 1600, App.mobile ? [30, 215, innerWidth - 45, innerHeight - 340] : [340, 120, innerWidth - 250, innerHeight - 350]);
  const proj = App.projection;
  const adv = MINARD_ADVANCE.map(d => ({ ...d, xy: proj(d.p) }));
  const ret = MINARD_RETREAT.map(d => ({ ...d, xy: proj(d.p) }));
  const scale = ((App.mobile ? 36 : 64) / k) / 422000;
  const g = App.L.minard; g.selectAll('*').remove();
  const advP = g.append('path').attr('class', 'minard-adv');
  const retP = g.append('path').attr('class', 'minard-ret');
  const lbls = g.append('g');
  adv.concat(ret).forEach(d => d.shown = false);

  minardPanel.classList.remove('hidden');
  minardPanel.innerHTML = `<svg id="temp-svg"></svg>
    <button class="pbtn minard-close" id="mn-close">✕ Закрыть</button>
    <button class="pbtn minard-close" id="mn-replay" style="right:130px">↻ Повторить</button>`;
  byId('mn-close').onclick = () => { exitMode(); App.resetZoom(); };
  byId('mn-replay').onclick = () => startMinard();

  // карточка с пояснением
  let card = byId('minard-card');
  if (!card) { card = document.createElement('aside'); card.id = 'minard-card'; card.className = 'panel info'; byId('app').appendChild(card); }
  card.style.display = '';
  card.innerHTML = `<div class="camp" style="margin:0">ШАРЛЬ ЖОЗЕФ МИНАР, 1869</div>
    <div style="font-family:var(--display);font-weight:900;font-size:24px;line-height:1.1;margin:4px 0 6px">Гибель Великой армии в России</div>
    <div style="font-size:15.5px;line-height:1.35">Ширина полосы показывает численность армии. <b>Светлая</b> — наступление на Москву, <b>чёрная</b> — отступление. Внизу — мороз на обратном пути.</div>
    <hr><div style="font-size:15.5px;line-height:1.35">Из <b>422 000</b> солдат, перешедших Неман, назад вернулись лишь около <b>10 000</b>.</div>
    <div style="font-size:13.5px;font-style:italic;color:var(--ink-soft);margin-top:8px;line-height:1.25">Историк дизайна Эдвард Тафти назвал этот график «возможно, лучшим статистическим рисунком из когда-либо созданных».</div>`;

  const bandPath = (pts, frac, dir) => {
    if (frac <= 0) return '';
    const seg = []; let L = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].xy[0] - pts[i - 1].xy[0], pts[i].xy[1] - pts[i - 1].xy[1]); seg.push(d); L += d; }
    let target = frac * L, out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      if (target >= seg[i - 1]) { out.push(pts[i]); target -= seg[i - 1]; }
      else {
        const f = target / seg[i - 1], a = pts[i - 1], b = pts[i];
        out.push({ xy: [a.xy[0] + (b.xy[0] - a.xy[0]) * f, a.xy[1] + (b.xy[1] - a.xy[1]) * f], n: a.n + (b.n - a.n) * f });
        break;
      }
    }
    if (out.length < 2) return '';
    const e1 = [], e2 = [];
    out.forEach((p, i) => {
      const a = out[Math.max(0, i - 1)].xy, b = out[Math.min(out.length - 1, i + 1)].xy;
      let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      let nx = -ty, ny = tx; if (ny < 0) { nx = -nx; ny = -ny; } // нормаль «на юг»
      const w = p.n * scale;
      e1.push(p.xy);
      e2.push([p.xy[0] + nx * w * dir, p.xy[1] + ny * w * dir]);
    });
    return 'M' + e1.map(p => p.join(',')).join('L') + 'L' + e2.reverse().map(p => p.join(',')).join('L') + 'Z';
  };
  const showLbl = (d, isRet, i) => {
    if (d.shown) return; d.shown = true;
    const off = isRet ? 16 / k + d.n * scale : -7 / k - d.n * scale;
    const t = lbls.append('g').attr('transform', `translate(${d.xy[0]},${d.xy[1] + off})`).style('opacity', 0);
    t.append('text').attr('class', 'minard-num' + (isRet ? ' ret' : '')).attr('text-anchor', 'middle').attr('font-size', (App.mobile ? 10 : 13) / k).style('stroke-width', 3 / k + 'px').text(fmt(d.n));
    if (d.c && !App.mobile && !(isRet && ['Москва'].includes(d.c))) t.append('text').attr('class', 'minard-city').attr('text-anchor', 'middle').attr('y', (isRet ? 12 : -13) / k).attr('font-size', 11 / k).text(d.c);
    t.transition().duration(400).style('opacity', 1);
  };
  if (minardTimer) minardTimer.stop();
  const DUR = 9000;
  setTimeout(() => {
    if (App.mode !== 'minard') return;
    minardTimer = d3.timer(el => {
      const f = Math.min(1, el / DUR);
      const fa = Math.min(1, f / .48), fr = Math.max(0, (f - .52) / .48);
      advP.attr('d', bandPath(adv, fa, -1));
      retP.attr('d', bandPath(ret, fr, 1));
      adv.forEach((d, i) => { if (fa >= i / (adv.length - 1) - 1e-6) showLbl(d, false, i); });
      ret.forEach((d, i) => { if (fr > 0 && fr >= i / (ret.length - 1) - 1e-6) showLbl(d, true, i); });
      drawTemps(fr);
      if (f >= 1) minardTimer.stop();
    });
  }, 1700);
  App.onZoom = () => drawTemps(App.minardFr ?? 0);
  drawTemps(0);
}
function drawTemps(fr) {
  App.minardFr = fr;
  const s = d3.select('#temp-svg'); if (s.empty()) return;
  s.selectAll('*').remove();
  const t = d3.zoomTransform(App.svg.node());
  const box = minardPanel.getBoundingClientRect();
  const y = v => App.mobile ? 48 + (-v) / 38 * 78 : 58 + (-v) / 38 * 110;
  const pts = MINARD_TEMP.map(d => ({ ...d, x: t.applyX(App.projection([d.lon, 54.5])[0]) - box.left, y: y(d.t) }));
  s.append('text').attr('x', 18).attr('y', 26).attr('font-family', 'Playfair SC, Georgia').attr('font-size', 15).attr('font-weight', 700).attr('fill', '#3a2914').attr('font-size', App.mobile ? 12 : 15).text(App.mobile ? 'МОРОЗ ПРИ ОТСТУПЛЕНИИ, °C' : 'ТЕМПЕРАТУРА ВОЗДУХА ПРИ ОТСТУПЛЕНИИ, °C');
  [0, -10, -20, -30].forEach(v => {
    s.append('line').attr('x1', 18).attr('x2', box.width - 18).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', 'rgba(58,41,20,.15)');
    s.append('text').attr('x', 18).attr('y', y(v) - 3).attr('font-size', 12).attr('fill', '#6b5434').text(v + '°');
  });
  const n = Math.round(fr * (pts.length - 1) + .4);
  const vis = pts.slice(0, Math.max(0, n + (fr > 0 ? 1 : 0)));
  if (!vis.length) return;
  vis.forEach(p => s.append('line').attr('class', 'temp-drop').attr('x1', p.x).attr('x2', p.x).attr('y1', -box.top + 80).attr('y2', p.y));
  s.append('path').attr('class', 'temp-line').attr('d', d3.line().x(p => p.x).y(p => p.y)(vis));
  vis.forEach(p => {
    s.append('circle').attr('class', 'temp-dot').attr('cx', p.x).attr('cy', p.y).attr('r', 3.5);
    s.append('text').attr('class', 'temp-lbl').attr('x', p.x + 6).attr('y', p.y + 16).text(App.mobile ? `${p.t}°` : `${p.t}° · ${p.d}`);
  });
}
function endMinard() {
  if (minardTimer) minardTimer.stop();
  App.L.minard.selectAll('*').remove();
  minardPanel.classList.add('hidden');
  const c = byId('minard-card'); if (c) c.style.display = 'none';
  body.classList.remove('minard-mode'); byId('b-minard').classList.remove('active');
  App.onZoom = null;
}

/* ================= Викторина ================= */
const quizPanel = byId('quiz-panel');
const quiz = { qs: [], i: 0, score: 0, max: 0, wait: false };
function startQuiz() {
  exitMode();
  App.mode = 'quiz'; body.classList.add('quiz-mode'); byId('b-quiz').classList.add('active');
  App.stop(); App.resetZoom(900);
  quiz.qs = d3.shuffle(QUIZ.slice()).slice(0, 10);
  quiz.i = 0; quiz.score = 0; quiz.max = quiz.qs.length * 100;
  quizPanel.classList.remove('hidden');
  askQuiz();
}
function askQuiz() {
  App.L.quiz.selectAll('*').remove();
  const q = quiz.qs[quiz.i];
  quiz.wait = q.kind === 'map';
  quizPanel.innerHTML = `<div class="qk"><span>ВОПРОС ${quiz.i + 1} ИЗ ${quiz.qs.length}</span><span>ОЧКИ: ${quiz.score}</span></div>
    <h3>${q.q}</h3>
    ${q.kind === 'choice' ? `<div class="quiz-choices">${q.a.map((a, i) => `<button data-i="${i}">${a}</button>`).join('')}</div>` : ''}
    <div class="quiz-res" id="qz-res">${q.kind === 'map' ? 'Нажмите на карте место, где, по-вашему, это произошло. Чем ближе — тем больше очков.' : ''}</div>
    <div class="row"><button class="pbtn" id="qz-exit">Выйти</button><button class="pbtn primary hidden" id="qz-next">Дальше →</button></div>`;
  byId('qz-exit').onclick = () => exitMode();
  byId('qz-next').onclick = () => { quiz.i++; quiz.i >= quiz.qs.length ? quizFinal() : askQuiz(); };
  quizPanel.querySelectorAll('.quiz-choices button').forEach(b => b.onclick = () => {
    if (byId('qz-next').classList.contains('hidden') === false) return;
    const i = +b.dataset.i, ok = i === q.ok;
    quizPanel.querySelectorAll('.quiz-choices button').forEach(x => { if (+x.dataset.i === q.ok) x.classList.add('ok'); });
    if (!ok) b.classList.add('bad');
    if (ok) quiz.score += 100;
    Sound.bell(ok);
    byId('qz-res').innerHTML = ok ? '<b>Верно!</b> +100 очков' : `<b>Неверно.</b> Правильный ответ: ${q.a[q.ok]}`;
    byId('qz-next').classList.remove('hidden');
  });
}
App.svg.on('click.quiz', ev => {
  if (App.mode !== 'quiz' || !quiz.wait) return;
  const q = quiz.qs[quiz.i], e = EVById[q.id];
  const pt = d3.pointer(ev, App.L.quiz.node());
  const ll = App.projection.invert(pt);
  if (!ll) return;
  quiz.wait = false;
  const km = Math.round(d3.geoDistance(ll, e.p) * 6371);
  const pts = km <= 75 ? 100 : Math.max(0, Math.round(100 - (km - 75) / 7));
  quiz.score += pts;
  const k = App.k, g = App.L.quiz, txy = App.projection(e.p);
  g.append('line').attr('class', 'q-line').attr('x1', pt[0]).attr('y1', pt[1]).attr('x2', pt[0]).attr('y2', pt[1])
    .transition().duration(700).attr('x2', txy[0]).attr('y2', txy[1]);
  g.append('circle').attr('class', 'q-click').attr('cx', pt[0]).attr('cy', pt[1]).attr('r', 6 / k);
  g.append('circle').attr('class', 'q-true').attr('cx', txy[0]).attr('cy', txy[1]).attr('r', 0).transition().delay(600).duration(400).attr('r', 9 / k);
  g.append('text').attr('class', 'q-lbl').attr('x', txy[0] + 12 / k).attr('y', txy[1] + 5 / k).attr('font-size', 15 / k).style('stroke-width', 3.5 / k + 'px').text(e.title).style('opacity', 0).transition().delay(700).style('opacity', 1);
  Sound.bell(pts >= 50);
  byId('qz-res').innerHTML = `${pts >= 85 ? '<b>Превосходно!</b>' : pts >= 50 ? '<b>Неплохо!</b>' : pts > 0 ? '<b>Далековато.</b>' : '<b>Мимо.</b>'} Ошибка — ${fmt(km)} км. +${pts} очков. <br>${e.title} — ${e.place}.`;
  byId('qz-next').classList.remove('hidden');
});
function quizFinal() {
  App.L.quiz.selectAll('*').remove();
  const pct = quiz.score / quiz.max;
  const rank = pct >= .9 ? 'Маршал Империи' : pct >= .7 ? 'Генерал' : pct >= .5 ? 'Полковник' : pct >= .3 ? 'Капитан' : 'Новобранец';
  quizPanel.innerHTML = `<div class="quiz-final"><div class="qk" style="justify-content:center">ИТОГ ВИКТОРИНЫ</div>
    <div class="score">Вы набрали <b>${quiz.score}</b> из ${quiz.max} очков</div>
    <div>Ваше звание:</div><div class="rank">${rank}</div>
    <div class="row" style="justify-content:center"><button class="pbtn primary" id="qz-again">Пройти ещё раз</button><button class="pbtn" id="qz-exit">На карту</button></div></div>`;
  if (pct >= .5) { Sound.drum(); setTimeout(() => Sound.boom(.6), 600); }
  byId('qz-again').onclick = () => startQuiz();
  byId('qz-exit').onclick = () => exitMode();
}
function endQuiz() {
  App.L.quiz.selectAll('*').remove();
  quizPanel.classList.add('hidden');
  body.classList.remove('quiz-mode'); byId('b-quiz').classList.remove('active');
}

/* ================= Летопись ================= */
const chron = byId('chronicle'), sheet = byId('chron-sheet');
let chronFilter = 'all';
function renderChron() {
  const F = {
    all: () => true, rus: e => e.russia, battles: e => ['battle', 'siege', 'naval'].includes(e.type),
    win: e => e.result === 'win', loss: e => e.result === 'loss'
  };
  const list = EV.filter(F[chronFilter]);
  const groups = [];
  list.forEach(e => {
    const key = e.campaign || campaignAt(e.t)?.name || 'Между походами';
    if (!groups.length || groups[groups.length - 1].key !== key) groups.push({ key, items: [] });
    groups[groups.length - 1].items.push(e);
  });
  const dot = e => `<svg viewBox="-16 -16 32 32" width="34" height="34"><circle r="13" fill="var(--${e.result})" stroke="#f6ebcc" stroke-width="1.6"/>${e.russia ? '<circle r="15" fill="none" stroke="#2c6e3f" stroke-width="1.6" stroke-dasharray="2.2 1.6"/>' : ''}<path d="${ICONS[e.type].d}" transform="translate(-12,-12)" fill="${ICONS[e.type].solid ? '#f6ebcc' : 'none'}" stroke="${ICONS[e.type].solid ? 'none' : '#f6ebcc'}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  sheet.innerHTML = `<button class="close-x" id="ch-close">×</button>
    <div class="chron-head"><h2>Летопись событий</h2><p>${list.length} ${plural(list.length, 'событие', 'события', 'событий')} · нажмите, чтобы открыть страницу</p></div>
    <div class="filters">${[['all', 'Все'], ['rus', 'С участием России'], ['battles', 'Сражения'], ['win', 'Победы'], ['loss', 'Поражения']].map(([k, n]) => `<button data-f="${k}" class="${k === chronFilter ? 'on' : ''}">${n}</button>`).join('')}</div>
    ${groups.map(g => `<div class="chron-group"><h3>${g.key.toUpperCase()}</h3>${g.items.map(e => `<div class="chron-item" data-id="${e.id}">
      <div class="cd">${e.dateLabel.replace(/\s*\(.*?\)/, '')}</div>${dot(e)}<div><div class="ct">${e.title}${e.russia ? '<span class="rus-badge">РОССИЯ</span>' : ''}</div><div class="cl">${e.lead}</div></div></div>`).join('')}</div>`).join('')}`;
  byId('ch-close').onclick = closeChron;
  sheet.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { chronFilter = b.dataset.f; renderChron(); });
  sheet.querySelectorAll('.chron-item').forEach(it => it.onclick = () => { closeChron(); App.openEvent(it.dataset.id); });
}
function openChron() { renderChron(); chron.classList.add('open'); Sound.rustle(); }
function closeChron() { chron.classList.remove('open'); }
chron.addEventListener('click', ev => { if (ev.target === chron) closeChron(); });
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && chron.classList.contains('open')) closeChron(); });

/* ================= Кнопки ================= */
byId('b-tour').onclick = () => App.mode === 'tour' ? (exitMode(), App.resetZoom()) : startTour();
byId('b-minard').onclick = () => App.mode === 'minard' ? (exitMode(), App.resetZoom()) : startMinard();
byId('b-quiz').onclick = () => App.mode === 'quiz' ? exitMode() : startQuiz();
byId('b-chron').onclick = openChron;
