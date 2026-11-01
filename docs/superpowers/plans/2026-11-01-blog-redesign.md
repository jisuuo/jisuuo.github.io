# 블로그 리디자인 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상단 메뉴를 왼쪽 학습 지도형 사이드바(프로필 + CS/언어/프로젝트/회고 트리 + 진행도)로 바꾸고, 잉크 & 그린 톤과 주제 페이지를 추가한다.

**Architecture:** 주제 정의는 `src/data/topics.ts` 한 곳에 두고, 트리 탐색·진행도·검증은 `astro:content`에 의존하지 않는 순수 모듈 `src/utils/topic-tree.ts`로 분리해 vitest로 테스트한다. 같은 검증 함수를 `content.config.ts`의 `superRefine`에서 호출해 잘못된 frontmatter는 빌드를 실패시킨다. 화면은 `BaseLayout`이 사이드바 + 본문 2단 그리드를 그린다.

**Tech Stack:** Astro 7, TypeScript, astro/zod, vitest 5, pagefind(기존)

**Spec:** `docs/superpowers/specs/2026-11-01-blog-redesign-design.md`

## Global Constraints

- 기존 URL(`/blog/...`, `/tags/...`, `/series/...`, `/search`, `/rss.xml`)은 바꾸지 않는다.
- 기존 글 수정은 `src/content/blog/why-i-joined-grit.md`에 `topic: 'retro'` 한 줄 추가뿐이다.
- 사이드바 폭 260px, 본문 폭은 기존 `--content-width: 760px` 유지. 모바일 기준 768px 이하.
- 트리 깊이 최대 3단계(그룹 > 주제 > 하위 주제). 진행 막대는 그룹 줄에만.
- 색 토큰은 스펙 3절 표의 값을 그대로 쓴다. 기존 `data-theme` 토글 방식 유지.
- 글꼴: 본문 Pretendard(기존), 메타·숫자·코드 JetBrains Mono.
- 읽는 시간 = `Math.max(1, Math.ceil(본문 글자 수 / 500))`분.
- `draft` 글은 기존 `getPosts()` 규칙을 따른다(개발 서버에서만 포함).
- 기존 코드 스타일: 탭 들여쓰기, 작은따옴표, 한국어 JSDoc 한 줄 주석.

## 파일 구조

| 파일 | 상태 | 책임 |
| --- | --- | --- |
| `src/utils/topic-tree.ts` | 신규 | 타입, 트리 탐색, 검증, 진행도, 읽는 시간(순수 함수) |
| `src/utils/topic-tree.test.ts` | 신규 | 위 함수 단위 테스트 |
| `src/data/topics.ts` | 신규 | 주제 그룹·plan 데이터 |
| `src/content.config.ts` | 수정 | `topic`, `planItem` 필드 + 검증 |
| `src/styles/global.css` | 수정 | 색 토큰, 폰트 변수, 2단 레이아웃, 모바일 드로어 |
| `src/components/BaseHead.astro` | 수정 | JetBrains Mono 로드 |
| `src/components/ProgressBar.astro` | 신규 | 진행 막대 하나 |
| `src/components/Sidebar.astro` | 신규 | 프로필 + 분류 트리 |
| `src/components/Header.astro` | 수정 | 링크 목록 제거, ☰·검색·테마 버튼만 |
| `src/components/HeaderLink.astro` | 삭제 | Header 변경으로 사용처 없음 |
| `src/layouts/BaseLayout.astro` | 수정 | 2단 레이아웃, `activeTopic`/`activeSeries` 전달 |
| `src/components/PostList.astro` | 수정 | 설명 2줄 말줄임, mono 메타 + 읽는 시간 |
| `src/components/TopicChecklist.astro` | 신규 | "이 주제에서 다룰 것" |
| `src/pages/topics/[...slug].astro` | 신규 | 주제 페이지 |
| `src/layouts/BlogPost.astro` | 수정 | 경로 표시, 같은 주제의 다른 글, 사이드바 활성화 |
| `src/pages/series/[series].astro` | 수정 | 사이드바 활성화 |
| `src/pages/index.astro` | 수정 | 짧은 소개 + CS 로드맵 + 최근 글 10개 + 대표 프로젝트(유지) |
| `src/pages/about.astro` | 수정 | 홈의 긴 소개·다루는 주제·기술 스택을 옮겨 옴 |

---

### Task 1: 주제 트리 순수 로직 + vitest

**Files:**
- Create: `src/utils/topic-tree.ts`
- Test: `src/utils/topic-tree.test.ts`
- Modify: `package.json` (devDependency `vitest`, script `test`)

**Interfaces:**
- Produces:
  - `type Topic = { slug: string; name: string; plan?: string[]; children?: Topic[] }`
  - `type TopicGroup = { id: 'cs' | 'lang' | 'projects' | 'retro'; name: string; topics: Topic[] }`
  - `type TopicRef = { topic?: string; planItem?: string }`
  - `type Progress = { done: number; total: number }`
  - `flattenTopics(topics: Topic[]): Topic[]`
  - `topicTrail(groups: TopicGroup[], slug: string): { group: TopicGroup; path: Topic[] } | undefined`
  - `validateTopicRef(groups: TopicGroup[], ref: TopicRef): string | undefined`
  - `isInTopic(postTopic: string | undefined, slug: string): boolean`
  - `completedItems(topic: Topic, refs: TopicRef[]): Set<string>`
  - `progressOf(topics: Topic[], refs: TopicRef[]): Progress`
  - `nextPlanItems(topics: Topic[], refs: TopicRef[], limit: number): { topic: Topic; item: string }[]`
  - `readingMinutes(text: string): number`

- [ ] **Step 1: vitest 설치와 스크립트 추가**

Run: `npm i -D vitest@^5`
`package.json`의 `scripts`에 `"test": "vitest run"` 추가.

- [ ] **Step 2: 실패하는 테스트 작성** — `src/utils/topic-tree.test.ts`

