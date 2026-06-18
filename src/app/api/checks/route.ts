import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const today = format(new Date(), "yyyy-MM-dd")
  const kakaoId = (session.user as any).kakao_id

  const { data: user } = await supabase.from('users').select('id').eq('kakao_id', kakaoId).single()
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { data: check } = await supabase
    .from('daily_checks')
    .select('*')
    .eq('user_id', user.id)
    .eq('check_date', today)
    .single()

  return NextResponse.json({ status: check?.status || 'pending' })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const today = format(new Date(), "yyyy-MM-dd")
  const kakaoId = (session.user as any).kakao_id

  const { data: user } = await supabase.from('users').select('id').eq('kakao_id', kakaoId).single()
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { data: existing } = await supabase
    .from('daily_checks')
    .select('id')
    .eq('user_id', user.id)
    .eq('check_date', today)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from('daily_checks').update({
      status: 'completed',
      checked_at: new Date().toISOString(),
      checked_by: user.id
    }).eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase.from('daily_checks').insert({
      user_id: user.id,
      check_date: today,
      status: 'completed',
      checked_at: new Date().toISOString(),
      checked_by: user.id
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, status: 'completed' })
}
