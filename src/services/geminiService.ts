import { GoogleGenerativeAI } from '@google/generative-ai';
import { familyCases } from '../constants/cases';
import type { FamilyCase } from '../constants/cases';

export interface GeminiResponse {
  npc_reply: string;
  npc_emotion_tag: 'defensive' | 'relaxed' | 'neutral';
  rapport_score_change: number;
  student_skill_tag: string[];
  ai_reasoning: string;
}

export interface CoachSuggestionResponse {
  coach_suggestion: string;
  coach_reasoning: string;
}

export interface InfoCheckResponse {
  family_structure: { achieved: boolean; evidence: string };
  financial_status: { achieved: boolean; evidence: string };
  developmental_history: { achieved: boolean; evidence: string };
}

function buildSystemInstruction(selectedCase: FamilyCase, timeMode: number): string {
  return `你現在是「IFSP 前置家庭訪談能力訓練系統」中的 NPC 角色與 AI 評分教練。
你的角色設定是「${selectedCase.name}」中的主要對話角色：
- 背景：${selectedCase.background_prompt}
- 隱藏痛點：${selectedCase.hidden_pain_point}

【對話場景設定】
- 本次訪談限制時間設定為：${timeMode} 分鐘。請在對話回應中，根據時間進度或時間壓力適度展現反應。

【評分與動態反應機制】
你需要根據使用者的發言，計算 Rapport_Score (關係分數) 變化，並決定回覆語氣：
- 加分行為：使用同理心詞彙（如：辛苦了、我了解）、開放式提問。
- 扣分行為：出現評價指責、連續封閉式提問、觸碰隱藏痛點、過早給建議。
- 狀態連動：
  - 分數 > 80 (relaxed)：語氣緩和，主動分享家庭脈絡。
  - 分數 < 30 (defensive)：語氣冷淡，字數限 10 字內，甚至拒答。

【強制 JSON 輸出 Schema】
你必須解析使用者的對話，並嚴格按照以下 JSON 結構回傳，不可夾帶任何 Markdown 的 \`\`\`json 標記或額外文字，只需回傳合法的 JSON 字串：
{
  "npc_reply": "以該家庭角色的語氣做出的回答",
  "npc_emotion_tag": "defensive, relaxed, or neutral",
  "rapport_score_change": 數值 (例如 5 或 -10),
  "student_skill_tag": ["同理回應", "開放式提問", "封閉式提問", "評價式語句" 等（根據使用者發言標記）],
  "ai_reasoning": "簡短解釋為什麼給這些標記以及為什麼加/扣分"
}`;
}

const COACH_SYSTEM_INSTRUCTION = `你現在是「IFSP 前置家庭訪談能力訓練系統」中的 AI 督導教練。
目前的對話是受訓人員（社工/早療人員）與受訪家庭個案的訪談練習。
你的任務是提供「🆘 暫停求救」建議。
請根據先前的對話脈絡（受訪家長目前的關係分數與情緒），給予受訓人員下一句的「建議問法」以及「理由」。
請務必使用同理回應或開放式提問等技巧，協助修復或增進關係分數。

【強制 JSON 輸出 Schema】
你必須嚴格按照以下 JSON 結構回傳，不可夾帶任何 Markdown 標記，只需回傳合法的 JSON 字串：
{
  "coach_suggestion": "給受訓社工的建議問法，可以直接照著唸的句子",
  "coach_reasoning": "簡短說明為什麼在此脈絡下建議這樣詢問，以及背後運用了什麼同理或引導技巧"
}`;

