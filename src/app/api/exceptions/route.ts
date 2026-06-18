import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const kakaoId = (session.user as any).kakao_id
  const { startDate, endDate, reason } = await req.json()

  const { data: user } = await supabase.from('users').select('id').eq('kakao_id', kakaoId).single()
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { error } = await supabase.from('exceptions').insert({
    user_id: user.id,
    start_date: startDate,
    end_date: endDate,
    reason: reason
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const kakaoId = (session.user as any).kakao_id
  const { data: user } = await supabase.from('users').select('id').eq('kakao_id', kakaoId).single()
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { data: exceptions, error } = await supabase
    .from('exceptions')
    .select('*')
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, exceptions })
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  const kakaoId = (session.user as any).kakao_id
  const { data: user } = await supabase.from('users').select('id').eq('kakao_id', kakaoId).single()
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { error } = await supabase
    .from('exceptions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
