export default function OfflinePage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="text-5xl mb-4">📡</div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">You&apos;re offline</h1>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm">
        No internet connection. Check your network and try again — your tournament data will be waiting.
      </p>
    </div>
  )
}
