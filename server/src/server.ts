import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getCaseById, caseProfiles } from './constants/cases';
import { firestoreService, UtteranceRecord, SkillAnnotationRecord } from './services/firestoreService';
import { geminiAIService } from './services/geminiService';
import { requireAuth, requireStaff } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS 白名單配置：僅允許入口網站與本地開發環境
const portalOrigin = process.env.PORTAL_ORIGIN;
const allowedOrigins = [
  portalOrigin,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:3001'
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // 允許無 origin 之伺服器/反向代理/非瀏覽器連線 (如 Unity VR 設備)
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =========================================================================
// 健康檢查介面 (Health Check)
// =========================================================================
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'IFSP 家訪 AI 訓練後台與即時監控系統 (Express + TypeScript)',
    gemini_model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    timestamp: new Date().toISOString()
  });
});

// =========================================================================
// 身分驗證中介軟體 (保護所有 /api 路由，/health 維持開放)
// =========================================================================
app.use('/api', requireAuth);

// =========================================================================
// 個案列表讀取 (GET /api/cases)
// =========================================================================
app.get('/api/cases', async (req: Request, res: Response) => {
  try {
    const cases = await firestoreService.getCaseProfiles();
    res.json({ success: true, cases });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =========================================================================
// 1. 【POST /api/session/start】場次初始化
// =========================================================================
app.post('/api/session/start', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawUserId = req.body.user_id || req.body.UserId || req.body.userId;
    const rawCaseId = req.body.case_id || req.body.CaseId || req.body.caseId || req.body.persona_id;
    const rawDuration = req.body.selected_duration || req.body.SelectedDuration || req.body.selectedDuration || req.body.duration || 30;

    const validDuration = (['30', '60', '90'].includes(String(rawDuration))
      ? String(rawDuration)
      : '30') as '30' | '60' | '90';

    const targetCase = getCaseById(rawCaseId);
    // 優先使用 Supabase 驗證後的 user.id，不再信任前端自由帶入的身分
    const userId = req.user?.id || rawUserId || 'trainee_vr_default';

    // 1. 在 Firestore 建立 training_sessions
    const sessionId = await firestoreService.createSession(userId, targetCase.case_id, validDuration);

    // 2. 初始化四大範疇資訊盤點 (information_checklists)
    await firestoreService.initInformationChecklist(sessionId);

    // 3. 寫入第一筆 NPC 歡迎詞至 utterances
    const initialNpcText = targetCase.initial_greeting;
    await firestoreService.addUtterance({
      session_id: sessionId,
      utterance_id: `utt_init_${Date.now()}`,
      speaker: 'npc',
      text: initialNpcText,
      speech_duration: 3,
      input_mode: 'text',
      rapport_score: 50
    });

    // 4. 寫入初始 NPC 動態心理狀態 (npc_state_logs)
    await firestoreService.addNPCStateLog(
      sessionId,
      targetCase.initial_trust,
      targetCase.initial_defense,
      50,
      'neutral',
      false
    );

    console.log(`[Session Start] 成功啟動訓練場次 ${sessionId} | 個案: ${targetCase.persona_name} | 時長: ${validDuration}分鐘`);

    res.json({
      success: true,
      session_id: sessionId,
      case_id: targetCase.case_id,
      persona_name: targetCase.persona_name,
      selected_duration: validDuration,
      initial_npc_reply: initialNpcText,
      initial_trust: targetCase.initial_trust,
      initial_defense: targetCase.initial_defense,
      // 兼備 Unity VR DTO
      Session_Id: sessionId,
      NPC_Reply: initialNpcText
    });
  } catch (error: any) {
    console.error('[Session Start 錯誤]:', error);
    res.status(500).json({ success: false, error: error.message || '伺服器內部錯誤' });
  }
});

// =========================================================================
// 2. 【POST /api/chat】即時對話處理 (支援 Unity VR 與前端監控鏡像)
// =========================================================================
app.post('/api/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const text = req.body.player_message || req.body.text || req.body.PlayerMessage || req.body.Text || req.body.message;
    const session_id = req.body.session_id || req.body.SessionId || req.body.sessionId;
    const input_mode = (req.body.input_mode || req.body.InputMode || 'text') as 'text' | 'voice';
    const speech_duration = Number(req.body.speech_duration || req.body.SpeechDuration || 2);

    if (!text || !session_id) {
      res.status(400).json({
        success: false,
        error: '缺少 session_id 或 player_message 發言內容',
        received_body: req.body
      });
      return;
    }

    // 1. 讀取場次與個案資訊
    const session = await firestoreService.getSession(session_id);
    const targetCase = getCaseById(session?.case_id);
    const duration = session?.selected_duration || '30';

    // 2. 撈取場次全歷史上下文
    const history = await firestoreService.getSessionUtterances(session_id);
    const npcLogs = await firestoreService.getSessionNPCStateLogs(session_id);

    // 3. 取得當前心理狀態
    const lastLog = npcLogs.length > 0 ? npcLogs[npcLogs.length - 1] : null;
    const currentTrust = lastLog ? lastLog.trust_score : targetCase.initial_trust;
    const currentDefense = lastLog ? lastLog.defense_score : targetCase.initial_defense;
    const currentRapport = lastLog ? lastLog.rapport_score : 50;

    // 4. 呼叫 Gemini 2.5 Flash 生成 NPC 回覆、語意標記與進度增量
    const aiResponse = await geminiAIService.generateChatResponse(
      targetCase,
      duration,
      history,
      text,
      currentTrust,
      currentDefense,
      currentRapport
    );

    // 5. 計算新分數
    const newRapportScore = Math.max(0, Math.min(100, currentRapport + aiResponse.rapport_score_change));

    // 6. 寫入學員發話至 utterances
    const userUttId = `utt_u_${Date.now()}`;
    await firestoreService.addUtterance({
      session_id,
      utterance_id: userUttId,
      speaker: 'user',
      text,
      speech_duration,
      input_mode,
      rapport_score: currentRapport
    });

    // 7. 寫入逐句語意標記至 skill_annotations
    await firestoreService.addSkillAnnotation({
      session_id,
      utterance_id: userUttId,
      question_type: aiResponse.question_type,
      empathy_level: aiResponse.empathy_level,
      risk_tag: aiResponse.risk_tag,
      domain_tag: aiResponse.domain_tag
    });

    // 8. 寫入 NPC 回覆至 utterances
    const npcUttId = `utt_npc_${Date.now()}`;
    await firestoreService.addUtterance({
      session_id,
      utterance_id: npcUttId,
      speaker: 'npc',
      text: aiResponse.npc_reply,
      speech_duration: Math.max(2, Math.round(aiResponse.npc_reply.length * 0.2)),
      input_mode: 'text',
      rapport_score: newRapportScore
    });

    // 9. 寫入 NPC 動態心理狀態至 npc_state_logs
    await firestoreService.addNPCStateLog(
      session_id,
      aiResponse.trust_score,
      aiResponse.defense_score,
      newRapportScore,
      aiResponse.npc_emotion_tag,
      aiResponse.sensitive_triggered
    );

    // 10. 更新四大範疇資訊盤點 (information_checklists)
    const updatedChecklist = await firestoreService.updateInformationChecklist(
      session_id,
      aiResponse.checklist_delta
    );

    // 11. 更新 session 最新分數
    await firestoreService.updateSession(session_id, {
      final_score: newRapportScore
    });

    console.log(`[Chat 處理完畢] Session: ${session_id} | Emotion: ${aiResponse.npc_emotion_tag} | Trust: ${aiResponse.trust_score} | Def: ${aiResponse.defense_score}`);

    // 12. 回傳 Unity VR 與督導監控儀表板所需 DTO
    res.json({
      success: true,
      npc_reply: aiResponse.npc_reply,
      npc_emotion_tag: aiResponse.npc_emotion_tag,
      current_rapport_score: newRapportScore,
      rapport_score_change: aiResponse.rapport_score_change,
      trust_score: aiResponse.trust_score,
      defense_score: aiResponse.defense_score,
      skill_annotation: {
        question_type: aiResponse.question_type,
        empathy_level: aiResponse.empathy_level,
        risk_tag: aiResponse.risk_tag,
        domain_tag: aiResponse.domain_tag
      },
      information_progress: updatedChecklist,
      ai_reasoning: aiResponse.ai_reasoning,
      sensitive_triggered: aiResponse.sensitive_triggered,

      // Unity 兼備欄位 (PascalCase)
      NPC_Reply: aiResponse.npc_reply,
      Emotion_Tag: aiResponse.npc_emotion_tag,
      Trust_Score: aiResponse.trust_score,
      Defense_Score: aiResponse.defense_score,
      Rapport_Score: newRapportScore
    });
  } catch (error: any) {
    console.error('[Chat 錯誤]:', error);
    res.status(500).json({
      success: false,
      npc_reply: '（NPC 正在思考中，請稍後再試）',
      npc_emotion_tag: 'neutral',
      trust_score: 50,
      defense_score: 50,
      current_rapport_score: 50,
      error: error.message || '對話生成失敗'
    });
  }
});

