import { GoogleGenerativeAI } from '@google/generative-ai';
import { CaseProfile } from '../constants/cases';
import { buildSystemInstruction, buildEvaluationInstruction } from '../constants/prompts';
import { UtteranceRecord, AIScoreRecord } from './firestoreService';
import dotenv from 'dotenv';

dotenv.config();

export interface GeminiChatResponse {
  npc_reply: string;
  npc_emotion_tag: 'defensive' | 'relaxed' | 'neutral';
  rapport_score_change: number;
  trust_score: number;
  defense_score: number;
  question_type: 'open' | 'closed' | 'routine_based' | 'none';
  empathy_level: 0 | 1 | 2 | 3;
  risk_tag: 'judgment' | 'blame' | 'premature_advice' | null;
  domain_tag: 'child_function' | 'daily_routine' | 'family_needs' | 'strengths_resources' | 'rapport' | 'other';
  checklist_delta: {
    child_function: number;
    daily_routine: number;
    family_needs: number;
    strengths_resources: number;
  };
  sensitive_triggered: boolean;
  ai_reasoning: string;
}

export type GeminiEvaluationResponse = Omit<AIScoreRecord, 'session_id' | 'created_at'>;

function safeParseJSON<T>(text: string): T {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();

  const startIdx = cleaned.indexOf('{');
  const endIdx = cleaned.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  }

  return JSON.parse(cleaned) as T;
}

export class GeminiAIService {
  private genAI: GoogleGenerativeAI | null = null;
  private modelName: string;