```ts
import { describe, expect, test } from 'vitest';
import {
	completedItems,
	flattenTopics,
	isInTopic,
	nextPlanItems,
	progressOf,
	readingMinutes,
	topicTrail,
	validateTopicRef,
	type TopicGroup,
} from './topic-tree';

const groups: TopicGroup[] = [
	{
		id: 'cs',
		name: 'CS',
		topics: [
			{ slug: 'cs/network', name: 'Network', plan: ['TCP', 'HTTP', 'DNS'] },
			{
				slug: 'cs/database',
				name: 'Database',
				plan: ['트랜잭션'],
				children: [{ slug: 'cs/database/index', name: '인덱스', plan: ['B+Tree', '실행 계획'] }],
			},
		],
	},
	{ id: 'retro', name: '회고', topics: [{ slug: 'retro', name: '회고' }] },
];
const [cs, retro] = groups;

describe('flattenTopics', () => {
	test('하위 주제까지 전위 순회로 펼친다', () => {
		expect(flattenTopics(cs.topics).map((t) => t.slug)).toEqual([
			'cs/network',
			'cs/database',
			'cs/database/index',
		]);
	});
});

describe('topicTrail', () => {
	test('그룹과 최상위부터의 경로를 돌려준다', () => {
		const trail = topicTrail(groups, 'cs/database/index');
		expect(trail?.group.id).toBe('cs');
		expect(trail?.path.map((t) => t.name)).toEqual(['Database', '인덱스']);
	});
	test('없는 slug면 undefined', () => {
		expect(topicTrail(groups, 'cs/nope')).toBeUndefined();
	});
});

describe('validateTopicRef', () => {
	test('topic이 없으면 통과', () => {
		expect(validateTopicRef(groups, {})).toBeUndefined();
	});
	test('올바른 topic과 planItem은 통과', () => {
		expect(validateTopicRef(groups, { topic: 'cs/database/index', planItem: 'B+Tree' })).toBeUndefined();
		expect(validateTopicRef(groups, { topic: 'retro' })).toBeUndefined();
	});
	test('없는 topic은 에러', () => {
		expect(validateTopicRef(groups, { topic: 'cs/nope' })).toContain('알 수 없는 topic');
	});
	test('plan에 없는 planItem은 에러', () => {
		expect(validateTopicRef(groups, { topic: 'cs/network', planItem: 'TLS' })).toContain('plan에 없는');
	});
	test('하위 주제의 planItem을 상위 주제에 쓰면 에러', () => {
		expect(validateTopicRef(groups, { topic: 'cs/database', planItem: 'B+Tree' })).toContain('plan에 없는');
	});
	test('topic 없이 planItem만 있으면 에러', () => {
		expect(validateTopicRef(groups, { planItem: 'TCP' })).toContain('topic이 필요');
	});
});

describe('isInTopic', () => {
	test('자기 자신과 하위 주제는 포함, 이름이 겹치는 다른 주제는 제외', () => {
		expect(isInTopic('cs/database', 'cs/database')).toBe(true);
		expect(isInTopic('cs/database/index', 'cs/database')).toBe(true);
		expect(isInTopic('cs/databases', 'cs/database')).toBe(false);
		expect(isInTopic(undefined, 'cs/database')).toBe(false);
	});
});

describe('completedItems / progressOf', () => {
	const refs = [
		{ topic: 'cs/network', planItem: 'TCP' },
		{ topic: 'cs/network', planItem: 'TCP' }, // 같은 항목 두 번은 한 번으로
		{ topic: 'cs/network' }, // planItem 없는 글은 진행도에 안 들어감
		{ topic: 'cs/database/index', planItem: 'B+Tree' },
		{},
	];
	test('주제 자신의 완료 항목만 센다', () => {
		expect([...completedItems(cs.topics[0], refs)]).toEqual(['TCP']);
		expect(completedItems(cs.topics[1], refs).size).toBe(0);
	});
	test('하위 주제를 포함해 합산한다', () => {
		expect(progressOf([cs.topics[1]], refs)).toEqual({ done: 1, total: 3 });
	});
	test('그룹 전체를 합산한다', () => {
		expect(progressOf(cs.topics, refs)).toEqual({ done: 2, total: 6 });
	});
	test('plan이 없으면 0/0', () => {
		expect(progressOf(retro.topics, refs)).toEqual({ done: 0, total: 0 });
	});
});

describe('nextPlanItems', () => {
	test('완료되지 않은 항목을 주제 순서대로 limit개', () => {
		const refs = [{ topic: 'cs/network', planItem: 'TCP' }];
		expect(nextPlanItems(cs.topics, refs, 3).map((n) => `${n.topic.slug}:${n.item}`)).toEqual([
			'cs/network:HTTP',
			'cs/network:DNS',
			'cs/database:트랜잭션',
		]);
	});
});

describe('readingMinutes', () => {
	test('500자당 1분, 올림, 최소 1분', () => {
		expect(readingMinutes('')).toBe(1);
		expect(readingMinutes('가'.repeat(500))).toBe(1);
		expect(readingMinutes('가'.repeat(501))).toBe(2);
	});
});
```

- [ ] **Step 3: 실패 확인**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./topic-tree"`

- [ ] **Step 4: 구현** — `src/utils/topic-tree.ts`

```ts
/** 주제 트리 계산. astro:content에 의존하지 않아 content.config.ts와 테스트에서 함께 쓴다. */

export type Topic = {
	slug: string;
	name: string;
	/** 이 주제에서 다룰 것. 없으면 체크리스트·진행도 없이 글 수만 보여 준다. */
	plan?: string[];
	children?: Topic[];
};

export type TopicGroup = {
	id: 'cs' | 'lang' | 'projects' | 'retro';
	name: string;
	topics: Topic[];
};

/** 글 frontmatter 중 주제와 관련된 부분. */
export type TopicRef = { topic?: string; planItem?: string };

export type Progress = { done: number; total: number };

/** 하위 주제까지 펼친 목록(전위 순회). */
export function flattenTopics(topics: Topic[]): Topic[] {
	return topics.flatMap((t) => [t, ...flattenTopics(t.children ?? [])]);
}

/** slug가 속한 그룹과, 최상위 주제부터 그 주제까지의 경로. */
export function topicTrail(
	groups: TopicGroup[],
	slug: string,
): { group: TopicGroup; path: Topic[] } | undefined {
	for (const group of groups) {
		const path = findPath(group.topics, slug);
		if (path) return { group, path };
	}
}

function findPath(topics: Topic[], slug: string): Topic[] | undefined {
	for (const t of topics) {
		if (t.slug === slug) return [t];
		const rest = findPath(t.children ?? [], slug);
		if (rest) return [t, ...rest];
	}
}

/** frontmatter의 topic/planItem이 올바르지 않으면 에러 메시지를 돌려준다. */
export function validateTopicRef(groups: TopicGroup[], { topic, planItem }: TopicRef): string | undefined {
	if (planItem && !topic) return `planItem("${planItem}")에는 topic이 필요합니다`;
	if (!topic) return;
	const trail = topicTrail(groups, topic);
	if (!trail) return `알 수 없는 topic: "${topic}" (src/data/topics.ts 확인)`;
	if (planItem && !trail.path.at(-1)!.plan?.includes(planItem)) {
		return `"${topic}"의 plan에 없는 planItem: "${planItem}"`;
	}
}

/** 글의 topic이 slug 자신이거나 그 하위 주제인지. */
export function isInTopic(postTopic: string | undefined, slug: string): boolean {
	return postTopic === slug || !!postTopic?.startsWith(`${slug}/`);
}

/** 이 주제(하위 제외)의 plan 중 글로 완료된 항목. */
export function completedItems(topic: Topic, refs: TopicRef[]): Set<string> {
	return new Set(refs.filter((r) => r.topic === topic.slug && r.planItem).map((r) => r.planItem!));
}

/** 주제들(하위 포함)의 완료 항목 수 / plan 항목 수. */
export function progressOf(topics: Topic[], refs: TopicRef[]): Progress {
	return flattenTopics(topics).reduce(
		(sum, t) => ({
			done: sum.done + completedItems(t, refs).size,
			total: sum.total + (t.plan?.length ?? 0),
		}),
		{ done: 0, total: 0 },
	);
}

/** 아직 글이 없는 plan 항목을 주제 순서대로 limit개. */
export function nextPlanItems(
	topics: Topic[],
	refs: TopicRef[],
	limit: number,
): { topic: Topic; item: string }[] {
	return flattenTopics(topics)
		.flatMap((topic) => {
			const done = completedItems(topic, refs);
			return (topic.plan ?? []).filter((item) => !done.has(item)).map((item) => ({ topic, item }));
		})
		.slice(0, limit);
}

/** 읽는 시간(분). 500자/분, 올림, 최소 1분. */
export function readingMinutes(text: string): number {
	return Math.max(1, Math.ceil(text.length / 500));
}
```

