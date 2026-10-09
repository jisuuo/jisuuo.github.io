import { type CollectionEntry, getCollection } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

/** 최신순 글 목록. draft 글은 개발 서버에서만 포함한다. */
export async function getPosts(): Promise<Post[]> {
	const posts = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
	return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** 태그·시리즈 이름을 URL 경로로 바꾼다. 예: "Spring 트랜잭션" → "spring-트랜잭션" */
export function slugify(name: string): string {
	return name.trim().toLowerCase().replace(/\s+/g, '-');
}

/** 시리즈 안의 순서: seriesOrder가 있으면 우선, 없으면 작성일 순. */
export function sortSeries(posts: Post[]): Post[] {
	return [...posts].sort(
		(a, b) =>
			(a.data.seriesOrder ?? Infinity) - (b.data.seriesOrder ?? Infinity) ||
			a.data.pubDate.valueOf() - b.data.pubDate.valueOf(),
	);
}

/** 이름 → 글 목록. tags 또는 series 기준으로 묶는다. */
export function groupBy(posts: Post[], key: 'tags' | 'series'): Map<string, Post[]> {
	const groups = new Map<string, Post[]>();
	for (const post of posts) {
		const value = post.data[key];
		const names = Array.isArray(value) ? value : value ? [value] : [];
		for (const name of names) groups.set(name, [...(groups.get(name) ?? []), post]);
	}
	return groups;
}
