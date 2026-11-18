# 자동 수집·배포 가이드 (GitHub Actions + GitHub Pages)

하루 2회(한국시간 07:00, 15:00) 자동으로 수집하고 사이트를 갱신한다. 서버 비용은 없다(공개 저장소 기준).

## 한 번만 하는 설정
1. **GitHub 가입** — https://github.com (계정이 있으면 생략)
2. **새 저장소 만들기** — 이름 예: `news-hub`, 공개(Public), README·.gitignore는 추가하지 않음
3. **이 폴더에서 올리기** (터미널, 폴더: `seongbuk-news-hub`)
   ```bash
   git init -b main
   git add .
   git commit -m "first commit"
   git remote add origin https://github.com/<내아이디>/news-hub.git
   git push -u origin main
   ```
   처음 push할 때 GitHub 로그인 창이 뜬다(비밀번호·토큰은 직접 입력).
4. **Pages 켜기** — 저장소 Settings → Pages → Source를 **GitHub Actions**로 선택
5. **첫 실행** — 저장소 Actions 탭 → `crawl-and-deploy` → Run workflow. 5~10분 뒤 Settings → Pages에 사이트 주소가 표시된다.
6. **(선택) AI 요약** — Settings → Secrets and variables → Actions → New repository secret
   이름 `ANTHROPIC_API_KEY`, 값에 발급받은 키. 없으면 규칙 기반 임시 요약으로 동작한다.

## 알아둘 점
- 저장소가 공개라서 `data/posts.json`(제목·링크·요약)이 공개된다. 본문은 저장하지 않는다. `docs/`(내부 조사 메모)는 `.gitignore`로 제외했다.
- AI 요약은 **새로 수집된 글에만** 적용된다. 키를 나중에 설정하면 기존 글(임시 요약)은 그대로 남는다.
- 기관 사이트가 바뀌어 수집이 깨지면 Actions 로그에 `실패`가 찍힌다(워크플로 자체는 계속 진행). 주기적으로 Actions 탭을 확인한다.
- 장기간 저장소 활동이 없으면 GitHub이 예약 실행을 멈출 수 있다. 멈추면 Actions 탭에서 다시 활성화한다.
- 가족센터는 요청 간격 10초를 지켜서 실행 시간이 길다(30분 제한 안에서 충분).
- 사이트 이름·문구는 `web/index.html`에서 바꾼다(현재 제목: "성북 소식 모아보기").
