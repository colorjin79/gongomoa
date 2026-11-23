import fs from 'node:fs';
import path from 'node:path';
import { COVERAGE } from './coverage.js';
import { SOURCES } from './sources.js';

export function buildWeb(posts, updatedAt) {
  const ROOT = path.resolve(import.meta.dirname, '..');
  const slim = posts.map(({ body, ...rest }) => rest); // 본문은 웹에 싣지 않는다 (링크·요약만)
  const sources = SOURCES.map((s) => ({ id: s.id, region: s.region, name: s.name }));
  fs.mkdirSync(path.join(ROOT, 'web'), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, 'web', 'data.js'),
    `window.NEWS = ${JSON.stringify({ updatedAt, posts: slim })};window.COVERAGE = ${JSON.stringify(COVERAGE)};window.SOURCES = ${JSON.stringify(sources)};`
  );
}