  constructor() {
    let key = process.env.GEMINI_API_KEY || '';
    key = key.trim().replace(/^["']|["']$/g, '');
    this.modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (key && key !== 'YOUR_GEMINI_API_KEY_HERE') {
      this.genAI = new GoogleGenerativeAI(key);
      console.log(`[Gemini AI] 成功初始化 Gemini API Client (模型: ${this.modelName})`);
    } else {
      console.warn('[Gemini AI 警告] 未配置 GEMINI_API_KEY，將啟用防護模擬回應模式');
    }
  }

  /**
   * 即時對話處理：生成 NPC 回應、情緒分析、逐句語意標記與四大範疇進度增量
   */
  public async generateChatResponse(
    selectedCase: CaseProfile,
    selectedDuration: number | string,
    history: UtteranceRecord[],
    traineeMessage: string,
    currentTrust: number,
    currentDefense: number,
    currentRapport: number
  ): Promise<GeminiChatResponse> {
    if (!this.genAI) {
      // 智慧模擬回饋
      const isQuestion = traineeMessage.includes('嗎') || traineeMessage.includes('？') || traineeMessage.includes('甚麼') || traineeMessage.includes('什麼') || traineeMessage.includes('如何');
      const isRoutine = traineeMessage.includes('吃') || traineeMessage.includes('睡') || traineeMessage.includes('作息') || traineeMessage.includes('平常') || traineeMessage.includes('早上') || traineeMessage.includes('出門');
      const isEmpathy = traineeMessage.includes('辛苦') || traineeMessage.includes('不容易') || traineeMessage.includes('理解') || traineeMessage.includes('感受') || traineeMessage.includes('體諒');
      const isRisk = traineeMessage.includes('為什麼不') || traineeMessage.includes('你應該') || traineeMessage.includes('怎麼沒') || traineeMessage.includes('錯了');

      const deltaTrust = isRisk ? -15 : (isEmpathy ? 10 : (isRoutine ? 8 : 4));
      const deltaDefense = isRisk ? 20 : (isEmpathy ? -12 : (isRoutine ? -8 : -3));
      const deltaRapport = isRisk ? -12 : (isEmpathy ? 10 : 5);

      const newTrust = Math.max(0, Math.min(100, currentTrust + deltaTrust));
      const newDefense = Math.max(0, Math.min(100, currentDefense + deltaDefense));

      return {
        npc_reply: isRisk 
          ? '你問這什麼意思？我們家這樣過得好好的，不需要你指手畫腳。'
          : (isEmpathy 
            ? '唉...你這樣說，我心裡稍微好過一點。一個人帶孩子真的很累，有時我都不知道該怎麼辦。' 
            : (isRoutine 
              ? '早上小A通常七點多醒來，常常哭鬧不願意刷牙吃早餐，我都得哄很久。'
              : '嗯，小A平時比較怕生，跟鄰居小孩也不常講話。')),
        npc_emotion_tag: newDefense > 65 ? 'defensive' : (newTrust > 60 ? 'relaxed' : 'neutral'),
        rapport_score_change: deltaRapport,
        trust_score: newTrust,
        defense_score: newDefense,
        question_type: isRoutine ? 'routine_based' : (isQuestion ? 'open' : 'none'),
        empathy_level: isEmpathy ? 2 : 1,
        risk_tag: isRisk ? 'judgment' : null,
        domain_tag: isRoutine ? 'daily_routine' : (isEmpathy ? 'family_needs' : 'child_function'),
        checklist_delta: {
          child_function: isRoutine ? 5 : 8,
          daily_routine: isRoutine ? 15 : 2,
          family_needs: isEmpathy ? 12 : 3,
          strengths_resources: 4
        },
        sensitive_triggered: isRisk,
        ai_reasoning: '系統離線模擬判定：根據同理詞彙與作息關鍵字計算'
      };
    }

    try {
      const systemInstruction = buildSystemInstruction(selectedCase, selectedDuration);

      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

      // 載入歷史上下文
      for (const item of history) {
        contents.push({
          role: item.speaker === 'user' ? 'user' : 'model',
          parts: [{ text: item.text }]
        });
      }

      // 當前輪次提示詞
      const promptText = `[受訓人員發言]: "${traineeMessage}"\n[當前心理狀態]: 信任度=${currentTrust}, 防衛度=${currentDefense}, 關係度=${currentRapport}\n請根據角色設定與規範輸出嚴格合法的 JSON。`;
      contents.push({
        role: 'user',
        parts: [{ text: promptText }]
      });

      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        systemInstruction,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        }
      });

      const result = await model.generateContent({ contents });
      const rawText = result.response.text();
      const parsed = safeParseJSON<GeminiChatResponse>(rawText);

      // 安全檢查與預設值填補
      parsed.rapport_score_change = parsed.rapport_score_change ?? 0;
      parsed.trust_score = Math.max(0, Math.min(100, parsed.trust_score ?? currentTrust));
      parsed.defense_score = Math.max(0, Math.min(100, parsed.defense_score ?? currentDefense));
      parsed.question_type = parsed.question_type || 'none';
      parsed.empathy_level = parsed.empathy_level ?? 0;
      parsed.risk_tag = parsed.risk_tag ?? null;
      parsed.domain_tag = parsed.domain_tag || 'child_function';
      parsed.checklist_delta = parsed.checklist_delta || {
        child_function: 0,
        daily_routine: 0,
        family_needs: 0,
        strengths_resources: 0
      };
      parsed.sensitive_triggered = parsed.sensitive_triggered ?? false;
      parsed.ai_reasoning = parsed.ai_reasoning || '';

      return parsed;
    } catch (error) {
      console.error('[Gemini AI 錯誤] generateChatResponse 異常：', error);
      throw error;
    }
  }

  /**
   * 訪談結算與六大面向 AI 評分 (100分制)
   */
  public async evaluateSession(
    selectedCase: CaseProfile,
    selectedDuration: number | string,
    history: UtteranceRecord[]
  ): Promise<GeminiEvaluationResponse> {
    if (!this.genAI) {
      // 離線模擬評分
      return {
        dimension_1_rapport: 12,
        dimension_2_questioning: 20,
        dimension_3_empathy: 16,
        dimension_4_family_centered: 12,
        dimension_5_ifsp_info: 15,
        dimension_6_time_mgmt: 4,
        total_score: 79,
        feedback_comments: '訪談初期態度親切，能以同理心承接家長情緒；建議多增加作息本位提問，避免過早提供教養建議。',
        strengths: ['能真誠表達對照顧者辛苦的同理', '提問態度溫和，未出現嚴厲斥責語句'],
        suggestions: ['作息本位提問比例可再提高，例如多詢問起床與用餐細節', '在探索出深層家庭需求前，暫緩給出過多教養策略'],
        best_question: '您平常一個人帶三個孩子，光是張羅三餐就很不容易，早上大概是幾點開始忙碌呢？',
        best_question_reason: '結合了深度同理心，同時自然引導至日常生活作息探索。',
        suboptimal_question: '你有沒有帶小A去大醫院看身心科檢查？',
        suggested_alternative: '平常小A在溝通或表達想法時，您觀察他最自在或是比較卡關的時刻大概是什麼時候呢？'
      };
    }

    try {
      let formattedTranscript = '';
      for (const item of history) {
        const role = item.speaker === 'user' ? '受訓學員' : '受訪家長';
        formattedTranscript += `[${item.speaker.toUpperCase()}] ${role}: ${item.text}\n`;
      }

      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        systemInstruction: buildEvaluationInstruction(selectedDuration),
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        }
      });

      const prompt = `【案例資訊】：${selectedCase.persona_name}\n【背景】：${selectedCase.background_prompt}\n【隱藏痛點】：${selectedCase.hidden_pain_point}\n【約定訪談時間】：${selectedDuration} 分鐘\n\n【全場訪談對話逐字稿】：\n${formattedTranscript}\n\n請依據六大能力面向權重（15分, 25分, 20分, 15分, 20分, 5分）進行評估，並輸出合法的 JSON。`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = safeParseJSON<GeminiEvaluationResponse>(text);

      // 強制範圍約束
      parsed.dimension_1_rapport = Math.min(15, Math.max(0, parsed.dimension_1_rapport || 0));
      parsed.dimension_2_questioning = Math.min(25, Math.max(0, parsed.dimension_2_questioning || 0));
      parsed.dimension_3_empathy = Math.min(20, Math.max(0, parsed.dimension_3_empathy || 0));
      parsed.dimension_4_family_centered = Math.min(15, Math.max(0, parsed.dimension_4_family_centered || 0));
      parsed.dimension_5_ifsp_info = Math.min(20, Math.max(0, parsed.dimension_5_ifsp_info || 0));
      parsed.dimension_6_time_mgmt = Math.min(5, Math.max(0, parsed.dimension_6_time_mgmt || 0));

      parsed.total_score = parsed.dimension_1_rapport + 
        parsed.dimension_2_questioning + 
        parsed.dimension_3_empathy + 
        parsed.dimension_4_family_centered + 
        parsed.dimension_5_ifsp_info + 
        parsed.dimension_6_time_mgmt;

      parsed.strengths = parsed.strengths || [];
      parsed.suggestions = parsed.suggestions || [];

      return parsed;
    } catch (error) {
      console.error('[Gemini AI 錯誤] evaluateSession 評分失敗：', error);
      throw error;
    }
  }
}

export const geminiAIService = new GeminiAIService();
