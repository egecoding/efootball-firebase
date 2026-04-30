'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function SignupForm() {
  const router = useRouter()
  const [form, setForm] = useState({
    email: '',
    username: '',
    displayName: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.username.length < 3) {
      setError('Username must be at least 3 characters')
      return
    }
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) {
      setError('Username can only contain letters, numbers, and underscores')
      return
    }

    setLoading(true)
    const supabase = getClient()

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          username: form.username.toLowerCase(),
          display_name: form.displayName || form.username,
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // If Supabase returned a session directly (email confirmation disabled), use it
    if (signUpData.session) {
      setLoading(false)
      setRedirecting(true)
      router.push('/dashboard')
      router.refresh()
      return
    }

    // Email confirmation is enabled — try signing in anyway
    // (works if the project auto-confirms or if OTP flow is used)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })

    setLoading(false)

    if (signInError) {
      // Email confirmation required — show message instead of broken redirect
      setRedirecting(false)
      setError('')
      // Show a friendly confirmation-needed state
      router.push('/auth/login?message=confirm_email')
      return
    }

    setRedirecting(true)
    router.push('/dashboard')
    router.refresh()
  }

  if (redirecting) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="h-8 w-8 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Account created! Redirecting you to your dashboard…
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Email"
        type="email"
        required
        autoComplete="email"
        value={form.email}
        onChange={update('email')}
        placeholder="you@example.com"
      />
      <Input
        label="Username"
        type="text"
        required
        autoComplete="username"
        value={form.username}
        onChange={update('username')}
        placeholder="player123"
        hint="Letters, numbers, underscores only"
      />
      <Input
        label="Display name"
        type="text"
        value={form.displayName}
        onChange={update('displayName')}
        placeholder="Optional — shown in tournaments"
      />
      <Input
        label="Password"
        type="password"
        required
        autoComplete="new-password"
        value={form.password}
        onChange={update('password')}
        placeholder="At least 6 characters"
        minLength={6}
      />
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
      <Button type="submit" loading={loading} size="lg" className="w-full mt-1">
        Create account
      </Button>
    </form>
  )
}
