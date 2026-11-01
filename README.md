# jissuo.blog

[![Deploy](https://github.com/jisuuo/jisuuo.github.io/actions/workflows/deploy.yml/badge.svg)](https://github.com/jisuuo/jisuuo.github.io/actions/workflows/deploy.yml)

**https://jissuo.com** · 프로젝트와 기술 블로그

Astro로 만든 정적 블로그입니다. `main`에 push하면 GitHub Actions가 빌드해서 GitHub Pages로 배포합니다. GitHub 잔디 그래프를 새로 고치기 위해 매일 09:00(KST)에도 자동으로 다시 배포됩니다.

## 기술 스택

- [Astro](https://astro.build) + MDX
- [Pagefind](https://pagefind.app) 정적 검색
- GitHub Actions → GitHub Pages
- 도메인 `jissuo.com` (Cloudflare DNS)

## 시작하기

```bash
git clone https://github.com/jisuuo/jisuuo.github.io.git
cd jisuuo.github.io
npm install
npm run dev
```

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 (`localhost:4321`). draft 글도 보이고, 검색은 동작하지 않습니다 |
| `npm run build` | `dist/`로 빌드한 뒤 Pagefind 검색 인덱스를 생성합니다 |
| `npm run preview` | 빌드 결과 미리보기 (검색 포함) |
| `npm test` | Vitest 테스트 |

## 글 쓰기 — `src/content/blog/*.md`

파일 이름이 주소가 됩니다. `network-intro.md` → `jissuo.com/blog/network-intro/`

```yaml
---
title: '제목'                  # 필수
description: '목록과 SEO에 쓰이는 요약'  # 필수
pubDate: 2026-11-01           # 필수
updatedDate: 2026-11-02       # 선택
tags: ['network', 'backend']  # 선택
topic: 'cs/network'           # 선택. src/data/topics.ts의 slug
planItem: 'TCP 연결 수립과 종료'  # 선택. 그 주제 plan 항목과 정확히 같아야 합니다
series: '시리즈 이름'            # 선택. 같은 이름끼리 묶입니다
seriesOrder: 1                # 선택. 없으면 pubDate 순
heroImage: './cover.png'      # 선택
draft: false                  # true면 배포에서 빠집니다
---
```

- `topic`에 쓸 수 있는 값: `cs/network` · `cs/os` · `cs/database` · `cs/data-structure` · `cs/algorithm` · `lang/java` · `retro`
- `planItem`을 적으면 주제 페이지 체크리스트에 완료로 표시됩니다. `topic`이나 `planItem`이 목록에 없으면 빌드가 실패합니다.

### 올리기 / 수정 / 삭제

```bash
git pull
vim src/content/blog/network-intro.md   # 새 글 또는 수정
git add . && git commit -m "post: 네트워크 입문" && git push

git rm src/content/blog/network-intro.md   # 삭제
git commit -m "post: 네트워크 입문 삭제" && git push
```

push 후 1~2분이면 사이트에 반영됩니다. 실패하면 [Actions](https://github.com/jisuuo/jisuuo.github.io/actions) 탭에서 로그를 확인하세요.

## 프로젝트 추가 — `src/content/projects/*.md`

```yaml
---
title: '프로젝트 이름'
description: '한두 줄 설명'
stack: ['TypeScript', 'Node.js']
github: 'https://github.com/...'  # 선택
demo: 'https://...'               # 선택
featured: true                    # 선택
order: 1                          # 선택. 작을수록 먼저
---
```

## 어디를 고치나요

| 바꾸고 싶은 것 | 파일 |
| --- | --- |
| 사이트 이름, 설명, GitHub·이메일 링크 | `src/consts.ts` |
| 사이트 주소(도메인) | `astro.config.mjs`의 `site` |
| 홈 화면 기술 스택 | `src/pages/index.astro` |
| 소개 / 연락처 | `src/pages/about.astro` |
| 주제 분류와 학습 체크리스트 | `src/data/topics.ts` |

## Contact

- Email: me@jissuo.com
- GitHub: [@jisuuo](https://github.com/jisuuo)
