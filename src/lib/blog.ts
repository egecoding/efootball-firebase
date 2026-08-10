import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { remark } from 'remark'
import remarkHtml from 'remark-html'

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')

export interface BlogPostMeta {
  slug: string
  title: string
  description: string
  date: string
  /** Optional frontmatter — existing posts predate these and leave them undefined. */
  updated?: string
  author?: string
  tags?: string[]
}

export interface BlogPost extends BlogPostMeta {
  contentHtml: string
}

function readPostFile(slug: string): { data: Record<string, unknown>; content: string } | null {
  const filePath = path.join(BLOG_DIR, `${slug}.md`)
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf8')
  return matter(raw)
}

function toMeta(slug: string, data: Record<string, unknown>): BlogPostMeta {
  return {
    slug,
    title: (data.title as string) ?? slug,
    description: (data.description as string) ?? '',
    date: (data.date as string) ?? new Date(0).toISOString(),
    updated: (data.updated as string) ?? undefined,
    author: (data.author as string) ?? undefined,
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : undefined,
  }
}

/** All posts, newest first. Reads content/blog/*.md at request/build time. */
export function getAllPosts(): BlogPostMeta[] {
  if (!fs.existsSync(BLOG_DIR)) return []

  return fs
    .readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const slug = file.replace(/\.md$/, '')
      const { data } = matter(fs.readFileSync(path.join(BLOG_DIR, file), 'utf8'))
      return toMeta(slug, data)
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const parsed = readPostFile(slug)
  if (!parsed) return null
  const processed = await remark().use(remarkHtml).process(parsed.content)
  return { ...toMeta(slug, parsed.data), contentHtml: processed.toString() }
}
