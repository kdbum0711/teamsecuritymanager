"use client"
import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { ko } from "date-fns/locale"

export default function AdminClient({ currentUser }: { currentUser: any }) {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [remindTime, setRemindTime] = useState("17:00")
  const [managerTime, setManagerTime] = useState("18:00")

  const fetchData = async (date: Date) => {
    setLoading(true)
    try {
      // 로컬 시간 기준으로 yyyy-MM-dd 변환 (UTC 오차 방지)
      const offset = date.getTimezoneOffset() * 60000;
      const localDate = new Date(date.getTime() - offset);
      const formattedDate = localDate.toISOString().split('T')[0];
      
      const res = await fetch(`/api/admin/status?date=${formattedDate}`)
      const data = await res.json()
      if (data.users) setUsers(data.users)
    } catch (error) {
      toast.error("데이터를 불러오지 못했습니다.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(selectedDate)
  }, [selectedDate])

  useEffect(() => {
    if (currentUser.role === 'admin') {
      fetch('/api/admin/cron?type=remind')
        .then(res => res.json())
        .then(data => {
          if (data.time) setRemindTime(data.time)
        })
      fetch('/api/admin/cron?type=manager')
        .then(res => res.json())
        .then(data => {
          if (data.time) setManagerTime(data.time)
        })
    }
  }, [currentUser.role])

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (currentUser.role !== 'admin') return toast.error("권한이 없습니다.")
    const res = await fetch('/api/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: userId, newRole })
    })
    const data = await res.json()
    if (data.success) {
      toast.success("권한이 변경되었습니다.")
      fetchData(selectedDate)
    } else {
      toast.error(data.error)
    }
  }

  if (loading) return <div className="flex justify-center p-20"><div className="animate-spin w-10 h-10 border-4 border-yellow-400 rounded-full border-t-transparent"></div></div>

  const completed = users.filter(u => u.status === 'completed').length
  const exceptions = users.filter(u => u.status === 'exception').length
  const pending = users.filter(u => u.status === 'pending').length

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10 h-full">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full w-9 h-9 bg-gray-50 hover:bg-gray-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">팀 현황 <span className="text-blue-500 ml-1 text-sm">({format(selectedDate, "M/d")})</span></h1>
        </div>
        <div className="flex items-center gap-2">
          {currentUser.role === 'admin' && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full bg-white border-gray-200 text-gray-700 shadow-sm font-bold text-xs px-3 py-1.5 hover:bg-gray-50 h-9"
                onClick={async () => {
                  const loadingId = toast.loading("결산 리포트 집계 및 발송 중...");
                  try {
                    const res = await fetch('/api/admin/monthly-report', { method: 'POST' });
                    const data = await res.json();
                    toast.dismiss(loadingId);
                    if (data.success) {
                      toast.success(`전월 결산이 ${data.sentTo}명의 관리자에게 발송되었습니다!`);
                    } else {
                      toast.error("발송 실패: " + data.error);
                    }
                  } catch (e) {
                    toast.dismiss(loadingId);
                    toast.error("발송 중 오류가 발생했습니다.");
                  }
                }}
              >
                📊 전월 결산
              </Button>
              <Popover>
              <PopoverTrigger className="flex items-center justify-center bg-gray-900 text-white w-9 h-9 rounded-full shadow-sm hover:bg-gray-800 transition-colors cursor-pointer">
                ⏰
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-2rem)] max-w-sm p-5 rounded-2xl mx-4" align="end">
                <h3 className="font-bold mb-4 text-gray-800">알림 발송 시간 설정 (KST)</h3>
                
                <div className="mb-4">
                  <p className="text-xs font-bold text-gray-600 mb-2 flex justify-between items-center">
                    팀원 미점검 재촉 알람
                  </p>
                  <div className="flex gap-2">
                    <input 
                      type="time" 
                      className="border border-gray-200 bg-gray-50 rounded-xl p-2 w-full text-center font-bold focus:outline-none focus:ring-2 focus:ring-yellow-400" 
                      value={remindTime}
                      onChange={(e) => setRemindTime(e.target.value)}
                    />
                    <Button 
                      className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-xl"
                      onClick={async () => {
                        const loadingId = toast.loading("적용 중...");
                        try {
                          const res = await fetch('/api/admin/cron', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ time: remindTime, type: 'remind' })
                          });
                          const data = await res.json();
                          toast.dismiss(loadingId);
                          if (data.success) {
                            toast.success(`재촉 알림이 ${remindTime}으로 변경되었습니다!`);
                          } else {
                            toast.error("변경 실패: " + data.error);
                          }
                        } catch (e) {
                          toast.dismiss(loadingId);
                          toast.error("오류가 발생했습니다.");
                        }
                      }}
                    >
                      저장
                    </Button>
                  </div>
                </div>

                <div className="mb-2">
                  <p className="text-xs font-bold text-gray-600 mb-2 flex justify-between items-center">
                    담당자 일일 현황 리포트
                  </p>
                  <div className="flex gap-2">
                    <input 
                      type="time" 
                      className="border border-gray-200 bg-gray-50 rounded-xl p-2 w-full text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-400" 
                      value={managerTime}
                      onChange={(e) => setManagerTime(e.target.value)}
                    />
                    <Button 
                      className="bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl"
                      onClick={async () => {
                        const loadingId = toast.loading("적용 중...");
                        try {
                          const res = await fetch('/api/admin/cron', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ time: managerTime, type: 'manager' })
                          });
                          const data = await res.json();
                          toast.dismiss(loadingId);
                          if (data.success) {
                            toast.success(`리포트 발송이 ${managerTime}으로 변경되었습니다!`);
                          } else {
                            toast.error("변경 실패: " + data.error);
                          }
                        } catch (e) {
                          toast.dismiss(loadingId);
                          toast.error("오류가 발생했습니다.");
                        }
                      }}
                    >
                      저장
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Card className="border-0 shadow-lg rounded-3xl bg-white overflow-hidden">
          <CardContent className="p-4 flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(day) => day && setSelectedDate(day)}
              locale={ko}
              className="bg-white scale-90 sm:scale-100 origin-top"
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <Card className="border-0 shadow-sm bg-green-50 rounded-2xl">
            <CardContent className="p-3 text-center flex flex-col items-center justify-center">
              <p className="text-[11px] font-bold text-green-600 mb-0.5">점검 완료</p>
              <p className="text-2xl font-extrabold text-green-700">{completed}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-red-50 rounded-2xl">
            <CardContent className="p-3 text-center flex flex-col items-center justify-center">
              <p className="text-[11px] font-bold text-red-600 mb-0.5">미점검</p>
              <p className="text-2xl font-extrabold text-red-700">{pending}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gray-100 rounded-2xl">
            <CardContent className="p-3 text-center flex flex-col items-center justify-center">
              <p className="text-[11px] font-bold text-gray-500 mb-0.5">부재/예외</p>
              <p className="text-2xl font-extrabold text-gray-700">{exceptions}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-3 mt-2">
          {users.map(u => (
            <Card key={u.id} className="border-0 shadow-sm rounded-2xl bg-white overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 text-lg">{u.name}</span>
                    {u.status === 'completed' && <span className="text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded text-[10px] font-bold">완료</span>}
                    {u.status === 'pending' && <span className="text-red-700 bg-red-100 border border-red-200 px-2 py-0.5 rounded text-[10px] font-bold">미점검</span>}
                    {u.status === 'exception' && <span className="text-gray-700 bg-gray-200 border border-gray-300 px-2 py-0.5 rounded text-[10px] font-bold">예외</span>}
                  </div>
                  
                  {currentUser.role === 'admin' ? (
                    <select 
                      value={u.role} 
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="bg-gray-50 border border-gray-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-yellow-400 font-semibold text-gray-700"
                    >
                      <option value="user">팀원</option>
                      <option value="security">담당자</option>
                      <option value="admin">관리자</option>
                    </select>
                  ) : (
                    <span className="text-xs font-semibold text-gray-500 bg-gray-50 px-2 py-1.5 rounded-lg">
                      {u.role === 'admin' ? '관리자' : u.role === 'security' ? '담당자' : '팀원'}
                    </span>
                  )}
                </div>
                {u.reason && (
                  <div className="text-xs font-medium text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                    💡 사유: {u.reason}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
