// 공고 목록 페이지 로직: 필터·정렬·보기·북마크·사이드바·히어로 통계
const { updatedAt } = window.NEWS;
// 같은 제목·같은 마감일의 공고가 여러 기관에 올라온 경우 하나로 합치고, 함께 올라온 기관은 dups에 담는다
const posts = (() => {
  const seen = new Map(), out = [];
  for (const p of window.NEWS.posts) {
    const key = p.title.replace(/[\s\[\]()「」『』<>]/g, '') + '|' + (p.deadline || '');
    const hit = seen.get(key);
    if (hit && hit.sourceName !== p.sourceName) { (hit.dups = hit.dups || []).push(p.sourceName); continue; }
    if (hit) continue;
    seen.set(key, p); out.push(p);
  }
  return out;
})();
const SITE = window.SITE, ADS = window.ADS;
const CATS = ['강사모집','지원사업·공모','채용','프로그램','행사·공연','입찰·대관','운영안내','기타'];
const AUDS = ['시민 일반','아동·청소년','청년','중장년·어르신','가족·다문화','소상공인·사회적기업','예술인·단체','여성'];
const REGS = ['성북','강북','종로','중구','용산','성동','광진','동대문','중랑','도봉','노원','은평','서대문','마포','양천','강서','구로','금천','영등포','동작','관악','서초','강남','송파','강동','서울'];
const COVER = window.COVERAGE || {};
const REG_TOTAL = {}; posts.forEach(p => { REG_TOTAL[p.region] = (REG_TOTAL[p.region] || 0) + 1; });
const regTotal = v => posts.filter(p => regHas(p, v)).length;
const COMMON_SRC = new Set(['seoul-youth']); // 서울시 단위 사업은 해당 구와 '서울 공통' 양쪽에 보인다
const regHas = (p, v) => (p.region || '').includes(v) || (v === '서울' && COMMON_SRC.has(p.source));
const regLabel = v => v === '서울' ? '서울 공통' : v;
const STTS = ['진행 중','마감 임박','마감','상시','기한 미확인'];
const SORTS = ['최신순','오래된순','마감임박순','기관별'];
const SIZES = [10,30,50,100];
const LABEL = { reg:'지역', cat:'분류', aud:'대상', stt:'상태' };
const GROUPS = ['reg','cat','aud','stt'];
const OPTS = { reg:REGS, cat:CATS, aud:AUDS, stt:STTS };
const SRC_ALL = [...new Set(posts.map(p => p.sourceName))].sort((a, b) => a.localeCompare(b, 'ko'));
const regOf = p => (p.region || '').split('·')[0];
const SRC_REG = {}; posts.forEach(p => { SRC_REG[p.sourceName] = SRC_REG[p.sourceName] || (COMMON_SRC.has(p.source) ? '서울' : regOf(p)); });
const REG_ORDER = REGS.filter(r => r !== '서울');
const GU_FIRST = new Set(['성북', '강북']); // 기본으로 먼저 보여 주는 지역

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
                set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

document.title = SITE.name + ' · ' + SITE.tagline;
const saved = store.get('prefs', {});
const st = {
  reg:new Set(saved.reg || []), cat:new Set(saved.cat || []), aud:new Set(saved.aud || []), stt:new Set(saved.stt || []), src:new Set(saved.src || []),
  q:'', bm:false, page:1, srcOpen:false, regOpen:false, srcQ:'', ops:saved.ops === true,
  size:SIZES.includes(saved.size) ? saved.size : 30,
  view:saved.view === '목록' ? '목록' : '블록',
  sort:SORTS.includes(saved.sort) ? saved.sort : '최신순',
  panel:saved.panel ?? (window.innerWidth >= 768),
};
const savePrefs = () => store.set('prefs', { reg:[...st.reg], cat:[...st.cat], aud:[...st.aud], stt:[...st.stt], src:[...st.src], size:st.size, view:st.view, sort:st.sort, panel:st.panel, ops:st.ops });
let marks = new Set(store.get('bm', []));
const saveMarks = () => store.set('bm', [...marks]);

