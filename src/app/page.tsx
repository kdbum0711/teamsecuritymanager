import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import DashboardClient from "@/components/DashboardClient"

export default async function Home() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  return (
    <main className="flex-1 bg-gray-50 flex flex-col p-4 md:p-8">
      <DashboardClient user={session.user} />
    </main>
  )
}
