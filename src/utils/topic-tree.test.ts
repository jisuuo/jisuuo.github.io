import { describe, expect, test } from 'vitest';
import {
	completedItems,
	flattenTopics,
	isInTopic,
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

describe('readingMinutes', () => {
	test('500자당 1분, 올림, 최소 1분', () => {
		expect(readingMinutes('')).toBe(1);
		expect(readingMinutes('가'.repeat(500))).toBe(1);
		expect(readingMinutes('가'.repeat(501))).toBe(2);
	});
});