- [ ] **Step 5: 통과 확인**

Run: `npm test`
Expected: PASS (모든 테스트)

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json src/utils/topic-tree.ts src/utils/topic-tree.test.ts
git commit -m "주제 트리 계산 로직과 단위 테스트 추가"
```

---

### Task 2: 주제 데이터 + frontmatter 검증

**Files:**
- Create: `src/data/topics.ts`
- Modify: `src/content.config.ts` (blog 스키마)
- Modify: `src/content/blog/why-i-joined-grit.md` (frontmatter 한 줄)

**Interfaces:**
- Consumes: `TopicGroup`, `validateTopicRef` (Task 1)
- Produces: `TOPIC_GROUPS: TopicGroup[]`, blog 엔트리 `data.topic?: string`, `data.planItem?: string`

- [ ] **Step 1: 주제 데이터 작성** — `src/data/topics.ts`

```ts
import type { TopicGroup } from '../utils/topic-tree';

/** 사이드바 트리와 주제 페이지 체크리스트의 출처. 주제를 추가하려면 여기에 항목을 더한다. */
export const TOPIC_GROUPS: TopicGroup[] = [
	{
		id: 'cs',
		name: 'CS',
		topics: [
			{
				slug: 'cs/network',
				name: 'Network',
				plan: [
					'OSI 7계층과 TCP/IP',
					'TCP 연결 수립과 종료',
					'TCP 흐름 제어와 혼잡 제어',
					'UDP',
					'HTTP/1.1',
					'HTTP/2와 HTTP/3',
					'TLS 핸드셰이크',
					'DNS',
					'로드밸런서와 프록시',
					'WebSocket',
				],
			},
			{
				slug: 'cs/os',
				name: 'Operating System',
				plan: [
					'프로세스와 스레드',
					'CPU 스케줄링',
					'동기화: 뮤텍스와 세마포어',
					'데드락',
					'가상 메모리와 페이징',
					'페이지 교체',
					'파일 시스템',
					'I/O 모델: 블로킹, 논블로킹, epoll',
				],
			},
			{
				slug: 'cs/database',
				name: 'Database',
				plan: [
					'B+Tree 인덱스',
					'실행 계획 읽기',
					'트랜잭션과 ACID',
					'트랜잭션 격리 수준',
					'MVCC',
					'락',
					'정규화',
					'커넥션 풀',
				],
			},
			{
				slug: 'cs/data-structure',
				name: '자료구조',
				plan: ['배열과 연결 리스트', '스택, 큐, 덱', '해시 테이블', '트리와 이진 탐색 트리', '힙과 우선순위 큐', '그래프'],
			},
			{
				slug: 'cs/algorithm',
				name: '알고리즘',
				plan: ['시간 복잡도', '정렬', '이분 탐색', 'BFS와 DFS', '최단 경로', '동적 계획법', '그리디'],
			},
		],
	},
	{
		id: 'lang',
		name: '언어',
		topics: [
			{
				slug: 'lang/java',
				name: 'Java',
				plan: [
					'JVM 메모리 구조',
					'GC',
					'클래스 로딩',
					'컬렉션 프레임워크',
					'제네릭',
					'스레드와 동시성 유틸리티',
					'Java 메모리 모델과 volatile',
					'스트림과 람다',
				],
			},
		],
	},
	// 프로젝트 그룹의 항목은 글의 series 값에서 자동으로 만든다.
	{ id: 'projects', name: '프로젝트', topics: [] },
	{ id: 'retro', name: '회고', topics: [{ slug: 'retro', name: '회고' }] },
];
```

- [ ] **Step 2: 잘못된 topic으로 빌드가 통과해 버리는지(아직 검증 없음) 확인**

`why-i-joined-grit.md` frontmatter의 `tags: ['grit']` 아래에 `topic: 'nope'` 임시 추가 후
Run: `npx astro build`
Expected: 성공 — 스키마에 `topic`이 없어 무시되므로 검증이 필요함을 확인

- [ ] **Step 3: 스키마에 필드와 검증 추가** — `src/content.config.ts`

import 추가:
```ts
import { TOPIC_GROUPS } from './data/topics';
import { validateTopicRef } from './utils/topic-tree';
```
blog 스키마의 `draft: z.boolean().default(false),` 다음 줄에 필드를 추가하고, `z.object({...})` 뒤에 `superRefine`을 붙인다:
```ts
			draft: z.boolean().default(false),
			// src/data/topics.ts의 slug. 예: 'cs/network'
			topic: z.string().optional(),
			// 그 주제 plan의 항목. 적으면 체크리스트에 완료로 표시된다.
			planItem: z.string().optional(),
		})
		.superRefine((data, ctx) => {
			const error = validateTopicRef(TOPIC_GROUPS, data);
			if (error) ctx.addIssue({ code: 'custom', message: error });
		}),