const todayStr = new Date().toLocaleDateString('sv-SE');
const dayDiff = d => Math.round((Date.parse(d + 'T00:00:00') - Date.parse(todayStr + 'T00:00:00')) / 864e5);
const md = d => (d || '').slice(5).replace('-', '.');

function dlInfo(p) {
  if (p.deadline) {
    const days = dayDiff(p.deadline);
    if (days < 0) return { s:'마감', label:'마감', cls:'closed', rank:20000 - days };
    if (days <= 3) return { s:'마감 임박', label:(days === 0 ? 'D-Day' : 'D-' + days), cls:'soon', rank:days };
    return { s:'진행 중', label:'D-' + days, cls:'open', rank:days };
  }
  if (p.dl === 'closed') return { s:'마감', label:'마감', cls:'closed', rank:20000 };
  if (p.dl === 'open') return { s:'진행 중', label:'진행 중', cls:'open', rank:10000 };
  if (p.dl === 'rolling') return { s:'상시', label:'상시', cls:'rolling', rank:10000 };
  return null;
}
const sttOne = (p, f) => { const i = dlInfo(p);
  if (f === '기한 미확인') return !i;
  if (!i) return false;
  if (f === '진행 중') return i.s === '진행 중' || i.s === '마감 임박' || i.s === '상시';
  return i.s === f; };
const badge = p => { const i = dlInfo(p); return i ? '<span class="dl ' + i.cls + '">' + esc(i.label) + '</span>' : ''; };
const isNew = p => p.date && dayDiff(p.date) >= -3 && dayDiff(p.date) <= 0;
const newTag = p => isNew(p) ? '<span class="new">NEW</span>' : '';

// 요약문 정리: 표 항목명 나열 등 의미 없는 문구는 숨긴다
function cleanSum(s) {
  s = String(s || '').trim();
  if (!s) return '';
  if (/상세(보기)?\s*[:\-]|(\S+,\s*){4,}/.test(s.slice(0, 80))) return '';
  s = s.replace(/^정보\s*제공\s*고시공고구분.*?제목\s*/, '').replace(/^정보\s*제공\s*/, '').replace(/조회\s*:\s*\d+\s*주관부서\s*\S+\s*(요약\s*)?/, '').replace(/전화번호[\s\S]*$/, '').replace(/작성일\s*:\s*[\d.\-]+\s*최종수정일\s*:\s*[\d.\-]+/, '').replace(/^구분\s*\S+\s*/, '');
  s = s.replace(/^파일\s*정보\s*제공\s*제목[\s\S]*?조회수\s*\d*\s*/, '').replace(/^(작성자\s*:\s*\S+\s*)?\d{4}[.\-]\d{1,2}[.\-]\d{1,2}\s*조회수\s*\d+\s*/, '').replace(/\S+\.(pdf|hwpx?|docx?|xlsx?|pptx?|zip|png|jpe?g)\s*/gi, '').replace(/\s*게시물\s*상세\s*정보를[\s\S]*$/, '').replace(/^[…\s]+$/, '');
  s = s.replace(/글쓴이\s*\S+\s*작성일\s*[\d.\-]+\s*조회수\s*[\d\s]*(\S+\.(png|jpe?g|gif))?/g, '').trim();
  return s.length > 25 ? s : '';
}

const conds = {
  reg: p => !st.reg.size || [...st.reg].some(r => regHas(p, r)),
  src: p => !st.src.size || st.src.has(p.sourceName),
  cat: p => st.cat.size ? st.cat.has(p.category) : (st.ops || p.category !== '운영안내'), // 운영안내(휴관·이용 제한 등)는 기본으로 접는다
  aud: p => !st.aud.size || (p.audiences || []).some(a => st.aud.has(a)),
  stt: p => !st.stt.size || [...st.stt].some(f => sttOne(p, f)),
};
const optHas = { reg:(p, v) => regHas(p, v), src:(p, v) => p.sourceName === v, cat:(p, v) => p.category === v,
                 aud:(p, v) => (p.audiences || []).includes(v), stt:(p, v) => sttOne(p, v) };
