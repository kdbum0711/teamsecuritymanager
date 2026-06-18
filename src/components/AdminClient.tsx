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
      fetchData()
    } else {
      toast.error(data.error)
    }
  }

  if (loading) return <div className="flex justify-center p-20"><div className="animate-spin w-10 h-10 border-4 border-yellow-400 rounded-full border-t-transparent"></div></div>

  const completed = users.filter(u => u.status === 'completed').length
  const exceptions = users.filter(u => u.status === 'exception').length
  const pending = users.filter(u => u.status === 'pending').length

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">팀 보안점검 현황</h1>
          
          <Popover>
            <PopoverTrigger className="ml-4 flex items-center gap-2 bg-gray-50 border border-gray-200 px-4 py-2 rounded-xl text-gray-700 font-semibold hover:bg-gray-100 transition-colors focus:outline-none cursor-pointer">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              {format(selectedDate, "yyyy년 MM월 dd일")}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-2xl border-0 shadow-2xl" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(day) => day && setSelectedDate(day)}
                locale={ko}
                className="bg-white rounded-2xl"
              />
            </PopoverContent>
          </Popover>
        </div>
        <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${currentUser.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
          {currentUser.role === 'admin' ? '👑 최고 관리자' : '👀 보안 담당자'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-md bg-white overflow-hidden">
          <CardContent className="p-6 text-center border-b-4 border-green-500">
            <p className="text-sm font-bold text-gray-500 mb-1">점검 완료</p>
            <p className="text-4xl font-extrabold text-green-500">{completed}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-white overflow-hidden">
          <CardContent className="p-6 text-center border-b-4 border-red-500">
            <p className="text-sm font-bold text-gray-500 mb-1">미점검</p>
            <p className="text-4xl font-extrabold text-red-500">{pending}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-white overflow-hidden">
          <CardContent className="p-6 text-center border-b-4 border-gray-400">
            <p className="text-sm font-bold text-gray-500 mb-1">부재 / 예외</p>
            <p className="text-4xl font-extrabold text-gray-700">{exceptions}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-xl rounded-2xl bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="p-4 font-bold text-gray-600">이름</th>
                <th className="p-4 font-bold text-gray-600">오늘 상태</th>
                <th className="p-4 font-bold text-gray-600">특이사항 (사유)</th>
                <th className="p-4 font-bold text-gray-600">시스템 권한</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 font-bold text-gray-800">{u.name}</td>
                  <td className="p-4">
                    {u.status === 'completed' && <span className="text-green-700 bg-green-100 border border-green-200 px-3 py-1 rounded-full text-xs font-bold">완료됨</span>}
                    {u.status === 'pending' && <span className="text-red-700 bg-red-100 border border-red-200 px-3 py-1 rounded-full text-xs font-bold">미점검</span>}
                    {u.status === 'exception' && <span className="text-gray-700 bg-gray-200 border border-gray-300 px-3 py-1 rounded-full text-xs font-bold">예외/부재</span>}
                  </td>
                  <td className="p-4 text-sm font-medium text-gray-500">{u.reason || '-'}</td>
                  <td className="p-4">
                    {currentUser.role === 'admin' ? (
                      <select 
                        value={u.role} 
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="bg-white border border-gray-200 text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-yellow-400 font-semibold text-gray-700"
                      >
                        <option value="user">팀원 (User)</option>
                        <option value="security">보안 담당자 (Security)</option>
                        <option value="admin">최고 관리자 (Admin)</option>
                      </select>
                    ) : (
                      <span className="text-sm font-semibold text-gray-600">
                        {u.role === 'admin' ? '최고 관리자' : u.role === 'security' ? '보안 담당자' : '팀원'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
