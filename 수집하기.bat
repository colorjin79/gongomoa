@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 성북·강북 공고 수집
echo.
echo  공고를 수집합니다. 가족센터는 요청 간격 때문에 몇 분 걸립니다. 창을 닫지 마세요.
echo.
call node src/crawl.js --limit 15 %*
if errorlevel 1 (
  echo.
  echo  수집 중 오류가 났습니다. 위 메시지를 확인하세요.
  pause
  exit /b 1
)
echo.
echo  완료. 화면을 엽니다.
if not defined NO_OPEN start "" "%~dp0web\index.html"
ping -n 4 127.0.0.1 >nul
