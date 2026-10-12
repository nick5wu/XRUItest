import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'placeholder-publishable-key';

// 建立瀏覽器端 Supabase 用戶端 (與 Next.js 入口網站共用同一組 Cookie)
export const supabase = createBrowserClient(
  supabaseUrl,
  supabasePublishableKey
);

export interface CurrentUser {
  id: string;
  name: string;
  role: 'student' | 'owner' | 'assistant' | string;
  email?: string;
  isMock?: boolean;
}

/**
 * 檢查登入狀態：
 * 若未登入，導向入口網站登入頁面，登入成功後透過 ?next=/xr/ 返回
 */
export async function requireLogin(): Promise<{ session: any; user: CurrentUser } | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      // 若為本機開發且未配置真實 Supabase URL，提供本地模擬機制防崩潰
      const isPlaceholder = !supabaseUrl || supabaseUrl.includes('placeholder');
      if (isPlaceholder && import.meta.env.DEV) {
        console.warn('[Supabase] 檢測到為本地開發模式且未填寫真實 Supabase 金鑰，使用本地模擬登入');
        return {
          session: null,
          user: {
            id: 'dev_mock_trainee_01',
            name: '本地測試學員 (Dev Mode)',
            role: 'owner', // 開發模式預設開放檢視督導與學員全功能
            email: 'dev@test.edu.tw',
            isMock: true
          }
        };
      }

      // 正式環境或已配置 Supabase：強制導回入口網站
      window.location.href = '/?next=' + encodeURIComponent('/xr/');
      return null;
    }

    const role = getRole(session.access_token);
    const user: CurrentUser = {
      id: session.user.id,
      name: session.user.user_metadata?.full_name ?? session.user.email ?? '學員',
      role,
      email: session.user.email,
      isMock: false
    };

    return { session, user };
  } catch (error) {
    console.error('[Supabase Auth Check Error]:', error);
    return null;
  }
}

/**
 * 從 JWT Access Token 提取使用者角色 (user_role)
 * 僅用於前端介面分頁顯示邏輯，實際存取安全性由後端 API 檢驗
 */
export function getRole(accessToken?: string): string {
  if (!accessToken) return 'student';
  try {
    const parts = accessToken.split('.');
    if (parts.length < 2) return 'student';
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = decodeURIComponent(
      atob(b64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonStr);
    return payload.user_role ?? 'student';
  } catch (e) {
    console.warn('[Supabase] 無法從 Token 解析角色，預設為 student', e);
    return 'student';
  }
}
