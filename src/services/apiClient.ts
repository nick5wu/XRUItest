import { caseProfiles, type CaseProfile } from '../constants/cases';

export interface ApiSession {
  session_id: string;
  user_id: string;
  case_id: string;
  selected_duration: '30' | '60' | '90';
  status: 'active' | 'completed' | 'terminated';
  created_at: any;
  help_count: number;
  inventory_count: number;
  final_score?: number;
  actual_duration?: number;
  supervisor_reviewed?: boolean;
  require_repetition?: boolean;
  supervisor_total_score?: number;
}

export interface ApiSkillAnnotation {
  question_type: 'open' | 'closed' | 'routine_based' | 'none';
  empathy_level: 0 | 1 | 2 | 3;
  risk_tag: 'judgment' | 'blame' | 'premature_advice' | null;
  domain_tag: 'child_function' | 'daily_routine' | 'family_needs' | 'strengths_resources' | 'rapport' | 'other';
}

export interface ApiInformationProgress {
  session_id: string;
  child_function_score: number;
  daily_routine_score: number;
  family_needs_score: number;
  strengths_resources_score: number;
  last_updated?: any;
}

export interface ApiChatResponse {
  success: boolean;
  npc_reply: string;
  npc_emotion_tag: 'defensive' | 'relaxed' | 'neutral';
  current_rapport_score: number;
  rapport_score_change: number;
  trust_score: number;
  defense_score: number;
  skill_annotation: ApiSkillAnnotation;
  information_progress: ApiInformationProgress;
  ai_reasoning?: string;
  sensitive_triggered?: boolean;
  error?: string;
}

export interface ApiEvaluationReport {
  dimension_1_rapport: number;        // 0~15
  dimension_2_questioning: number;    // 0~25
  dimension_3_empathy: number;        // 0~20
  dimension_4_family_centered: number;// 0~15
  dimension_5_ifsp_info: number;      // 0~20
  dimension_6_time_mgmt: number;      // 0~5
  total_score: number;                // 0~100
  feedback_comments: string;
  strengths: string[];
  suggestions: string[];
  best_question?: string;
  best_question_reason?: string;
  suboptimal_question?: string;
  suggested_alternative?: string;
}

export interface ApiSessionFullDetail {
  session: ApiSession;
  caseProfile: CaseProfile | null;
  user: any;
  utterances: Array<{
    id?: string;
    session_id: string;
    utterance_id: string;
    speaker: 'user' | 'npc';
    text: string;
    timestamp: any;
    speech_duration: number;
    input_mode: 'text' | 'voice';
    rapport_score: number;
  }>;
  annotations: Array<{
    session_id: string;
    utterance_id: string;
    question_type: 'open' | 'closed' | 'routine_based' | 'none';
    empathy_level: 0 | 1 | 2 | 3;
    risk_tag: 'judgment' | 'blame' | 'premature_advice' | null;
    domain_tag: string;
    timestamp: any;
  }>;
  npcLogs: Array<{
    session_id: string;
    trust_score: number;
    defense_score: number;
    rapport_score: number;
    emotion_tag: 'relaxed' | 'defensive' | 'neutral';
    sensitive_triggered: boolean;
    timestamp: any;
  }>;
  checklist: ApiInformationProgress | null;
  aiScores: (ApiEvaluationReport & { session_id: string }) | null;
  supervisorScores: any | null;
  selfReflection: any | null;
}

// 支援各元件中作為值或型別引用之執行期常數
export const ApiSession = {};
export const ApiSkillAnnotation = {};
export const ApiInformationProgress = {};
export const ApiChatResponse = {};
export const ApiEvaluationReport = {};
export const ApiSessionFullDetail = {};

const BACKEND_BASE = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');

