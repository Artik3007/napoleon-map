/* =========================================================
   Полноценная страница события: #/event/<id>
   ========================================================= */
const pageEl = document.getElementById('event-page');

function openEvent(id) { location.hash = '#/event/' + id; }
function closeEvent() { location.hash = '#/'; }
App.openEvent = openEvent;

/* Число из строки вида «около 12 000–20 000 (…)», «96 000 + 27 000», «2 000 убитых, 17 000 пленных» */
function parseForce(s) {
  if (!s || s === '—') return null;
  s = s.split(/\(|в т\. ч\.|из них/)[0];
  const re = /(\d{1,3}(?:[\s ]\d{3})*)(?:\s*[–-]\s*(\d{1,3}(?:[\s ]\d{3})*))?/g;
  let m, sum = 0, found = false;
  while ((m = re.exec(s))) {
    const after = s.slice(re.lastIndex, re.lastIndex + 12);
    if (/^\s*(оруд|корабл|линейн|эскадр)/.test(after)) continue;
    const a = +m[1].replace(/\s/g, ''), b = m[2] ? +m[2].replace(/\s/g, '') : a;
    sum += (a + b) / 2; found = true;
  }
  return found && sum >= 100 ? sum : null;
}

function miniMap(e) {
  const w = 360, h = 240;
  const pr = d3.geoConicConformal().parallels([38, 58]).rotate([-16, 0]).fitExtent([[4, 4], [w - 4, h - 4]], EXTENT);
  const p = d3.geoPath(pr);
  let s = `<svg class="mini" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;
  s += `<path d="${p(landFeat)}" fill="#efe2bf" stroke="#5a4220" stroke-width=".6"/>`;
  const colors = { F: 'rgba(79,99,144,.62)', V: 'rgba(143,162,200,.6)', A: 'rgba(185,176,106,.6)', W: 'rgba(160,120,130,.55)', E: 'rgba(184,100,74,.5)' };
  REGIONS.forEach(r => {
    const st = at(r.stT, e.t);
    if (st === 'N') return;
    if (r.withinFeature) s += `<clipPath id="mc-${r.id}"><path d="${p(r.withinFeature)}"/></clipPath>`;
    s += `<path d="${p(r.feature)}" fill="${colors[st]}" ${r.withinFeature ? `clip-path="url(#mc-${r.id})"` : ''}/>`;
  });
  s += `<path d="${p(landFeat)}" fill="none" stroke="#5a4220" stroke-width=".6"/>`;
  const [x, y] = pr(e.p);
  s += `<circle cx="${x}" cy="${y}" r="14" fill="none" stroke="#8e2a1f" stroke-width="1.5"><animate attributeName="r" values="6;20;6" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0;1" dur="2s" repeatCount="indefinite"/></circle>`;
  s += `<circle cx="${x}" cy="${y}" r="5" fill="#8e2a1f" stroke="#fff" stroke-width="1.5"/>`;
  s += '</svg>';
  return s;
}

function ornament() {
  return `<svg class="ep-orn" viewBox="0 0 300 14"><path d="M0 7h120M180 7h120" stroke="#6b5434" stroke-width="1"/><path d="M150 1l6 6-6 6-6-6z" fill="#8e2a1f"/><circle cx="132" cy="7" r="2.4" fill="#6b5434"/><circle cx="168" cy="7" r="2.4" fill="#6b5434"/></svg>`;
}

function heroArt(e) {
  // Декоративная гравюра: большой значок типа события
  const ic = ICONS[e.type];
  return `<svg class="bgart" viewBox="0 0 100 40" preserveAspectRatio="xMidYMid slice"><g transform="translate(38,2) scale(1.5)"><path d="${ic.d}" fill="${ic.solid ? '#3a2914' : 'none'}" stroke="#3a2914" stroke-width=".8"/></g></svg>`;
}

function renderPage(e) {
  const prev = EV[e.i - 1], next = EV[e.i + 1];
  const sealTxt = { win: 'ПОБЕДА<br>НАПОЛЕОНА', loss: 'ПОРАЖЕНИЕ<br>ФРАНЦУЗОВ', draw: 'ИСХОД<br>НЕ РЕШЁН', event: 'ВАЖНОЕ<br>СОБЫТИЕ' }[e.result];
  const chain = EV.filter(x => (e.campaign && x.campaign === e.campaign) || (!e.campaign && Math.abs(x.t - e.t) < 1.2));
  const isFight = ['battle', 'siege'].includes(e.type) && e.sides.length === 2;
  const fA = isFight && parseForce(e.sides[0].forces), fB = isFight && parseForce(e.sides[1].forces);
  const lA = isFight && parseForce(e.sides[0].losses), lB = isFight && parseForce(e.sides[1].losses);
  let bars = '';
  if (fA && fB) {
    const mx = Math.max(fA, fB, lA || 0, lB || 0);
    const row = (lbl, a, b) => `<div class="bar-row"><div class="bl"><span>${lbl}</span></div>
      <div class="bl"><span>${e.sides[0].name}</span><b>≈ ${fmt(Math.round(a / 100) * 100)}</b></div><div class="bar a"><i data-w="${a / mx * 100}"></i></div>
      <div class="bl" style="margin-top:4px"><span>${e.sides[1].name}</span><b>≈ ${fmt(Math.round(b / 100) * 100)}</b></div><div class="bar b"><i data-w="${b / mx * 100}"></i></div></div>`;
    bars = `<h2>СИЛЫ И ПОТЕРИ</h2><div class="bars">${row('Численность войск', fA, fB)}${lA && lB ? row('Потери', lA, lB) : ''}<div class="bar-note">Средние значения по оценкам историков.</div></div>`;
  }
  const sides = e.sides.map(s => `<div class="side-card"><div class="sn"><span class="flag ${s.flag}"></span>${s.name}</div><dl>
      <dt>Командование</dt><dd>${s.cmd}</dd>${s.forces !== '—' ? `<dt>Силы</dt><dd>${s.forces}</dd>` : ''}${s.losses !== '—' ? `<dt>Потери</dt><dd>${s.losses}</dd>` : ''}</dl></div>`).join('');

  pageEl.innerHTML = `<div class="book paper">
    <div class="ep-bar">
      <button class="pbtn" id="ep-back">← К карте</button>
      <button class="pbtn" id="ep-speak" title="Прочитать вслух">▶ Слушать</button>
      <div class="grow">СОБЫТИЕ ${e.i + 1} ИЗ ${EV.length}${e.campaign ? ' · ' + e.campaign.toUpperCase() : ''}</div>
      <button class="pbtn" id="ep-map">Показать на карте</button>
      <button class="pbtn" id="ep-prev" ${prev ? '' : 'disabled'} title="Предыдущее">‹</button>
      <button class="pbtn" id="ep-next" ${next ? '' : 'disabled'} title="Следующее">›</button>
    </div>
    <header class="ep-hero">
      ${heroArt(e)}
      <div class="ep-kind">${TYPE_NAMES[e.type].toUpperCase()}${e.russia ? ' · РОССИЯ' : ''}</div>
      <h1>${e.title}</h1>
      <div class="ep-date">${e.dateLabel}</div>
      <div class="ep-place">${e.place}</div>
      ${ornament()}
      <div class="seal ${e.result}">${sealTxt}</div>
      <div class="ep-lead">${e.lead}</div>
    </header>
    <div class="ep-grid">
      <div class="ep-main">
        <h2>ХОД СОБЫТИЙ</h2>
        <div class="ep-body">${e.body.map(p => `<p>${p}</p>`).join('')}</div>
        <div class="ep-box meaning"><h3>ИТОГИ И ЗНАЧЕНИЕ</h3><p>${e.meaning}</p></div>
        <div class="ep-box fact"><h3>ЛЮБОПЫТНЫЙ ФАКТ</h3><p>${e.fact}</p></div>
        ${e.quote ? `<blockquote class="ep-quote">${e.quote.t}<cite>${e.quote.a}</cite></blockquote>` : ''}
      </div>
      <aside class="ep-side">
        <h2>МЕСТО НА КАРТЕ</h2>
        ${miniMap(e)}
        <div class="mini-cap">Европа в момент события: синим — Франция и зависимые страны, красным — её противники.</div>
        ${bars}
        <h2>СТОРОНЫ</h2>
        ${sides}
        ${chain.length > 1 ? `<h2 style="margin-top:22px">${e.campaign ? e.campaign.toUpperCase() : 'РЯДОМ ПО ВРЕМЕНИ'}</h2>
          <ul class="ep-chain">${chain.map(x => `<li data-id="${x.id}" class="${x.id === e.id ? 'cur' : ''}">${x.title}<small>${x.dateLabel}</small></li>`).join('')}</ul>` : ''}
      </aside>
    </div>
    <div class="ep-foot">
      ${prev ? `<button class="pbtn" data-go="${prev.id}">← Что было раньше<small>${prev.title}</small></button>` : '<span></span>'}
      ${next ? `<button class="pbtn" data-go="${next.id}" style="text-align:right">Что было дальше →<small>${next.title}</small></button>` : '<span></span>'}
    </div>
    <div class="ep-note">Численность войск и потери приведены приблизительно: оценки историков заметно различаются. Даты указаны по новому стилю (григорианскому календарю), для событий в России — также по старому стилю.</div>
  </div>`;

  pageEl.scrollTop = 0;
  const q = s => pageEl.querySelector(s);
  q('#ep-back').onclick = closeEvent;
  q('#ep-map').onclick = () => { location.hash = '#/'; setTimeout(() => { App.goEvent(e); }, 350); };
  if (prev) q('#ep-prev').onclick = () => openEvent(prev.id);
  if (next) q('#ep-next').onclick = () => openEvent(next.id);
  pageEl.querySelectorAll('[data-go]').forEach(b => b.onclick = () => openEvent(b.dataset.go));
  pageEl.querySelectorAll('.ep-chain li').forEach(li => li.onclick = () => openEvent(li.dataset.id));
  let speaking = false;
  q('#ep-speak').onclick = () => {
    const btn = q('#ep-speak');
    if (speaking) { Sound.hush(); speaking = false; btn.textContent = '▶ Слушать'; return; }
    const text = [e.title, e.dateLabel, e.lead, ...e.body, 'Итоги и значение. ' + e.meaning].join('. ').replace(/\.\./g, '.');
    const ok = Sound.speak(text, () => { speaking = false; btn.textContent = '▶ Слушать'; });
    if (ok) { speaking = true; btn.textContent = '■ Остановить'; }
    else btn.textContent = 'Голос недоступен';
  };
  requestAnimationFrame(() => setTimeout(() => pageEl.querySelectorAll('.bar i').forEach(i => i.style.width = i.dataset.w + '%'), 700));
}

function route() {
  const m = location.hash.match(/^#\/event\/([\w-]+)/);
  if (m && EVById[m[1]]) {
    const e = EVById[m[1]];
    App.stop();
    if (App.mode === 'tour' && App.pauseTour) App.pauseTour();
    document.getElementById('splash').classList.add('gone');
    const wasOpen = pageEl.classList.contains('open');
    if (wasOpen) { pageEl.classList.remove('open'); void pageEl.offsetWidth; }
    renderPage(e);
    pageEl.classList.add('open');
    Sound.rustle();
    if (['battle', 'siege'].includes(e.type) && !wasOpen) setTimeout(() => Sound.boom(.7), 250);
    App.cameFromMap = true;
  } else {
    Sound.hush();
    pageEl.classList.remove('open');
  }
}
addEventListener('hashchange', route);
route();
