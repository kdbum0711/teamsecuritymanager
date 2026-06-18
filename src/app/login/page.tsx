"use client"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
      <Card className="w-full max-w-sm border-0 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center pb-8">
          <div className="w-16 h-16 mx-auto bg-yellow-400 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-yellow-200">
            <svg className="w-8 h-8 text-yellow-900" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 3.185-9 7.111 0 2.545 1.706 4.773 4.254 6.002-.32 1.134-1.157 3.864-1.189 3.993-.042.167.12.247.245.163.167-.111 3.94-2.607 5.485-3.642.392.052.793.084 1.205.084 4.97 0 9-3.185 9-7.111S16.97 3 12 3z"/></svg>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">팀 일일 보안점검</CardTitle>
          <CardDescription className="text-gray-500">안전한 퇴근을 위한 첫걸음</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            className="w-full bg-[#FEE500] hover:bg-[#FEE500]/90 text-black font-semibold h-12 text-base rounded-xl transition-all active:scale-95 flex gap-2" 
            onClick={() => signIn('kakao', { callbackUrl: '/' })}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 3.185-9 7.111 0 2.545 1.706 4.773 4.254 6.002-.32 1.134-1.157 3.864-1.189 3.993-.042.167.12.247.245.163.167-.111 3.94-2.607 5.485-3.642.392.052.793.084 1.205.084 4.97 0 9-3.185 9-7.111S16.97 3 12 3z"/></svg>
            카카오로 시작하기
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
