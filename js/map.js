/* =========================================================
   Карта: проекция, слои, шкала времени, маршрут, маркеры.
   ========================================================= */
const App = window.App = { T: TIME_START, k: 1, playing: false, speed: 1, mode: null };

/* ---------- Подготовка данных ---------- */
const EV = EVENTS.map(e => ({ ...e, t: D(e.date) })).sort((a, b) => a.t - b.t);
EV.forEach((e, i) => e.i = i);
const EVById = Object.fromEntries(EV.map(e => [e.id, e]));
ROUTE.forEach(r => r.t = D(r.d));
CAMPAIGNS.forEach(c => { c.t0 = D(c.from); c.t1 = D(c.to); });
TITLES.forEach(x => x.time = D(x.d));
REGIONS.forEach(r => { r.stT = r.st.map(([d, s]) => [D(d), s]); r.nmT = r.nm.map(([d, n]) => [D(d), n]); });
const BIRTH = D('1769-08-15');

function at(arr, t) { let v = arr[0][1]; for (const [tt, x] of arr) { if (tt <= t) v = x; else break; } return v; }
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
function dateOf(T) {
  const y = Math.floor(T), s = Date.UTC(y, 0, 1), e = Date.UTC(y + 1, 0, 1);
  const d = new Date(s + (T - y) * (e - s));
  return { y, m: d.getUTCMonth(), d: d.getUTCDate() };
}
const TYPE_NAMES = { battle: 'Сражение', naval: 'Морское сражение', siege: 'Осада', treaty: 'Мирный договор', politics: 'Историческое событие', exile: 'Ссылка' };
const RESULT_NAMES = { win: 'Победа Наполеона', loss: 'Поражение французов', draw: 'Исход не решён', event: 'Событие' };
const fmt = n => n.toLocaleString('ru-RU');

/* ---------- Иконки маркеров (в рамке 24×24, центр 12,12) ---------- */
const ICONS = {
  battle: { d: 'M6.5 6.5L17.5 17.5M17.5 6.5L6.5 17.5M5 14.5l4.5 4.5M14.5 19l4.5-4.5M5.5 5.5l1.5 .2M18.5 5.5l-1.5.2' },
  naval: { d: 'M12 6.5v12M8.5 9.5h7M6.5 14.5c.5 3 2.8 4.5 5.5 4.5s5-1.5 5.5-4.5M12 6.5a1.4 1.4 0 1 0 0-.1' },
  siege: { d: 'M7 19V10h2V7.5h2V10h2V7.5h2V10h2v9z', solid: true },
  treaty: { d: 'M8 6.5h8.5v9.5a2.5 2.5 0 0 1-2.5 2.5H7.5M8 6.5a1.6 1.6 0 0 0 0 3.2M7.5 18.5a1.5 1.5 0 0 1 0-3H14M10.5 10h4M10.5 12.5h3' },
  politics: { d: 'M5.5 16.5L6.5 8l3.5 3.5L12 6.5l2 5L17.5 8l1 8.5z', solid: true },
  exile: { d: 'M5 18.5c4-2.5 10-2.5 14 0M12 17.5V10M12 10c-1.5-2-4-2-5.5 0M12 10c1.5-2 4-2 5.5 0M12 10c-.5-2.5-2-3.5-3.8-3.5M12 10c.8-2.4 2.4-3.2 4-3' }
};

/* ---------- Текстура бумаги ---------- */
(function paper() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d'), img = g.createImageData(512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 200 + Math.random() * 55;
    img.data[i] = v; img.data[i + 1] = v * .96; img.data[i + 2] = v * .86; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.globalAlpha = .05; g.strokeStyle = '#6b4a20';
  for (let i = 0; i < 260; i++) { // волокна
    g.beginPath(); const x = Math.random() * 512, y = Math.random() * 512, a = Math.random() * Math.PI;
    g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * 20, y + Math.sin(a) * 20 + 6, x + Math.cos(a) * 40, y + Math.sin(a) * 40);
    g.lineWidth = Math.random() * 1.2; g.stroke();
  }
  g.globalAlpha = .07; g.fillStyle = '#7a5523';
  for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(Math.random() * 512, Math.random() * 512, Math.random() * 3, 0, 7); g.fill(); }
  document.getElementById('paper').style.backgroundImage = `url(${c.toDataURL()})`;
})();

/* ---------- Карта ---------- */
const svg = d3.select('#map');
let W = innerWidth, H = innerHeight;
const topo = WORLD_TOPO;
const geoms = topo.objects.countries.geometries;
const allFeat = topojson.feature(topo, topo.objects.countries).features;

