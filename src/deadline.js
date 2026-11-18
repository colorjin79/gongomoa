// 공고 기한·상태 추출. 제목은 모든 글에, 본문은 수집 시점(본문이 메모리에 있을 때)에만 쓴다.
// 저장값: deadline(YYYY-MM-DD 또는 null), dl('closed'|'open'|'rolling'|null)
// 화면에서 오늘 날짜와 비교해 진행 중·임박·마감을 계산하므로 매일 다시 수집하지 않아도 갱신된다.

const BODY_CATS = new Set(['강사모집', '지원사업·공모', '채용', '프로그램', '입찰·대관']); // 행사 일정을 기한으로 오인하지 않도록 제한
const DATE = String.raw`((?:20\d{2}\s*[.\-년]\s*)?\d{1,2}\s*[./월]\s*\d{1,2})`;

const iso = (d) => d.toISOString().slice(0, 10);

function toDate(str, postDate) {
  const m = str.replace(/\s+/g, '').match(/^(?:(20\d{2})[.\-년])?(\d{1,2})[./월](\d{1,2})$/);
  if (!m) return null;
  const base = postDate ? new Date(postDate + 'T00:00:00Z') : new Date();
  let y = m[1] ? Number(m[1]) : base.getUTCFullYear();
  let d = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[3])));
  if (isNaN(d) || d.getUTCMonth() !== Number(m[2]) - 1) return null;
  // 연도가 없고 글 등록일보다 한참 이전이면 다음 해로 본다(12월 글의 1월 마감 등)
  if (!m[1] && d < new Date(base.getTime() - 60 * 864e5)) d = new Date(Date.UTC(y + 1, Number(m[2]) - 1, Number(m[3])));
  // 등록일 기준 -7일 ~ +400일 밖이면 기한이 아니라고 본다
  if (d < new Date(base.getTime() - 7 * 864e5) || d > new Date(base.getTime() + 400 * 864e5)) return null;
  return iso(d);
}

const RE_TITLE_TILDE = new RegExp(String.raw`~\s*` + DATE);
const RE_KEY_TILDE = new RegExp(String.raw`(접수|신청|모집|제출|지원|마감|기한)[^~∼～–—]{0,80}?[~∼～–—]\s*` + DATE);
const RE_KEY_UNTIL = new RegExp(String.raw`(접수|신청|모집|제출|마감|기한|지원)[^까]{0,60}?` + DATE + String.raw`\s*일?\.?\s*(?:\([^)]{1,4}\))?\s*(?:\d{1,2}\s*[:시]\s*\d{0,2}\s*)?까지`);

const RE_CLOSED_ANY = /\[[^\]]*마감[^\]]*\]|\(마감\)|마감되었|접수\s*종료|모집\s*종료/;
const RE_CLOSED_RESULT = /결과\s*(공고|공지|안내|발표)|합격자|최종\s*(선정|합격)|선정\s*결과/; // 진행이 끝난 글. 행정공고 등에는 쓰지 않음
const RE_OPEN = /\[(채용중|모집중|접수중|진행중)\]/;
const RE_ROLLING = /상시\s*(모집|접수)|예산\s*소진|소진\s*시|수시\s*(모집|접수)/;

export function applyDeadline(p) {
  const title = p.title || '';
  const body = p.body || '';
  let deadline = p.deadline || null;
  let dl = p.dl === 'rolling' ? 'rolling' : null; // 마감·진행 표시는 제목으로 매번 다시 판정, 상시는 본문에서 뽑은 값을 유지

  // 1) 제목: 모든 분류
  let m = title.match(RE_TITLE_TILDE);
  if (m) deadline = toDate(m[1], p.date) || deadline;
  if (!deadline) {
    m = title.match(RE_KEY_UNTIL);
    if (m) deadline = toDate(m[2], p.date);
  }
  // 2) 본문: 기한이 의미 있는 분류만
  if (!deadline && body && BODY_CATS.has(p.category)) {
    m = body.match(RE_KEY_TILDE);
    if (m) deadline = toDate(m[2], p.date);
    if (!deadline) {
      m = body.match(RE_KEY_UNTIL);
      if (m) deadline = toDate(m[2], p.date);
    }
  }
  // 3) 상태 표시
  if (RE_CLOSED_ANY.test(title) || (BODY_CATS.has(p.category) && RE_CLOSED_RESULT.test(title))) dl = 'closed';
  else if (RE_OPEN.test(title)) dl = 'open';
  else if (!deadline && !dl && BODY_CATS.has(p.category) && RE_ROLLING.test(title + ' ' + body.slice(0, 600))) dl = 'rolling';

  p.deadline = deadline;
  p.dl = dl;
  return p;
}
