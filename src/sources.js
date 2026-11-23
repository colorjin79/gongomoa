// 기관별 게시판 어댑터. 각 어댑터는 목록 HTML에서 {title, url, date} 배열을 뽑는다.
import * as cheerio from 'cheerio';

const DATE_RE = /(20\d{2}|\d{2})[.\-](\d{1,2})[.\-](\d{1,2})/;

export function parseDate(text = '') {
  const m = text.match(DATE_RE);
  if (!m) return null;
  const y = m[1].length === 2 ? '20' + m[1] : m[1];
  return `${y}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

const clean = (s = '') => s.replace(/\s+/g, ' ').trim();

export const GU = ['종로','중구','용산','성동','광진','동대문','중랑','성북','강북','도봉','노원','은평','서대문','마포','양천','강서','구로','금천','영등포','동작','관악','서초','강남','송파','강동'];

export const SOURCES = [
  {
    id: 'sb-gu',
    region: '성북',
    name: '성북구청',
    list: 'https://www.sb.go.kr/www/selectBbsNttList.do?bbsNo=41&key=6350',
    delayMs: 1000,
    parse(html, base) {
      const $ = cheerio.load(html);
      const out = [];
      $('a[href*="selectBbsNttView"]').each((_, a) => {
        const $a = $(a);
        const row = $a.closest('tr, li');
        const title = clean($a.text()) || clean($a.attr('title'));
        if (!title) return;
        out.push({ title, url: new URL($a.attr('href'), base).href, date: parseDate(row.text()) });
      });
      return out;
    },
    content: ['td.p-table__content', '.bbs__view'],
  },
  {
    id: 'sb-culture',
    region: '성북',
    name: '성북문화재단',
    list: [
      'https://sbculture.or.kr/culture/bbs/BMSR00021/list.do?menuNo=500049', // 공지사항
      'https://sbculture.or.kr/culture/bbs/BMSR00005/list.do?menuNo=500144', // 문화프로그램
    ],
    delayMs: 1000,
    parse(html, base) {
      const $ = cheerio.load(html);
      const out = [];
      $('a[href*="view.do?boardId"]').each((_, a) => {
        const $a = $(a);
        const row = $a.closest('li, tr');
        let title = clean($a.attr('title') || $a.text()).replace(/\s*페이지\s*이동$/, '');
        if (!title) return;
        out.push({ title, url: new URL($a.attr('href'), base).href, date: parseDate(row.text()) });
      });
      return out;
    },
    content: ['#hwpEditorBoardContent', '.board-normal-view'],
  },
  {
    id: 'sb-lib',
    region: '성북',
    name: '성북구립도서관',
    list: 'https://www.sblib.seoul.kr/library/menu/10038/bbs/20001/bbsArticleList.do',
    delayMs: 1000,
    parse(html, base) {
      const $ = cheerio.load(html);
      const out = [];
      $('a[onclick*="fnDetail"]').each((_, a) => {
        const $a = $(a);
        const idx = ($a.attr('onclick').match(/fnDetail\('(\d+)'\)/) || [])[1];
        if (!idx) return;
        const row = $a.closest('tr, li');
        out.push({
          title: clean($a.text()),
          url: new URL(`/library/menu/10038/bbs/20001/bbsArticleDetail.do?bbsArticleIdx=${idx}`, base).href,
          date: parseDate(row.text()),
        });
      });
      return out;
    },
    content: ['td.content', '#contleft'],
  },
  {
    id: 'sb-family',
    region: '성북',
    name: '성북구가족센터',
    list: 'https://sb.familynet.or.kr/web/lay1/bbs/S1T299C302/A/1/list.do',
    delayMs: 10500, // robots.txt Crawl-delay: 10
    parse(html, base) {
      const $ = cheerio.load(html);
      const out = [];
      $('a[href*="view.do?article_seq"]').each((_, a) => {
        const $a = $(a);
        const row = $a.closest('tr, li');
        const title = clean($a.text());
        if (!title) return;
        out.push({ title, url: new URL($a.attr('href'), base).href.replace(/&(cpage|rows|condition|keyword)=[^&]*/g, ''), date: parseDate(row.text()) });
      });
      return out;
    },
    content: ['.board_view', '.bbs_view', '.view_con', '#contents'],
  },
  {
    id: 'sb-youth',
    region: '성북',
    name: '시립성북청소년센터',
    list: 'https://sbyouth.or.kr/board/notice',
    delayMs: 1000,
    parse(html, base) {
      const $ = cheerio.load(html);
      const out = [];
      $('td.sbj a[href*="viewMode=view"]').each((_, a) => {
        const $a = $(a);
        const idx = ($a.attr('href').match(/idx=(\d+)/) || [])[1];
        const row = $a.closest('tr');
        out.push({
          title: clean($a.text()),
          url: `https://sbyouth.or.kr/board/notice?viewMode=view&idx=${idx}`,
          date: parseDate(row.find('td.date').text()),
        });
      });
      return out;
    },
    content: ['#sb-view'],
  },
  {
    id: 'sbgb-edu',
    region: '성북·강북',
    name: '성북강북교육지원청',
    list: 'http://sbgbedu.sen.go.kr/CMS/information/information01/index.html',
    delayMs: 1000,
    parse(html, base) {
      const $ = cheerio.load(html);
      const out = [];
      $('a[href*="/CMS/"][href$=".html"]').each((_, a) => {
        const $a = $(a);
        const href = $a.attr('href');
        if (!/\d{6,}_\d+\.html$/.test(href)) return;
        const row = $a.closest('tr, li');
        const title = clean($a.text());
        if (!title) return;
        out.push({ title, url: new URL(href, base).href, date: parseDate(row.text()) });
      });
      return out;
    },
    content: ['td.cont'],
  },
  {
    id: 'sb-gu-gosi',
    region: '성북',
    name: '성북구청',
    // 고시공고 게시판(key=6977)은 일반 행정공고라 수집하지 않고, 채용공고만 수집한다
    list: ['https://www.sb.go.kr/www/selectEminwonList.do?key=6483&searchCnd=employment'],
    delayMs: 1000,
    parse(html, base) {
      const $ = cheerio.load(html);
      const out = [];
      $('td.p-subject a[href*="selectEminwonView"]').each((_, a) => {
        const $a = $(a);
        const no = ($a.attr('href').match(/notAncmtMgtNo=(\d+)/) || [])[1];
        if (!no) return;
        out.push({
          title: clean($a.text()),
          url: 'https://www.sb.go.kr/www/selectEminwonView.do?key=6977&notAncmtMgtNo=' + no, // 고시공고·채용공고 중복 제거용
          date: parseDate($a.closest('tr').find('td').last().prev().text() + ' ' + $a.closest('tr').text()),
        });
      });
      return out;
    },
    content: ['td.p-table__content', '.epform.gosi'],
  },
  {
    id: 'gb-culture',
    region: '강북',
    name: '강북문화재단',
    list: 'https://www.gbcf.or.kr/load.asp?subPage=510',
    delayMs: 1000,
    parse(html, base) {
      const $ = cheerio.load(html);
      const out = [];
      $('a[href*="subPage=510.view"]').each((_, a) => {
        const $a = $(a);
        const idx = ($a.attr('href').match(/idx=(\d+)/) || [])[1];
        if (!idx) return;
        out.push({
          title: clean($a.text()),
          url: 'https://www.gbcf.or.kr/load.asp?subPage=510.view&idx=' + idx,
          date: parseDate($a.closest('div.subject_inner, li, tr').find('.date').first().text()),
        });
      });
      return out;
    },
    content: ['.view_content', '.board_view', '.view', '#contents'],
  },
  {
    id: 'gb-family',
    region: '강북',
    name: '강북구가족센터',
    list: [
      'https://gangbuk.familynet.or.kr/center/lay1/bbs/S295T311C312/A/6/list.do', // 공지사항
      'https://gangbuk.familynet.or.kr/center/lay1/bbs/S295T311C313/A/7/list.do', // 채용공고
    ],
    delayMs: 10500, // robots.txt Crawl-delay: 10
    parse(html, base) {
      const $ = cheerio.load(html);
      const out = [];
      $('a[href*="view.do?article_seq"]').each((_, a) => {
        const $a = $(a);
        const title = clean($a.text());
        if (!title) return;
        out.push({
          title,
          url: new URL($a.attr('href'), base).href.replace(/&(cpage|rows|condition|keyword)=[^&]*/g, ''),
          date: parseDate($a.closest('tr, li').find('li span').first().text()),
        });
      });
      return out;
    },
    content: ['td#body', 'td.contents', '.board_view'],
  },
  {
    id: 'gb-lib',
    region: '강북',
    name: '강북구립도서관',
    list: 'https://www.gblib.or.kr/gangbuk/board/notice_list.do',
    delayMs: 1000,
    parse(html, base) {
      const $ = cheerio.load(html);
      const out = [];
      $('a[onclick*="go_view("]').each((_, a) => {
        const $a = $(a);
        const idx = ($a.attr('onclick').match(/go_view\('(\d+)'/) || [])[1];
        if (!idx) return;
        out.push({
          title: clean($a.text()),
          url: 'https://www.gblib.or.kr/gangbuk/board/notice_view.do?idx=' + idx + '&gidx=0001',
          date: parseDate($a.closest('li').text()),
        });
      });
      return out;
    },
    content: ['.board_view', '.view_cont', '.view', '#contents'],
  },
  {
    id: 'gb-se',
    region: '강북',
    name: '강북구사회적경제지원센터',
    list: ['https://gbse.kr/bbs/board.php?bo_table=3_1', 'https://gbse.kr/bbs/board.php?bo_table=3_4'],
    delayMs: 1000,
    parse(html, base) {
      const $ = cheerio.load(html);
      const out = [];
      $('td.td_subject a[href*="wr_id="]').each((_, a) => {
        const $a = $(a);
        const title = clean($a.text());
        if (!title) return;
        out.push({ title, url: $a.attr('href').replace(/&amp;/g, '&').replace(/&(page|sfl|stx)=[^&]*/g, ''), date: null });
      });
      return out;
    },
    content: ['#bo_v_con', '#bo_v'],
  },
  {
    id: 'seoul-youth',
    region: '서울',
    name: '서울청년센터',
    // 전 자치구 통합 게시판. 센터(구) 칸의 값을 지역으로 쓴다. 1~3쪽 순회
    list: [1, 2, 3].flatMap((n) => [
      'https://youth.seoul.go.kr/orang/bbs/list.do?key=2309200009&pageIndex=' + n, // 공지사항
      'https://youth.seoul.go.kr/orang/bbs/list.do?key=2309210007&pageIndex=' + n, // 동네정보퐁퐁
    ]),
    delayMs: 1500,
    parse(html, base) {
      const $ = cheerio.load(html);
      const key = (base.match(/key=(\d+)/) || [])[1];
      const out = [];
      $('tbody tr').each((_, tr) => {
        const $tr = $(tr);
        const a = $tr.find('a[onclick*="goView("]').first();
        const sn = (a.attr('onclick') || '').match(/goView\('(\d+)'\)/)?.[1];
        if (!sn) return;
        const title = clean(a.text());
        const cells = $tr.find('td').map((_, td) => clean($(td).text())).get();
        const center = cells.find((c) => GU.includes(c)) || (title.match(/서울청년센터\s*(\S+)/)?.[1] || '').replace(/[^가-힣]/g, '');
        out.push({
          title: title.replace(/\s*New$/, ''),
          url: 'https://youth.seoul.go.kr/orang/bbs/view.do?key=' + key + '&pstSn=' + sn,
          date: parseDate($tr.text()),
          region: GU.includes(center) ? center : '서울',
        });
      });
      return out;
    },
    content: ['.board-content', '.board-detail-wrap'],
  },
  {
    id: 'sb-se',
    region: '성북',
    name: '성북구사회적경제센터',
    // 아임웹 사이트: 목록이 브라우저에서 그려지므로 사이트 자체 JSON 게시판 API를 쓴다(공개 접근, 로그인 불필요).
    // 11824=공지사항, 11825=외부공모/지원사업. 상세 페이지는 JS 렌더링이라 API가 주는 요약문을 본문으로 쓴다.
    list: [
      'https://www.sbnet.or.kr/api/boards/11825/posts/search?page=1&count=30&sortType=createdDate&sortBy=desc&withFixedPost=true',
      'https://www.sbnet.or.kr/api/boards/11824/posts/search?page=1&count=30&sortType=createdDate&sortBy=desc&withFixedPost=true',
    ],
    delayMs: 1000,
    noDetail: true,
    parse(text, base) {
      const j = JSON.parse(text);
      return [...(j.fixed || []), ...(j.list || [])]
        .filter((p) => p.isVisible !== false && !p.isSecret && p.status !== 'secret')
        .filter((p) => !/^비밀글/.test(p.title || ''))
        .map((p) => ({
          title: clean((p.title || '').replace(/\s*[｜|]\s*성북구사회적경제센터\s*$/, '')),
          url: 'https://www.sbnet.or.kr/board/' + p.boardId + '/' + p.id,
          date: parseDate(p.createdDate || ''),
          body: clean(p.seoDescription || ''),
        }))
        .filter((p) => p.title);
    },
    content: [],
  },
  {
    id: 'gb-women',
    region: '강북',
    name: '강북여성인력개발센터',
    // 서울커리업(구 서울우먼업) 계열. D1101=취업/창업정보(채용·모집), D1102=커뮤니티(교육 공지)
    list: [
      'https://gangbuk.seoulcareerup.or.kr/gangbuk/common/bbs/selectPageListBBS.do?bbs_code=D1101',
      'https://gangbuk.seoulcareerup.or.kr/gangbuk/common/bbs/selectPageListBBS.do?bbs_code=D1102',
    ],
    delayMs: 1500,
    parse(html, base) {
      const $ = cheerio.load(html);
      const code = (base.match(/bbs_code=(\w+)/) || [])[1];
      const out = [];
      $('a[onclick*="fnSelect("]').each((_, a) => {
        const $a = $(a);
        const seq = ($a.attr('onclick').match(/fnSelect\('(\d+)'/) || [])[1];
        if (!seq) return;
        const title = clean($a.text()).replace(/^공지\s*/, '');
        if (!title) return;
        out.push({
          title,
          url: 'https://gangbuk.seoulcareerup.or.kr/gangbuk/common/bbs/selectBBS.do?bbs_code=' + code + '&bbs_seq=' + seq,
          date: parseDate($a.closest('tr').text()),
        });
      });
      return out;
    },
    content: ['.view_content', '#list_detail', '.staff_detail'],
  },
  {
    id: 'sb-childcare',
    region: '성북',
    name: '성북구육아종합지원센터',
    list: 'https://www.gongdan.go.kr/childCare/bbs/selectPageListBbs.do?bbs_code=I2002', // 공지사항
    delayMs: 1500,
    parse(html, base) {
      const $ = cheerio.load(html);
      const out = [];
      $('ul.board_list li a[onclick*="fnDetail("]').each((_, a) => {
        const $a = $(a);
        const seq = ($a.attr('onclick').match(/fnDetail\('(\d+)'/) || [])[1];
        if (!seq) return;
        const title = clean($a.find('.tit1').text()) || clean($a.find('.tit_box').text());
        if (!title) return;
        out.push({
          title,
          url: 'https://www.gongdan.go.kr/childCare/bbs/selectBbs.do?bbs_code=I2002&bbs_seq=' + seq,
          date: parseDate($a.find('.date').text()),
        });
      });
      return out;
    },
    content: ['.board_view', '.editor_view'],
  },
  {
    // 평생학습관의 공지는 별도 누리집이 없고 성북통합예약포털 공지사항에 '[평생학습]' 말머리로 올라온다
    id: 'sb-lll',
    region: '성북',
    name: '성북구평생학습관',
    list: 'https://www.sb.go.kr/yeyak/selectBbsNttList.do?bbsNo=75&key=6530',
    delayMs: 1000,
    parse(html, base) {
      const $ = cheerio.load(html);
      const out = [];
      $('a[href*="selectBbsNttView"]').each((_, a) => {
        const $a = $(a);
        const title = clean($a.text());
        if (!title) return;
        out.push({ title, url: new URL($a.attr('href'), base).href, date: parseDate($a.closest('tr').text()) });
      });
      return out;
    },
    content: ['#contents'],
  },
];

// 서울50플러스 구 센터(14곳). 같은 사이트·같은 구조라 한 팩토리로 만든다. 코드↔구 대응은 각 센터 페이지 제목으로 확인함.
const PLUS50 = { sbc: '성북', gbc: '강북', ddc: '동대문', djc: '동작', gch: '금천', gdc: '강동', gnc: '관악', gsc: '강서', nwc: '노원', sch: '서초', sdc: '성동', sdm: '서대문', ycp: '양천', ysc: '용산' };
function plus50(code, gu) {
  return {
    id: code === 'gbc' ? 'gb-50plus' : 'p50-' + code,
    region: gu,
    name: gu + '50플러스센터',
    list: ['https://www.50plus.or.kr/' + code + '/notice.do'].concat(code === 'gbc' ? ['https://www.50plus.or.kr/gbc/recruit.do'] : []),
    delayMs: 1000,
    parse(html, base) {
      const $ = cheerio.load(html);
      const out = [];
      const seen = new Set();
      $('a[href*="detail.do?id="]').each((_, a) => {
        const $a = $(a);
        const title = clean($a.find('h3').text());
        const url = new URL($a.attr('href'), 'https://www.50plus.or.kr/' + code + '/').href;
        if (!title || seen.has(url)) return;
        seen.add(url);
        let row = $a;
        while (row.length && !row.find('.board-box__info__post-date').length) row = row.parent();
        out.push({ title, url, date: parseDate(row.find('.board-box__info__post-date').first().text()) });
      });
      return out;
    },
    content: ['.post-content'],
  };
}
SOURCES.push(...Object.entries(PLUS50).map(([c, g]) => plus50(c, g)));

import { makeSeoulSources } from './sources-seoul.js';
SOURCES.push(...makeSeoulSources({ cheerio, parseDate, clean }));
