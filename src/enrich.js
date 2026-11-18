// 요약·분류·대상 태깅. ANTHROPIC_API_KEY가 있으면 Claude, 없으면 규칙 기반.
import { CATEGORIES, AUDIENCES, classify } from './classify.js';
export { CATEGORIES, AUDIENCES };

function ruleBased(p) {
  const { category, audiences } = classify(p);
  let body = (p.body || '')
    .replace(/^[^\n]{0,40}?상세(보기)?\s*[:\-]\s*[\s\S]{0,200}?(정보\s*제공|내용)[\s,]*/, '') // 표 캡션 제거
    .replace(/글쓴이\s*\S+\s*작성일\s*[\d.\-]+\s*조회수\s*[\d\s]*(\S+\.(png|jpe?g|gif))?/g, '') // 게시판 머리말
    .replace(/^정보\s*제공\s*고시공고구분.*?제목\s*/, '')
    .replace(/^정보\s*제공\s*/, '')
    .replace(/조회\s*:\s*\d+\s*주관부서\s*\S+\s*(요약\s*)?/, '')
    .replace(/전화번호[\s\S]*$/, '')
    .replace(/작성일\s*:\s*[\d.\-]+\s*최종수정일\s*:\s*[\d.\-]+/, '')
    .replace(/^구분\s*\S+\s*/, '')
    .replace(/\[[^\]]*\]|첨부파일[\s\S]*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const t = (p.title || '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
  if (t && body.startsWith(t)) body = body.slice(t.length).trim(); // 본문이 제목으로 시작하면 제목 반복 제거
  const junk = /상세(보기)?\s*[:\-]|(\S+,\s*){4,}/.test(body.slice(0, 80)); // 항목명만 나열된 경우
  const summary = !junk && body.length > 40 ? body.slice(0, 110).replace(/\s+\S*$/, '') + '…' : '';
  return { category, audiences, summary, ai: false };
}

async function claude(p, key) {
  const prompt = `다음은 성북구 지역 기관의 공지입니다. JSON만 출력하세요.
{"summary":"핵심만 1~2문장(대상·일정·신청방법 중심, 120자 이내, 합쇼체)","category":"${CATEGORIES.join('|')} 중 하나","audiences":["${AUDIENCES.join('","')}" 중 1~3개]}
본문에 없는 내용은 쓰지 마세요.

제목: ${p.title}
기관: ${p.sourceName}
본문: ${p.body.slice(0, 1800)}`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.SUMMARY_MODEL || 'claude-haiku-5-5', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const j = JSON.parse((await res.json()).content[0].text.match(/\{[\s\S]*\}/)[0]);
  return {
    summary: String(j.summary || '').slice(0, 200),
    category: CATEGORIES.includes(j.category) ? j.category : '기타',
    audiences: (j.audiences || []).filter((a) => AUDIENCES.includes(a)).slice(0, 3),
    ai: true,
  };
}

export async function enrich(posts) {
  const key = process.env.ANTHROPIC_API_KEY;
  console.log(key ? '요약: Claude API 사용' : '요약: API 키 없음 → 규칙 기반(임시)');
  for (const p of posts) {
    if (!p.ai) Object.assign(p, classify(p)); // 분류 규칙이 바뀌어도 기존 글에 반영
    if (p.summary && (p.ai || !key)) continue; // 이미 처리됨
    if (key && !p.ai && !p.body && p.summary) continue; // 본문을 저장하지 않으므로 기존 임시 요약은 본문 없이 AI로 다시 만들지 않는다
    try {
      Object.assign(p, key ? await claude(p, key) : ruleBased(p));
    } catch (e) {
      console.warn(`  요약 실패(${p.title.slice(0, 20)}): ${e.message}`);
      Object.assign(p, ruleBased(p));
    }
    if (!p.audiences?.length) p.audiences = ['시민 일반'];
  }
}
