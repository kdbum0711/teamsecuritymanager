import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const dateParam = searchParams.get('date')
  const targetDate = dateParam || format(new Date(), "yyyy-MM-dd")

  const { data: users, error: userError } = await supabase.from('users').select('id, name, role, is_active').order('name')
  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 })

  const { data: checks } = await supabase.from('daily_checks').select('*').eq('check_date', targetDate)
  
  const { data: exceptions } = await supabase.from('exceptions')
    .select('*')
    .lte('start_date', targetDate)
    .gte('end_date', targetDate)

  const checkMap = Object.fromEntries((checks || []).map(c => [c.user_id, c.status]))
  const exceptionMap = Object.fromEntries((exceptions || []).map(e => [e.user_id, e.reason]))

  const report = users.map(u => ({
    id: u.id,
    name: u.name,
    role: u.role,
    isActive: u.is_active,
    status: exceptionMap[u.id] ? 'exception' : (checkMap[u.id] || 'pending'),
    reason: exceptionMap[u.id] || null
  }))

  return NextResponse.json({ users: report })
}
