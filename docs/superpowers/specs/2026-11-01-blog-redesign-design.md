# 블로그 리디자인 설계 — 학습 지도형 사이드바

- 날짜: 2026-11-01
- 참고: https://blog.fruitworld.dev/categories/cs-fundamentals/ (구조만 참고, 그대로 복제하지 않음)
- 확정안: 레이아웃 B(학습 지도형) + 톤 1(잉크 & 그린)

## 목표

1. 상단 메뉴 대신 왼쪽 사이드바(프로필 + 분류 트리)로 바꾼다.
2. 사이드바의 CS·언어 메뉴는 "앞으로 공부할 주제" 목록이며, 주제마다 진행도(쓴 글 / 계획한 글)를 보여 준다.
3. 주제가 늘어나도 사이드바가 길어지지 않게 한다.
4. 기존 글 13편, 태그, 시리즈, 검색, RSS는 그대로 동작한다.

## 범위 밖

- 댓글, 조회수, 다국어
- 글 본문 마크다운 렌더링 스타일 변경(색 토큰 교체로 생기는 변화만 허용)
- 기존 URL(`/blog/...`, `/tags/...`, `/series/...`) 변경

## 1. 정보 구조와 데이터

### 1.1 주제 정의 — `src/data/topics.ts`

사이드바 트리와 주제 페이지 체크리스트의 유일한 출처.

```ts
export type Topic = {
  slug: string;          // 'cs/network', 'cs/database/index', 'lang/java', 'retro'
  name: string;          // 'Network'
  plan?: string[];       // 이 주제에서 다룰 것. 없으면 체크리스트·진행도 없음
  children?: Topic[];    // 하위 주제(트리 최대 3단계: 그룹 > 주제 > 하위 주제)
};

export type TopicGroup = {
  id: 'cs' | 'lang' | 'projects' | 'retro';
  name: string;          // 'CS', '언어', '프로젝트', '회고'
  topics: Topic[];
};
```

초기 그룹과 주제:

| 그룹 | 주제 |
| --- | --- |
| CS | Network, Operating System, Database, 자료구조, 알고리즘 |
| 언어 | Java |
| 프로젝트 | 트리는 `series` 값에서 자동 생성(Relay 채팅 서버, keepup 운영기, Astro 블로그 만들기) |
| 회고 | `retro` 하나(plan 없음) |

각 CS 주제와 Java의 `plan`은 구현 때 기본안을 채우고, 사용자가 검토해서 고친다.

### 1.2 글 frontmatter — `topic`, `planItem` 추가

`src/content.config.ts`의 blog 스키마에 선택 필드 두 개를 추가한다.

- `topic?: string` — `topics.ts`에 정의된 slug. CS·언어·회고 글에 쓴다.
- `planItem?: string` — 그 주제 `plan`의 항목 문자열. 적으면 해당 체크리스트 항목이 완료로 표시되고 이 글로 링크된다.

검증(빌드 실패 조건):

- `topic`이 `topics.ts`에 없는 slug면 실패.
- `planItem`이 그 topic의 `plan`에 없는 문자열이면 실패.
- `planItem`이 있는데 `topic`이 없으면 실패.

프로젝트 그룹은 기존 `series`를 그대로 쓴다. 기존 글 수정은 `why-i-joined-grit.md`에 `topic: 'retro'` 한 줄 추가뿐이다.

### 1.3 진행도 계산

- 주제 진행도 = `planItem`으로 완료 표시된 서로 다른 plan 항목 수 / `plan.length`.
- 그룹 진행도 = 그룹 안 모든 주제(하위 주제 포함)의 분자 합 / 분모 합.
- `plan`이 없는 주제(회고, 프로젝트)는 진행도 대신 글 수만 표시한다.
- `topic`은 있지만 `planItem`이 없는 글은 글 수에는 들어가고 진행도에는 들어가지 않는다.
- `draft: true` 글은 모든 집계에서 뺀다(기존 `getPosts()`와 동일).

## 2. 화면 구성

### 2.1 공통 레이아웃 — `BaseLayout.astro` + 새 `Sidebar.astro`

- 왼쪽 사이드바(폭 약 260px, `position: sticky`, 높이 100vh, 독립 스크롤).
  - 프로필: `AUTHOR`, 한 줄 소개, `GITHUB_URL` 링크, RSS 링크.
  - 분류 트리(아래 2.2 규칙).
  - 하단 링크: About · Projects · Tags · Series.
- 상단 가로 메뉴(`Header.astro`의 링크 목록)는 제거. 검색 아이콘과 다크 모드 버튼은 본문 영역 오른쪽 위에 남긴다.
- 768px 이하: 사이드바 숨김, ☰ 버튼으로 왼쪽 드로어 열기. ESC·바깥 클릭으로 닫힘.