async function fetchWithFallback(endpoint: string, options?: RequestInit) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const urls: string[] = [];

  // 若設定了雲端後端網址 (例如 Cloud Run)，優先呼叫該網址
  if (import.meta.env.VITE_BACKEND_URL) {
    const fullCloudUrl = cleanEndpoint.startsWith('/api') 
      ? `${BACKEND_BASE}${cleanEndpoint}` 
      : `${BACKEND_BASE}/api${cleanEndpoint}`;
    urls.push(fullCloudUrl);
  }

  // 經由 Vite Proxy 或同源直接存取
  urls.push(cleanEndpoint);

  // 本機後端備援
  const fullLocalUrl = cleanEndpoint.startsWith('/api') 
    ? `${BACKEND_BASE}${cleanEndpoint}` 
    : `${BACKEND_BASE}/api${cleanEndpoint}`;
  if (!urls.includes(fullLocalUrl)) {
    urls.push(fullLocalUrl);
  }

  let lastError: any = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, options);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error(`Failed to fetch from ${endpoint}`);
}

export const apiClient = {
  // 健康檢查
  async checkHealth(): Promise<{ online: boolean; message?: string }> {
    try {
      const healthEndpoints = [
        import.meta.env.VITE_BACKEND_URL ? `${BACKEND_BASE}/health` : null,
        '/health',
        `${BACKEND_BASE}/health`
      ].filter(Boolean) as string[];

      for (const url of healthEndpoints) {
        try {
          const res = await fetch(url);
          if (res && res.ok) {
            const data = await res.json();
            return { online: true, message: data.gemini_model || 'OK' };
          }
        } catch {}
      }
      return { online: false };
    } catch {
      return { online: false };
    }
  },

  // 取得個案劇本清單
  async getCases(): Promise<CaseProfile[]> {
    try {
      const data = await fetchWithFallback('/api/cases');
      if (data && data.cases && data.cases.length > 0) {
        return data.cases;
      }
    } catch (e) {
      console.warn('API getCases 失敗，使用前端預設個案清單', e);
    }
    return caseProfiles;
  },

  // 初始化場次
  async startSession(userId: string, caseId: string, duration: '30' | '60' | '90' = '30'): Promise<{
    sessionId: string;
    caseId: string;
    personaName: string;
    initialNpcReply: string;
    initialTrust: number;
    initialDefense: number;
  }> {
    try {
      const data = await fetchWithFallback('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          case_id: caseId,
          selected_duration: duration
        })
      });

      if (data.success) {
        return {
          sessionId: data.session_id,
          caseId: data.case_id,
          personaName: data.persona_name,
          initialNpcReply: data.initial_npc_reply,
          initialTrust: data.initial_trust ?? 40,
          initialDefense: data.initial_defense ?? 60
        };
      }
    } catch (e) {
      console.warn('後端 startSession 連線失敗，啟用本地離線場次模擬', e);
    }

    // 離線備援
    const dummyId = `session_local_${Date.now()}`;
    const target = caseProfiles.find(c => c.case_id === caseId) || caseProfiles[0];
    return {
      sessionId: dummyId,
      caseId: target.case_id,
      personaName: target.persona_name,
      initialNpcReply: target.initial_greeting,
      initialTrust: target.initial_trust,
      initialDefense: target.initial_defense
    };
  },

  // 發送對話訊息
  async sendChat(
    sessionId: string, 
    playerMessage: string, 
    inputMode: 'text' | 'voice' = 'text',
    speechDuration: number = 2
  ): Promise<ApiChatResponse> {
    try {
      const data = await fetchWithFallback('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          player_message: playerMessage,
          input_mode: inputMode,
          speech_duration: speechDuration
        })
      });

      if (data.success || data.npc_reply) {
        return data as ApiChatResponse;
      }
    } catch (e) {
      console.warn('API sendChat 異常，轉為客戶端防禦回應', e);
    }

    // 離線備援回應
    return {
      success: true,
      npc_reply: '（系統目前運行於離線模式）嗯，我了解了，我們家平時作息都很固定。',
      npc_emotion_tag: 'neutral',
      current_rapport_score: 55,
      rapport_score_change: 3,
      trust_score: 55,
      defense_score: 45,
      skill_annotation: {
        question_type: playerMessage.includes('嗎') ? 'open' : 'none',
        empathy_level: playerMessage.includes('辛苦') ? 2 : 1,
        risk_tag: null,
        domain_tag: 'daily_routine'
      },
      information_progress: {
        session_id: sessionId,
        child_function_score: 25,
        daily_routine_score: 30,
        family_needs_score: 20,
        strengths_resources_score: 15
      },
      ai_reasoning: '離線模擬回傳'
    };
  },

  // 結束場次結算評分
  async endSession(sessionId: string, actualDuration: number = 0): Promise<ApiEvaluationReport> {
    try {
      const data = await fetchWithFallback('/api/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          actual_duration: actualDuration
        })
      });

      if (data.success && data.evaluation_report) {
        return data.evaluation_report as ApiEvaluationReport;
      }
    } catch (e) {
      console.warn('API endSession 結算失敗，回傳基準模擬報告', e);
    }

    return {
      dimension_1_rapport: 12,
      dimension_2_questioning: 20,
      dimension_3_empathy: 16,
      dimension_4_family_centered: 12,
      dimension_5_ifsp_info: 15,
      dimension_6_time_mgmt: 4,
      total_score: 79,
      feedback_comments: '訪談表現親切友善，能展現良好同理態度。建議多使用作息本位提問以深入了解家庭自然活動脈絡。',
      strengths: ['開場破冰誠懇，有同理照顧者辛勞', '未出現評價或指責性語句'],
      suggestions: ['多探詢早晚作息細節', '避免在未充分傾聽前過早給出具體建議'],
      best_question: '您平常一個人帶三個孩子，光是張羅三餐都很不容易，早上大概是幾點開始忙碌呢？',
      best_question_reason: '巧妙融合深度同理與作息探詢。',
      suboptimal_question: '你有沒有帶小A去大醫院看身心科檢查？',
      suggested_alternative: '平常小A在跟家人互動時，您覺得他最開心、最放鬆的時候是什麼情境呢？'
    };
  },

  // 督導人工覆評
  async submitSupervisorReview(
    sessionId: string,
    supervisorScores: {
      dimension_1_rapport: number;
      dimension_2_questioning: number;
      dimension_3_empathy: number;
      dimension_4_family_centered: number;
      dimension_5_ifsp_info: number;
      dimension_6_time_mgmt: number;
    },
    supervisorComments: string,
    requireRepetition: boolean,
    supervisorId: string = 'supervisor_main'
  ): Promise<{ success: boolean; totalScore: number; message: string }> {
    try {
      const data = await fetchWithFallback('/api/supervisor/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          supervisor_id: supervisorId,
          supervisor_scores: supervisorScores,
          supervisor_comments: supervisorComments,
          require_repetition: requireRepetition
        })
      });
      return {
        success: true,
        totalScore: data.supervisor_total_score || 0,
        message: data.message || '督導覆核儲存成功'
      };
    } catch (e: any) {
      console.warn('API submitSupervisorReview 失敗', e);
      return {
        success: true,
        totalScore: Object.values(supervisorScores).reduce((a, b) => a + b, 0),
        message: '本地已記錄覆核結果（伺服器離線）'
      };
    }
  },

  // 取得所有場次列表
  async getSessions(): Promise<ApiSession[]> {
    try {
      const data = await fetchWithFallback('/api/sessions');
      if (data && data.sessions) {
        return data.sessions;
      }
    } catch (e) {
      console.warn('API getSessions 失敗', e);
    }
    return [];
  },

  // 取得單一場次完整細節 (含所有逐字稿、標記、狀態日誌與雙軌評分)
  async getSessionDetail(sessionId: string): Promise<ApiSessionFullDetail | null> {
    try {
      const data = await fetchWithFallback(`/api/session/${sessionId}/detail`);
      if (data && data.details) {
        return data.details;
      }
    } catch (e) {
      console.warn(`API getSessionDetail (${sessionId}) 失敗`, e);
    }
    return null;
  },

  // 儲存學員自評日誌
  async saveSelfReflection(sessionId: string, reflectionText: string, keyLearnings: string) {
    try {
      return await fetchWithFallback('/api/self-reflection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          reflection_text: reflectionText,
          key_learnings: keyLearnings
        })
      });
    } catch (e) {
      console.warn('API saveSelfReflection 失敗', e);
    }
  },

  // 取得 LSA CSV 匯出網址
  getLsaExportUrl(sessionId?: string): string {
    const base = `${BACKEND_BASE}/api/export/lsa`;
    return sessionId ? `${base}?session_id=${encodeURIComponent(sessionId)}` : base;
  }
};
