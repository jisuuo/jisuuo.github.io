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