```

- [ ] **Step 4: 잘못된 topic으로 빌드 실패 확인**

Run: `npx astro build`
Expected: FAIL — `InvalidContentEntryDataError ... 알 수 없는 topic: "nope"`

- [ ] **Step 5: grit 글에 올바른 topic 적용**

`topic: 'nope'`을 `topic: 'retro'`로 바꾼다.
Run: `npm run build && npm test`
Expected: 둘 다 성공

- [ ] **Step 6: 커밋**

```bash
git add src/data/topics.ts src/content.config.ts src/content/blog/why-i-joined-grit.md
git commit -m "주제 데이터와 topic/planItem frontmatter 검증 추가"
```

---

### Task 3: 잉크 & 그린 색 토큰 + JetBrains Mono

**Files:**
- Modify: `src/styles/global.css:1-19` (토큰), 본문 `code`/`pre` 규칙
- Modify: `src/components/BaseHead.astro` (폰트 링크)

**Interfaces:**
- Produces: CSS 변수 `--bg --bg-soft --text --text-muted --border --accent --accent-soft --progress --font-mono --sidebar-width`

- [ ] **Step 1: 토큰 교체** — `global.css` 맨 위 두 블록을 아래로 교체

```css
:root {
	--content-width: 760px;
	--sidebar-width: 260px;
	--font-mono: 'JetBrains Mono', ui-monospace, Menlo, monospace;
	--accent: #15803d;
	--accent-soft: #e8f5ec;
	--progress: #16a34a;
	--text: #1c1f1d;
	--text-muted: #6b716d;
	--bg: #ffffff;
	--bg-soft: #f7f8f7;
	--border: #e6e9e7;
	color-scheme: light;
}
:root[data-theme='dark'] {
	--accent: #4ade80;
	--accent-soft: #1b2e22;
	--progress: #22c55e;
	--text: #e4e9e6;
	--text-muted: #8d9691;
	--bg: #0f1311;
	--bg-soft: #141a17;
	--border: #26302b;
	color-scheme: dark;
}
```

- [ ] **Step 2: 코드 글꼴** — `global.css`의 `code {` 규칙과 `pre {` 규칙에 각각 `font-family: var(--font-mono);` 추가

- [ ] **Step 3: 폰트 로드** — `BaseHead.astro`의 Pretendard `<link>` 바로 아래에 추가

```astro
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
	rel="stylesheet"
	href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap"
/>
```

- [ ] **Step 4: 확인**

Run: `npm run build`
Expected: 성공. `grep -c "#15803d" dist/_astro/*.css` 결과 1 이상.

- [ ] **Step 5: 커밋**

```bash
git add src/styles/global.css src/components/BaseHead.astro
git commit -m "잉크 & 그린 색 토큰과 JetBrains Mono 적용"
```

---

### Task 4: 사이드바 + 2단 레이아웃 + 모바일 드로어

**Files:**
- Create: `src/components/ProgressBar.astro`, `src/components/Sidebar.astro`
- Modify: `src/layouts/BaseLayout.astro`, `src/components/Header.astro`, `src/styles/global.css`
- Delete: `src/components/HeaderLink.astro`

**Interfaces:**
- Consumes: `TOPIC_GROUPS`, `progressOf`, `isInTopic`, `topicTrail`, `getPosts`, `groupBy`, `slugify`
- Produces:
  - `<ProgressBar done={number} total={number} />`
  - `<Sidebar activeTopic?: string activeSeries?: string />`
  - `BaseLayout` Props에 `activeTopic?: string; activeSeries?: string` 추가

- [ ] **Step 1: ProgressBar** — `src/components/ProgressBar.astro`

```astro
---
interface Props {
	done: number;
	total: number;
}

const { done, total } = Astro.props;
const percent = total ? Math.round((done / total) * 100) : 0;
---

<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax={total} aria-valuenow={done}>
	<i style={`width: ${percent}%`}></i>
</div>

<style>
	.progress {
		height: 4px;
		overflow: hidden;
		border-radius: 2px;
		background: var(--border);
	}
	i {
		display: block;
		height: 100%;
		background: var(--progress);
	}
</style>
```

- [ ] **Step 2: Sidebar** — `src/components/Sidebar.astro`

```astro
---
import { AUTHOR, GITHUB_URL, SITE_DESCRIPTION } from '../consts';
import { TOPIC_GROUPS } from '../data/topics';
import { getPosts, groupBy, slugify } from '../utils/posts';
import { isInTopic, progressOf, topicTrail, type Topic, type TopicGroup } from '../utils/topic-tree';
import ProgressBar from './ProgressBar.astro';

interface Props {
	activeTopic?: string;
	activeSeries?: string;
}

const { activeTopic, activeSeries } = Astro.props;
const posts = await getPosts();
const refs = posts.map((p) => p.data);
const series = [...groupBy(posts, 'series')];

// 현재 주제의 경로(그룹 + 상위 주제들)만 펼친다. 아무 것도 활성이 아니면 CS를 펼친다.
const trail = activeTopic ? topicTrail(TOPIC_GROUPS, activeTopic) : undefined;
const openGroup = trail?.group.id ?? (activeSeries ? 'projects' : 'cs');
const openSlugs = new Set(trail?.path.map((t) => t.slug));

const countOf = (slug: string) => posts.filter((p) => isInTopic(p.data.topic, slug)).length;
const topicLabel = (topic: Topic) => {
	const { done, total } = progressOf([topic], refs);
	return total ? `${done}/${total}` : String(countOf(topic.slug));
};
const groupStats = (group: TopicGroup) => {
	if (group.id === 'projects') return { label: String(series.reduce((n, [, ps]) => n + ps.length, 0)), progress: undefined };
	const progress = progressOf(group.topics, refs);
	const count = group.topics.reduce((n, t) => n + countOf(t.slug), 0);
	return progress.total ? { label: `${progress.done}/${progress.total}`, progress } : { label: String(count), progress: undefined };
};
---

<aside class="sidebar" id="sidebar">
	<div class="profile">
		<a class="name" href="/">{AUTHOR}</a>
		<p class="bio">{SITE_DESCRIPTION}</p>
		<p class="links">
			<a href={GITHUB_URL} target="_blank" rel="noopener">GitHub</a>
			·
			<a href="/rss.xml">RSS</a>
		</p>
	</div>

	<nav class="tree" aria-label="분류">
		<a class="row all" href="/blog/"><span>전체 글</span><span class="count">{posts.length}</span></a>
		{
			TOPIC_GROUPS.map((group) => {
				const { label, progress } = groupStats(group);
				return (
					<details open={group.id === openGroup}>
						<summary class="row group">
							<span>{group.name}</span>
							<span class="count">{label}</span>
						</summary>
						{progress && <ProgressBar {...progress} />}
						<ul>
							{group.id === 'projects'
								? series.map(([name, ps]) => (
										<li>
											<a class:list={['row', { active: name === activeSeries }]} href={`/series/${slugify(name)}/`}>
												<span>{name}</span>
												<span class="count">{ps.length}</span>
											</a>
										</li>
									))
								: group.topics.map((topic) => (
										<li>
											<a
												class:list={['row', { active: topic.slug === activeTopic, empty: countOf(topic.slug) === 0 }]}
												href={`/topics/${topic.slug}/`}
											>
												<span>{topic.name}</span>
												<span class="count">{topicLabel(topic)}</span>
											</a>
											{topic.children && openSlugs.has(topic.slug) && (
												<ul>
													{topic.children.map((child) => (
														<li>
															<a
																class:list={['row', 'sub', { active: child.slug === activeTopic, empty: countOf(child.slug) === 0 }]}
																href={`/topics/${child.slug}/`}
															>
																<span>{child.name}</span>
																<span class="count">{topicLabel(child)}</span>
															</a>
														</li>
													))}
												</ul>
											)}
										</li>
									))}
						</ul>
					</details>
				);
			})
		}
	</nav>

	<nav class="pages" aria-label="페이지">
		<a href="/about/">About</a>
		<a href="/projects/">Projects</a>
		<a href="/tags/">Tags</a>
		<a href="/series/">Series</a>
	</nav>
</aside>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1.75rem 1rem;
		border-right: 1px solid var(--border);
		background: var(--bg-soft);
		font-size: 0.9rem;
		line-height: 1.5;
	}
	.profile {
		padding: 0 0.5rem;
	}
	.name {
		color: var(--text);
		font-size: 1.1rem;
		font-weight: 700;
		text-decoration: none;
	}
	.bio,
	.links {
		margin: 0.25rem 0 0;
		color: var(--text-muted);
		font-size: 0.85rem;
	}
	.links a {
		color: inherit;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.row {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
		color: var(--text-muted);
		text-decoration: none;
	}
	a.row:hover {
		background: var(--border);
		color: var(--text);
	}
	.all,
	.group {
		color: var(--text);
		font-weight: 700;
	}
	details {
		margin-top: 0.5rem;
	}
	summary {
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary span:first-child::before {
		content: '▸';
		display: inline-block;
		width: 1rem;
		color: var(--text-muted);
		font-size: 0.75rem;
	}
	details[open] summary span:first-child::before {
		content: '▾';
	}
	details :global(.progress) {
		margin: 0.15rem 0.5rem 0.35rem;
	}
	details > ul .row {
		padding-left: 1.5rem;
	}
	details > ul .row.sub {
		padding-left: 2.5rem;
		font-size: 0.85rem;
	}
	.row.empty {
		opacity: 0.6;
	}
	.row.active {
		background: var(--accent-soft);
		color: var(--accent);
		font-weight: 600;
		opacity: 1;
	}
	.count {
		flex-shrink: 0;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 400;
	}
	.pages {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.75rem;
		margin-top: auto;
		padding: 0 0.5rem;
		font-size: 0.8rem;
	}
	.pages a {
		color: var(--text-muted);
	}
</style>
```

- [ ] **Step 3: Header 정리** — `src/components/Header.astro` 전체를 교체

```astro
<header>
	<button id="nav-toggle" class="icon menu" type="button" aria-label="메뉴 열기" aria-controls="sidebar">
		<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"></path></svg>
	</button>
	<div class="actions">
		<a href="/search" class="icon" aria-label="검색">
			<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg>
		</a>
		<button id="theme-toggle" class="icon" type="button" aria-label="다크 모드 전환">
			<svg class="sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg>
			<svg class="moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path></svg>
		</button>
	</div>
</header>

<script>
	document.getElementById('theme-toggle')?.addEventListener('click', () => {
		const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
		document.documentElement.dataset.theme = next;
		localStorage.setItem('theme', next);
	});

	// 모바일: ☰로 사이드바 드로어를 열고, 배경 클릭이나 ESC로 닫는다.
	const root = document.documentElement;
	const setNav = (open: boolean) => root.toggleAttribute('data-nav-open', open);
	document.getElementById('nav-toggle')?.addEventListener('click', () => setNav(!root.hasAttribute('data-nav-open')));
	document.querySelector('.nav-backdrop')?.addEventListener('click', () => setNav(false));
	document.addEventListener('keydown', (e) => e.key === 'Escape' && setNav(false));
</script>

<style>
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		max-width: var(--content-width);
		margin: 0 auto;
		padding: 0.9rem 1.25rem 0;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
		margin-left: auto;
	}
	.icon {
		display: inline-flex;
		padding: 0.25rem;
		border: 0;
		background: none;
		color: var(--text-muted);
		cursor: pointer;
	}
	.icon:hover {
		color: var(--text);
	}
	.menu {
		display: none;
	}
	@media (max-width: 768px) {
		.menu {
			display: inline-flex;
		}
	}
	:global([data-theme='dark']) .sun,
	:global([data-theme='light']) .moon {
		display: none;
	}
</style>
```

- [ ] **Step 4: HeaderLink 삭제**

Run: `git rm src/components/HeaderLink.astro && grep -rn HeaderLink src`
Expected: grep 결과 없음

- [ ] **Step 5: BaseLayout** — `src/layouts/BaseLayout.astro` 전체를 교체

```astro
---
import type { ImageMetadata } from 'astro';
import BaseHead from '../components/BaseHead.astro';
import Footer from '../components/Footer.astro';
import Header from '../components/Header.astro';
import Sidebar from '../components/Sidebar.astro';

interface Props {
	title: string;
	description: string;
	image?: ImageMetadata;
	/** 사이드바에서 펼치고 강조할 주제 slug */
	activeTopic?: string;
	/** 사이드바에서 강조할 시리즈 이름 */
	activeSeries?: string;
}

const { title, description, image, activeTopic, activeSeries } = Astro.props;
---

<!doctype html>
<html lang="ko">
	<head>
		<BaseHead title={title} description={description} image={image} />
		<slot name="head" />
	</head>
	<body>
		<div class="layout">
			<Sidebar activeTopic={activeTopic} activeSeries={activeSeries} />
			<div class="nav-backdrop"></div>
			<div class="page">
				<Header />
				<main>
					<slot />
				</main>
				<Footer />
			</div>
		</div>
	</body>
</html>
```

- [ ] **Step 6: 레이아웃 CSS** — `global.css`의 `/* 공용 레이아웃 */` 주석 바로 아래에 추가

```css
.layout {
	display: grid;
	grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
	min-height: 100vh;
}
.sidebar {
	position: sticky;
	top: 0;
	height: 100vh;
	overflow-y: auto;
}
.page {
	min-width: 0;
}
.nav-backdrop {
	display: none;
}
@media (max-width: 768px) {
	.layout {
		grid-template-columns: minmax(0, 1fr);
	}
	.sidebar {
		position: fixed;
		z-index: 20;
		inset: 0 auto 0 0;
		width: min(85vw, var(--sidebar-width));
		transform: translateX(-100%);
		transition: transform 0.2s;
	}
	[data-nav-open] .sidebar {
		transform: none;
	}
	[data-nav-open] .nav-backdrop {
		display: block;
		position: fixed;
		z-index: 10;
		inset: 0;
		background: rgb(0 0 0 / 0.4);
	}
}
```

- [ ] **Step 7: 확인**

Run: `npm run build`
Expected: 성공. `grep -c 'class="sidebar"' dist/index.html` → 1, `grep -c '/topics/cs/network/' dist/index.html` → 1 이상.

- [ ] **Step 8: 커밋**

```bash
git add -A src
git commit -m "학습 지도형 사이드바와 2단 레이아웃, 모바일 드로어 추가"
```

---

### Task 5: 글 목록 스타일

**Files:**
- Modify: `src/components/PostList.astro`

**Interfaces:**
- Consumes: `readingMinutes` (Task 1)

- [ ] **Step 1: 메타 줄에 읽는 시간 추가** — import에 `import { readingMinutes } from '../utils/topic-tree';` 추가, `.meta` div의 태그 map 다음에 추가:

```astro
					<span class="reading">{readingMinutes(post.body ?? '')}분</span>
```

- [ ] **Step 2: 스타일 변경** — `<style>`의 `li`, `.title`, `.description`, `.meta` 규칙을 아래로 교체하고 `.reading` 추가

```css
	li {
		padding: 1rem 0;
		border-bottom: 1px solid var(--border);
	}
	.title {
		color: var(--text);
		font-size: 1.05rem;
		font-weight: 600;
		line-height: 1.4;
		text-decoration: none;
	}
	.title:hover {
		color: var(--accent);
	}
	.description {
		display: -webkit-box;
		margin: 0.35rem 0;
		overflow: hidden;
		color: var(--text-muted);
		font-size: 0.92rem;
		line-height: 1.6;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.75rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.78rem;
	}
	.tag {
		color: var(--accent);
		text-decoration: none;
	}
	.reading {
		margin-left: auto;
	}
```

- [ ] **Step 3: 확인**

Run: `npm run build`
Expected: 성공. `grep -c 'class="reading"' dist/blog/index.html` → 13 (draft 제외 글 수와 같음)

- [ ] **Step 4: 커밋**

```bash
git add src/components/PostList.astro
git commit -m "글 목록에 mono 메타 줄과 읽는 시간 추가"
```

---

### Task 6: 주제 페이지 + 체크리스트

**Files:**
- Create: `src/components/TopicChecklist.astro`, `src/pages/topics/[...slug].astro`

**Interfaces:**
- Consumes: `TOPIC_GROUPS`, `flattenTopics`, `topicTrail`, `isInTopic`, `progressOf`, `Topic`, `TopicGroup`, `getPosts`, `Post`, `PostList`, `ProgressBar`, `BaseLayout activeTopic`
- Produces: `/topics/<slug>/` 정적 페이지(모든 주제와 하위 주제)

- [ ] **Step 1: TopicChecklist** — `src/components/TopicChecklist.astro`

```astro
---
import type { Post } from '../utils/posts';
import type { Topic } from '../utils/topic-tree';

interface Props {
	topic: Topic;
	posts: Post[];
}

const { topic, posts } = Astro.props;
// plan 항목마다 그 항목을 다룬 글(가장 최근 글)을 찾는다.
const items = (topic.plan ?? []).map((item) => ({
	item,
	post: posts.find((p) => p.data.topic === topic.slug && p.data.planItem === item),
}));
---

<section class="checklist">
	<h2>이 주제에서 다룰 것</h2>
	<ul>
		{
			items.map(({ item, post }) => (
				<li class:list={{ done: post }}>
					<span class="mark" aria-hidden="true">{post ? '✓' : '○'}</span>
					{post ? <a href={`/blog/${post.id}/`}>{item}</a> : <span>{item}</span>}
					<span class="sr-only">{post ? '(정리함)' : '(예정)'}</span>
				</li>
			))
		}
	</ul>
</section>

<style>
	.checklist {
		margin: 1.5rem 0 2.5rem;
		padding: 1rem 1.25rem;
		border: 1px solid var(--border);
		border-radius: 10px;
	}
	h2 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
	}
	ul {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
		gap: 0.25rem 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.92rem;
	}
	li {
		color: var(--text-muted);
	}
	.mark {
		display: inline-block;
		width: 1.25rem;
		font-family: var(--font-mono);
	}
	.done .mark {
		color: var(--progress);
	}
