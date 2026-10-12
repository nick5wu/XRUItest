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
    const isPlaceholder = !supabaseUrl || supabaseUrl.includes('placeholder');

    // 1. 若尚未配置真實 Supabase URL (例如雙方尚未正式串接)，一律提供完整展示帳號，徹底杜絕無窮重新導向
    if (isPlaceholder) {
      console.info('[Supabase] 未配置真實 Supabase 金鑰，啟用單機展示/測試模式');
      return {
        session: null,
        user: {
          id: 'supervisor_demo',
          name: '督導教授 (展示模式)',
          role: 'owner', // 預設開放全部功能供檢視
          email: 'supervisor@demo.edu.tw',
          isMock: true
        }
      };
    }

    // 2. 若有配置 Supabase，嘗試取得登入 Session
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      // 若對方系統尚未登入，且在直接存取本系統時，自動降級為展示模式，確保系統能正常體驗與操作
      console.warn('[Supabase] 尚未取得入口網站登入 Session，啟用單機展示模式以供正常使用');
      return {
        session: null,
        user: {
          id: 'supervisor_demo',
          name: '督導教授 (展示模式)',
          role: 'owner',
          email: 'supervisor@demo.edu.tw',
          isMock: true
        }
      };
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
    // 出錯時亦提供防崩潰保護模式
    return {
      session: null,
      user: {
        id: 'supervisor_demo',
        name: '督導教授 (離線保護模式)',
        role: 'owner',
        email: 'supervisor@demo.edu.tw',
        isMock: true
      }
    };
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
