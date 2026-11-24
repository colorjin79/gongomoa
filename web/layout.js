// 모든 페이지 공통: 헤더·푸터·광고 자리·메타. 각 페이지에는 #site-header, #site-footer 자리만 둔다.
(function () {
  const S = window.SITE, A = window.ADS;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const here = location.pathname.split('/').pop() || 'index.html';
  const onIndex = here === 'index.html' || here === '';

  // 아이콘(문서 + 체크 모양). 파비콘에도 같은 SVG 사용
  const mark = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#2f5bea"/><path d="M9 10h14M9 16h8M9 22h6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M19 21.5l2.6 2.6 4.4-5" stroke="#9fe3c4" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
  window.SITE_MARK = mark;
  if (!document.querySelector('link[rel=icon]')) {
    const l = document.createElement('link'); l.rel = 'icon'; l.href = 'data:image/svg+xml,' + encodeURIComponent(mark); document.head.appendChild(l);
  }
  const meta = (n, v, attr = 'name') => { let m = document.head.querySelector(`meta[${attr}="${n}"]`); if (!m) { m = document.createElement('meta'); m.setAttribute(attr, n); document.head.appendChild(m); } m.content = v; };
  if (!document.querySelector('meta[name=description]')) meta('description', S.description);
  meta('og:title', document.title, 'property'); meta('og:description', S.description, 'property'); meta('og:type', 'website', 'property'); meta('og:site_name', S.name, 'property');
  meta('theme-color', '#2f5bea');

  // 헤더
  const NAV = [
    ['전체 공고', 'index.html#all', 'all'],
    ['마감 임박', 'index.html#stt=마감 임박', 'stt=마감 임박'],
    ['수집 현황', 'coverage.html', 'coverage'],
    ['소개', 'about.html', 'about'],
  ];
  const h = document.getElementById('site-header');
  if (h) h.outerHTML = `
  <header class="site-header"><div class="container hd">
    <a class="logo" href="index.html#all" aria-label="${esc(S.name)} 홈">${mark}<span>${esc(S.name)}</span></a>
    <nav class="nav" aria-label="주요 메뉴">${NAV.map(([t, href, key]) => `<a href="${href}" data-nav="${esc(key)}" ${(key === 'about' && here === 'about.html') || (key === 'coverage' && here === 'coverage.html') ? 'class="on"' : ''}>${esc(t)}</a>`).join('')}</nav>
    <div class="hd-right"><a class="hbtn" href="index.html#bm" id="hdBm">★ 북마크 <b id="hdBmCnt"></b></a></div>
  </div></header>`;

  // 푸터
  const sources = (window.NEWS && window.NEWS.posts) ? [...new Set(window.NEWS.posts.map(p => p.sourceName))].sort((a, b) => a.localeCompare(b, 'ko')) : [];
  const f = document.getElementById('site-footer');
  if (f) f.outerHTML = `
  <footer class="site-footer"><div class="container">
    <div class="ft">
      <div>
        <a class="logo" href="index.html#all">${mark}<span>${esc(S.name)}</span></a>
        <p>${esc(S.tagline)}.<br>기관별로 흩어진 공고를 모아 마감일과 대상 기준으로 쉽게 찾도록 돕습니다.</p>
      </div>
      <div>
        <h3>서비스</h3>
        <ul>
          <li><a href="index.html#all">전체 공고</a></li>
          <li><a href="index.html#stt=마감 임박">마감 임박 공고</a></li>
          <li><a href="index.html#bm">내 북마크</a></li>
          <li><a href="coverage.html">수집 현황</a></li>
          <li><a href="about.html">서비스 소개</a></li>
        </ul>
      </div>
      <div>
        <h3>안내</h3>
        <ul>
          <li><a href="terms.html">이용약관</a></li>
          <li><a href="privacy.html"><strong>개인정보처리방침</strong></a></li>
          ${S.contactEmail ? `<li><a href="mailto:${esc(S.contactEmail)}">문의하기</a></li>` : ''}
        </ul>
      </div>
    </div>
    ${sources.length ? `<details class="ft-src"><summary><b>공고 출처 ${sources.length}개 기관</b> <a href="coverage.html">수집 현황</a></summary>${sources.map(s => `<span>${esc(s)}</span>`).join('')}</details>` : ''}
    <div class="ft-bottom">
      <div>각 공고의 저작권과 권리는 해당 기관에 있으며, 본 서비스는 제목·요약·원문 링크만 제공하는 비공식 서비스로 어떤 기관과도 제휴 관계가 없습니다.<br>요약과 분류, 마감일은 자동으로 생성되어 오류가 있을 수 있으니 신청 전 반드시 원문을 확인해 주세요.</div>
      <div>© ${new Date().getFullYear()} ${esc(S.operator || S.name)}. All rights reserved.<br><span id="ftUpd"></span></div>
    </div>
  </div></footer>`;

  // 현재 필터와 맞는 메뉴 표시는 app.js가 data-nav 로 처리한다

  // 광고 자리: mode가 off면 아무것도 그리지 않는다(빈 박스 없음)
  const adMode = /[?&]ads=preview/.test(location.search) ? 'preview' : A.mode;
  window.adSlot = function (name) {
    if (adMode === 'off') return '';
    if (adMode === 'preview' || !A.client || !A.slots[name]) {
      return adMode === 'preview' ? `<div class="ad ad-${name}" aria-hidden="true"><div>광고 영역 (${name})<small>애드센스 승인 후 이 자리에 표시됩니다</small></div></div>` : '';
    }
    return `<div class="ad real ad-${name}"><ins class="adsbygoogle" style="display:block;width:100%" data-ad-client="${esc(A.client)}" data-ad-slot="${esc(A.slots[name])}" data-ad-format="auto" data-full-width-responsive="true"></ins></div>`;
  };
  window.adInit = function () {
    if (adMode !== 'adsense' || !A.client) return;
    document.querySelectorAll('ins.adsbygoogle:not([data-done])').forEach(el => { el.dataset.done = '1'; try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {} });
  };
  if (adMode === 'adsense' && A.client) {
    const s = document.createElement('script'); s.async = true; s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(A.client);
    document.head.appendChild(s);
  }
  document.querySelectorAll('[data-ad]').forEach(el => { el.outerHTML = window.adSlot(el.dataset.ad); });
  window.adInit();
})();