</style>
```

- [ ] **Step 2: 주제 페이지** — `src/pages/topics/[...slug].astro`

```astro
---
import PostList from '../../components/PostList.astro';
import ProgressBar from '../../components/ProgressBar.astro';
import TopicChecklist from '../../components/TopicChecklist.astro';
import { TOPIC_GROUPS } from '../../data/topics';
import BaseLayout from '../../layouts/BaseLayout.astro';
import { getPosts } from '../../utils/posts';
import { flattenTopics, isInTopic, progressOf, topicTrail, type Topic } from '../../utils/topic-tree';

export async function getStaticPaths() {
	return TOPIC_GROUPS.flatMap((group) =>
		flattenTopics(group.topics).map((topic) => ({ params: { slug: topic.slug }, props: { topic } })),
	);
}

const { topic } = Astro.props as { topic: Topic };
const { group, path } = topicTrail(TOPIC_GROUPS, topic.slug)!;
const posts = (await getPosts()).filter((p) => isInTopic(p.data.topic, topic.slug));
const progress = progressOf([topic], posts.map((p) => p.data));
const crumbs = [group.name, ...path.slice(0, -1).map((t) => t.name)];
---

<BaseLayout title={topic.name} description={`${crumbs.join(' › ')} › ${topic.name} 학습 기록`} activeTopic={topic.slug}>
	{crumbs[crumbs.length - 1] !== topic.name && <p class="muted crumb">{crumbs.join(' › ')}</p>}
	<h1>{topic.name}</h1>
	{
		progress.total > 0 && (
			<div class="progress-row">
				<span class="muted">{progress.done} / {progress.total} 정리함</span>
				<ProgressBar {...progress} />
			</div>
		)
	}
	{topic.plan && <TopicChecklist topic={topic} posts={posts} />}
	{
		topic.children && (
			<section>
				<h2>하위 주제</h2>
				<ul class="chips">
					{topic.children.map((child) => (
						<li>
							<a href={`/topics/${child.slug}/`}>{child.name}</a>
						</li>
					))}
				</ul>
			</section>
		)
	}
	<h2>글 <span class="muted count">{posts.length}</span></h2>
	{posts.length > 0 ? <PostList posts={posts} /> : <p class="muted">아직 이 주제로 쓴 글이 없어요.</p>}
