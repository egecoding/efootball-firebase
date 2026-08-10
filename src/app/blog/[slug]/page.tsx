import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Calendar, ArrowLeft } from 'lucide-react'
import { getAllPosts, getPostBySlug } from '@/lib/blog'
import { SITE_URL } from '@/lib/site'
import { blogPostingSchema, breadcrumbSchema, NOINDEX } from '@/lib/seo'
import { JsonLd } from '@/components/seo/JsonLd'
import { ViewTracker } from '@/components/blog/ViewTracker'

interface PageProps {
  params: { slug: string }
}

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const post = await getPostBySlug(params.slug)
  if (!post) return { title: 'Post not found', robots: NOINDEX }

  const title = post.title

  return {
    title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title,
      description: post.description,
      url: `${SITE_URL}/blog/${post.slug}`,
      type: 'article',
      publishedTime: post.date,
      modifiedTime: post.updated ?? post.date,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: post.description,
    },
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const post = await getPostBySlug(params.slug)
  if (!post) notFound()

  return (
    <div className="page-container">
      <ViewTracker slug={post.slug} />
      <JsonLd data={blogPostingSchema(post)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Blog', path: '/blog' },
          { name: post.title, path: `/blog/${post.slug}` },
        ])}
      />
      <div className="max-w-2xl mx-auto">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to blog
        </Link>

        <h1 className="section-title mb-2">{post.title}</h1>
        <span className="inline-flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 mb-8">
          <Calendar className="h-3.5 w-3.5" />
          {new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </span>

        <article
          className="prose dark:prose-invert prose-headings:font-bold max-w-none"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />
      </div>
    </div>
  )
}
