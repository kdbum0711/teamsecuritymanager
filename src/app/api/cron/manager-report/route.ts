import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { isWeekend, format } from "date-fns"

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const today = new Date()
  if (isWeekend(today)) {
    return NextResponse.json({ success: true, message: "Weekend skipped" })
  }

  const todayStr = format(today, "yyyy-MM-dd")

  const { data: users } = await supabase.from('users').select('*').eq('is_active', true)
  if (!users) return NextResponse.json({ error: "No users found" }, { status: 500 })

  const { data: checks } = await supabase
    .from('daily_checks')
    .select('user_id')
    .eq('check_date', todayStr)
    .eq('status', 'completed')

  const checkedUserIds = new Set(checks?.map(c => c.user_id) || [])

  const { data: exceptions } = await supabase
    .from('exceptions')
    .select('user_id')
    .lte('start_date', todayStr)
    .gte('end_date', todayStr)

  const exceptionUserIds = new Set(exceptions?.map(e => e.user_id) || [])

  const targets = users.filter(u => !checkedUserIds.has(u.id) && !exceptionUserIds.has(u.id))
  
  const managers = users.filter(u => u.role === 'admin' || u.role === 'security')
  const reportText = targets.length > 0 
    ? `[일일 보안점검 현황]\n오늘(${format(today, "MM/dd")}) 미점검자는 총 ${targets.length}명입니다.\n\n미점검자 명단:\n${targets.map(t => `- ${t.name}`).join('\n')}`
    : `[일일 보안점검 완료]\n오늘(${format(today, "MM/dd")}) 모든 인원이 보안점검을 완료했습니다! 🎉`

  let managerSendCount = 0
  for (const manager of managers) {
    if (!manager.kakao_refresh_token) continue
    try {
      const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: process.env.KAKAO_CLIENT_ID || "",
          client_secret: process.env.KAKAO_CLIENT_SECRET || "",
          refresh_token: manager.kakao_refresh_token
        })
      })

      if (!tokenRes.ok) continue
      const tokenData = await tokenRes.json()
      const accessToken = tokenData.access_token

      if (tokenData.refresh_token) {
        await supabase.from('users').update({ kakao_refresh_token: tokenData.refresh_token }).eq('id', manager.id)
      }

      const sendRes = await fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          template_object: JSON.stringify({
            object_type: "text",
            text: reportText,
            link: {
              web_url: process.env.NEXTAUTH_URL || "http://localhost:3000",
              mobile_web_url: process.env.NEXTAUTH_URL || "http://localhost:3000"
            },
            button_title: "대시보드 바로가기"
          })
        })
      })
      if (sendRes.ok) managerSendCount++
    } catch (err) {}
  }

  return NextResponse.json({ success: true, managerSendCount })
}
