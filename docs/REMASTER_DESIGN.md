# 다이아토닉 학습 게임 리마스터 설계서

대상: `diatonic_chord_edu_game` (코드 크래프터: 조성 왕국 복원기)
기준: `Rhythm_Chord_Block`의 화면 틀·색·그림·피드백 방식
작성일: 2026-11-18

---

## 1. 목표

다이아토닉 게임의 **문제·채점·저장 규칙은 그대로 두고**, 화면과 조작을 Rhythm_Chord_Block처럼 직관적으로 바꾼다.

- 한 화면 고정(스크롤 없음)
- 조작한 자리에서 바로 피드백(소리·움직임·표정)
- 전용 그림 자산 사용, 12px 미만 글자 최소화

## 2. 현황 진단 (390×844 기준 실측)

| | Rhythm_Chord_Block | 다이아토닉 게임 |
|---|---|---|
| 화면 구조 | 확인한 5개 화면 모두 스크롤 없는 한 장 | 스크롤 문서형. 홈 1,553px, 지도 2,040px, 플레이 1,083~1,182px |
| 조작 반응 | 점수 이유·화음 이름·마스코트 표정이 조작한 자리에 바로 표시. @keyframes 34개 | 3도 쌓기 오답 시 보이는 변화는 문제 수(1/7→1/8)뿐. 설명은 하단 버튼 줄에 가려짐. @keyframes 0개, 오답 효과음 없음 |
| 글자 | 12px 미만 지정 10곳 | 12px 미만 지정 100곳(6~9px 45곳), 영어 소제목 혼용 |
| 그림 | 전용 SVG 387장 | 범용 선 아이콘. Phaser(1.2MB)는 홈 장식에만 사용 |

추가 발견:

- 음계 배열 문제에서 정답 음계 띠(C D E F G A B)가 빈칸 바로 위에 그대로 노출된다.
- 하단 고정 `.game-actions`가 안내 말풍선(`.npc-dialogue`)을 가린다 (390×844에서 101px, 360×780에서 63px, 320×568·430×932에서는 0px).
- `docs/design.md` §4.2·§7.2·§13.2가 요구한 고정 3구역 화면, 원형 음계, 필수 애니메이션이 구현되지 않았다. 따라서 이번 작업은 원 설계를 Rhythm_Chord_Block에서 검증된 방식으로 구현하는 일에 가깝다.

## 3. 방식 (B안: 화면 계층 교체)

### 선택지 비교

| 안 | 내용 | 평가 |
|---|---|---|
| A | 색·글꼴·버튼만 교체 | 작업 최소. 스크롤 구조와 가려지는 피드백이 남음 |
| **B** | **화면 계층 교체 (추천)** | 문제·채점은 유지하고 화면·조작만 교체 |
| C | Rhythm_Chord_Block에 세 번째 모드로 합침 | 틀·그림 완전 공유. 다만 앱이 무거워지고 두 게임 배포가 묶임 |

B를 Rhythm_Chord_Block과 같은 폴더 구조로 만들면 나중에 C로 옮길 수 있다.

### 그대로 두는 것

- `src/domain` (theory, questions, challenges, learning)
- `src/data` (worlds 등)
- `src/storage` (저장 키 `chord-crafter-save`, 스키마 버전 1 유지 → 기존 진행 기록 보존)
- `src/audio/AudioService.ts`
- 기능 규칙: 감점 없는 듣기, 세 번 오답 뒤 직접 재현, 화면 낭독용 이름표

### Rhythm_Chord_Block에서 가져오는 것

- 색·글꼴 정의(`globals.css`, Jua 글꼴)
- 화면 틀(`PhoneColumn`, `IconButton`, `Button`, 대화상자)
- 메뉴 카드, 스테이지 목록, 시작·일시정지·결과 카드
- 떠오르는 글자(`FloatingTexts`)
- 아이콘·효과·마스코트·배경 SVG

### 새로 만드는 것

