# 兩系統共用登入整合方案：IEP 培訓平台 × XR 訪談訓練

Oct 5, 2026 · @一凡

## 整合後的樣子

學生在我們的網站登入一次，在選擇頁挑「IEP 培訓」或「XR 訪談訓練」。XR 系統掛在我們網域的 `/xr` 底下，兩邊共用同一份 Supabase 登入狀態，學生不用再登入。

&#91;embedded content: 整合架構 · 上色的是新增的部分\]

兩個系統各自保留自己的後端與資料庫（我們 Supabase、對方 Firestore），只共用「登入」這一件事。身分一律從 Supabase 發的 token 取得，對方學生資料的 ID 改用 Supabase 的使用者 ID（UUID）。

選「同網域掛在 /xr」而不是「兩個網域互跳」的原因：同網域時瀏覽器會自動共用登入 cookie，不必在網址裡傳 token，也不會有跨網域（CORS）問題。

## 對方（XRUItest）要改的地方

共 11 項，依 [nick5wu/XRUItest](https://github.com/nick5wu/XRUItest) 最新版（commit `cda6358`）整理。前端 6 項、後端 5 項；資料庫仍用 Firestore，不用搬。

| # | 檔案 | 改什麼 | 為什麼 |
| --- | --- | --- | --- |
| 1 | `vite.config.ts` | 加 `base: '/xr/'` | 網站要掛在我們網域的 `/xr` 底下，打包後的檔案路徑才會對 |
| 2 | `.env` | 新增 `VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY`；`VITE_BACKEND_URL=/xr-api`；刪除 `VITE_GEMINI_API_KEY` | 連我們的登入；後端經我們的轉址呼叫 |
| 3 | 新增 `src/services/supabaseClient.ts` | 建立 Supabase 連線、檢查是否登入 | 讀取我們網站存的登入 cookie |
| 4 | `src/App.tsx` | 啟動時取登入者；沒登入就導回我們登入頁；督導分頁只給老師角色 | 現在任何人都看得到全部分頁 |
| 5 | `src/components/InteractiveTrainer.tsx` | 拿掉「受訓學員編號」輸入框，改用登入者 | 現在身分可以自己亂填 |
| 6 | `src/services/apiClient.ts` | 每個請求附 `Authorization` 標頭；正式環境拿掉 localhost 備援 | 後端靠 token 認人 |
| 7 | `src/services/geminiService.ts` | 整個刪除 | 沒有元件在用，但會讓人把 Gemini 金鑰填進前端 |
| 8 | 新增 `server/src/middleware/auth.ts` | `requireAuth`（驗 token）與 `requireStaff`（限老師） | 後端目前完全不驗身分 |
| 9 | `server/src/server.ts` | 套用上面兩個檢查；`user_id`、`supervisor_id` 改從 token 取；學生只能看自己的場次 | 不再相信請求內容裡的身分 |
| 10 | `server/src/server.ts` | CORS 從 `'*'` 改成只允許我們的網域 | 現在任何網站都能呼叫 |
| 11 | `server/.env` | 新增 `SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY`、`PORTAL_ORIGIN` | 驗 token 與 CORS 用 |

我們會提供 Supabase 專案網址與 publishable key（本來就是公開給前端用的）。**secret key 不會給，對方也不需要。**

### 程式範例

**#3 `src/services/supabaseClient.ts`**。必須用 `@supabase/ssr` 的 `createBrowserClient`，它和我們 Next.js 讀寫同一組 cookie，登入狀態才會共用。

```ts
import { createBrowserClient } from '@supabase/ssr';

export const supabase = createBrowserClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

// 沒登入就送回入口網站登入，登入後會帶回 /xr/
export async function requireLogin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/?next=' + encodeURIComponent('/xr/');
    return null;
  }
  return session;
}

// 只用來決定畫面顯示哪些分頁；真正的權限由後端檢查
export function getRole(accessToken: string): string {
  const b64 = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(b64)).user_role ?? 'student';
}
```

**#4 `App.tsx` 的角色分頁**：`owner`、`assistant` 看得到 `live`、`report`、`review`、`analytics`；`student` 只看 `trainer`。

**#6 `apiClient.ts`**，在 `fetchWithFallback` 送出前加上：

```ts
const { data: { session } } = await supabase.auth.getSession();
const headers = {
  ...(options?.headers ?? {}),
  Authorization: `Bearer ${session?.access_token ?? ''}`,
};
```

**#8 `server/src/middleware/auth.ts`**（先 `npm i @supabase/supabase-js`）：

```ts
import { createClient } from '@supabase/supabase-js';
import type { Request, Response, NextFunction } from 'express';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_PUBLISHABLE_KEY!,
);

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) { res.status(401).json({ error: 'UNAUTHENTICATED' }); return; }

  // 向 Supabase 確認 token 是真的、沒過期
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) { res.status(401).json({ error: 'INVALID_TOKEN' }); return; }

  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  (req as any).user = {
    id: data.user.id,                                  // Supabase UUID
    name: data.user.user_metadata?.full_name ?? data.user.email,
    role: claims.user_role ?? 'student',
  };
  next();
}

export function requireStaff(req: Request, res: Response, next: NextFunction) {
  const role = (req as any).user?.role;
  if (role === 'owner' || role === 'assistant') { next(); return; }
  res.status(403).json({ error: 'FORBIDDEN' });
}
```

**#9、#10 `server.ts`**，`app.use('/api', requireAuth)` 要放在所有 `/api` 路由定義之前：

```ts
app.use(cors({ origin: [process.env.PORTAL_ORIGIN!, 'http://localhost:3000'] }));
app.get('/health', ...);                 // 不用登入
app.use('/api', requireAuth);            // 以下全部要登入

app.post('/api/supervisor/review', requireStaff, ...);
app.get('/api/export/lsa', requireStaff, ...);

// /api/session/start 裡
const userId = (req as any).user.id;    // 不再讀 req.body.user_id
```

`/api/sessions` 與 `/api/session/:sessionId/detail`：老師看全部，學生只回傳 `user_id` 等於自己的場次。

⚠️ 套上 `requireAuth` 後，Unity VR 目前直接送 `user_id` 的呼叫會被擋下。VR 要先決定暫時怎麼處理（見「兩隊要先講好的事」），再套用。

## 我們這邊要改的地方

共 7 項，全部在我們的 repo。第 1–5 項是串接必要的；第 6 項是同一個問題（後端沒驗身分）在我們自己身上，建議一起修。

| # | 檔案 | 改什麼 |
| --- | --- | --- |
| 1 | 新增 `frontend/src/app/portal/page.tsx` | 選擇頁：「IEP 撰寫培訓」與「XR 訪談訓練」兩張卡片；老師角色多一個「管理後台」入口 |
| 2 | `frontend/src/app/page.tsx`、`auth/callback`、`middleware.ts` | 登入、完成註冊後改導向 `/portal`（現在是直接進 `/student/modules` 或 `/admin/tools`）；支援 `?next=` 帶回原本要去的頁 |
| 3 | `frontend/src/middleware.ts` | `matcher` 加入 `/portal`、`/xr/:path*`，沒登入或沒完成註冊的人進不去 |
| 4 | `frontend/next.config.ts` | 加轉址：`/xr` 轉對方前端、`/xr-api` 轉對方後端 |
| 5 | 新增 `supabase/migrations/002_role_claim.sql` | 讓登入 token 帶上角色（`user_role`），兩個系統都從 token 讀角色 |
| 6 | `backend/`（FastAPI） | 加 token 驗證，`user_id` 改從 token 取，不再信任請求裡帶的 |
| 7 | 部署設定 | 前端環境變數新增 `XR_FRONTEND_URL`、`XR_BACKEND_URL` |

### 程式範例

**#2 `?next=` 的安全檢查**：只接受站內路徑，否則別人可以做一個「登入後跳到釣魚網站」的連結。

```ts
const next = searchParams.get('next');
const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/portal';
```

**#4 `next.config.ts`**：

```ts
const nextConfig: NextConfig = {
  async rewrites() {
    const front = process.env.XR_FRONTEND_URL; // 對方前端部署網址
    const api = process.env.XR_BACKEND_URL;    // 對方後端 Cloud Run 網址
    return [
      { source: '/xr', destination: `${front}/` },
      { source: '/xr/:path*', destination: `${front}/:path*` },
      { source: '/xr-api/:path*', destination: `${api}/:path*` },
    ];
  },
};
```

**#5 `002_role_claim.sql`**：執行後到 Supabase Dashboard → Authentication → Hooks，把「Custom Access Token」指向這個函式。角色改動會在下一次 token 更新時生效（預設 1 小時內）。

```sql
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable as $$
declare
  claims jsonb;
  r text;
begin
  select role into r from public.profiles where id = (event->>'user_id')::uuid;
  claims := jsonb_set(event->'claims', '{user_role}', to_jsonb(coalesce(r, 'student')));
  return jsonb_set(event, '{claims}', claims);
end; $$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
grant select on table public.profiles to supabase_auth_admin;
```

**#6 FastAPI**：做法和對方 #8 一樣，用一個 `Depends(current_user)` 向 Supabase 驗 token。`/api/practice/sessions/{id}/submit` 與 `/hints` 的 `user_id`、`/api/review/submissions/{id}/judge` 的 `teacher_id` 都改從 token 取；`/api/review/*` 只限 `owner`、`assistant`。

這 7 項由成員三（後端）負責，前端 1–4 項需要和前端組協調。

## 接上真實學生帳號前必修的安全問題

以下 6 項不修，任何知道網址的人都能讀走或竄改學生資料。測試階段可以先串接，但放真實帳號前全部要完成。

| # | 問題 | 在哪一邊 | 風險 | 修法 |
| --- | --- | --- | --- | --- |
| 1 | 後端不驗身分，`/api/export/lsa`、`/api/sessions` 任何人都能呼叫 | 對方 | 可以一次匯出所有學生的訪談紀錄 | 對方 #8、#9 |
| 2 | CORS 設成 `'*'` | 對方 | 任何網站都能在使用者瀏覽器裡呼叫後端 | 對方 #10 |
| 3 | 學生身分從請求內容讀（`user_id`） | 兩邊都有 | 可以冒用別人作答、看別人成績 | 對方 #9、我們 #6 |
| 4 | 前端設計成讀 `VITE_GEMINI_API_KEY` | 對方 | Vite 會把 `VITE_` 變數打包進網頁，金鑰被任何人拿去用 | 對方 #7，Gemini 只在後端呼叫 |
| 5 | Supabase 資料表沒開 RLS（列級權限） | 我們 | publishable key 是公開的，沒有 RLS 時拿到它就能直接讀寫所有資料表；現在要給第二個團隊，更要處理 | 至少 `profiles` 與作答、評分相關表開 RLS，使用者只能讀自己的資料；並為 #5 的角色 hook 加 `supabase_auth_admin` 的讀取政策 |
| 6 | 登入後的 `?next=` 轉址 | 我們 | 做不好會變成釣魚跳板 | 我們 #2 的檢查 |

Supabase secret key 只能放在我們自己的後端環境變數，不給對方、不進 Git。

## 兩隊要先講好的事

下面 7 件事沒有技術上的標準答案，開工前先對齊，否則改到一半會卡住。

| 事項 | 我們的建議 | 決定 |
| --- | --- | --- |
| 正式網域與誰部署入口網站 | 用我們 Next.js 的網域當入口，由我們部署 |  |
| 對方前端放哪裡 | Cloud Run 或 Firebase Hosting 皆可，只要把打包後的 `dist/` 放在根目錄、給我們一個網址 |  |
| 角色對應 | `owner`、`assistant` = 督導；`student` = 學員；`explorer` 要不要開放 XR，請決定 |  |
| 誰看得到 XR 卡片 | 先開放給所有已完成註冊的人；之後要分課程再加 |  |
| Firestore 裡現有的測試資料 | 舊的 `trainee_web_01` 等 ID 對不到真實帳號，建議清掉或標記為測試 |  |
| Unity VR 怎麼登入 | 網頁顯示 6 位數配對碼（5 分鐘有效），頭盔輸入後由對方後端換成該學生的場次憑證。做好前，VR 只連測試用後端，不碰真實帳號 |  |
| 時程與窗口 | 兩邊各指定一位聯絡人；對方先完成 #1–#6，就能進行第一次串接測試 |  |

## 執行順序與驗收清單

分五個階段，前三個階段完成就能在測試環境走完整流程；第四階段完成前不放真實學生帳號。

1. **我們先準備**：角色 hook（我們 #5）、轉址（#4）、選擇頁與登入導向（#1–#3），並把 Supabase 網址與 publishable key 交給對方。
2. **對方前端**：對方 #1–#7。本機聯調時，對方跑 `vite build && vite preview`，我們把 `XR_FRONTEND_URL` 指向那個網址。
3. **對方後端**：對方 #8–#11。VR 的呼叫先留在測試用後端。
4. **安全修正**：開 RLS、我們 FastAPI 的 token 驗證（#6）。
5. **部署與驗收**：兩邊部署到正式環境，照下方清單逐項勾。

驗收清單：

- [ ] 沒登入直接開 `/xr`，會被導回登入頁；登入後自動回到 `/xr`
- [ ] 學生登入後在 `/portal` 看到兩張卡片，點 XR 不用再登入
- [ ] XR 練習畫面沒有學員編號輸入框；Firestore 新場次的 `user_id` 是 Supabase UUID
- [ ] 學生帳號看不到督導分頁，直接呼叫 `/api/export/lsa` 回 403
- [ ] 老師帳號看得到全部場次，學生只看得到自己的
- [ ] 不帶 token 呼叫對方任何 `/api/*` 回 401
- [ ] 從其他網域呼叫對方後端被 CORS 擋下
- [ ] 對方打包後的前端檔案裡搜不到 Gemini 金鑰（`AIza` 開頭的字串）
- [ ] 在我們網站登出後回到 `/xr`，會被要求重新登入
- [ ] 用 publishable key 直接讀 Supabase 資料表，只拿得到自己的資料（RLS 生效）