</BaseLayout>

<style>
	.crumb {
		margin: 0 0 0.25rem;
		font-size: 0.9rem;
	}
	h1 {
		margin-bottom: 0.5rem;
	}
	.progress-row {
		display: grid;
		gap: 0.35rem;
		max-width: 320px;
		font-family: var(--font-mono);
		font-size: 0.85rem;
	}
	.count {
		font-family: var(--font-mono);
		font-size: 0.9rem;
		font-weight: 400;
	}
</style>
```

- [ ] **Step 3: 확인**

Run: `npm run build && ls dist/topics/cs/network/index.html dist/topics/retro/index.html dist/topics/lang/java/index.html`
Expected: 빌드 성공, 세 파일 존재. `grep -c "내가 그릿에 온 이유" dist/topics/retro/index.html` → 1 이상. `grep -c "○" dist/topics/cs/network/index.html` → 10.

- [ ] **Step 4: 커밋**

```bash
git add src/components/TopicChecklist.astro src/pages/topics
git commit -m "주제 페이지와 학습 체크리스트 추가"
```

---

### Task 7: 글 페이지 경로·같은 주제 글 + 시리즈 페이지 활성화

**Files:**
- Modify: `src/layouts/BlogPost.astro`
- Modify: `src/pages/series/[series].astro`

**Interfaces:**
- Consumes: `TOPIC_GROUPS`, `topicTrail`, `isInTopic`, `BaseLayout activeTopic/activeSeries`, `PostList`

- [ ] **Step 1: BlogPost frontmatter 스크립트** — import 추가와 계산 추가

import에 추가:
```ts
import PostList from '../components/PostList.astro';
import { TOPIC_GROUPS } from '../data/topics';
import { isInTopic, topicTrail } from '../utils/topic-tree';
```
`const { title, ... } = post.data;` 줄에 `topic`을 추가하고(`..., tags, series, topic } = post.data;`), 시리즈 이전/다음 계산 블록 아래에 추가:
```ts
// 주제 글이면 본문 위 경로와 같은 주제의 다른 글(최대 5개)을 보여 준다.
const trail = topic ? topicTrail(TOPIC_GROUPS, topic) : undefined;
const related = topic
	? (await getPosts()).filter((p) => p.id !== post.id && isInTopic(p.data.topic, topic)).slice(0, 5)
	: [];