function matches(p, skip) {
  const q = st.q.trim().toLowerCase();
  if (st.bm && !marks.has(p.url)) return false;
  if (q && !(p.title + ' ' + cleanSum(p.summary)).toLowerCase().includes(q)) return false;
  return Object.keys(conds).every(k => k === skip || conds[k](p));
}
function counts(key, values) {
  const base = posts.filter(p => matches(p, key));
  const out = {};
  values.forEach(v => { out[v] = base.filter(p => optHas[key](p, v)).length; });
  return out;
}

// ---------- 히어로 통계 ----------
function renderStats() {
  const open = posts.filter(p => ['진행 중','마감 임박','상시'].includes((dlInfo(p) || {}).s)).length;
  const soon = posts.filter(p => (dlInfo(p) || {}).s === '마감 임박').length;
  const fresh = posts.filter(isNew).length;
  const tiles = [
    ['all', '전체 공고', posts.length, ''],
    ['stt=진행 중', '모집·진행 중', open, 'ok'],
    ['stt=마감 임박', '마감 임박', soon, 'hot'],
    ['new', '새 글 (3일)', fresh, ''],
  ];
  $('stats').innerHTML = tiles.map(([k, l, n, c]) => `<button class="stat ${c}" data-preset="${esc(k)}"><span class="n">${n}</span><span class="l">${l}</span></button>`).join('');
}

// ---------- 프리셋(메뉴·해시) ----------
function applyPreset(key) {
  GROUPS.forEach(k => st[k].clear()); st.src.clear(); st.bm = false; st.page = 1; st.q = ''; $('q').value = '';
  if (key === 'bm') st.bm = true;
  else if (key === 'new') st.sort = '최신순';
  else if (key && key !== 'all') {
    const [k, ...rest] = key.split('='); const v = rest.join('=');
    if (st[k] && v) st[k].add(v);
    if (k === 'stt' && v === '마감 임박') st.sort = '마감임박순';
  }
  savePrefs(); render();
  if (key === 'new') { /* 새 글 보기는 최신순 + 목록 맨 위로 */ }
  window.scrollTo({ top: document.querySelector('.layout').offsetTop - 8, behavior:'smooth' });
}
function fromHash() {
  const h = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (h) applyPreset(h);
}
function navActive() {
  const only = (k, v) => !st.bm && st[k].size === 1 && st[k].has(v) && GROUPS.concat('src').filter(g => g !== k).every(g => !st[g].size);
  const none = !st.bm && GROUPS.concat('src').every(g => !st[g].size);
  document.querySelectorAll('[data-nav]').forEach(a => {
    const key = a.dataset.nav; let on = false;
    if (key === 'all') on = none; else if (key.includes('=')) { const [k, v] = key.split('='); on = only(k, v); }
    if (key !== 'about' && key !== 'coverage') a.classList.toggle('on', on);
  });
  const hb = $('hdBm'); if (hb) { hb.classList.toggle('on', st.bm); $('hdBmCnt').textContent = marks.size ? '(' + marks.size + ')' : ''; }
}

