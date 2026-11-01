/** GitHub 잔디밭 데이터. 빌드할 때 공개 페이지에서 가져온다. */

export type ContributionDay = {
	date: string;
	/** GitHub가 매긴 색 단계 0~4 */
	level: number;
	count: number;
};

/** github.com/users/<user>/contributions HTML에서 날짜별 기록을 뽑는다. */
export function parseContributions(html: string): ContributionDay[] {
	const counts = new Map<string, number>();
	for (const [, id, text] of html.matchAll(/<tool-tip[^>]*\bfor="([^"]+)"[^>]*>([^<]*)/g)) {
		const match = text.match(/^([\d,]+) contribution/);
		counts.set(id, match ? Number(match[1].replace(/,/g, '')) : 0);
	}

	const days: ContributionDay[] = [];
	for (const [td] of html.matchAll(/<td\b[^>]*\bdata-date="[^"]+"[^>]*>/g)) {
		const attr = (name: string) => td.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1];
		const date = attr('data-date')!;
		const id = attr('id');
		days.push({ date, level: Number(attr('data-level') ?? 0), count: (id && counts.get(id)) || 0 });
	}
	return days.sort((a, b) => a.date.localeCompare(b.date));
}

/** 가져오기에 실패하면 빈 배열을 돌려줘 빌드를 막지 않는다. */
export async function fetchContributions(user: string): Promise<ContributionDay[]> {
	try {
		const res = await fetch(`https://github.com/users/${user}/contributions`);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return parseContributions(await res.text());
	} catch (error) {
		console.warn(`[contributions] ${user}의 잔디 데이터를 가져오지 못했습니다:`, error);
		return [];
	}
}
