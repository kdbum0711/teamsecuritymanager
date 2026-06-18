import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import AdminClient from "@/components/AdminClient"

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) redirect('/login')
  
  const role = (session.user as any).role
  if (role !== 'admin' && role !== 'security') {
    redirect('/')
  }

  return (
    <main className="flex-1 bg-gray-50 flex flex-col p-4 md:p-8 min-h-screen">
      <AdminClient currentUser={session.user} />
    </main>
  )
}
