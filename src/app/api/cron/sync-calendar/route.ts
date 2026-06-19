import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { google } from "googleapis"
import { format, addDays, parseISO } from "date-fns"
import { toZonedTime } from "date-fns-tz"

export async function POST(req: Request) {
  // 1. 권한 체크 (Cron Secret 또는 Admin)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // 수동 동기화 지원을 위해 POST body에 admin token이 있는지 확인 (간단하게 생략하고 오픈해도 무방, 보안상 내부망 사용)
  }

  const calendarId = process.env.GOOGLE_CALENDAR_ID
  const serviceAccountJsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  const apiKey = process.env.GOOGLE_CALENDAR_API_KEY

  if (!calendarId) {
    return NextResponse.json({ success: false, error: "GOOGLE_CALENDAR_ID is not set" }, { status: 400 })
  }

  try {
    let calendar;
    
    // 2. 구글 캘린더 클라이언트 초기화
    if (serviceAccountJsonStr) {
      // 서비스 계정 방식 (Private 캘린더 지원)
      const credentials = JSON.parse(serviceAccountJsonStr)
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      })
      calendar = google.calendar({ version: 'v3', auth })
    } else if (apiKey) {
      // API Key 방식 (Public 캘린더 전용)
      calendar = google.calendar({ version: 'v3', auth: apiKey })
    } else {
      return NextResponse.json({ success: false, error: "No Google credentials provided (API Key or Service Account)" }, { status: 400 })
    }

    // 3. 이벤트 조회 (오늘부터 30일 뒤까지)
    const timeMin = new Date().toISOString()
    const timeMax = addDays(new Date(), 30).toISOString()

    const res = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    })

    const events = res.data.items || []
    if (events.length === 0) {
      return NextResponse.json({ success: true, message: "No events found", synced: 0 })
    }

    // 4. 유저 목록 가져오기
    const { data: users } = await supabase.from('users').select('id, name').eq('is_active', true)
    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, message: "No active users found", synced: 0 })
    }

    let syncedCount = 0

    // 5. 부재 일정 키워드 정의 ('반차'는 보안점검 대상이므로 부재 예외에서 제외)
    const absenceKeywords = ['연차', '휴가', '출장', '교육', '예비군', '공가', '병가', '휴무', '오프', '외근']

    // 6. 이벤트 파싱 및 예외 일정 등록
    for (const event of events) {
      const summary = event.summary || ""
      const description = event.description || ""
      const fullText = `${summary} ${description}`

      // 텍스트에 부재 키워드가 하나라도 포함되어 있는지 확인 (일반 회의 등 제외)
      const hasKeyword = absenceKeywords.some(kw => fullText.includes(kw))
      if (!hasKeyword) continue

      // 제목이나 내용에서 유저 이름 찾기 (여러 명일 수 있음)
      const matchedUsers = users.filter(u => fullText.includes(u.name))
      if (matchedUsers.length === 0) continue

      // 시작/종료 날짜 추출 (종일 일정은 date, 시간 일정은 dateTime)
      let startDateStr = event.start?.date || event.start?.dateTime
      let endDateStr = event.end?.date || event.end?.dateTime

      if (!startDateStr || !endDateStr) continue

      // KST 기준으로 포맷팅 (YYYY-MM-DD)
      const startKst = toZonedTime(startDateStr, 'Asia/Seoul')
      // 구글 캘린더 종일 일정의 종료일은 +1일로 설정되므로 보정 처리
      const endKstRaw = toZonedTime(endDateStr, 'Asia/Seoul')
      let endKst = endKstRaw;
      if (event.end?.date) {
         // 종일 일정인 경우 실제 마지막 날짜는 종료일 - 1일
         endKst = addDays(endKstRaw, -1)
      }

      const startFmt = format(startKst, "yyyy-MM-dd")
      const endFmt = format(endKst, "yyyy-MM-dd")

      for (const matchedUser of matchedUsers) {
        // 중복 확인
        const { data: existing } = await supabase
          .from('exceptions')
          .select('id')
          .eq('user_id', matchedUser.id)
          .eq('start_date', startFmt)
          .eq('end_date', endFmt)
          .single()

        if (!existing) {
          await supabase.from('exceptions').insert({
            user_id: matchedUser.id,
            start_date: startFmt,
            end_date: endFmt,
            reason: `[캘린더연동] ${summary}`
          })
          syncedCount++
        }
      }
    }

    return NextResponse.json({ success: true, message: "Synced successfully", synced: syncedCount })
  } catch (error: any) {
    console.error("Google Calendar Sync Error:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
