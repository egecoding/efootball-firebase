import { redirect } from 'next/navigation'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { AdminPanel } from '@/components/admin/AdminPanel'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const admin = await requireSuperAdmin()
  if (!admin) redirect('/')

  return <AdminPanel />
}