// ---------- 필터 UI ----------
const regChip = (v, c, cls) => {
  const on = st.reg.has(v);
  const na = v !== '서울' && !regTotal(v);
  const tip = na ? ` title="${esc(v + ' · 수집 전 — ' + ((COVER[v] || {}).note || '아직 수집 기관이 없습니다'))}"` : '';
  return `<button class="${cls} ${on ? 'on' : ''} ${!on && !c[v] ? 'dim' : ''} ${na ? 'na' : ''}" data-k="reg" data-v="${esc(v)}"${tip}>${cls === 'chip' ? '' : `<span class="bx">${on ? '✓' : ''}</span>`}${esc(regLabel(v))}${na ? '<em>수집 전</em>' : `<i>${c[v]}</i>`}</button>`;
};
function regRow() {
  const c = counts('reg', REGS);
  const quick = ['서울', ...REG_ORDER.filter(v => GU_FIRST.has(v) || st.reg.has(v))];
  $('reg').innerHTML = `<span class="label">지역</span><button class="chip ${st.reg.size ? '' : 'on'}" data-k="reg" data-v="전체">전체</button>` +
    quick.map(v => regChip(v, c, 'chip')).join('') +
    `<button class="chip more ${st.regOpen ? 'on' : ''}" id="regBtn" aria-expanded="${st.regOpen}">다른 구 선택 ${st.regOpen ? '▴' : '▾'}</button>`;
  $('regs').hidden = !st.regOpen;
  $('regs').innerHTML = st.regOpen ? REG_ORDER.map(v => regChip(v, c, 'src-btn')).join('') + '<p class="reg-note">점선 지역은 아직 수집 전입니다. <a href="coverage.html">구별 수집 현황 보기</a></p>' : '';
}
function chipRow(key) {
  if (key === 'reg') return regRow();
  const c = counts(key, OPTS[key]);
  const all = `<button class="chip ${st[key].size ? '' : 'on'}" data-k="${key}" data-v="전체">전체</button>`;
  $(key).innerHTML = `<span class="label">${LABEL[key]}</span>` + all + (key === 'reg' ? '' : '') + OPTS[key].map(v => {
    const on = st[key].has(v);
    const na = key === 'reg' && v !== '서울' && !regTotal(v);
    const tip = na ? ` title="${esc(v + ' · 수집 전 — ' + ((COVER[v] || {}).note || '아직 수집 기관이 없습니다'))}"` : '';
    return `<button class="chip ${on ? 'on' : ''} ${!on && !c[v] ? 'dim' : ''} ${na ? 'na' : ''}" data-k="${key}" data-v="${esc(v)}"${tip}>${esc(key === 'reg' ? regLabel(v) : v)}${na ? '<em>수집 전</em>' : `<i>${c[v]}</i>`}</button>`;
  }).join('');
}
function renderFilters() {
  GROUPS.forEach(chipRow);
  const c = counts('src', SRC_ALL);
  $('srcBtn').innerHTML = (st.src.size ? '선택 ' + st.src.size + '곳' : '전체 기관') + ' ' + (st.srcOpen ? '▴' : '▾');
  $('srcBtn').classList.toggle('on', st.src.size > 0);
  $('srcs').hidden = !st.srcOpen;
  $('srcQ').hidden = !st.srcOpen;
  const sq = st.srcQ.trim();
  const srcBtn = v => { const on = st.src.has(v); return `<button class="src-btn ${on ? 'on' : ''} ${!on && !c[v] ? 'dim' : ''}" data-k="src" data-v="${esc(v)}"><span class="bx">${on ? '✓' : ''}</span>${esc(v)}<i>${c[v]}</i></button>`; };
  $('srcs').innerHTML = st.srcOpen ? [...REG_ORDER, '서울', ''].map(g => {
    const names = SRC_ALL.filter(v => (g === '' ? !REGS.includes(SRC_REG[v]) : SRC_REG[v] === g) && (!sq || v.includes(sq)));
    return names.length ? `<h4 class="sg">${esc(g === '' ? '기타' : regLabel(g))}</h4>` + names.map(srcBtn).join('') : '';
  }).join('') || '<p class="reg-note">일치하는 기관이 없습니다.</p>' : '';
  const act = [];
  [...GROUPS, 'src'].forEach(k => st[k].forEach(v => act.push(`<button class="ac" data-x="${k}" data-v="${esc(v)}" title="선택 해제">${esc(v)} ✕</button>`)));
  if (st.bm) act.unshift('<button class="ac" data-x="bm">★ 북마크만 ✕</button>');
  $('active').hidden = !act.length;
  $('active').innerHTML = act.join('') + (act.length ? '<button class="ac clear" data-x="all">모두 해제</button>' : '');
  $('fcnt').textContent = GROUPS.concat('src').reduce((n, k) => n + st[k].size, 0) ? '(' + GROUPS.concat('src').reduce((n, k) => n + st[k].size, 0) + ')' : '';
  $('filt').classList.toggle('on', st.panel);
  $('filt').setAttribute('aria-expanded', st.panel);
  $('panel').hidden = !st.panel;
  document.body.classList.toggle('sheet', st.panel && window.innerWidth < 768); // 모바일은 전체 화면 시트
}

