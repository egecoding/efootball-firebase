import Link from 'next/link'
import type { Metadata } from 'next'
import { Calendar } from 'lucide-react'
import { getAllPosts } from '@/lib/blog'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Guides and tips for organizing and playing in free eFootball tournaments — formats, fair-play tools, and running a smooth competition.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'Blog — eFootball Cup',
    description: 'Guides and tips for organizing and playing in free eFootball tournaments.',
    type: 'website',
  },
}

export default function BlogIndexPage() {
  const posts = getAllPosts()

  return (
    <div className="page-container">
      <div className="mb-8">
        <h1 className="section-title">Blog</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Guides and tips for organizing and playing in eFootball tournaments.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((post) => (
          <Link key={post.slug} href={`/blog/${post.slug}`} className="group block">
            <div className="h-full flex flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm transition-all duration-200 group-hover:shadow-lg group-hover:shadow-black/5 dark:group-hover:shadow-black/30 group-hover:border-gray-300 dark:group-hover:border-gray-700 group-hover:-translate-y-0.5 overflow-hidden">
              <div className="flex flex-col gap-3 p-5 flex-1">
                <h2 className="font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                  {post.title}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed flex-1">
                  {post.description}
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                  <Calendar className="h-3 w-3" />
                  {new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {posts.length === 0 && (
        <p className="text-center text-gray-400 dark:text-gray-500 py-20">No posts yet — check back soon.</p>
      )}
    </div>
  )
}
