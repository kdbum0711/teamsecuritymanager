"use client"
import { useState, useEffect } from "react"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { toast } from "sonner"
import { DateRange } from "react-day-picker"

export default function DashboardClient({ user }: { user: any }) {
  const [status, setStatus] = useState<'loading' | 'pending' | 'completed' | 'exception'>('loading')
  const [date, setDate] = useState<DateRange | undefined>()
  const [reason, setReason] = useState("")
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const [exceptions, setExceptions] = useState<any[]>([])
  const [selectedException, setSelectedException] = useState<any>(null)

  const fetchExceptions = () => {
    fetch('/api/exceptions')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.exceptions) {
          setExceptions(data.exceptions)
        }
      })
  }

  useEffect(() => {
    fetch('/api/checks')
      .then(res => res.json())
      .then(data => {
        if (data.status) setStatus(data.status)
      })
    fetchExceptions()
  }, [])

  const handleCheck = async () => {
    setStatus('loading')
    try {
      const res = await fetch('/api/checks', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setStatus('completed')
        toast.success("오늘의 보안점검이 완료되었습니다! 👏")
      } else {
        toast.error("점검 완료 처리에 실패했습니다: " + data.error)
        setStatus('pending')
      }
    } catch (e) {
      toast.error("오류가 발생했습니다.")
      setStatus('pending')
    }
  }

  const handleCancelCheck = async () => {
    if (!confirm("점검 완료를 취소하시겠습니까?")) return;
    setStatus('loading')
    try {
      const res = await fetch('/api/checks', { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setStatus('pending')
        toast.info("점검 완료가 취소되었습니다.")
      } else {
        toast.error("취소에 실패했습니다: " + data.error)
        setStatus('completed')
      }
    } catch (e) {
      toast.error("오류가 발생했습니다.")
      setStatus('completed')
    }
  }

  const handleException = async () => {
    if (!date?.from) return toast.warning("날짜를 선택해주세요.")
    if (!reason.trim()) return toast.warning("사유를 입력해주세요.")
    
    try {
      const formattedStartDate = format(date.from, 'yyyy-MM-dd')
      const formattedEndDate = date.to ? format(date.to, 'yyyy-MM-dd') : formattedStartDate

      const res = await fetch('/api/exceptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: formattedStartDate,
          endDate: formattedEndDate,
          reason
        })
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`[${formattedStartDate} ~ ${formattedEndDate}] 부재 등록 완료.`)
        setIsPopoverOpen(false)
        setReason("")
        fetchExceptions()
      } else {
        toast.error("등록 실패: " + data.error)
      }
    } catch (e) {
      toast.error("오류가 발생했습니다.")
    }
  }

  const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const exceptionRanges = exceptions.map(e => ({
    from: parseLocalDate(e.start_date),
    to: parseLocalDate(e.end_date)
  }))

  const handleSelectDate = (newDate: DateRange | undefined) => {
    setDate(newDate)
    if (newDate?.from && !newDate.to) {
      const dt = newDate.from.getTime()
      const found = exceptions.find(e => {
        const start = parseLocalDate(e.start_date).getTime()
        const end = parseLocalDate(e.end_date).getTime()
        return dt >= start && dt <= end
      })
      if (found) {
        setSelectedException(found)
      } else {
        setSelectedException(null)
      }
    } else {
      setSelectedException(null)
    }
  }

  const handleDeleteException = async (id: string) => {
    if (!confirm("이 일정을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/exceptions?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast.success("부재 일정이 삭제되었습니다.")
        setSelectedException(null)
        setDate(undefined)
        fetchExceptions()
      } else {
        toast.error("삭제 실패: " + data.error)
      }
    } catch (e) {
      toast.error("오류가 발생했습니다.")
    }
  }

  return (
    <div className="w-full max-w-md mx-auto flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            환영합니다, <span className="text-yellow-500 drop-shadow-sm">{user.name}</span>님
          </h1>
          <p className="text-gray-500 text-sm mt-1">오늘 하루도 고생 많으셨습니다.</p>
        </div>
        <div className="flex gap-2">
          {(user.role === 'admin' || user.role === 'security') && (
            <Button variant="secondary" size="sm" onClick={() => window.location.href = '/admin'} className="rounded-full font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 shadow-sm border border-blue-200">
              대시보드
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: '/login' })} className="rounded-full font-semibold">
            로그아웃
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-2xl shadow-gray-200/40 rounded-3xl overflow-hidden mb-6 bg-white/90 backdrop-blur-xl">
        <CardHeader className="bg-gray-50/80 border-b border-gray-100 pb-4">
          <CardTitle className="text-lg text-gray-700 text-center font-bold tracking-tight">오늘의 보안 점검</CardTitle>
        </CardHeader>
        <CardContent className="pt-10 pb-12 flex flex-col items-center justify-center">
          {status === 'loading' ? (
            <div className="w-56 h-56 rounded-full border-4 border-gray-100 border-t-yellow-400 animate-spin shadow-inner"></div>
          ) : (
            <div 
              className={`relative w-64 h-64 rounded-full flex flex-col items-center justify-center transition-all duration-500 cursor-pointer shadow-xl border-8 group ${
                status === 'completed' 
                  ? 'bg-gradient-to-br from-green-400 to-green-600 border-green-200 text-white shadow-green-300 hover:scale-[1.02]' 
                  : 'bg-white border-gray-50 text-gray-700 hover:border-yellow-300 hover:shadow-yellow-200/60 hover:scale-[1.03] active:scale-95'
              }`}
              onClick={status === 'completed' ? handleCancelCheck : handleCheck}
            >
              {status === 'completed' ? (
                <>
                  <svg className="w-24 h-24 mb-2 drop-shadow-md animate-in zoom-in duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-2xl font-extrabold tracking-wide drop-shadow-sm">점검 완료!</span>
                  <span className="text-sm font-medium mt-2 text-green-100 opacity-80 group-hover:opacity-100 transition-opacity">클릭하여 취소하기</span>
                </>
              ) : (
                <>
                  <svg className="w-20 h-20 mb-3 text-gray-200 group-hover:text-yellow-400 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span className="text-lg font-bold group-hover:text-yellow-600 transition-colors">퇴근 전 터치하세요</span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger className="w-full text-left p-0 border-0 bg-transparent focus:outline-none cursor-pointer">
          <Card className="border-0 shadow-md shadow-gray-200/50 rounded-2xl bg-white/80 backdrop-blur-md hover:bg-white transition-colors cursor-pointer group">
            <CardContent className="p-5 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-base font-bold text-gray-800">부재 일정 등록</span>
                <span className="text-sm text-gray-500 mt-0.5">휴가, 출장 등 미점검 사유</span>
              </div>
              <div className="bg-gray-100 text-gray-600 group-hover:bg-yellow-100 group-hover:text-yellow-700 p-3 rounded-xl transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
              </div>
            </CardContent>
          </Card>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-5 rounded-2xl border-0 shadow-2xl bg-white" align="center" sideOffset={12}>
          <div className="flex flex-col gap-4">
            <h3 className="font-bold text-gray-800 text-center text-lg">어떤 일정인가요?</h3>
            <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
              <Calendar
                mode="range"
                selected={date}
                onSelect={handleSelectDate}
                modifiers={{ booked: exceptionRanges }}
                modifiersClassNames={{ booked: "bg-yellow-100 text-yellow-800 font-bold underline decoration-yellow-400 decoration-2 underline-offset-4" }}
                className="bg-transparent"
                locale={ko}
                numberOfMonths={1}
              />
            </div>
            {selectedException && (
              <div className="bg-yellow-50 text-yellow-800 p-3 rounded-xl text-sm font-bold border border-yellow-200 animate-in fade-in zoom-in duration-300 flex justify-between items-center">
                <span>📌 {selectedException.reason}</span>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => handleDeleteException(selectedException.id)}
                  className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg text-xs"
                >
                  삭제
                </Button>
              </div>
            )}
            <Input 
              placeholder="사유 (예: 연차, 반차, 출장)" 
              value={reason} 
              onChange={e => setReason(e.target.value)} 
              className="h-12 rounded-xl bg-gray-50 border-gray-200 text-center font-medium"
            />
            <Button onClick={handleException} className="w-full bg-[#FEE500] hover:bg-[#FEE500]/90 text-black rounded-xl h-12 font-bold mt-2 shadow-sm">
              일정 등록 완료
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      
    </div>
  )
}