/* Оставляем только страны рядом с Европой */
const keepNames = new Set();
allFeat.forEach(f => {
  const b = d3.geoBounds(f);
  const crosses = b[0][0] > b[1][0];
  if (crosses || (b[1][0] > -32 && b[0][0] < 70 && b[1][1] > 18 && b[0][1] < 75)) keepNames.add(f.properties.name);
});
const keepGeoms = geoms.filter(g => keepNames.has(g.properties.name));
const landFeat = topojson.merge(topo, keepGeoms);
const mergeNames = names => topojson.merge(topo, geoms.filter(g => names.includes(g.properties.name)));

const projection = d3.geoConicConformal().parallels([38, 58]).rotate([-16, 0]);
const EXTENT = { type: 'MultiPoint', coordinates: [[-15, 29], [-15, 62.5], [47, 62.5], [47, 29], [16, 63.6], [16, 28.3]] };
const path = d3.geoPath(projection);
const MQ = matchMedia('(max-width: 760px), (max-height: 500px)');
let TEXT = [[-40, -40], [W + 40, H + 40]];
function fitProjection() {
  App.mobile = MQ.matches;
  if (App.mobile && H > W) {
    // телефон вертикально: карта по высоте, шире экрана — её можно двигать пальцем
    projection.fitExtent([[0, 112], [100000, H - 150]], EXTENT);
    const c = projection([12, 49]), t = projection.translate();
    projection.translate([t[0] - (c[0] - W / 2), t[1]]);
  } else if (App.mobile) {
    projection.fitExtent([[8, 112], [W - 8, H - 150]], EXTENT);
  } else {
    projection.fitExtent([[14, 50], [W - 14, H - 96]], EXTENT);
  }
  const xs = EXTENT.coordinates.map(p => projection(p)[0]);
  const x0 = Math.min(0, Math.min(...xs)), x1 = Math.max(W, Math.max(...xs));
  projection.clipExtent([[x0 - 80, -80], [x1 + 80, H + 80]]);
  TEXT = [[x0 - 30, -40], [x1 + 30, H + 40]];
}
fitProjection();

function fixWinding(feature) {
  if (d3.geoArea(feature) > 2 * Math.PI) feature.geometry.coordinates.forEach(r => r.reverse());
  return feature;
}
REGIONS.forEach(r => {
  if (r.countries) r.feature = { type: 'Feature', geometry: mergeNames(r.countries) };
  else {
    const ring = r.poly.concat([r.poly[0]]);
    r.feature = fixWinding({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] } });
    r.withinFeature = { type: 'Feature', geometry: mergeNames(r.within) };
  }
});

const defs = svg.append('defs');
const hatch = defs.append('pattern').attr('id', 'hatch-war').attr('patternUnits', 'userSpaceOnUse').attr('width', 7).attr('height', 7).attr('patternTransform', 'rotate(45)');
hatch.append('rect').attr('width', 7).attr('height', 7).attr('fill', 'rgba(143,162,200,.55)');
hatch.append('rect').attr('width', 3).attr('height', 7).attr('fill', 'rgba(184,100,74,.8)');

const root = svg.append('g').attr('class', 'root');
const L = {};
['grat', 'ripple', 'land', 'regions', 'borders', 'coast', 'rivers', 'big', 'seas', 'compass', 'cities', 'minard', 'route', 'quiz', 'markers', 'hat'].forEach(n => L[n] = root.append('g').attr('class', 'l-' + n));

