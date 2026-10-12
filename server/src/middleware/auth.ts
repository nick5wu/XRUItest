import { createClient } from '@supabase/supabase-js';
import type { Request, Response, NextFunction } from 'express';

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || 'placeholder-publishable-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface AuthenticatedUser {
  id: string;
  name: string;
  role: 'student' | 'owner' | 'assistant' | string;
  email?: string;
  isLegacyVR?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * requireAuth 中介層
 * 驗證請求 Authorization 標頭中的 Supabase JWT Token
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    // 檢查是否為 Unity VR 實機連線 (過渡相容機制)
    const isUnityVR = 
      req.headers['x-client-platform'] === 'unity-vr' || 
      req.headers['x-unity-client'] === 'true';

    if (isUnityVR && process.env.ALLOW_VR_UNAUTHENTICATED === 'true') {
      const fallbackUserId = (req.body?.user_id as string) || 'trainee_vr_legacy';
      req.user = {
        id: fallbackUserId,
        name: 'VR 學員 (過渡期相容)',
        role: 'student',
        isLegacyVR: true,
      };
      next();
      return;
    }

    res.status(401).json({
      error: 'UNAUTHENTICATED',
      message: '缺少身分驗證憑證 (Missing Bearer Token in Authorization header)'
    });
    return;
  }

  try {
    // 1. 向 Supabase 驗證 token 的有效性
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({
        error: 'INVALID_TOKEN',
        message: error?.message || '憑證無效或已過期'
      });
      return;
    }

    // 2. 從 JWT Payload 解析自訂角色 (user_role)
    let userRole = 'student';
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        userRole = claims.user_role ?? 'student';
      }
    } catch {
      userRole = 'student';
    }

    req.user = {
      id: data.user.id,
      name: data.user.user_metadata?.full_name ?? data.user.email ?? '學員',
      role: userRole,
      email: data.user.email,
    };

    next();
  } catch (err: any) {
    console.error('[requireAuth Error]:', err);
    res.status(401).json({
      error: 'TOKEN_VERIFICATION_FAILED',
      message: err.message || 'Token 驗證過程發生錯誤'
    });
  }
}

/**
 * requireStaff 中介層
 * 僅允許督導與老師 (owner / assistant) 存取
 */
export function requireStaff(req: Request, res: Response, next: NextFunction): void {
  const role = req.user?.role;
  if (role === 'owner' || role === 'assistant' || role === 'supervisor' || role === 'teacher') {
    next();
    return;
  }

  res.status(403).json({
    error: 'FORBIDDEN',
    message: '權限不足：此端點僅限督導與教師角色存取'
  });
}