- 과제 화면 10종 (한 화면 고정 + 음계 고리)
- 음이름 타일, 로마 숫자 배지
- 스테이지 소개 그림
- 룰북 그림

## 4. 색 규칙

- **음 타일:** 글자(C~B)에 7색 고정. 어느 조성이든 글자가 한 번씩만 나오므로 30개 조성 모두에서 겹치지 않는다.
- **화음 배지:** 기능별 색. 토닉(Ⅰ) 금색, 프리도미넌트(Ⅳ) 청록, 도미넌트(Ⅴ) 보라.
- **표기:** Jua 글꼴에 ♯ ♭ ° 글자가 없으므로 기호 전용 컴포넌트(`Acc`)가 필요하다. 스파이크에서 검증 완료.

## 5. 단계별 계획

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| 1 | `makeTasks`를 `LevelPlayer.tsx`에서 `domain`으로 분리하고 단위 테스트 추가 | 기존 103개 + 신규 테스트 통과 |
| 2 | Rhythm_Chord_Block 틀·토큰·글꼴 이식 | 별도 입구 `remaster.html`에서 빌드 통과 |
| 3 | **3도 계단 오르기** 한 화면 구현 | 폰에서 터치·소리·오답 피드백 확인 |
| 4 | 나머지 과제 화면, 메뉴·지도·결과 화면 | 195개 스테이지 전체 진행 가능 |
| 5 | 룰북, 그림 자산 마무리, E2E 재작성 | E2E 통과 후 `index.html` 교체 |

배포: 새 화면은 `remaster.html`에서 만들고 마지막에 `index.html`을 교체한다. 그동안 기존 앱은 그대로 배포된다.

## 6. 실현 가능성 검증 결과

스크래치 복사본(`spike/`)에서 확인:

- Rhythm_Chord_Block 파일 10개를 수정 없이 `src/rcb/`에 복사 (`cmp`로 동일 확인)
  - `app/globals.css`, `app/fonts/jua.woff2`, `lib/utils.ts`, `lib/game/layout.ts`, `lib/music/{assets,solfege}.ts`, `components/shell/{PhoneColumn,IconButton,FloatingTexts}.tsx`, `components/ui/button.tsx`
- 별도 입구 `remaster.html` + `vite.config.ts` 다중 엔트리, 별칭 `@` → `src/rcb`
- 추가 의존성: `tailwindcss@4`, `@tailwindcss/vite`, `clsx`, `tailwind-merge`, `class-variance-authority`, `@radix-ui/react-slot`
- 빌드 통과, 단위 테스트 103개 통과, 기존 입구 CSS 해시 동일
- `ProofScreen`이 실제 엔진·오디오로 G♭ 장조, C♯ 자연단음계를 정확히 표시

## 7. 위험과 주의

- 실제 휴대폰의 터치·소리는 아직 검증하지 못했다.
- 다이아토닉 쪽 픽셀 수치는 웹폰트를 받지 못한 환경에서 측정한 값이라 실기기에서 조금 다를 수 있다.
- 문구가 긴 과제(상대조 비교 등)는 한 화면에 맞게 문구와 배치를 다시 잡아야 한다.
- E2E 테스트(`tests/e2e/game.spec.ts`)는 README의 선택자가 실제 버튼과 맞지 않았다 (실제 라벨: "E에서 F 구간 선택"). 새 화면 기준으로 다시 작성한다.
- `learning.ts`의 `createAttemptState`·`recordIncorrect` 등은 UI가 쓰지 않고 있다. 세 번 오답 규칙을 새 화면에서 이 코드로 연결할지 결정이 필요하다.

## 8. 결정이 필요한 항목

1. B안으로 진행할지 (현재 추천안)
2. 첫 구현 화면을 '3도 계단 오르기'로 할지
3. 최종적으로 독립 앱(B)으로 둘지, 장기적으로 Rhythm_Chord_Block 모드(C)까지 갈지