function drawStatic() {
  Object.values(L).forEach(g => g.selectAll('*').remove());
  defs.selectAll('clipPath').remove();

  L.grat.append('path').attr('class', 'graticule').attr('d', path(d3.geoGraticule().step([5, 5])()));

  const landD = path(landFeat);
  [[22, 'rgba(70,52,25,.14)'], [19, '#cec8a6'], [13, 'rgba(70,52,25,.18)'], [11, '#cec8a6'], [6.5, 'rgba(70,52,25,.24)'], [4.5, '#cec8a6']]
    .forEach(([w, c]) => L.ripple.append('path').attr('class', 'sea-ripple').attr('d', landD).attr('stroke', c).attr('stroke-width', w));
  L.land.append('path').attr('class', 'land').attr('d', landD);

  REGIONS.forEach(r => {
    let clip = null;
    if (r.withinFeature) {
      clip = 'clip-' + r.id;
      defs.append('clipPath').attr('id', clip).append('path').attr('d', path(r.withinFeature));
    }
    r.el = L.regions.append('path').attr('class', 'region st-N').attr('d', path(r.feature))
      .attr('clip-path', clip ? `url(#${clip})` : null).datum(r);
    r.cur = null;
  });
  L.regions.selectAll('.region')
    .on('mousemove', (ev, r) => showTip(ev, `<div class="tt-k">${STATUS[r.cur].name.toUpperCase()}</div><div class="tt-t">${at(r.nmT, App.T)}</div>`))
    .on('mouseleave', hideTip);

  L.borders.append('path').attr('class', 'borders').attr('d', path(topojson.mesh(topo, { type: 'GeometryCollection', geometries: keepGeoms }, (a, b) => a !== b)));
  L.coast.append('path').attr('class', 'coast').attr('d', landD);

  const line = d3.line().curve(d3.curveCatmullRom.alpha(.5));
  RIVERS.forEach(rv => {
    const pts = rv.p.map(p => projection(p));
    const id = 'rv-' + rv.n.replace(/\s/g, '');
    L.rivers.append('path').attr('class', 'river').attr('id', id).attr('d', line(pts));
  });
  RIVERS.forEach(rv => {
    const mid = rv.p[Math.floor(rv.p.length / 2)], pp = projection(mid);
    L.rivers.append('text').attr('class', 'river-label').attr('x', pp[0] + 4).attr('y', pp[1] - 4).text(rv.n);
  });

  SEAS.forEach(([n, lon, lat, s]) => {
    const [x, y] = projection([lon, lat]);
    L.seas.append('text').attr('class', 'sea-label').attr('x', x).attr('y', y).attr('font-size', s).text(n);
  });

  BIG_LABELS.forEach(b => {
    const [x, y] = projection([b.p[0], b.p[1]]);
    b.el = L.big.append('text').datum(b).attr('class', 'big-label').attr('x', x).attr('y', y).attr('font-size', b.s).text(b.n).style('opacity', 0);
  });

  drawCompass();

  CITIES.forEach(([n, lon, lat, tier]) => {
    const [x, y] = projection([lon, lat]);
    const g = L.cities.append('g').attr('class', `city tier-${tier} ${tier === 1 ? 'capital' : ''}`).attr('data-x', x).attr('data-y', y);
    if (tier < 4) g.append('circle').attr('r', tier === 1 ? 3.2 : 2.4);
    g.append('text').attr('x', 5).attr('y', -4).text(n).style('font-style', tier === 4 ? 'italic' : null);
  });

  ROUTE.forEach(r => r.xy = projection(r.p));
  L.route.append('g').attr('class', 'past');
  L.route.append('path').attr('class', 'route-glow');
  L.route.append('g').attr('class', 'now');

  drawMarkers();

  const hat = L.hat.append('g').attr('class', 'hat');
  hat.append('g').attr('class', 'bob').append('use').attr('href', '#hat-shape').attr('transform', 'translate(0,-12) scale(1.15)');
  App.hatEl = hat;

  App.lastRegionsT = null;
  render(App.T, true);
  applyZoomScale();
}