```

- [ ] **Step 2: BlogPost 마크업**

`<BaseLayout title={title} description={description} image={heroImage}>`를 아래로 교체:
```astro
<BaseLayout title={title} description={description} image={heroImage} activeTopic={topic} activeSeries={series}>
```
`<header class="post-header">` 바로 다음 줄에 추가:
```astro
			{
				trail && (
					<p class="crumb">
						{trail.group.name}
						{trail.path.map((t) => (
							<>
								{' › '}
								<a href={`/topics/${t.slug}/`}>{t.name}</a>
							</>
						))}
					</p>
				)
			}
```
`</BaseLayout>` 바로 위(시리즈 이전/다음 nav 다음)에 추가:
```astro
	{
		related.length > 0 && (
			<section class="related">
				<h2>같은 주제의 다른 글</h2>
				<PostList posts={related} />
			</section>
		)
	}
```
`<style>`에 추가:
```css
	.crumb {
		margin: 0 0 0.5rem;
		color: var(--text-muted);
		font-size: 0.9rem;
	}
	.related {
		margin-top: 3rem;
	}
	.related h2 {
		font-size: 1.1rem;
	}
```
`.meta` 규칙에 `font-family: var(--font-mono);` 추가.

- [ ] **Step 3: 시리즈 페이지** — `src/pages/series/[series].astro`의 BaseLayout 여는 태그를 교체

```astro
<BaseLayout title={name} description={`${name} 시리즈`} activeSeries={name}>
```

- [ ] **Step 4: 확인**

Run: `npm run build`
Expected: 성공.
- `grep -c 'class="crumb"' dist/blog/why-i-joined-grit/index.html` → 1
- `grep -o 'row active[^>]*' dist/series/keepup-운영기/index.html | head -1` → keepup 시리즈 링크
- `grep -o 'row active[^>]*' dist/blog/why-i-joined-grit/index.html | head -1` → `/topics/retro/`

- [ ] **Step 5: 커밋**

```bash
git add src/layouts/BlogPost.astro "src/pages/series/[series].astro"
git commit -m "글 페이지에 주제 경로와 같은 주제 글, 사이드바 활성화 추가"
```

---

### Task 8: 홈 정리 + About 이동

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/pages/about.astro`

**Interfaces:**
- Consumes: `TOPIC_GROUPS`, `progressOf`, `nextPlanItems`, `ProgressBar`, `PostList`, `ProjectCard`

- [ ] **Step 1: About으로 옮기기** — `src/pages/about.astro` 전체를 교체

홈에 있던 `topics`, `skills` 배열과 두 소개 문단, 해당 마크업·스타일을 옮긴다.
```astro
---
import { GITHUB_URL } from '../consts';
import BaseLayout from '../layouts/BaseLayout.astro';

const topics = [
	{ icon: '🛠️', name: 'Backend', desc: 'Java · Spring Boot · Database · API 설계' },
	{ icon: '💻', name: 'Frontend', desc: 'React · TypeScript · React Native · Flutter' },
	{ icon: '🤖', name: 'AI', desc: 'AI Agent · LLM · RAG 학습과 실험' },
	{ icon: '🧩', name: 'Problem Solving', desc: '실무에서 마주친 설계 고민과 문제 해결 기록' },
];

const skills = [
	['Mobile', 'Flutter · React Native · Dart'],
	['Frontend', 'React · TypeScript · JavaScript'],
	['Backend', 'Java · Spring Boot · REST API · Spring Security/JWT · MyBatis · JPA/QueryDSL'],
	['Database', 'MSSQL · Oracle · MySQL · SQLite'],
	['Infra', 'AWS(S3/CloudFront/RDS) · Docker · GitHub Actions · FCM'],
];
---

<BaseLayout title="About" description="소개">
	<h1>About</h1>
	<section class="intro">
		<p>
			모바일 앱 개발로 시작해 웹 프론트엔드와 백엔드까지 영역을 넓혀 온 <strong>4년차 소프트웨어 개발자</strong>입니다.
			Flutter·React Native, React·TypeScript, Java·Spring Boot로 실제 운영 시스템을 만들고 고쳐 왔습니다.
		</p>
		<p class="muted">
			이 블로그에는 기능 개발, 외부 연동, 배포, 유지보수를 하며 배운 것들과 AI·LLM을 공부하고 실험한 내용을 기록합니다.
		</p>
	</section>

	<section>
		<h2>다루는 주제</h2>
		<div class="topics">
			{
				topics.map((t) => (
					<div class="topic">
						<strong>
							{t.icon} {t.name}
						</strong>
						<span class="muted">{t.desc}</span>
					</div>
				))
			}
		</div>
	</section>

	<section>
		<h2>기술 스택</h2>
		<dl class="skills">
			{
				skills.map(([area, list]) => (
					<>
						<dt>{area}</dt>
						<dd>{list}</dd>
					</>
				))
			}
		</dl>
	</section>

	<section>
		<h2>Contact</h2>
		<ul>
			<li>GitHub: <a href={GITHUB_URL}>{GITHUB_URL}</a></li>
		</ul>
	</section>
</BaseLayout>

<style>
	.intro p {
		margin: 0.5rem 0;
	}
	section + section {
		margin-top: 3rem;
	}
	.topics {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
		gap: 0.75rem;
	}
	.topic {
		display: flex;
		flex-direction: column;
		padding: 1rem 1.25rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg-soft);
	}
	.topic span {
		font-size: 0.9rem;
	}
	.skills {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.5rem 1.25rem;
		margin: 0;
	}
	.skills dt {
		font-weight: 600;
	}
	.skills dd {
		margin: 0;
		color: var(--text-muted);
	}
	@media (max-width: 560px) {
		.skills {
			grid-template-columns: 1fr;
			gap: 0 0;
		}
		.skills dd {
			margin-bottom: 0.75rem;
		}
	}
</style>
```

