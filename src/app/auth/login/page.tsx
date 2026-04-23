import { LoginForm } from '@/components/auth/LoginForm'
import Link from 'next/link'
import { Trophy } from 'lucide-react'

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 mb-4">
            <Trophy className="h-6 w-6 text-brand-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Sign in to manage your tournaments
          </p>
        </div>
        <LoginForm />
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Don&apos;t have an account?{' '}
          <Link
            href="/auth/signup"
            className="text-brand-500 hover:text-brand-600 font-medium"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
