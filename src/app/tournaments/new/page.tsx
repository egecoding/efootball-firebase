import { TournamentForm } from '@/components/tournament/TournamentForm'

export default function NewTournamentPage() {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : '')
  return (
    <div className="page-container">
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <h1 className="section-title">Create Tournament</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Set up your tournament. You&apos;ll get an invite link after creation.
          </p>
        </div>
        <TournamentForm baseUrl={baseUrl} />
      </div>
    </div>
  )
}
