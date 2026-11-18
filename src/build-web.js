import fs from 'node:fs';
import path from 'node:path';

export function buildWeb(posts, updatedAt) {
  const ROOT = path.resolve(import.meta.dirname, '..');
  const slim = posts.map(({ body, ...rest }) => rest); // 본문은 웹에 싣지 않는다 (링크·요약만)
  fs.mkdirSync(path.join(ROOT, 'web'), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, 'web', 'data.js'),
    `window.NEWS = ${JSON.stringify({ updatedAt, posts: slim })};`
  );
}