// ---------- 사이드바 ----------
function renderSide() {
  const soon = posts.filter(p => { const i = dlInfo(p); return i && p.deadline && i.rank >= 0 && i.rank < 10000; }).sort((a, b) => dlInfo(a).rank - dlInfo(b).rank).slice(0, 6);
  $('wSoon').innerHTML = soon.length ? soon.map(p => `<li><a href="${esc(p.url)}" target="_blank" rel="noopener"><div class="wm">${badge(p)}<span>${esc(p.sourceName)}</span></div><span class="wt">${esc(p.title)}</span></a></li>`).join('')
    : '<li><p class="none">마감이 임박한 공고가 없습니다.</p></li>';
  const c = {}; posts.forEach(p => c[p.sourceName] = (c[p.sourceName] || 0) + 1);
  const top = [...SRC_ALL].sort((a, b) => c[b] - c[a]).slice(0, 10);
  $('wSrc').innerHTML = top.map(v => `<button data-k="src" data-v="${esc(v)}" class="${st.src.has(v) ? 'on' : ''}"><span>${esc(v)}</span><i>${c[v]}</i></button>`).join('')
    + `<a class="wmore" href="coverage.html">전체 ${SRC_ALL.length}개 기관 · 수집 현황 ›</a>`;
}

// ---------- 목록 ----------
function render() {
  renderFilters(); navActive();
  let rows = posts.filter(p => matches(p));
  const byIdx = (arr, f) => arr.map((p, i) => [p, i]).sort((a, b) => f(a[0], b[0]) || a[1] - b[1]).map(x => x[0]);
  const dkey = p => p.date || (p.firstSeen || '').slice(0, 10);
  if (st.sort === '마감임박순') rows = byIdx(rows, (a, b) => ((dlInfo(a) || { rank:15000 }).rank - (dlInfo(b) || { rank:15000 }).rank));
  else if (st.sort === '오래된순') rows = byIdx(rows, (a, b) => dkey(a).localeCompare(dkey(b)));
  else if (st.sort === '기관별') rows = byIdx(rows, (a, b) => a.sourceName.localeCompare(b.sourceName, 'ko') || dkey(b).localeCompare(dkey(a)));
  const pages = Math.max(1, Math.ceil(rows.length / st.size));
  if (st.page > pages) st.page = pages;
  const view = rows.slice((st.page - 1) * st.size, st.page * st.size);
  $('count').innerHTML = '<strong>' + rows.length + '</strong>건의 공고' + (pages > 1 ? ' · ' + st.page + '/' + pages + '쪽' : '');
  $('views').innerHTML = [['블록','▦'],['목록','☰']].map(([n, ic]) => `<button class="vw ${st.view === n ? 'on' : ''}" data-k="view" data-v="${n}" title="${n} 보기" aria-label="${n} 보기">${ic}</button>`).join('');
  $('sorts').innerHTML = '<select id="sortSel" class="sel" aria-label="정렬 기준">' + SORTS.map(n => `<option value="${n}" ${st.sort === n ? 'selected' : ''}>${n}</option>`).join('') + '</select>';
  $('opsBox').innerHTML = `<label class="ops"><input type="checkbox" id="opsChk" ${st.ops ? 'checked' : ''}> 운영안내 포함</label>`;
  $('sizes').innerHTML = '<select id="sizeSel" class="sel" aria-label="한 번에 보기">' + SIZES.map(n => `<option value="${n}" ${st.size === n ? 'selected' : ''}>${n}개씩</option>`).join('') + '</select>';
  const pg = (n, label, dis, on) => `<button class="pg ${on ? 'on' : ''}" ${dis ? 'disabled' : ''} data-k="page" data-v="${n}">${label}</button>`;
  const nums = [];
  for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - st.page) <= 2) nums.push(i);
  $('pager').innerHTML = pages > 1 ? pg(st.page - 1, '‹', st.page === 1) +
    nums.map((n, i) => (i && n - nums[i - 1] > 1 ? '<span style="align-self:center;color:var(--sub)">…</span>' : '') + pg(n, n, false, n === st.page)).join('') +
    pg(st.page + 1, '›', st.page === pages) : '';

  const star = p => `<button class="star ${marks.has(p.url) ? 'on' : ''}" data-u="${esc(p.url)}" aria-label="북마크">${marks.has(p.url) ? '★' : '☆'}</button>`;
  const closedCls = p => (dlInfo(p) || {}).cls === 'closed' ? 'closed' : '';
  const listEl = $('list');
  listEl.classList.toggle('rows', st.view === '목록');
  const feed = (i) => (ADS.feedEvery && (i + 1) % ADS.feedEvery === 0 && i + 1 < view.length) ? window.adSlot('feed') : '';
  if (!view.length) {
    const any = st.src.size || GROUPS.some(k => st[k].size) || st.q || st.bm;
    listEl.innerHTML = '<div class="empty"><strong>조건에 맞는 공고가 없습니다.</strong><br>' + (any ? '필터를 줄이거나 검색어를 바꿔 보세요.<br><button class="btn" data-x="all">조건 모두 해제</button>' : '') + '</div>';
  } else if (st.view === '목록') {
    listEl.innerHTML = view.map((p, i) => `
    <div class="row ${closedCls(p)}">
      <span class="src">${esc(p.sourceName)}</span>
      <span>${badge(p)}${newTag(p)}</span>
      <span class="tt"><a href="${esc(p.url)}" target="_blank" rel="noopener" title="${esc(p.title)}">${esc(p.title)}</a></span>
      <span class="dt">${esc(p.category)} · ${esc(md(p.date))}</span>
      ${star(p)}
    </div>` + feed(i)).join('');
  } else {
    listEl.innerHTML = view.map((p, i) => { const sum = cleanSum(p.summary); return `
    <article class="card ${closedCls(p)}">
      <div class="meta"><span class="src" ${p.dups ? `title="같은 공고가 ${esc(p.dups.join(', '))}에도 올라와 있습니다"` : ''}>${esc(p.region && !p.sourceName.startsWith(regOf(p)) ? regOf(p) + ' · ' : '')}${esc(p.sourceName)}${p.dups ? ' 외 ' + p.dups.length + '곳' : ''}</span>${badge(p)}${newTag(p)}
        <span style="margin-left:auto" class="dt">${esc(md(p.date))}</span>${star(p)}</div>
      <h2><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a></h2>
      ${sum ? `<p class="sum">${esc(sum)}</p>` : (p.deadline ? `<p class="sum alt">${esc(p.sourceName)} · 마감 ${esc(p.deadline)} · 자세한 내용은 원문에서 확인하세요.</p>` : '')}
      <div class="tags"><span class="tag">${esc(p.category)}</span>${(p.audiences || []).map(a => `<span class="tag">${esc(a)}</span>`).join('')}
        <a class="orig" href="${esc(p.url)}" target="_blank" rel="noopener">원문보기 ↗</a></div>
    </article>` + feed(i); }).join('');
  }
  renderSide();
  window.adInit && window.adInit();
}

