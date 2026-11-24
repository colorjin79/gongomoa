// 서울 다른 구 어댑터(2차: 구청 3곳 + 강남 계열). 같은 구조끼리 팩토리로 만든다.
export function makeSeoulSources({ cheerio, parseDate, clean, GU }) {
  // 전자정부 표준형 구청 게시판(selectBbsNttList.do / selectBbsNttView.do). 성북구청과 같은 계열.
  // 목록 페이지에 사이드 메뉴 링크도 섞여 있어 해당 게시판(bbsNo)의 글만 고른다.
  function nttBoard({ id, region, name, origin, boards, delayMs = 1500, content }) {
    return {
      id,
      region,
      name,
      list: boards.map((b) => `${origin}/${b.path}/selectBbsNttList.do?bbsNo=${b.no}&key=${b.key}`),
      delayMs,
      parse(html, base) {
        const no = (base.match(/bbsNo=(\d+)/) || [])[1];
        const $ = cheerio.load(html);
        const seen = new Set();
        const out = [];
        $('a[href*="selectBbsNttView"]').each((_, a) => {
          const $a = $(a);
          const href = $a.attr('href') || '';
          if (!new RegExp('bbsNo=' + no + '(&|$)').test(href)) return;
          const ntt = (href.match(/nttNo=(\d+)/) || [])[1];
          if (!ntt || seen.has(ntt)) return;
          const title = clean($a.text()).replace(/\s*(새글|NEW)$/, '');
          if (!title) return;
          seen.add(ntt);
          const key = (base.match(/key=(\d+)/) || [])[1];
          out.push({
            title,
            url: `${origin}/${base.split('/').slice(3, -1).join('/')}/selectBbsNttView.do?key=${key}&bbsNo=${no}&nttNo=${ntt}`,
            date: parseDate($a.closest('tr').find('td').map((_, td) => clean($(td).text())).get().find((c) => /^\d{4}[.\-]\d{1,2}[.\-]\d{1,2}$/.test(c)) || $a.closest('tr, li').text().replace(title, '')),
          });
        });
        return out;
      },
      content: content || ['td.p-table__content', '.bbs__view', '.bbs_view', '#contents'],
    };
  }

  // 강남구 계열: 구청과 산하기관이 한 도메인의 /office/<코드>/board/<게시판>/list.do 구조를 공유한다.
  function gangnamBoard({ id, name, boards, delayMs = 1500 }) {
    return {
      id,
      region: '강남',
      name,
      list: boards,
      delayMs,
      parse(html, base) {
        const $ = cheerio.load(html);
        const out = [];
        const seen = new Set();
        $('tbody a[href$="/view.do"], tbody a[href*="/view.do?"]').each((_, a) => {
          const $a = $(a);
          const href = $a.attr('href') || '';
          if (!/\/board\/[^/]+\/\d+\/view\.do|\/notice\/view\.do|\/recruit\/notice\/\d+\/view\.do/.test(href)) return;
          const url = new URL(href, base).href;
          if (seen.has(url)) return;
          const row = $a.closest('tr');
          const title = clean($a.text()) || clean(row.find('td.subject, td.title').text());
          if (!title) return;
          seen.add(url);
          out.push({ title, url, date: parseDate(row.text()) });
        });
        return out;
      },
      content: ['.board_view', '.view_cont', '.bbs-view', '#contents', '.contents'],
    };
  }


  // 표/목록형 게시판 공통 팩토리(3차). aSel: 글 링크 선택자, url: (a, base) → 상세 주소, dateSel: 행 안의 날짜 칸(없으면 행 전체에서 찾음)
  function board({ id, region, name, list, delayMs = 1500, aSel, url, dateSel, rowSel = 'tr, li', content, encoding, max = 15, noDetail }) {
    return {
      id, region, name, list, delayMs, encoding, noDetail, content: content || [],
      parse(html, base) {
        const $ = cheerio.load(html);
        const out = [];
        const seen = new Set();
        $(aSel).each((_, a) => {
          const $a = $(a);
          const u = url($a, base);
          if (!u || seen.has(u)) return;
          const row = $a.closest(rowSel);
          const title = clean($a.text() || $a.attr('title')).replace(/\s*(새글|NEW|N)$/, '');
          if (!title) return;
          seen.add(u);
          out.push({ title, url: u, date: parseDate(dateSel ? row.find(dateSel).first().text() : row.text()) });
        });
        return out.slice(0, max);
      },
    };
  }
  const qs = (base, k) => (base.match(new RegExp('[?&]' + k + '=([^&]+)')) || [])[1];

  const G = 'https://www.gangnam.go.kr';
  const o = (code, board, mid) => `${G}/office/${code}/board/${board}/list.do?mid=${mid}`;

  return [

    board({
      id: 'nowon-gu', content: ['div.txt'], region: '노원', name: '노원구청', content: ['.bbs-view', '.board-view', '#contents'],
      list: ['https://www.nowon.kr/www/user/bbs/BD_selectBbsList.do?q_bbsCode=1001&q_estnColumn1=11', 'https://www.nowon.kr/www/user/bbs/BD_selectBbsList.do?q_bbsCode=1003&q_estnColumn7=Y'],
      aSel: 'td.cell-subject a', dateSel: 'td.cell-date',
      url: ($a, base) => { const sn = (($a.attr('onclick') || '') + ($a.attr('href') || '')).match(/opView\('(\d+)'\)|q_bbscttSn=(\d+)/); const n = sn && (sn[1] || sn[2]); return n ? 'https://www.nowon.kr/www/user/bbs/BD_selectBbs.do?q_bbsCode=' + qs(base, 'q_bbsCode') + '&q_bbscttSn=' + n : null; },
    }),
    board({
      id: 'nowon-arts', content: ['div.notice_view'], region: '노원', name: '노원문화재단',
      list: ['https://www.nowonarts.kr/channels/notice/posts', 'https://www.nowonarts.kr/channels/job/posts'],
      aSel: 'td.tb_subject a', dateSel: 'td.tb_date', url: ($a) => $a.attr('href'),
    }),
    board({
      id: 'seocho-gu', content: ['div.view_contents'], region: '서초', name: '서초구청', list: ['https://www.seocho.go.kr/site/seocho/ex/bbs/List.do?cbIdx=57'],
      aSel: 'td.title a[href*="View.do"]', dateSel: 'td[data-label="등록일"]',
      url: ($a, base) => { const m = ($a.attr('href') || '').match(/cbIdx=(\d+)&bcIdx=(\d+)/); return m ? 'https://www.seocho.go.kr/site/seocho/ex/bbs/View.do?cbIdx=' + m[1] + '&bcIdx=' + m[2] : null; },
    }),
    board({
      id: 'gwanak-gu', content: ['div.board-view'], region: '관악', name: '관악구청', list: ['https://www.gwanak.go.kr/site/gwanak/ex/bbs/List.do?cbIdx=239'],
      aSel: 'td.title a[onclick*="doBbsFView"]', dateSel: 'td.wdate', delayMs: 3000,
      url: ($a) => { const m = ($a.attr('onclick') || '').match(/doBbsFView\('(\d+)','(\d+)'/); return m ? 'https://www.gwanak.go.kr/site/gwanak/ex/bbs/View.do?cbIdx=' + m[1] + '&bcIdx=' + m[2] : null; },
    }),
    board({
      id: 'gangdong-gu', content: ['div.detail_view'], region: '강동', name: '강동구청',
      list: ['https://www.gangdong.go.kr/web/newportal/bbs/b_068/list', 'https://www.gangdong.go.kr/web/newportal/bbs/b_075/list'],
      aSel: 'td.tlt a', url: ($a, base) => { const h = $a.attr('href'); return h ? new URL(h.split('?')[0], base).href : null; },
    }),
    board({
      id: 'sdm-gu', content: ['table.boardWrite tr:last-of-type'], region: '서대문', name: '서대문구청', encoding: 'euc-kr',
      list: ['https://www.sdm.go.kr/news/news/notice.do', 'https://www.sdm.go.kr/genre/economic/jobinfo/jobs.do'],
      aSel: 'a[href^="javascript:goView"]', rowSel: 'tr',
      url: ($a, base) => { const n = ($a.attr('href') || '').match(/goView\('(\d+)'/)?.[1]; return n ? base.split('?')[0] + '?mode=view&sdmBoardSeq=' + n : null; },
    }),
    board({
      dateSel: 'span.date', id: 'gwangjin-gu',noDetail: true, region: '광진', name: '광진구청', delayMs: 10500, max: 8,
      list: ['https://www.gwangjin.go.kr/portal/bbs/B0000001/list.do?menuNo=200', 'https://www.gwangjin.go.kr/portal/bbs/B0000004/list.do?menuNo=200'],
      aSel: 'a[href*="/B0000001/view.do"], a[href*="/B0000004/view.do"]',
      url: ($a, base) => { const m = ($a.attr('href') || '').match(/(\/portal\/bbs\/B\d+\/view\.do)\?nttId=(\d+)/); return m ? 'https://www.gwangjin.go.kr' + m[1] + '?nttId=' + m[2] + '&menuNo=200' : null; },
    }),
    board({
      id: 'gwangjin-arts', noDetail: true, region: '광진', name: '광진문화재단', list: ['https://www.naruart.or.kr/community/notice_list.php'],
      aSel: 'p.sbj a', dateSel: 'p.day', url: ($a, base) => { const m = ($a.attr('href') || '').match(/idx=(\d+)/); return m ? 'https://www.naruart.or.kr/community/notice_view.php?idx=' + m[1] : null; },
    }),
    board({
      id: 'geumcheon-arts', noDetail: true, region: '금천', name: '금천문화재단', list: ['https://gcfac.or.kr/board/notice?gcfac_menu_cd=U0139'],
      aSel: 'tr[onclick*="goBoardView"] td.title a', rowSel: 'tr',
      url: ($a) => { const n = ($a.closest('tr').attr('onclick') || '').match(/goBoardView\('(\d+)'/)?.[1]; return n ? 'https://gcfac.or.kr/board/noticeDetail?board_seq=' + n + '&gcfac_menu_cd=U0139' : null; },
    }),
    nttBoard({
      id: 'ddm-gu', region: '동대문', name: '동대문구청', origin: 'https://www.ddm.go.kr',
      boards: [{ path: 'www', no: 38, key: 198 }, { path: 'www', no: 42, key: 208 }, { path: 'www', no: 43, key: 210 }, { path: 'www', no: 164, key: 587 }],
    }),
    nttBoard({
      id: 'guro-gu', region: '구로', name: '구로구청', origin: 'https://www.guro.go.kr',
      boards: [{ path: 'www', no: 662, key: 1790 }, { path: 'www', no: 664, key: 1792 }],
    }),
    nttBoard({
      id: 'gcn-gu', region: '금천', name: '금천구청', origin: 'https://www.geumcheon.go.kr',
      boards: [{ path: 'portal', no: 4, key: 293 }, { path: 'edu', no: 268, key: 3066 }],
    }),
    gangnamBoard({ id: 'gn-gfac', name: '강남문화재단', boards: [o('gfac', 'gfac_notice', 'gfac_notice01'), o('gfac', 'gfac_chargeteacher', 'gfac_chargeTeacher'), o('gfac', 'gfac_staffrec', 'gfac_staffRec')] }),
    gangnamBoard({ id: 'gn-family', name: '강남구가족센터', boards: [o('gngfamily', 'gngfamily_notice', 'gngfamily_notice')] }),
    gangnamBoard({ id: 'gn-youth', name: '강남청년누리', boards: [o('youthgn', 'youthgn_notice', 'youthgn_notice')] }),
    gangnamBoard({ id: 'gn-job', name: '강남구일자리통합지원센터', boards: [o('giesc', 'giesc_center_notice', 'giesc_center_notice'), `${G}/office/giesc/recruit/notice/list.do?mid=giesc_recruit_notice`] }),
    gangnamBoard({ id: 'gn-digital', name: '강남구신중년디지털일자리센터', boards: [o('gndjc', 'gndjc_notice', 'gndjc_notice')] }),
    gangnamBoard({ id: 'gn-jahwal', name: '강남지역자활센터', boards: [o('gjhope', 'gjhope_notice', 'gjhope_notice')] }),
    gangnamBoard({ id: 'gn-yeoksam', name: '역삼청소년센터', boards: [o('gyyc', 'gyyc_18', 'gyyc_notice'), o('gyyc', 'gyyc_35', 'gyyc_recruit')] }),
    gangnamBoard({ id: 'gn-welfare', name: '강남복지재단', boards: [o('welfare', 'welfare_board', 'welfare_notice')] }),

    // 기업마당(중소벤처기업부 지원사업 통합 사이트). 전국 사업이 올라오므로 서울특별시와 중앙부처 사업만 담는다.
    // 목록 표에 신청기간·소관 기관이 있어 상세 페이지는 읽지 않고 표 내용으로 마감일을 정한다. schEndAt=N 은 마감 안 된 사업만.
    {
      id: 'bizinfo', region: '서울', name: '기업마당', delayMs: 1500, noDetail: true,
      list: [1, 2, 3, 4, 5, 6].map((n) => `https://www.bizinfo.go.kr/sii/siia/selectSIIA200View.do?schEndAt=N&cpage=${n}`),
      parse(html) {
        const $ = cheerio.load(html);
        const out = [];
        $('tbody tr').each((_, tr) => {
          const $tr = $(tr);
          const a = $tr.find('a[href*="selectSIIA200Detail"]').first();
          const id = (a.attr('href') || '').match(/pblancId=(PBLN_\d+)/)?.[1];
          if (!id) return;
          const c = $tr.find('td').map((_, td) => clean($(td).text())).get(); // 번호, 분야, 사업명, 신청기간, 소관, 수행기관, 등록일, 조회
          const org = c[4] || '';
          const seoul = org.startsWith('서울');
          const local = /(특별시|광역시|특별자치시|특별자치도|통합특별시|도)$/.test(org); // 시·도 단위 소관
          if (local && !seoul) return; // 다른 지역 사업은 제외
          const title = clean(a.attr('title') ? a.attr('title').replace(/\s*페이지 이동$/, '') : a.text());
          const gu = seoul ? (GU || []).find((g) => (title + ' ' + (c[5] || '')).includes(g)) : '';
          const end = (c[3] || '').match(/~\s*(\d{4}-\d{2}-\d{2})/)?.[1];
          const rolling = /소진|상시|수시/.test(c[3] || '');
          out.push({
            title,
            url: `https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=${id}`,
            date: parseDate(c[6] || ''),
            region: gu || '서울',
            deadline: end || null,
            dl: rolling && !end ? 'rolling' : null,
            body: `기업마당 지원사업. 소관 ${org}${c[5] ? ' · 수행기관 ' + c[5] : ''}${c[1] ? ' · 지원분야 ' + c[1] : ''}. 신청기간 ${c[3] || '원문 확인'}.`,
          });
        });
        return out;
      },
      content: [],
    },

    // 가족센터(한국건강가정진흥원) 중앙 사이트의 '지역센터 채용공고' 게시판. area=A001 로 서울 권역만 요청한다.
    // robots.txt Crawl-delay 10초를 지키고, 상세는 읽지 않는다(상세 주소는 센터별 사이트로 연결되는 구조).
    {
      id: 'familynet-seoul', region: '서울', name: '가족센터(서울 지역센터 채용)', delayMs: 10500, noDetail: true,
      list: ['https://www.familynet.or.kr/web/lay1/bbs/S1T299C416/A/15/list.do?rows=30&cpage=1&area=A001'],
      parse(html) {
        const $ = cheerio.load(html);
        const out = [];
        $('td.tit').each((_, td) => {
          const $td = $(td);
          const a = $td.find('a[onclick*="showRecruitView_center"]').first();
          const seq = (a.attr('onclick') || '').match(/showRecruitView_center\('(\d+)'/)?.[1];
          const title = clean(a.text());
          if (!seq || !title) return;
          const info = {};
          $td.find('li').each((_, li) => { info[clean($(li).find('b').text())] = clean($(li).find('span').text()); });
          const gu = (info['지역센터'] || '').split('>')[1]?.trim().replace(/구$/, '') || '';
          out.push({
            title,
            url: `https://www.familynet.or.kr/web/lay1/bbs/S1T299C416/A/15/view.do?article_seq=${seq}`,
            date: parseDate(info['작성일'] || ''),
            region: (GU || []).includes(gu) ? gu : '서울',
            body: `${info['지역센터'] || '서울'} 가족센터 채용공고.`,
          });
        });
        return out;
      },
      content: [],
    },

    // 서울특별시 사회적경제지원센터(워드프레스). 공식 REST 주소로 글 목록을 JSON으로 받는다. 18=사회적경제 공지, 30=사회적경제 구인.
    ...[['sehub', 18, '공지'], ['sehub-job', 30, '구인']].map(([id, cat, label]) => ({
      id, region: '서울', name: '서울시사회적경제지원센터', delayMs: 1500, noDetail: true,
      list: [`https://sehub.net/wp-json/wp/v2/posts?categories=${cat}&per_page=20&_fields=id,date,title,link,excerpt`],
      parse(json) {
        let arr = [];
        try { arr = JSON.parse(json); } catch (e) { return []; }
        const txt = (s) => clean(cheerio.load(`<p>${s || ''}</p>`).text());
        return arr.map((p) => ({
          title: txt(p.title?.rendered),
          url: p.link,
          date: (p.date || '').slice(0, 10),
          body: txt(p.excerpt?.rendered),
        })).filter((x) => x.title && x.url);
      },
      content: [],
    })),

    // 한국예술인복지재단 공지사항(채용·위탁기관 모집·지원사업 안내). robots.txt 없음. 목록은 정적 HTML.
    {
      id: 'kawf', region: '서울', name: '한국예술인복지재단', delayMs: 1500,
      list: ['https://www.kawf.kr/notice/sub01.do'],
      parse(html) {
        const $ = cheerio.load(html);
        const out = [];
        $('p.Common_Bbs_Table_Type1_Item').each((_, p) => {
          const $p = $(p);
          const idx = $p.attr('data-pidx'); // cheerio는 속성 이름을 소문자로 읽는다
          const title = clean($p.find('a').text());
          if (!idx || !title) return;
          const d = clean($p.closest('li').find('p.date').text()); // 26.11.24 형식
          const m = d.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
          out.push({
            title,
            url: `https://www.kawf.kr/notice/sub01View.do?selIdx=${idx}`,
            date: m ? `20${m[1]}-${m[2]}-${m[3]}` : parseDate(d),
          });
        });
        return out;
      },
      content: ['.view-con', '.board-wrap.type-view1', '.content'],
    },

    // 아트모아(예술경영지원센터) 문화예술 채용정보. 근무지가 서울인 공고만 담고, 표에 마감일이 있어 상세 페이지는 읽지 않는다.
    {
      id: 'artmore-job', region: '서울', name: '아트모아 채용', delayMs: 1500, noDetail: true,
      list: [1, 2, 3].map((n) => `https://www.artmore.kr/sub/recruit/search_list.do?page=${n}`),
      parse(html) {
        const $ = cheerio.load(html);
        const out = [];
        $('tbody tr').each((_, tr) => {
          const $tr = $(tr);
          const a = $tr.find('a.jobs_title').first();
          const idx = (a.attr('href') || '').match(/rec_idx=(\d+)/)?.[1];
          if (!idx) return;
          const place = clean($tr.find('.jobs_wkplace').text());
          if (!/^서울/.test(place)) return; // 서울 근무지만
          const org = clean($tr.find('.jobs_cname').clone().children().remove().end().text());
          const state = clean(a.find('.jobs_list_state').text());
          const raw = clean(a.clone().children().remove().end().text());
          const title = org && !raw.includes(org.replace(/^\(.\)/, '')) ? `[${org}] ${raw}` : raw;
          const end = clean($tr.find('.jobs_regi_end-time').text()).match(/(\d{4}-\d{2}-\d{2})/)?.[1];
          const reg = clean($tr.find('.jobs_regi_stt-time').text()).match(/(\d{4}-\d{2}-\d{2})/)?.[1];
          const gu = (GU || []).find((g) => place.includes(g + '구')) || '';
          out.push({
            title: state === '마감' ? title + ' (마감)' : title,
            url: `https://www.artmore.kr/sub/recruit/search_view.do?rec_idx=${idx}`,
            date: reg || null,
            region: gu || '서울',
            deadline: end || null,
            body: `${org} 채용. 근무지 ${place}. ${clean($tr.find('.jobs_career').text())}. ${clean($tr.find('.jobs_salary').text())}. 마감 ${end || '원문 확인'}.`,
          });
        });
        return out;
      },
      content: [],
    },

    // 아르떼(한국문화예술교육진흥원) 공지사항. 문화예술교육 사업·공모 안내가 올라온다.
    {
      id: 'arte', region: '서울', name: '아르떼(문화예술교육진흥원)', delayMs: 1500,
      list: ['https://arte.or.kr/information/notice/Notice_BoardList.do'],
      parse(html) {
        const $ = cheerio.load(html);
        const out = [];
        $('tbody tr').each((_, tr) => {
          const $tr = $(tr);
          const id = ($tr.find('a[href*="fnView("]').attr('href') || '').match(/fnView\('([^']+)'\)/)?.[1];
          if (!id) return;
          const title = clean($tr.find('a[href*="fnView("] span').first().text() || $tr.find('a[href*="fnView("]').text());
          if (!title) return;
          out.push({
            title,
            url: `https://arte.or.kr/information/notice/Notice_BoardView.do?board_id=${id}`,
            date: parseDate($tr.find('td').map((_, td) => clean($(td).text())).get().find((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)) || ''),
          });
        });
        return out.slice(0, 20);
      },
      content: ['.board_view', '.comm_view', '#contents'],
    },
  ];
}