/* Крупные надписи государств */
const BIG_LABELS = [
  { n: 'ФРАНЦИЯ', p: [2.4, 46.9], s: 20, on: [['1793-01-01', '1804-05-18'], ['1814-04-06', '1815-03-20'], ['1815-06-22', '1816-01-01']] },
  { n: 'ФРАНЦУЗСКАЯ ИМПЕРИЯ', p: [2.6, 47.1], s: 17, on: [['1804-05-18', '1814-04-06'], ['1815-03-20', '1815-06-22']] },
  { n: 'РОССИЙСКАЯ ИМПЕРИЯ', p: [36, 52.6], s: 24, on: [['1793-01-01', '1816-01-01']] },
  { n: 'АВСТРИЯ', p: [16.8, 47.4], s: 14, on: [['1793-01-01', '1804-08-11']] },
  { n: 'АВСТРИЙСКАЯ ИМПЕРИЯ', p: [18.2, 47.2], s: 13, on: [['1804-08-11', '1816-01-01']] },
  { n: 'ПРУССИЯ', p: [15.2, 52.95], s: 13, on: [['1793-01-01', '1816-01-01']] },
  { n: 'ИСПАНИЯ', p: [-3.8, 39.6], s: 17, on: [['1793-01-01', '1816-01-01']] },
  { n: 'ВЕЛИКОБРИТАНИЯ', p: [-1.6, 52.6], s: 10, on: [['1793-01-01', '1816-01-01']] },
  { n: 'ОСМАНСКАЯ ИМПЕРИЯ', p: [32.5, 39.2], s: 16, on: [['1793-01-01', '1816-01-01']] },
  { n: 'ШВЕЦИЯ', p: [15.2, 61.0], s: 14, on: [['1793-01-01', '1816-01-01']] },
  { n: 'РЕЙНСКИЙ СОЮЗ', p: [10.4, 50.0], s: 11, on: [['1806-07-12', '1813-10-19']] },
  { n: 'ГЕРЦОГСТВО ВАРШАВСКОЕ', p: [19.7, 51.8], s: 9, on: [['1807-07-09', '1813-02-08']] },
  { n: 'КОРОЛЕВСТВО ИТАЛИЯ', p: [11.4, 44.75], s: 9, on: [['1805-03-17', '1814-04-20']] },
  { n: 'ЦИЗАЛЬПИНСКАЯ РЕСП.', p: [10.6, 44.75], s: 9, on: [['1797-06-29', '1799-04-28'], ['1800-06-14', '1802-01-26']] },
  { n: 'ИТАЛЬЯНСКАЯ РЕСП.', p: [10.8, 44.75], s: 9, on: [['1802-01-26', '1805-03-17']] },
  { n: 'НЕАПОЛЬ', p: [16.0, 40.55], s: 10, on: [['1793-01-01', '1816-01-01']] },
  { n: 'ЕГИПЕТ', p: [30.0, 29.3], s: 12, on: [['1793-01-01', '1816-01-01']] },
  { n: 'ПОРТУГАЛИЯ', p: [-8.0, 39.9], s: 8, on: [['1793-01-01', '1816-01-01']] },
  { n: 'ДАНИЯ', p: [9.2, 56.1], s: 8, on: [['1793-01-01', '1816-01-01']] },
  { n: 'ИЛЛИРИЯ', p: [15.0, 45.0], s: 8, on: [['1809-10-14', '1813-08-20']] }
];
BIG_LABELS.forEach(b => b.onT = b.on.map(([a, z]) => [D(a), D(z)]));

function drawCompass() {
  const [x, y] = projection([-11.5, 45.2]);
  const g = L.compass.append('g').attr('transform', `translate(${x},${y})`).attr('opacity', .75);
  const R = 46;
  g.append('circle').attr('r', R + 8).attr('fill', 'none').attr('stroke', '#5a4220').attr('stroke-width', 1);
  g.append('circle').attr('r', R + 4).attr('fill', 'none').attr('stroke', '#5a4220').attr('stroke-width', .5);
  for (let i = 0; i < 32; i++) {
    const a = i / 32 * Math.PI * 2;
    g.append('line').attr('x1', Math.sin(a) * (R + 4)).attr('y1', -Math.cos(a) * (R + 4)).attr('x2', Math.sin(a) * (R + 8)).attr('y2', -Math.cos(a) * (R + 8)).attr('stroke', '#5a4220').attr('stroke-width', .6);
  }
  const star = (n, r1, r2, rot, fillA, fillB) => {
    for (let i = 0; i < n; i++) {
      const a = rot + i / n * Math.PI * 2, a1 = a - Math.PI / n, a2 = a + Math.PI / n;
      const tip = [Math.sin(a) * r1, -Math.cos(a) * r1];
      const l = [Math.sin(a1) * r2, -Math.cos(a1) * r2], r = [Math.sin(a2) * r2, -Math.cos(a2) * r2];
      g.append('path').attr('d', `M0 0L${l}L${tip}Z`).attr('fill', fillA).attr('stroke', '#3a2914').attr('stroke-width', .4);
      g.append('path').attr('d', `M0 0L${tip}L${r}Z`).attr('fill', fillB).attr('stroke', '#3a2914').attr('stroke-width', .4);
    }
  };
  star(8, R * .62, R * .16, Math.PI / 8, '#efe2bf', '#8e7a55');
  star(4, R, R * .2, 0, '#3a2914', '#efe2bf');
  g.append('circle').attr('r', 3).attr('fill', '#8e2a1f');
  [['С', 0, -R - 15], ['Ю', 0, R + 23], ['З', -R - 19, 5], ['В', R + 19, 5]].forEach(([t, dx, dy]) =>
    g.append('text').attr('x', dx).attr('y', dy).attr('text-anchor', 'middle').attr('font-family', 'Playfair SC, Georgia').attr('font-size', 14).attr('font-weight', 700).attr('fill', '#3a2914').text(t));
}