### 2.2 사이드바 트리 규칙

1. 그룹(CS, 언어, 프로젝트, 회고)은 기본 접힘. 현재 페이지가 속한 그룹과 그 경로만 펼친다. 홈에서는 CS만 펼친다.
2. 진행 막대는 그룹 줄에만 그린다. 주제·하위 주제 줄에는 `2/8` 숫자만.
3. 트리 깊이는 최대 3단계(그룹 > 주제 > 하위 주제).
4. 글이 0편인 주제는 흐리게(muted) 표시하되 클릭은 가능.
5. 접기/펼치기는 `<details>`/`<summary>`로 구현해 JS 없이도 동작한다.
6. 현재 주제 줄은 강조색 배경 칩으로 표시.

### 2.3 페이지

| 경로 | 내용 |
| --- | --- |
| `/` | 짧은 소개 2~3줄 → CS 로드맵 요약(그룹별 진행 막대 + "다음에 공부할 것" = 아직 완료되지 않은 plan 항목 앞에서 3개) → 최근 글 10개 |
| `/topics/[...slug]` (신규) | 제목, `n / m 정리함` + 막대, "이 주제에서 다룰 것" 체크리스트(완료 항목은 글 링크), 하위 주제 목록, 해당 주제 글 목록. 하위 주제 페이지의 글은 상위 주제 페이지 목록에도 포함 |
| `/topics/retro` | 체크리스트 없이 글 목록만 |
| `/blog/[...slug]` | 본문 위 경로 표시(`CS › Network`, topic 없으면 생략), 기존 SeriesBox 유지, 하단에 "같은 주제의 다른 글"(최대 5개, topic 있을 때만) |
| `/about` | 기존 내용 + 현재 홈의 긴 소개·다루는 주제·기술 스택 섹션을 옮겨 옴 |
| 프로젝트 그룹 항목 | 기존 `/series/[series]`로 링크 |

글 목록 한 줄(`PostList.astro`): 제목(굵게) / 설명 2줄 말줄임 / mono 메타 줄(`날짜 · 태그 · 읽는 시간`). 읽는 시간은 본문 글자 수 ÷ 500자/분, 올림.

## 3. 시각 톤 — 잉크 & 그린

`src/styles/global.css`의 색 토큰을 아래로 교체한다(기존 `data-theme` 토글 방식 유지).

| 토큰 | 라이트 | 다크 |
| --- | --- | --- |
| `--bg` | `#ffffff` | `#0f1311` |
| `--bg-soft` (사이드바) | `#f7f8f7` | `#141a17` |
| `--text` | `#1c1f1d` | `#e4e9e6` |
| `--text-muted` | `#6b716d` | `#8d9691` |
| `--border` | `#e6e9e7` | `#26302b` |
| `--accent` | `#15803d` | `#4ade80` |
| `--accent-soft` (활성 칩 배경) | `#e8f5ec` | `#1b2e22` |
| `--progress` | `#16a34a` | `#22c55e` |

글꼴: 본문 Pretendard(기존), 메타·숫자·코드 JetBrains Mono(신규 `--font-mono`, 웹폰트 로드 실패 시 `ui-monospace, Menlo, monospace`).

## 4. 구현 단위

| 단위 | 책임 | 의존 |
| --- | --- | --- |
| `src/data/topics.ts` | 주제 정의 | 없음 |
| `src/utils/topics.ts` | slug 조회, 글↔주제 매핑, 진행도 계산, frontmatter 검증 | topics.ts, `getPosts()` |
| `Sidebar.astro` | 프로필 + 트리 렌더링, 현재 경로 펼침 | utils/topics |
| `TopicChecklist.astro` | 체크리스트 렌더링 | utils/topics |
| `ProgressBar.astro` | 막대 하나 | 없음 |
| `pages/topics/[...slug].astro` | 주제 페이지 | 위 컴포넌트들 |
| 수정: `BaseLayout`, `Header`, `PostList`, `BlogPost`, `index`, `about`, `global.css`, `content.config.ts` | 위 2·3절 반영 | — |

## 5. 확인 방법

1. `npm run build`가 성공하고 pagefind 인덱스가 생성된다.
2. `utils/topics.ts`의 진행도 계산·검증 함수에 단위 테스트(vitest)를 둔다: 진행도 합산, 하위 주제 포함, draft 제외, 잘못된 topic/planItem 시 에러.
3. 잘못된 `topic` 값을 가진 임시 글로 빌드가 실패하는지 확인한다.
4. `astro dev`로 띄워 확인: 홈 / `/topics/cs/network` / 기존 글 1편 / `/series/...` / `/tags/...` / `/search` — 라이트·다크, 데스크톱·모바일(375px) 폭에서 스크린샷.
5. 기존 글 13편의 URL이 모두 200으로 열린다.
