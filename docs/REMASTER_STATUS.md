# 리마스터 구현 상태 · 2026-11-18

기준: [REMASTER_DESIGN.md](./REMASTER_DESIGN.md), B안(독립 앱 화면 계층 교체).

## 구현

1. `domain/tasks.ts`로 기존 Task/makeTasks를 내용 변경 없이 분리하고 14개 테스트 추가.
2. Rhythm_Chord_Block의 지정 10개 파일을 `src/rcb`에 원문 복사. Jua/OFL 라이선스·SVG 자산과 Tailwind4 의존성·별칭 구성.
3. `remaster.html`에 새 입구. `src/remaster`에서 홈·페이지형 지도·도감·연습·도전6종·설정·복습·34페이지 그림 롤북과 과제10종 구현.
4. 원형 음계·7색 음타일·독립 기호 글꼴·마스코트 피드백·정답/오답 애니메이션·7종 스테이지 그림. 음계 배열은 정답 띠를 미리 보여주지 않으며 힌트/안내 뒤에만 표시.
5. 기존 data/storage/audio 및 기존 domain 4개 파일은 변경하지 않음. 저장 키와 스키마1을 공유하여 이전 진행을 유지.

## 검증

- 단위 테스트 **117/117 통과**, TypeScript 및 다중 입구 프로덕션 빌드 통과.
- RCB 지정 10개 파일의 원문 일치 확인.
- 브라우저 프리뷰에서 기존 저장(완료7/별19)이 유지된 홈·지도·과제 선택 확인.
- C장조 음계에서 세 번 오답 → 안내 → 직접 재현 → 반음 두 곳 선택 → 평균60/별1 결과 확인. 기존 최고 별은 유지됨.
- 3도 쌓기 C–E–G 정답 및 피드백, 플레이 중 그림 롤북 열기/닫기 확인.
- 320×568, 360×780, 390×844, 430×932 프리뷰에서 확인한 scale/tower 화면은 body 크기와 스크롤 크기가 일치. 피드백 하단과 액션 상단이 겹치지 않음.
- 실제 iOS/Android 터치·출력 청취·전체195단계 UI 완주는 미검증.

## 기본 입구 전환 보류

`tests/e2e/remaster.spec.ts`와 전용 Playwright 설정은 4시나리오×4화면 = 16사례를 발견한다. 현재 실행환경은 Chromium 시작 시 `socket() failed: Operation not permitted`로 assertions 전에 중단된다. 통과로 집계하지 않는다.

설계 5단계의 **E2E 통과 후 index.html 교체** 조건을 지켜 기본 입구는 기존 앱을 유지한다. 새 화면은 `/remaster.html`에서 사용할 수 있다. 검증 가능한 환경에서 다음 명령을 통과시킨 후 `index.html`의 script를 `/src/remaster/main.tsx`로 교체한다.

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 npx playwright test -c playwright.remaster.config.ts
```

브라우저 프리뷰를 사용하는 환경에서는 해당 서버 주소로 지정한다. 테스트나 승인 없이 기본 입구를 바꾸지 않는다.
