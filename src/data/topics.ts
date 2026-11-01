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