const CHECK_SYSTEM_INSTRUCTION = `你現在是「IFSP 前置家庭訪談能力訓練系統」中的 AI 資訊盤點專家。
你的任務是閱讀受訓人員（社工/早療人員）與家長的對話歷史，分析對話中是否已經成功問出或揭露以下三項關鍵的個別化家庭服務計畫 (IFSP) 資訊：
1. family_structure (家庭結構)：例如家中人口、單親與否、三代同堂、誰是主要照顧者等。
2. financial_status (經濟狀況)：例如補助狀況、工作情況、收入情形、家境是否困難等。
3. developmental_history (發展史)：例如小孩何時開始有狀況、目前的發展情形、早療評估、發展遲緩情形等。

【判定標準與證據要求】
- 只有當家長「具體透露」或「確認」相關資訊時，才判定 achieved = true。若受訓社工僅發問，但家長迴避或尚未答覆，需判定 achieved = false。
- evidence 必須簡短，若 achieved = true，說明取得的具體事證；若 achieved = false，說明尚缺少什麼資訊或家長目前的防範點。

【強制 JSON 輸出 Schema】
你必須嚴格按照以下 JSON 結構回傳，不可夾帶 any Markdown 標記，只需回傳合法的 JSON 字串：
{
  "family_structure": {
    "achieved": true 或者是 false,
    "evidence": "簡短說明"
  },
  "financial_status": {
    "achieved": true 或者是 false,
    "evidence": "簡短說明"
  },
  "developmental_history": {
    "achieved": true 或者是 false,
    "evidence": "簡短說明"
  }
}`;

function safeParseJSON<T>(text: string): T {
  let cleaned = text.trim();
  // 剝離可能夾帶的 ```json ... ``` 或 ``` ... ``` 標記
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();

  // 進一步定位最外層的 { ... } 以排除前後雜訊字元
  const startIdx = cleaned.indexOf('{');
  const endIdx = cleaned.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  }

  return JSON.parse(cleaned) as T;
}