- [ ] **Step 2: 홈 교체** — `src/pages/index.astro` 전체를 교체

```astro
---
import { getCollection } from 'astro:content';
import PostList from '../components/PostList.astro';
import ProgressBar from '../components/ProgressBar.astro';
import ProjectCard from '../components/ProjectCard.astro';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { TOPIC_GROUPS } from '../data/topics';
import BaseLayout from '../layouts/BaseLayout.astro';
import { getPosts } from '../utils/posts';
import { nextPlanItems, progressOf } from '../utils/topic-tree';

const allPosts = await getPosts();
const posts = allPosts.slice(0, 10);
const refs = allPosts.map((p) => p.data);
const projects = (await getCollection('projects', ({ data }) => data.featured)).sort(
	(a, b) => a.data.order - b.data.order,
);

// plan이 있는 그룹(CS, 언어)만 로드맵에 보여 준다.
const roadmap = TOPIC_GROUPS.map((group) => ({ group, progress: progressOf(group.topics, refs) })).filter(
	({ progress }) => progress.total > 0,
);
const next = nextPlanItems(
	roadmap.flatMap(({ group }) => group.topics),
	refs,
	3,
);
---

<BaseLayout title={SITE_TITLE} description={SITE_DESCRIPTION}>
	<section class="intro">
		<h1>안녕하세요, 최지수입니다.</h1>
		<p class="muted">
			백엔드를 중심으로 CS 기본기를 하나씩 정리하고, 프로젝트를 만들며 배운 것을 기록합니다.
			<a href="/about/">더 보기 →</a>
		</p>
	</section>

	<section>
		<h2>CS 로드맵</h2>
		<ul class="roadmap">
			{
				roadmap.map(({ group, progress }) => (
					<li>
						<span class="name">{group.name}</span>
						<ProgressBar {...progress} />
						<span class="count">
							{progress.done}/{progress.total}
						</span>
					</li>
				))
			}
		</ul>
		{
			next.length > 0 && (
				<>
					<h3>다음에 공부할 것</h3>
					<ul class="next">
						{next.map(({ topic, item }) => (
							<li>
								<a href={`/topics/${topic.slug}/`}>{topic.name}</a>
								<span class="muted"> · {item}</span>
							</li>
						))}
					</ul>
				</>
			)
		}
	</section>

	<section>
		<h2>최근 글</h2>
		<PostList posts={posts} />
		<p><a href="/blog/">전체 글 보기 →</a></p>
	</section>

	{
		projects.length > 0 && (
			<section>
				<h2>대표 프로젝트</h2>
				<div class="grid">
					{projects.map((project) => (
						<ProjectCard project={project} />
					))}
				</div>
				<p>
					<a href="/projects/">전체 프로젝트 보기 →</a>
				</p>
			</section>
		)
	}
</BaseLayout>

<style>
	.intro {
		margin-bottom: 3rem;
	}
	.intro p {
		margin: 0.5rem 0;
	}
	section + section {
		margin-top: 3rem;
	}
	.roadmap {
		display: grid;
		gap: 0.6rem;
		max-width: 480px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.roadmap li {
		display: grid;
		grid-template-columns: 4rem 1fr 4rem;
		align-items: center;
		gap: 0.75rem;
	}
	.roadmap .name {
		font-weight: 600;
	}
	.roadmap .count {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.8rem;
		text-align: right;
	}
	h3 {
		margin: 1.5rem 0 0.5rem;
		font-size: 1rem;
	}
	.next {
		margin: 0;
		padding-left: 1.25rem;
	}
</style>
```

> 소개 두 번째 줄("백엔드를 중심으로 …")은 새 문구다. 사용자가 원하면 바꾼다.

- [ ] **Step 3: 확인**

Run: `npm run build`
Expected: 성공. `grep -c "CS 로드맵" dist/index.html` → 1, `grep -c "기술 스택" dist/about/index.html` → 1, `grep -c 'class="reading"' dist/index.html` → 10.

- [ ] **Step 4: 커밋**

```bash
git add src/pages/index.astro src/pages/about.astro
git commit -m "홈을 로드맵 중심으로 정리하고 긴 소개를 About으로 이동"
```

---

### Task 9: 전체 확인

**Files:** 없음(수정이 필요하면 해당 파일)

- [ ] **Step 1: 테스트와 빌드**

Run: `npm test && npm run build`
Expected: 테스트 전부 PASS, 빌드 성공, pagefind 인덱스 생성 로그.

- [ ] **Step 2: 기존 URL 확인** — `npx astro preview --port 4321` 실행 후

```bash
for f in src/content/blog/*.md; do s=$(basename "$f" .md); printf '%s ' "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:4321/blog/$s/")"; echo "$s"; done
for p in / /blog/ /about/ /projects/ /tags/ /series/ /search/ /rss.xml /topics/cs/network/ /topics/retro/; do printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:4321$p")" "$p"; done
```
Expected: 모든 줄이 200.

- [ ] **Step 3: 화면 확인** — 브라우저로 홈, `/topics/cs/network/`, 글 1편, `/series/keepup-운영기/`를 라이트·다크, 1280px·375px 폭에서 확인. 375px에서 ☰ → 드로어 열림, 배경 클릭·ESC로 닫힘.

- [ ] **Step 4: 문제 수정 후 커밋, push**

```bash
git push origin main
```
