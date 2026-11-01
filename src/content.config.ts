import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { TOPIC_GROUPS } from './data/topics';
import { validateTopicRef } from './utils/topic-tree';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
			tags: z.array(z.string()).default([]),
			series: z.string().optional(),
			seriesOrder: z.number().optional(),
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
});

const projects = defineCollection({
	loader: glob({ base: './src/content/projects', pattern: '**/*.md' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		stack: z.array(z.string()),
		github: z.url().optional(),
		demo: z.url().optional(),
		featured: z.boolean().default(false),
		order: z.number().default(999),
	}),
});

export const collections = { blog, projects };
