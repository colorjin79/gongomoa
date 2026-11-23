// 사용법: node src/crawl.js [--limit 15] [--only sb-gu,sb-lib] [--no-detail]
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { SOURCES, parseDate } from './sources.js';
import { enrich } from './enrich.js';
import { classify } from './classify.js';
import { applyDeadline } from './deadline.js';
import { buildWeb } from './build-web.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const DB = path.join(ROOT, 'data', 'posts.json');
const UA = 'SeongbukNewsHub/0.1 (prototype; personal research)';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const LIMIT = Number(arg('--limit', 15));
const ONLY = arg('--only', '')?.split(',').filter(Boolean);
const NO_DETAIL = args.includes('--no-detail');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, enc) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return enc ? new TextDecoder(enc).decode(await res.arrayBuffer()) : res.text();
}

function extractDate(html) {
  const t = cheerio.load(html).text().replace(/\s+/g, ' ');
  const m = t.match(/(작성일|등록일|게시일|등록|DATE)\s*[:：]?\s*((?:20)?\d{2}[.\-]\d{1,2}[.\-]\d{1,2})/);
  return m ? parseDate(m[2]) : null;
}

function extractBody(html, selectors) {
  const $ = cheerio.load(html);
  $('script, style, nav, header, footer, noscript, iframe').remove();
  for (const sel of selectors || []) {
    const t = $(sel).first().text().replace(/\s+/g, ' ').trim();
    if (t.length > 40) return t.slice(0, 2500);
  }
  const t = ($('main').first().text() || $('body').text()).replace(/\s+/g, ' ').trim();
  return t.slice(0, 2500);
}

const db = fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB, 'utf8')) : { posts: [] };
const known = new Map(db.posts.map((p) => [p.url, { body: '', ...p }]));
for (const [url, p] of known) if (classify(p).category === '행정공고' || url.includes('selectEminwonView.do?key=6977')) known.delete(url); // 고시공고 게시판 글 포함 // 이미 담긴 행정공고도 제거
const now = new Date().toISOString();

for (const src of SOURCES) {
  if (ONLY.length && !ONLY.includes(src.id)) continue;
  const lists = [].concat(src.list);
  let added = 0;
  for (const listUrl of lists) {
    try {
      const html = await get(listUrl, src.encoding);
      const items = src.parse(html, listUrl).slice(0, LIMIT);
      console.log(`[${src.id}] ${listUrl.split('/').slice(-2).join('/')} → 목록 ${items.length}건`);
      await sleep(src.delayMs);
      for (const it of items) {
        if (known.has(it.url)) continue;
        if (classify(it).category === '행정공고') continue; // 일반 행정공고(고시·과태료 등)는 수집하지 않는다
        const post = { source: src.id, sourceName: src.name, ...it, region: it.region || src.region, firstSeen: now, body: it.body || '' };
        if (!NO_DETAIL && !src.noDetail) {
          try {
            const dh = await get(it.url, src.encoding);
            post.body = extractBody(dh, src.content);
            post.date = extractDate(dh) || post.date;
          } catch (e) {
            console.warn(`  본문 실패: ${e.message}`);
          }
          await sleep(src.delayMs);
        }
        known.set(it.url, post);
        added++;
      }
    } catch (e) {
      console.error(`[${src.id}] 실패: ${e.message}`);
    }
  }
  console.log(`[${src.id}] 신규 ${added}건`);
}

const posts = [...known.values()];
for (const p of posts) p.sourceName = SOURCES.find((s) => s.id === p.source)?.name || p.sourceName; // 이름 변경 시 기존 글에도 반영
for (const p of posts) p.region ||= SOURCES.find((s) => s.id === p.source)?.region || '';
await enrich(posts);
for (const p of posts) applyDeadline(p); // 기한·상태(제목 + 수집 시점의 본문)
posts.sort((a, b) => (b.date || b.firstSeen.slice(0, 10)).localeCompare(a.date || a.firstSeen.slice(0, 10)));

fs.mkdirSync(path.dirname(DB), { recursive: true });
fs.writeFileSync(DB, JSON.stringify({ updatedAt: now, posts: posts.map(({ body, ...rest }) => rest) }, null, 1));
buildWeb(posts, now);
console.log(`완료: 총 ${posts.length}건 → data/posts.json, web/data.js`);
