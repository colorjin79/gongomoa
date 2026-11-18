# 성북·강북 공고 모아보기 (프로토타입 v0.1)

성북구·강북구 기관의 공지·공고를 모아 보여주는 사이트. 지역(성북/강북) 필터 지원.

## 실행
```bash
npm run crawl            # 수집 (신규 글만 추가) → data/posts.json, web/data.js
npm run web              # http://localhost:3000 에서 확인
```
옵션: `node src/crawl.js --limit 15 --only sb-gu,sb-lib --no-detail`

## AI 요약 켜기
환경변수 `ANTHROPIC_API_KEY`를 설정하면 Claude가 요약·분류·대상을 생성한다(기본 모델 claude-haiku-5-5, `SUMMARY_MODEL`로 변경).
키가 없으면 규칙 기반 임시 요약을 쓰며, 키를 설정한 뒤 다시 실행하면 규칙 기반 글만 재처리한다.

## 구조
- `src/sources.js` 기관별 어댑터(목록 URL, 파싱, 본문 선택자) — 기관 추가는 여기에 항목 추가
- `src/crawl.js` 수집·중복제거·저장 / `src/enrich.js` 요약·분류 / `src/build-web.js` 웹용 데이터
- `web/index.html` 피드 화면(탭·분류·대상 필터·검색·북마크)

## 참고
- 가족센터는 robots.txt Crawl-delay 10초를 지킨다. 현재 '가족센터 소식' 게시판은 글이 0건.
- 웹에는 본문을 싣지 않고 요약+원문 링크만 노출한다.

## 더블클릭 실행 (Windows)
- `수집하기.bat` : 수집 → 완료 후 화면(`web/index.html`) 자동 열기. 가족센터 요청 간격 때문에 몇 분 걸린다.
- `보기만.bat` : 수집 없이 저장된 데이터로 화면만 열기.

## 기한·상태·정렬
- `src/deadline.js`: 제목의 `(~11.30.)`, `[채용마감]`과 수집 시점의 본문(접수기간 등)에서 기한을 뽑아 `deadline`, `dl`로 저장.
- 화면은 오늘 날짜와 비교해 D-n·마감 임박·마감·상시 배지를 표시하고, 상태 필터와 정렬(최신순·오래된순·마감임박순·기관별)을 제공.
- 기한 추출 규칙을 바꾼 뒤 기존 글에 반영하려면 `data/posts.json`을 지우고 다시 수집한다.
