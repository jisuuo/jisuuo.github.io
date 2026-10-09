---
title: 'Astro로 기술 블로그 만들기 (1) 설계'
description: '왜 Astro를 골랐고 어떤 구조로 만들었는지 정리합니다.'
pubDate: 2026-10-09
tags: ['astro', 'blog']
series: 'Astro 블로그 만들기'
seriesOrder: 1
---

샘플 글입니다. `src/content/blog/`의 파일을 지우거나 수정해서 사용하세요.

## 코드 하이라이팅

```ts
export function slugify(name: string): string {
	return name.trim().toLowerCase().replace(/\s+/g, '-');
}
```

> 인용문은 이렇게 보입니다.