document.addEventListener('click', e => {
  const nav = e.target.closest('a[data-nav], a.logo, #hdBm');
  if (nav && nav.getAttribute('href') && nav.dataset.nav !== 'about') {
    const h = decodeURIComponent((nav.getAttribute('href').split('#')[1] || 'all'));
    e.preventDefault(); history.replaceState(null, '', '#' + encodeURIComponent(h)); applyPreset(h); return;
  }
  const pre = e.target.closest('[data-preset]');
  if (pre) { applyPreset(pre.dataset.preset); return; }
  const x = e.target.closest('[data-x]');
  if (x) {
    const k = x.dataset.x;
    if (k === 'all') { [...GROUPS, 'src'].forEach(g => st[g].clear()); st.q = ''; $('q').value = ''; st.bm = false; }
    else if (k === 'bm') st.bm = false;
    else st[k].delete(x.dataset.v);
    st.page = 1; savePrefs(); render(); return;
  }
  const t = e.target.closest('[data-k]');
  if (t) {
    const k = t.dataset.k, v = t.dataset.v;
    if (k === 'view') st.view = v;
    else if (k === 'page') { st.page = Number(v); render(); window.scrollTo({ top: document.querySelector('.layout').offsetTop - 8 }); return; }
    else { const S = st[k]; if (v === '전체') S.clear(); else S.has(v) ? S.delete(v) : S.add(v); st.page = 1; }
    savePrefs(); render(); return;
  }
  const s = e.target.closest('.star');
  if (s) { const u = s.dataset.u; marks.has(u) ? marks.delete(u) : marks.add(u); saveMarks(); render(); return; }
  if (e.target.closest('#filt')) { st.panel = !st.panel; savePrefs(); render(); return; }
  if (e.target.closest('#srcBtn')) { st.srcOpen = !st.srcOpen; render(); return; }
  if (e.target.closest('#regBtn')) { st.regOpen = !st.regOpen; render(); return; }
  if (e.target.closest('#panelClose, #panelApply')) { st.panel = false; savePrefs(); render(); window.scrollTo({ top: document.querySelector('.layout').offsetTop - 8 }); return; }
  if (e.target.closest('#totop')) window.scrollTo({ top: 0, behavior: 'smooth' });
});
document.addEventListener('change', e => {
  if (e.target.id === 'opsChk') { st.ops = e.target.checked; st.page = 1; savePrefs(); render(); }
  if (e.target.id === 'sortSel') { st.sort = e.target.value; st.page = 1; savePrefs(); render(); }
  if (e.target.id === 'sizeSel') { st.size = Number(e.target.value); st.page = 1; savePrefs(); render(); }
});
document.addEventListener('wheel', e => {
  const r = e.target.closest('.chips');
  if (r && r.scrollWidth > r.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { r.scrollLeft += e.deltaY; e.preventDefault(); }
}, { passive:false });
$('srcQ').addEventListener('input', e => { st.srcQ = e.target.value; renderFilters(); });
$('q').addEventListener('input', e => { st.q = e.target.value; st.page = 1; render(); });
window.addEventListener('scroll', () => $('totop').classList.toggle('show', window.scrollY > 600), { passive:true });
window.addEventListener('hashchange', fromHash);

// 푸터 수집 시각
const d = new Date(updatedAt), age = Math.floor((Date.now() - d) / 864e5);
const fu = $('ftUpd'); if (fu) fu.textContent = '공고 데이터 마지막 갱신 ' + d.toLocaleString('ko-KR', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' }) + (age >= 2 ? ' (' + age + '일 경과)' : '');

renderStats();
render();
if (location.hash) fromHash();