function drawMarkers() {
  const sel = L.markers.selectAll('.marker').data(EV, d => d.id).join('g')
    .attr('class', d => `marker r-${d.result} t-${d.type}`)
    .each(function (d) {
      const [x, y] = projection(d.p);
      d.x = x + (d.nudge ? d.nudge[0] : 0); d.y = y + (d.nudge ? d.nudge[1] : 0);
      d.el = d3.select(this);
    })
    .on('click', (ev, d) => { ev.stopPropagation(); if (App.mode === 'quiz') return; openEvent(d.id); })
    .on('mousemove', (ev, d) => showTip(ev, `<div class="tt-k">${TYPE_NAMES[d.type].toUpperCase()} · ${RESULT_NAMES[d.result].toUpperCase()}</div><div class="tt-t">${d.title}</div><div class="tt-d">${d.dateLabel}</div><div class="tt-l">${d.lead}</div><div class="tt-h">Нажмите, чтобы открыть страницу события →</div>`))
    .on('mouseleave', hideTip);
  sel.selectAll('*').remove();
  sel.append('circle').attr('class', 'pulse').attr('r', 12);
  const inner = sel.append('g').attr('class', 'm-inner');
  inner.append('circle').attr('class', 'disc').attr('r', 11);
  inner.append('circle').attr('class', 'ring').attr('r', 12.6);
  inner.filter(d => d.russia).append('circle').attr('class', 'rus').attr('r', 15);
  inner.append('path').attr('class', d => 'icon' + (ICONS[d.type].solid ? ' solid' : '')).attr('d', d => ICONS[d.type].d).attr('transform', 'translate(-12,-12)');
  sel.append('text').attr('class', 'm-label').attr('x', 16).attr('y', 4).text(d => d.title);
  sel.filter(d => d.inset).append('text').attr('class', 'm-label').attr('x', -16).attr('y', 30).attr('text-anchor', 'start').style('opacity', 1).style('font-style', 'italic').style('font-size', '11px').text('↓ 7 000 км на юг');
}

/* ---------- Масштаб ---------- */
const zoom = d3.zoom().scaleExtent([1, 12]).translateExtent(TEXT).on('zoom', ev => {
  root.attr('transform', ev.transform);
  App.k = ev.transform.k;
  applyZoomScale();
  if (App.onZoom) App.onZoom(ev.transform);
});
svg.call(zoom).on('dblclick.zoom', null);

function applyZoomScale() {
  const k = App.k, inv = 1 / k;
  const ms = App.mobile ? inv * 0.72 : inv;
  L.markers.selectAll('.marker').attr('transform', d => `translate(${d.x},${d.y}) scale(${ms})`);
  L.cities.selectAll('.city').attr('transform', function () { return `translate(${this.dataset.x},${this.dataset.y}) scale(${inv})`; });
  L.rivers.selectAll('text').attr('font-size', 11 / k);
  L.rivers.selectAll('text').style('stroke-width', 2.5 / k + 'px');
  L.seas.selectAll('text').attr('transform', null).style('font-size', function () { return null; });
  L.seas.attr('opacity', k > 5 ? .5 : 1);
  L.big.selectAll('text').attr('font-size', b => b.s / Math.sqrt(k));
  if (App.hatXY) App.hatEl.attr('transform', `translate(${App.hatXY[0]},${App.hatXY[1]}) scale(${inv})`);
  document.body.classList.toggle('zoomed-in', k > 2.2);
}

function flyTo(lonlat, k = 3, dur = 1600) {
  const [x, y] = projection(lonlat);
  if (App.mobile) k = Math.max(1, k * 0.75);
  const cx = W / 2, cy = App.mobile ? H * 0.33 : H * 0.4;
  return svg.transition().duration(dur).ease(d3.easeCubicInOut)
    .call(zoom.transform, d3.zoomIdentity.translate(cx - k * x, cy - k * y).scale(k)).end().catch(() => { });
}
function flyBounds(lonlats, dur = 1600, rect) {
  rect = rect || [20, 110, W - 20, H - 140];
  const pts = lonlats.map(p => projection(p));
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = Math.min(12, (rect[2] - rect[0]) / (x1 - x0), (rect[3] - rect[1]) / (y1 - y0));
  const cx = (rect[0] + rect[2]) / 2, cy = (rect[1] + rect[3]) / 2;
  svg.transition().duration(dur).ease(d3.easeCubicInOut)
    .call(zoom.transform, d3.zoomIdentity.translate(cx - k * (x0 + x1) / 2, cy - k * (y0 + y1) / 2).scale(k));
  return k;
}
function resetZoom(dur = 1200) { return svg.transition().duration(dur).call(zoom.transform, d3.zoomIdentity).end().catch(() => { }); }
App.flyTo = flyTo; App.flyBounds = flyBounds; App.resetZoom = resetZoom;
App.svg = svg; App.zoom = zoom; App.projection = projection; App.L = L;