// =========================================================================
// 3. 【POST /api/session/end】訪談結算與 AI 評分 (嚴格 100 分制六大面向)
// =========================================================================
app.post('/api/session/end', async (req: Request, res: Response): Promise<void> => {
  try {
    const session_id = req.body.session_id || req.body.SessionId || req.body.sessionId;
    const actual_duration = Number(req.body.actual_duration || req.body.ActualDuration || 0);

    if (!session_id) {
      res.status(400).json({ success: false, error: '缺少 session_id' });
      return;
    }

    const session = await firestoreService.getSession(session_id);
    if (!session) {
      res.status(404).json({ success: false, error: '找不到該場次紀錄' });
      return;
    }

    const targetCase = getCaseById(session.case_id);
    const history = await firestoreService.getSessionUtterances(session_id);

    // 1. 呼叫 Gemini 進行六大能力面向考核
    const evaluation = await geminiAIService.evaluateSession(
      targetCase,
      session.selected_duration,
      history
    );

    // 2. 寫入 ai_scores
    await firestoreService.saveAIScores(session_id, evaluation);

    // 3. 更新 training_sessions 為 completed
    await firestoreService.updateSession(session_id, {
      status: 'completed',
      actual_duration,
      final_score: evaluation.total_score
    });

    console.log(`[Session End 結算完成] Session: ${session_id} | 總分: ${evaluation.total_score}/100`);

    res.json({
      success: true,
      session_id,
      evaluation_report: evaluation
    });
  } catch (error: any) {
    console.error('[Session End 錯誤]:', error);
    res.status(500).json({ success: false, error: error.message || '結算失敗' });
  }
});

