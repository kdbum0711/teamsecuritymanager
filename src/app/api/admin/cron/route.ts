import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.role !== 'admin') return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const { time, type } = await req.json() // type: 'remind' | 'manager'
  if (!time) return NextResponse.json({ error: "Time is required" }, { status: 400 })
  
  const [hourStr, minStr] = time.split(':')
  let hour = parseInt(hourStr) - 9
  if (hour < 0) hour += 24
  const cronExpr = `${parseInt(minStr)} ${hour} * * *`

  const owner = process.env.GITHUB_OWNER
  const repo = process.env.GITHUB_REPO
  const token = process.env.GITHUB_TOKEN
  const path = type === 'manager' ? '.github/workflows/manager-cron.yml' : '.github/workflows/cron.yml'

  if (!owner || !repo || !token) {
    return NextResponse.json({ error: "GitHub credentials not configured" }, { status: 500 })
  }

  const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  })
  
  if (!getRes.ok) return NextResponse.json({ error: "Failed to fetch GitHub file" }, { status: 500 })
  const fileData = await getRes.json()
  const sha = fileData.sha

  const contentStr = Buffer.from(fileData.content, 'base64').toString('utf8')
  const newContentStr = contentStr.replace(/cron:\s*'.*'/, `cron: '${cronExpr}'`)
  const newContentBase64 = Buffer.from(newContentStr).toString('base64')

  const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: `Update ${type || 'remind'} cron schedule to ${time} KST`,
      content: newContentBase64,
      sha
    })
  })

  if (!putRes.ok) return NextResponse.json({ error: "Failed to update GitHub file" }, { status: 500 })

  return NextResponse.json({ success: true, cron: cronExpr })
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.role !== 'admin') return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const url = new URL(req.url)
  const type = url.searchParams.get('type') || 'remind'

  const owner = process.env.GITHUB_OWNER
  const repo = process.env.GITHUB_REPO
  const token = process.env.GITHUB_TOKEN
  const path = type === 'manager' ? '.github/workflows/manager-cron.yml' : '.github/workflows/cron.yml'

  if (!owner || !repo || !token) return NextResponse.json({ time: "17:00" })

  try {
    const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    })
    
    if (!getRes.ok) return NextResponse.json({ time: "17:00" })
    const fileData = await getRes.json()
    const contentStr = Buffer.from(fileData.content, 'base64').toString('utf8')
    
    const match = contentStr.match(/cron:\s*'(\d+)\s+(\d+)\s+\*\s+\*\s+\*'/)
    if (match) {
      const minStr = match[1].padStart(2, '0')
      let hour = parseInt(match[2]) + 9 // UTC to KST
      if (hour >= 24) hour -= 24
      const hourStr = hour.toString().padStart(2, '0')
      return NextResponse.json({ time: `${hourStr}:${minStr}` })
    }
  } catch (e) {
    console.error(e)
  }
  return NextResponse.json({ time: "17:00" })
}