/* ---------- Подсказка ---------- */
const tip = document.getElementById('tooltip');
function showTip(ev, html) {
  if (App.mode === 'quiz') return;
  tip.innerHTML = html; tip.classList.add('show');
  const r = tip.getBoundingClientRect();
  let x = ev.clientX + 16, y = ev.clientY + 16;
  if (x + r.width > innerWidth - 10) x = ev.clientX - r.width - 16;
  if (y + r.height > innerHeight - 10) y = ev.clientY - r.height - 16;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}
function hideTip() { tip.classList.remove('show'); }
const TOUCH = matchMedia('(hover: none)').matches;
let tipTimer = null;
if (TOUCH) document.addEventListener('pointerdown', () => { clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 2200); }, true);

/* ---------- Площадь под контролем (рассчитана заранее, см. REGION_AREAS) ---------- */
let AREA = true;
REGIONS.forEach(r => r.area = REGION_AREAS[r.id] || 0);
// Французы реально контролировали лишь долину и дельту Нила
const egyptR = REGIONS.find(r => r.id === 'egypt'); if (egyptR) egyptR.area = 100000;

/* ---------- Рендер по времени ---------- */
function routeState(T) {
  let i = 0;
  while (i < ROUTE.length - 1 && ROUTE[i + 1].t <= T) i++;
  if (T < ROUTE[0].t) return { i: 0, xy: ROUTE[0].xy, moving: false };
  if (i >= ROUTE.length - 1) return { i: ROUTE.length - 1, xy: ROUTE[ROUTE.length - 1].xy, moving: false };
  const a = ROUTE[i], b = ROUTE[i + 1], f = (T - a.t) / (b.t - a.t);
  const moving = a.xy[0] !== b.xy[0] || a.xy[1] !== b.xy[1];
  return { i, f, xy: [a.xy[0] + (b.xy[0] - a.xy[0]) * f, a.xy[1] + (b.xy[1] - a.xy[1]) * f], moving, sea: b.sea };
}
App.routeState = routeState;

function campaignAt(T) { return CAMPAIGNS.find(c => T >= c.t0 && T <= c.t1); }

function render(T, force) {
  App.T = T;
  // регионы
  REGIONS.forEach(r => {
    const s = at(r.stT, T);
    if (s !== r.cur) { r.cur = s; r.el.attr('class', 'region st-' + s); }
  });
  // надписи
  BIG_LABELS.forEach(b => {
    const v = b.onT.some(([a, z]) => T >= a && T < z);
    if (v !== b.vis) { b.vis = v; b.el.style('opacity', v ? 1 : 0); }
  });
  // маршрут
  const rs = routeState(T), camp = campaignAt(T);
  const c0 = camp ? camp.t0 : T;
  const segsPast = [], segsNow = [];
  for (let j = 0; j < rs.i && j < ROUTE.length - 1; j++) {
    const a = ROUTE[j], b = ROUTE[j + 1];
    if (a.xy[0] === b.xy[0] && a.xy[1] === b.xy[1]) continue;
    (a.t >= c0 - 1e-6 ? segsNow : segsPast).push({ a: a.xy, b: b.xy, sea: !!b.sea });
  }
  if (rs.f > 0 && rs.moving) segsNow.push({ a: ROUTE[rs.i].xy, b: rs.xy, sea: !!rs.sea });
  const segPath = s => `M${s.a[0]},${s.a[1]}L${s.b[0]},${s.b[1]}`;
  L.route.select('.past').selectAll('path').data(segsPast).join('path')
    .attr('class', s => 'route-past' + (s.sea ? ' sea' : '')).attr('d', segPath);
  L.route.select('.now').selectAll('path').data(segsNow).join('path')
    .attr('class', s => 'route-now' + (s.sea ? ' sea' : '')).attr('d', segPath);
  L.route.select('.route-glow').attr('d', segsNow.filter(s => !s.sea).map(segPath).join(''));
  App.hatXY = rs.xy;
  App.hatEl.attr('transform', `translate(${rs.xy[0]},${rs.xy[1]}) scale(${1 / App.k})`);

  // маркеры
  L.markers.selectAll('.marker')
    .classed('future', d => d.t > T + 1e-6)
    .classed('now', d => T >= d.t && T - d.t < 0.12);

  updateInfo(T, camp);
  // шкала
  const f = (T - TIME_START) / (TIME_END - TIME_START);
  slider.value = f;
  fillEl.style.width = (f * 100) + '%';
  campEls.forEach(({ c, el }) => el.classList.toggle('cur', c === camp));
}
App.render = render;

