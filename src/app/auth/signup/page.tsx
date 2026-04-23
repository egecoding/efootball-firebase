import { SignupForm } from '@/components/auth/SignupForm'
import Link from 'next/link'
import { Trophy } from 'lucide-react'

export default function SignupPage() {
  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 mb-4">
            <Trophy className="h-6 w-6 text-brand-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Create account
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Start hosting tournaments for free
          </p>
        </div>
        <SignupForm />
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Already have an account?{' '}
          <Link
            href="/auth/login"
            className="text-brand-500 hover:text-brand-600 font-medium"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
