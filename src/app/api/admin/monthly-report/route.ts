import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, format, subMonths } from "date-fns"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: Request) {
  // 1. 보안을 위해 API 키 또는 인증 확인 (크론에서 호출 시 시크릿 토큰 검증, 수동 호출 시 세션 검증)
  const authHeader = req.headers.get('authorization')
  let isAuthorized = false;

  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    isAuthorized = true; // 스케줄러 인증
  } else {
    // 웹 수동 발송
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (role === 'admin' || role === 'security') isAuthorized = true;
  }

  if (!isAuthorized) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  // 2. 대상 월 계산 (기본값: 이전 달)
  const url = new URL(req.url)
  const monthParam = url.searchParams.get('month')
  let targetDate = new Date()
  if (monthParam) {
    targetDate = new Date(`${monthParam}-01`)
  } else {
    targetDate = subMonths(new Date(), 1) // 이전 달
  }

  const start = startOfMonth(targetDate)
  const end = endOfMonth(targetDate)
  const monthStr = format(start, "yyyy년 MM월")
  const startStr = format(start, "yyyy-MM-dd")
  const endStr = format(end, "yyyy-MM-dd")

  // 3. 평일(주말 제외) 일수 계산
  const daysInMonth = eachDayOfInterval({ start, end })
  const weekdays = daysInMonth.filter(d => !isWeekend(d))
  const totalWeekdays = weekdays.length

  // 4. 데이터 조회 (유저, 점검 내역, 예외 내역)
  const { data: users } = await supabase.from('users').select('*')
  if (!users) return NextResponse.json({ error: "No users found" }, { status: 500 })

  const { data: checks } = await supabase
    .from('daily_checks')
    .select('*')
    .gte('check_date', startStr)
    .lte('check_date', endStr)
    .eq('status', 'completed')

  const { data: exceptions } = await supabase
    .from('exceptions')
    .select('*')
    .lte('start_date', endStr)
    .gte('end_date', startStr)

  // 5. 유저별 정산
  const reportLines: string[] = []
  
  for (const user of users) {
    // 유저의 완료일수 (평일만)
    const userChecks = (checks || []).filter(c => c.user_id === user.id)
    const completedWeekdays = userChecks.filter(c => !isWeekend(new Date(c.check_date))).length

    // 유저의 부재/예외일수 (평일만)
    const userExcs = (exceptions || []).filter(e => e.user_id === user.id)
    let excWeekdays = 0
    for (const exc of userExcs) {
      const excStart = new Date(exc.start_date) > start ? new Date(exc.start_date) : start
      const excEnd = new Date(exc.end_date) < end ? new Date(exc.end_date) : end
      const excDays = eachDayOfInterval({ start: excStart, end: excEnd })
      excWeekdays += excDays.filter(d => !isWeekend(d)).length
    }

    const missedDays = totalWeekdays - completedWeekdays - excWeekdays
    const finalMissed = missedDays > 0 ? missedDays : 0
    
    if (finalMissed > 0) {
      reportLines.push(`${user.name}: ${finalMissed}일 미점검`)
    } else {
      reportLines.push(`${user.name}: 완벽함 ✨`)
    }
  }

  // 6. 리포트 메시지 생성
  const reportText = `[${monthStr} 보안점검 결산]
총 평일: ${totalWeekdays}일

${reportLines.join('\n')}

(※ 주말 및 부재일은 제외된 결과입니다.)`

  // 7. 카카오톡 메시지 발송 대상 (admin, security)
  const managers = users.filter(u => u.role === 'admin' || u.role === 'security')
  let sendCount = 0

  for (const manager of managers) {
    if (!manager.kakao_refresh_token) continue

    // 액세스 토큰 갱신
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

    // 나에게 보내기 발송
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
          button_title: "대시보드 확인하기"
        })
      })
    })

    if (sendRes.ok) sendCount++
  }

  return NextResponse.json({ success: true, report: reportText, sentTo: sendCount })
}