const $ = id => document.getElementById(id);
function updateInfo(T, camp = campaignAt(T)) {
  const dt = dateOf(T);
  $('i-year').textContent = dt.y;
  $('i-date').textContent = `${dt.d} ${MONTHS[dt.m]}`;
  $('i-camp').textContent = camp ? camp.name : 'Между походами';
  $('i-title').textContent = titleAt(T);
  const age = Math.floor(T - BIRTH);
  $('i-age').textContent = `Возраст: ${age} ${plural(age, 'год', 'года', 'лет')}`;
  let w = 0, l = 0, d = 0;
  EV.forEach(e => {
    if (e.t > T || !['battle', 'siege', 'naval'].includes(e.type)) return;
    if (e.result === 'win') w++; else if (e.result === 'loss') l++; else if (e.result === 'draw') d++;
  });
  $('i-win').textContent = w; $('i-loss').textContent = l; $('i-draw').textContent = d;
  if (AREA) {
    const a = REGIONS.reduce((s, r) => s + ((r.cur === 'F' || r.cur === 'V') ? r.area : 0), 0);
    $('i-area').textContent = a > 0 ? `≈ ${(a / 1e6).toFixed(2).replace('.', ',')} млн км²` : 'нет';
    $('i-area-bar').style.width = Math.min(100, a / 1.6e6 * 100) + '%';
  }
}
function titleAt(T) { let s = TITLES[0].t; for (const x of TITLES) if (x.time <= T) s = x.t; return s; }
function plural(n, a, b, c) { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : (m >= 2 && m <= 4 && (h < 10 || h >= 20)) ? b : c; }

/* ---------- Шкала времени ---------- */
const slider = $('slider'), fillEl = $('tl-fill');
const pos = t => ((t - TIME_START) / (TIME_END - TIME_START) * 100) + '%';
const campEls = [];
function buildTimeline() {
  const yrs = $('tl-years');
  for (let y = 1794; y <= 1815; y++) {
    const s = document.createElement('span'); s.textContent = y; s.style.left = pos(y);
    if ([1796, 1799, 1805, 1807, 1812, 1815].includes(y)) s.className = 'major';
    yrs.appendChild(s);
  }
  const ce = $('tl-camps');
  CAMPAIGNS.forEach(c => {
    if (/Мирные|Консульство|Начало/.test(c.name)) return;
    const el = document.createElement('div'); el.className = 'tl-camp';
    el.style.left = pos(c.t0); el.style.width = `calc(${pos(c.t1)} - ${pos(c.t0)})`;
    el.title = c.name;
    el.onclick = () => { stop(); smoothTo(c.t0 + 0.0001); };
    ce.appendChild(el); campEls.push({ c, el });
  });
  const te = $('tl-ticks');
  EV.forEach(e => {
    const b = document.createElement('button'); b.className = 'tl-tick r-' + e.result;
    b.style.left = pos(e.t); b.title = `${e.title} — ${e.dateLabel}`;
    b.onclick = () => goEvent(e);
    te.appendChild(b);
  });
  slider.addEventListener('input', () => {
    stop();
    render(TIME_START + (+slider.value) * (TIME_END - TIME_START));
  });
}

/* Переход к событию на карте */
function goEvent(e, fly = true) {
  stop();
  smoothTo(e.t + 0.0005, 900);
  if (fly) flyTo(e.p, Math.max(App.k, 3), 1400);
  setTimeout(() => { e.el.classed('flash', false); void e.el.node().getBBox(); e.el.classed('flash', true); }, 900);
}
App.goEvent = goEvent;

let smoothTimer = null;
function smoothTo(T1, dur = 1000) {
  if (smoothTimer) smoothTimer.stop();
  const T0 = App.T;
  smoothTimer = d3.timer(el => {
    const f = Math.min(1, el / dur);
    render(T0 + (T1 - T0) * d3.easeCubicInOut(f));
    if (f >= 1) { smoothTimer.stop(); smoothTimer = null; }
  });
}
App.smoothTo = smoothTo;