// =========================================================================
// 4. 【POST /api/supervisor/review】督導人工覆評 (僅限督導與教師)
// =========================================================================
app.post('/api/supervisor/review', requireStaff, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      session_id,
      supervisor_scores,
      supervisor_comments = '',
      require_repetition = false
    } = req.body;

    const supervisor_id = req.user?.id || req.body.supervisor_id || 'supervisor_default';

    if (!session_id || !supervisor_scores) {
      res.status(400).json({ success: false, error: '缺少 session_id 或 supervisor_scores' });
      return;
    }

    // 計算督導評定之總分
    const d1 = Number(supervisor_scores.dimension_1_rapport || 0);
    const d2 = Number(supervisor_scores.dimension_2_questioning || 0);
    const d3 = Number(supervisor_scores.dimension_3_empathy || 0);
    const d4 = Number(supervisor_scores.dimension_4_family_centered || 0);
    const d5 = Number(supervisor_scores.dimension_5_ifsp_info || 0);
    const d6 = Number(supervisor_scores.dimension_6_time_mgmt || 0);
    const totalScore = d1 + d2 + d3 + d4 + d5 + d6;

    // 寫入 supervisor_scores 集合
    await firestoreService.saveSupervisorScores(session_id, {
      session_id,
      supervisor_id,
      dimension_1_rapport: d1,
      dimension_2_questioning: d2,
      dimension_3_empathy: d3,
      dimension_4_family_centered: d4,
      dimension_5_ifsp_info: d5,
      dimension_6_time_mgmt: d6,
      total_score: totalScore,
      feedback_comments: supervisor_comments,
      require_repetition: Boolean(require_repetition),
      created_at: new Date()
    });

    console.log(`[Supervisor Review] 督導完成場次 ${session_id} 覆核 | 督導總分: ${totalScore} | 重練: ${require_repetition}`);

    res.json({
      success: true,
      session_id,
      supervisor_total_score: totalScore,
      message: '督導覆核儲存成功'
    });
  } catch (error: any) {
    console.error('[Supervisor Review 錯誤]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =========================================================================
// 5. 【GET /api/export/lsa】研究資料匯出 (僅限督導與教師，Lag Sequential Analysis CSV)
// =========================================================================
app.get('/api/export/lsa', requireStaff, async (req: Request, res: Response): Promise<void> => {
  try {
    const targetSessionId = req.query.session_id as string | undefined;
    const format = req.query.format as string | undefined;

    // 取得指定或全部場次
    let sessions = await firestoreService.getAllSessions();
    if (targetSessionId) {
      sessions = sessions.filter(s => s.session_id === targetSessionId);
    }

    interface LSARow {
      session_id: string;
      user_id: string;
      case_id: string;
      timestamp_seconds: number;
      step_index: number;
      speaker: 'user' | 'npc';
      text: string;
      question_type: string;
      empathy_level: number;
      risk_tag: string;
      domain_tag: string;
      trust_score: number;
      defense_score: number;
      rapport_score: number;
      behavior_code: string;
    }

    const rows: LSARow[] = [];

    for (const sess of sessions) {
      const sId = sess.session_id || (sess as any).sessionId;
      if (!sId) continue;
      const utterances = await firestoreService.getSessionUtterances(sId);
      const annotations = await firestoreService.getSessionSkillAnnotations(sId);
      const npcLogs = await firestoreService.getSessionNPCStateLogs(sId);

      const annotationMap = new Map<string, SkillAnnotationRecord>();
      for (const ann of annotations) {
        annotationMap.set(ann.utterance_id, ann);
      }

      let startSec = 0;
      let step = 1;

      for (let i = 0; i < utterances.length; i++) {
        const u = utterances[i];
        const ann = annotationMap.get(u.utterance_id);
        const log = npcLogs[Math.min(i, npcLogs.length - 1)];

        // 時間秒數估計
        const timeSec = startSec;
        startSec += (u.speech_duration || 3) + 2;

        // 計算標準化 LSA 行為代碼 (Standardized Behavior Codes for LSA)
        let behaviorCode = 'OTHER';
        if (u.speaker === 'user') {
          if (ann?.risk_tag === 'judgment') behaviorCode = 'RSK_JUDG';
          else if (ann?.risk_tag === 'blame') behaviorCode = 'RSK_BLAM';
          else if (ann?.risk_tag === 'premature_advice') behaviorCode = 'RSK_ADVC';
          else if ((ann?.empathy_level || 0) >= 2) behaviorCode = 'EMP_HI';
          else if (ann?.empathy_level === 1) behaviorCode = 'EMP_LO';
          else if (ann?.question_type === 'routine_based') behaviorCode = 'RB_Q';
          else if (ann?.question_type === 'open') behaviorCode = 'OP_Q';
          else if (ann?.question_type === 'closed') behaviorCode = 'CL_Q';
          else behaviorCode = 'USR_STMT';
        } else {
          if (log?.emotion_tag === 'defensive') behaviorCode = 'NPC_DEF';
          else if (log?.emotion_tag === 'relaxed') behaviorCode = 'NPC_REL';
          else behaviorCode = 'NPC_NEU';
        }

        rows.push({
          session_id: sess.session_id,
          user_id: sess.user_id,
          case_id: sess.case_id,
          timestamp_seconds: timeSec,
          step_index: step++,
          speaker: u.speaker,
          text: u.text.replace(/[\r\n",]/g, ' '),
          question_type: ann?.question_type || 'none',
          empathy_level: ann?.empathy_level ?? 0,
          risk_tag: ann?.risk_tag || 'none',
          domain_tag: ann?.domain_tag || 'none',
          trust_score: log?.trust_score ?? 50,
          defense_score: log?.defense_score ?? 50,
          rapport_score: u.rapport_score ?? 50,
          behavior_code: behaviorCode
        });
      }
    }

    if (format === 'json') {
      res.json({ success: true, count: rows.length, data: rows });
      return;
    }

    // 輸出 CSV
    const headers = [
      'session_id',
      'user_id',
      'case_id',
      'timestamp_seconds',
      'step_index',
      'speaker',
      'text',
      'question_type',
      'empathy_level',
      'risk_tag',
      'domain_tag',
      'trust_score',
      'defense_score',
      'rapport_score',
      'behavior_code'
    ];

    const csvLines = [headers.join(',')];
    for (const r of rows) {
      csvLines.push([
        r.session_id,
        r.user_id,
        r.case_id,
        r.timestamp_seconds,
        r.step_index,
        r.speaker,
        `"${r.text}"`,
        r.question_type,
        r.empathy_level,
        r.risk_tag,
        r.domain_tag,
        r.trust_score,
        r.defense_score,
        r.rapport_score,
        r.behavior_code
      ].join(','));
    }

    // UTF-8 BOM 以確保 Excel 開啟時繁體中文不亂碼
    const csvContent = '\uFEFF' + csvLines.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ifsp_lsa_export_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (error: any) {
    console.error('[LSA Export 錯誤]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =========================================================================
// 輔助 API：場次清單與場次完整細節 (GET /api/sessions & GET /api/session/:id)
// =========================================================================
app.get('/api/sessions', async (req: Request, res: Response) => {
  try {
    let sessions = await firestoreService.getAllSessions();
    const isStaff = ['owner', 'assistant', 'supervisor', 'teacher'].includes(req.user?.role || '');
    if (!isStaff && req.user?.id) {
      // 學生身分只可檢視自己執行的場次紀錄
      sessions = sessions.filter(s => s.user_id === req.user?.id);
    }
    res.json({ success: true, sessions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/session/:sessionId/detail', async (req: Request, res: Response) => {
  try {
    const details = await firestoreService.getSessionFullDetails(req.params.sessionId);
    if (!details.session) {
      res.status(404).json({ success: false, error: '場次不存在' });
      return;
    }
    const isStaff = ['owner', 'assistant', 'supervisor', 'teacher'].includes(req.user?.role || '');
    if (!isStaff && req.user?.id && details.session.user_id !== req.user.id) {
      res.status(403).json({ success: false, error: '權限不足：無法檢視其他學員的場次詳細資訊' });
      return;
    }
    res.json({ success: true, details });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =========================================================================
// 輔助 API：學生自評反思日誌 (POST /api/self-reflection)
// =========================================================================
app.post('/api/self-reflection', async (req: Request, res: Response) => {
  try {
    const { session_id, reflection_text, key_learnings } = req.body;
    if (!session_id) {
      res.status(400).json({ success: false, error: '缺少 session_id' });
      return;
    }
    await firestoreService.saveSelfReflection(session_id, {
      session_id,
      reflection_text: reflection_text || '',
      key_learnings: key_learnings || '',
      created_at: new Date()
    });
    res.json({ success: true, message: '自評反思儲存成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 啟動伺服器
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 IFSP 家訪 AI 訓練與即時監控伺服器已啟動 (Port: ${PORT})`);
  console.log(`👉 健康檢查: http://localhost:${PORT}/health`);
  console.log(`👉 8個案設定: http://localhost:${PORT}/api/cases`);
  console.log(`👉 場次初始化: POST http://localhost:${PORT}/api/session/start`);
  console.log(`👉 即時對話處理: POST http://localhost:${PORT}/api/chat`);
  console.log(`👉 訪談結算評分: POST http://localhost:${PORT}/api/session/end`);
  console.log(`👉 督導人工覆評: POST http://localhost:${PORT}/api/supervisor/review`);
  console.log(`👉 LSA 研究資料匯出: GET http://localhost:${PORT}/api/export/lsa`);
  console.log(`=======================================================`);
});
