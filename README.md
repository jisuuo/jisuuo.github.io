# jisuuo.github.io

Astro로 만든 프로젝트·기술 블로그입니다. `main`에 push하면 GitHub Actions가 GitHub Pages로 배포합니다.

## 명령어

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 (`localhost:4321`). draft 글도 보이고, 검색은 동작하지 않습니다 |
| `npm run build` | `dist/`로 빌드한 뒤 Pagefind 검색 인덱스를 생성합니다 |
| `npm run preview` | 빌드 결과 미리보기 (검색 포함) |

## 글 쓰기 — `src/content/blog/*.md`

```yaml
---
title: '제목'
description: '목록과 SEO에 쓰이는 요약'
pubDate: 2026-10-09
updatedDate: 2026-10-12      # 선택
tags: ['spring', 'backend']  # 선택
series: '시리즈 이름'          # 선택. 같은 이름끼리 묶입니다
seriesOrder: 1               # 선택. 없으면 pubDate 순
heroImage: './cover.png'     # 선택
draft: false                 # true면 배포에서 빠집니다
---
```

## 프로젝트 추가 — `src/content/projects/*.md`

```yaml
---
title: '프로젝트 이름'
description: '한두 줄 설명'
stack: ['TypeScript', 'Node.js']
github: 'https://github.com/...'  # 선택
demo: 'https://...'               # 선택
featured: true                    # 홈에 노출
order: 1                          # 작을수록 먼저
---
```

사이트 이름과 링크는 `src/consts.ts`, 소개 문구는 `src/pages/index.astro`와 `src/pages/about.astro`에서 수정합니다.