/* ---------- Воспроизведение ---------- */
let raf = null, last = 0, holdUntil = 0;
const playBtn = $('t-play'), playIco = $('play-ico');
function play() {
  if (App.playing) return;
  if (App.T >= TIME_END - 0.001) render(TIME_START);
  App.playing = true; playBtn.classList.remove('hint');
  playIco.setAttribute('d', 'M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z');
  Sound.drum();
  last = performance.now();
  raf = requestAnimationFrame(tick);
}
function stop() {
  App.playing = false; cancelAnimationFrame(raf);
  playIco.setAttribute('d', 'M7 4.5v15l13-7.5z');
}
App.play = play; App.stop = stop;
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (now < holdUntil) { raf = requestAnimationFrame(tick); return; }
  const rs = routeState(App.T);
  const near = EV.some(e => e.t > App.T && e.t - App.T < 0.03);
  const rate = (rs.moving ? 0.085 : near ? 0.12 : 0.75) * App.speed;
  const T0 = App.T, T1 = Math.min(TIME_END, T0 + rate * dt);
  const crossed = EV.filter(e => e.t > T0 && e.t <= T1);
  render(T1);
  if (crossed.length) {
    const e = crossed[crossed.length - 1];
    toast(e);
    if (['battle', 'siege', 'naval'].includes(e.type)) Sound.boom(e.type === 'naval' ? .6 : 1);
    holdUntil = now + 2300 / App.speed;
  }
  if (T1 >= TIME_END) { stop(); return; }
  raf = requestAnimationFrame(tick);
}

const toastEl = $('toast');
let toastTimer = null;
function toast(e) {
  toastEl.innerHTML = `<div class="tk">ВОЕННЫЙ БЮЛЛЕТЕНЬ · ${TYPE_NAMES[e.type].toUpperCase()}</div><div class="tt">${e.title}</div><div class="td">${e.dateLabel}</div><div class="tl">${e.lead}</div>`;
  toastEl.onclick = () => openEvent(e.id);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3400 / Math.max(1, App.speed * .7));
  e.el.classed('flash', false); void e.el.node().getBBox(); e.el.classed('flash', true);
}
App.toast = toast;

function prevNext(dir) {
  stop();
  const T = App.T;
  const e = dir > 0 ? EV.find(x => x.t > T + 0.001) : [...EV].reverse().find(x => x.t < T - 0.001);
  if (e) { goEvent(e); toast(e); }
}

/* ---------- Кнопки ---------- */
playBtn.onclick = () => App.playing ? stop() : play();
$('t-prev').onclick = () => prevNext(-1);
$('t-next').onclick = () => prevNext(1);
const SPEEDS = [1, 2, 4, 0.5];
$('t-speed').onclick = () => { App.speed = SPEEDS[(SPEEDS.indexOf(App.speed) + 1) % SPEEDS.length]; $('t-speed').textContent = (App.speed === .5 ? '½' : App.speed) + '×'; };
$('z-in').onclick = () => svg.transition().duration(400).call(zoom.scaleBy, 1.6);
$('z-out').onclick = () => svg.transition().duration(400).call(zoom.scaleBy, 1 / 1.6);
$('b-home').onclick = () => resetZoom();
$('b-full').onclick = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); };
$('b-sound').onclick = () => {
  Sound.on = !Sound.on;
  $('snd-wave').style.display = Sound.on ? '' : 'none'; $('snd-off').style.display = Sound.on ? 'none' : '';
};
$('lg-toggle').onclick = () => { $('legend').classList.toggle('collapsed'); $('lg-arrow').textContent = $('legend').classList.contains('collapsed') ? '▸' : '▾'; };

document.addEventListener('keydown', ev => {
  if (document.getElementById('event-page').classList.contains('open') || ev.target.tagName === 'INPUT' && ev.key === ' ') {
    if (ev.key === 'Escape' && location.hash.startsWith('#/event')) closeEvent();
    if (!(ev.target.tagName === 'INPUT' && ev.key === ' ')) return;
  }
  if (ev.key === ' ') { ev.preventDefault(); App.playing ? stop() : play(); }
  else if (ev.key === 'ArrowRight') { ev.preventDefault(); prevNext(1); }
  else if (ev.key === 'ArrowLeft') { ev.preventDefault(); prevNext(-1); }
  else if (ev.key === 'Escape' && App.exitMode) App.exitMode();
});

let resizeT = null;
addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    W = innerWidth; H = innerHeight; fitProjection();
    zoom.translateExtent(TEXT);
    svg.call(zoom.transform, d3.zoomIdentity);
    drawStatic();
    if (App.onResize) App.onResize();
  }, 250);
});

/* ---------- Старт ---------- */
buildTimeline();
drawStatic();

$('sp-go').onclick = () => {
  Sound.unlock(); Sound.rustle();
  $('splash').classList.add('gone');
  if (location.hash.startsWith('#/event/')) return;
};
if (App.mobile) { $('legend').classList.add('collapsed'); $('lg-arrow').textContent = '▸'; }
