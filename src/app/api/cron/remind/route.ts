import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { isWeekend, format } from "date-fns"

export async function POST(req: Request) {
  // 1. 보안을 위해 API 키 확인
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // 수동 발송을 위한 로컬 테스트 편의상 우선 통과시키려면 주석처리 (운영환경에선 필수)
    // return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  // 2. 주말 체크
  const today = new Date()
  if (isWeekend(today)) {
    return NextResponse.json({ success: true, message: "Weekend skipped" })
  }

  const todayStr = format(today, "yyyy-MM-dd")

  // 3. 모든 유저 정보 조회
  const { data: users } = await supabase.from('users').select('*').eq('is_active', true)
  if (!users) return NextResponse.json({ error: "No users found" }, { status: 500 })

  // 4. 오늘의 점검 내역 조회
  const { data: checks } = await supabase
    .from('daily_checks')
    .select('user_id')
    .eq('check_date', todayStr)
    .eq('status', 'completed')

  const checkedUserIds = new Set(checks?.map(c => c.user_id) || [])

  // 5. 오늘의 부재/예외 내역 조회
  const { data: exceptions } = await supabase
    .from('exceptions')
    .select('user_id')
    .lte('start_date', todayStr)
    .gte('end_date', todayStr)

  const exceptionUserIds = new Set(exceptions?.map(e => e.user_id) || [])

  // 6. 미점검 대상자 선별
  const targets = users.filter(u => !checkedUserIds.has(u.id) && !exceptionUserIds.has(u.id))
  
  // 7. 관리자/담당자에게 일일 현황 리포트 발송
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

  if (targets.length === 0) {
    return NextResponse.json({ success: true, message: "All users checked.", managerSendCount })
  }

  // 8. 대상자들에게 카카오 알림톡(나에게 보내기) 전송
  let sendCount = 0
  const failedUsers = []

  for (const user of targets) {
    if (!user.kakao_refresh_token) {
      failedUsers.push({ name: user.name, reason: "No refresh token" })
      continue
    }

    try {
      const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: process.env.KAKAO_CLIENT_ID || "",
          client_secret: process.env.KAKAO_CLIENT_SECRET || "",
          refresh_token: user.kakao_refresh_token
        })
      })

      if (!tokenRes.ok) {
        failedUsers.push({ name: user.name, reason: "Token refresh failed" })
        continue
      }
      
      const tokenData = await tokenRes.json()
      const accessToken = tokenData.access_token

      if (tokenData.refresh_token) {
        await supabase.from('users').update({ kakao_refresh_token: tokenData.refresh_token }).eq('id', user.id)
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
            text: `[팀 보안점검 알림]\n${user.name}님, 오늘(${format(today, "MM/dd")}) 보안점검을 아직 완료하지 않으셨습니다!\n\n하단의 버튼을 눌러 점검을 완료해주세요.`,
            link: {
              web_url: process.env.NEXTAUTH_URL || "http://localhost:3000",
              mobile_web_url: process.env.NEXTAUTH_URL || "http://localhost:3000"
            },
            button_title: "보안점검 대시보드 바로가기"
          })
        })
      })

      if (sendRes.ok) {
        sendCount++
      } else {
        failedUsers.push({ name: user.name, reason: "Send API failed" })
      }
    } catch (err) {
      failedUsers.push({ name: user.name, reason: "Network error" })
    }
  }

  return NextResponse.json({ 
    success: true, 
    targets: targets.length, 
    sentCount: sendCount,
    managerSendCount,
    failedUsers
  })
}