export class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private chatSession: any = null;
  private apiKey: string = '';

  constructor() {
    let key = import.meta.env.VITE_GEMINI_API_KEY || '';
    // 淨化金鑰：移除可能因 .env 解析帶入的前後單雙引號與空白
    key = key.trim().replace(/^["']|["']$/g, '');
    this.apiKey = key;
    if (this.apiKey && this.apiKey !== 'YOUR_GEMINI_API_KEY_HERE' && this.apiKey !== '') {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }
  }

  public isConfigured(): boolean {
    return this.genAI !== null;
  }

  /**
   * 初始化或重新開始對話
   */
  public startNewChat(currentRapportScore: number, caseId: string, timeMode: number): GeminiResponse {
    if (!this.genAI) {
      throw new Error("Gemini API 金鑰未正確配置，請在 .env 檔案中設定 VITE_GEMINI_API_KEY。");
    }

    const selectedCase = familyCases.find(c => c.id === caseId) || familyCases[0];
    const systemInstruction = buildSystemInstruction(selectedCase, timeMode);

    const model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      }
    });

    // 根據不同案例設定不同的起始問候語，增加真實感
    let initialNpcReply = "喔...你好。小A他在裡面睡覺。你們今天來做什麼？";
    if (selectedCase.id === 'case-b') {
      initialNpcReply = "社工喔...阿孫他在看電視啦。我們家沒什麼事，你們來做什麼？";
    } else if (selectedCase.id === 'case-c') {
      initialNpcReply = "你好...請問...找我有什麼事嗎？我先生在休息，小C在客廳。";
    } else if (selectedCase.id !== 'case-a') {
      initialNpcReply = `你好，我是 ${selectedCase.name.split(' ')[0]}的家長，有什麼事情嗎？`;
    }

    // 建立新的 ChatSession，並給予初始的歡迎對話上下文
    this.chatSession = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: `你好，我是今天來訪視的社工。我們今天聊聊小孩的情況。（初始關係分數：${currentRapportScore}）` }],
        },
        {
          role: "model",
          parts: [{ text: JSON.stringify({
            npc_reply: initialNpcReply,
            npc_emotion_tag: "neutral",
            rapport_score_change: 0,
            student_skill_tag: [],
            ai_reasoning: "初始對話，NPC 抱持中立警惕態度。"
          }) }]
        }
      ]
    });

    return {
      npc_reply: initialNpcReply,
      npc_emotion_tag: "neutral",
      rapport_score_change: 0,
      student_skill_tag: [],
      ai_reasoning: "初始對話，NPC 抱持中立警惕態度。"
    };
  }

  /**
   * 送出學生訊息並取得 NPC 回覆
   */
  public async sendMessage(message: string, currentRapportScore: number): Promise<GeminiResponse> {
    if (!this.genAI || !this.chatSession) {
      throw new Error("Gemini 服務未初始化，請確認 API 金鑰並呼叫 startNewChat。");
    }

    try {
      // 為了讓 API 能精準感知到前端累加的關係分數，我們在發送時把當前分數一併帶入 context
      const prompt = `[受訓人員發言]: "${message}"\n[當前累計關係分數]: ${currentRapportScore}\n請根據小A媽媽的角色設定，評分並產生 JSON 回覆。`;
      
      const result = await this.chatSession.sendMessage(prompt);
      const text = result.response.text();
      
      // 解析 JSON
      const data = safeParseJSON<GeminiResponse>(text);
      return data;
    } catch (error) {
      console.error("Gemini API Error in sendMessage:", error);
      throw error;
    }
  }

  /**
   * 取得求救建議
   */
  public async getHelpSuggestion(currentRapportScore: number): Promise<CoachSuggestionResponse> {
    if (!this.genAI) {
      throw new Error("Gemini API 金鑰未正確配置。");
    }

    try {
      // 取得當前的對話歷史
      const history = this.chatSession ? await this.chatSession.getHistory() : [];
      
      // 為了不污染原本 NPC 的對話 session，我們用一個獨立的 model 呼叫 generateContent
      const model = this.genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: COACH_SYSTEM_INSTRUCTION,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7,
        }
      });

      // 格式化歷史紀錄
      let formattedHistory = "";
      for (const turn of history) {
        const role = turn.role === "user" ? "受訓人員" : "受訪家長";
        let text = "";
        try {
          // 嘗試解析 JSON 讀取 npc_reply
          const parsed = JSON.parse(turn.parts[0].text);
          text = parsed.npc_reply || turn.parts[0].text;
        } catch {
          text = turn.parts[0].text;
        }
        formattedHistory += `${role}: ${text}\n`;
      }

      const prompt = `【對話歷史】：\n${formattedHistory}\n【當前關係分數】：${currentRapportScore}\n\n請教練給予我下一句對話的具體建議問法。`;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      return safeParseJSON<CoachSuggestionResponse>(text);
    } catch (error) {
      console.error("Gemini API Error in getHelpSuggestion:", error);
      throw error;
    }
  }

  /**
   * 盤點對話歷程，確認是否已獲得家庭結構、經濟狀況、發展史等資訊
   */
  public async checkIFSPInformation(): Promise<InfoCheckResponse> {
    if (!this.genAI || !this.chatSession) {
      throw new Error("Gemini 服務未初始化，請確認 API 金鑰並開始對話。");
    }

    try {
      const history = await this.chatSession.getHistory();
      
      // 格式化歷史紀錄
      let formattedHistory = "";
      for (const turn of history) {
        const role = turn.role === "user" ? "受訓人員" : "受訪家長";
        let text = "";
        try {
          const parsed = JSON.parse(turn.parts[0].text);
          text = parsed.npc_reply || turn.parts[0].text;
        } catch {
          text = turn.parts[0].text;
        }
        formattedHistory += `${role}: ${text}\n`;
      }

      const model = this.genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: CHECK_SYSTEM_INSTRUCTION,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2, // 盤點需要高度一致性與準確性，降低溫控
        }
      });

      const prompt = `【對話歷史】：\n${formattedHistory}\n\n請依據上述對話歷史盤點關鍵 IFSP 資訊，並以 JSON 結構回傳結果。`;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      return safeParseJSON<InfoCheckResponse>(text);
    } catch (error) {
      console.error("Gemini API Error in checkIFSPInformation:", error);
      throw error;
    }
  }
}
