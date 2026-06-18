import { NextAuthOptions } from "next-auth"
import KakaoProvider from "next-auth/providers/kakao"
import { supabase } from "@/lib/supabase"

export const authOptions: NextAuthOptions = {
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "profile_nickname talk_message",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'kakao') {
        const { data: existingUser } = await supabase.from('users').select('role').eq('kakao_id', account.providerAccountId).single()
        
        const { error } = await supabase
          .from('users')
          .upsert(
            {
              kakao_id: account.providerAccountId,
              name: user.name,
              kakao_refresh_token: account.refresh_token,
              role: existingUser ? existingUser.role : 'user',
              is_active: true
            },
            { onConflict: 'kakao_id' }
          )
        
        if (error) {
          console.error("Supabase upsert error:", error)
          return false
        }
      }
      return true
    },
    async session({ session, token }) {
      if (session?.user && token.sub) {
        const { data } = await supabase
          .from('users')
          .select('id, kakao_id, role')
          .eq('kakao_id', token.sub)
          .single()
        
        if (data) {
          (session.user as any).id = data.id;
          (session.user as any).kakao_id = data.kakao_id;
          (session.user as any).role = data.role;
        }
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: "jwt",
  },
}
