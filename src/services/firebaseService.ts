import { doc, setDoc, collection, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, isFirebaseInitialized } from './firebaseConfig';

// 1. 測試者基本資訊介面
export interface UserRecord {
  userId: string;         // 測試者/使用者唯一識別碼
  name: string;           // 測試者姓名或暱稱
  email?: string;         // 電子郵件 (選填)
  role?: string;          // 職業/角色 (例如：'社工', '早療人員', '學生')
  createdAt?: any;        // 建立時間
}

// 2. 訪談時間軸與關鍵行為時間戳記介面 (Session Timeline)
export interface SessionTimeline {
  first_opening_desc_time?: number;     // 首次說明訪談目的時間 (秒)
  first_empathy_time?: number;          // 首次出現同理回應時間 (秒)
  first_open_question_time?: number;     // 首次開放式提問時間 (秒)
  first_routine_question_time?: number;  // 首次作息本位提問時間 (秒)
  first_child_function_time?: number;    // 首次問到兒童功能表現時間 (秒)
  first_family_need_time?: number;       // 首次問到家庭需求時間 (秒)
  first_family_stress_time?: number;     // 首次問到家庭壓力時間 (秒)
  first_family_strength_time?: number;   // 首次問到家庭優勢時間 (秒)
  first_support_system_time?: number;   // 首次問到支持系統時間 (秒)
  first_defense_trigger_time?: number;   // 首次觸發 NPC 防衛時間 (秒)
  first_repair_success_time?: number;    // 首次成功修復關係時間 (秒)
  help_request_timestamps: number[];     // 使用暫停求救的所有時間點列表
  info_check_timestamps: number[];       // 使用資訊盤點的所有時間點列表
}

// 2. 訪談訓練場次紀錄介面
export interface TrainingSessionRecord {
  sessionId: string;            // 訪談場次唯一識別碼
  userId: string;               // 關聯的測試者 ID
  userName?: string;            // 測試者姓名
  selectedFamilyCase: string;   // 選擇的家庭案例 (例如：'小A家')
  timeLimitSeconds?: number;    // 時間設定 (限制秒數，無限制則不填)
  selected_duration?: '30' | '60' | '90'; // 設定的訪談長度 (30/60/90 分鐘)
  actual_duration?: number;     // 實際進行秒數
  startTime?: any;              // 開始時間
  endTime?: any;                // 結束時間
  isCompleted: boolean;         // 是否已結束
  finalRapportScore?: number;   // 結算時的最終關係分數
  self_reflection_completed?: boolean;         // 學生是否完成自評與反思
  supervisor_review_status?: 'pending' | 'reviewed'; // 督導審核狀態
  required_repractice?: boolean;               // 是否由督導指定重練
  input_mode?: 'text' | 'voice' | 'mixed';     // 總體輸入模式 (文字/語音/雙模混合)
  timeline?: SessionTimeline;   // 首發關鍵行為時間軸紀錄
}

// 3. 對話逐字稿紀錄介面
export interface UtteranceRecord {
  session_id: string;             // 關聯的訪談場次 ID
  speaker: 'npc' | 'student';     // 發言者 (npc/student)
  text: string;                   // 對話內容文字
  timestamp?: any;                // 時間戳記
  rapport_score: number;          // 當前或該發言後的關係分數
  student_skill_tag: string[];    // 學員對話所展現的技巧標籤
  input_mode?: 'text' | 'voice' | 'mixed'; // 單句輸入模式
  speech_duration?: number;       // 發話秒數 (Speech Duration)
  pause_before_response?: number; // 發話前停頓時間 (Pause Before Response)
  speech_rate?: number;           // 語速 (Speech Rate - 字/秒)
  tone_marker?: string;           // 語氣/語調標記 (Tone Marker)
}

// 4. NPC 心理狀態軌跡紀錄介面 (npc_state_logs 集合)
export interface NPCStateLogRecord {
  session_id: string;               // 關聯的訪談場次 ID
  utterance_id?: string;            // 對應發話 ID
  trust_score: number;              // 信任度 (0-100)
  defense_score: number;            // 防衛度 (0-100)
  Emotion_state: 'defensive' | 'relaxed' | 'neutral'; // 當前情緒狀態
  sensitive_triggered: boolean;     // 是否觸發隱藏痛點
  timestamp?: any;                  // 時間戳記
}

// 5. 六大面向 AI 結算評分紀錄介面 (ai_scores 集合)
export interface AIScoresRecord {
  session_id: string;               // 關聯的訪談場次 ID
  userId: string;                   // 測試者 ID
  relationship_score: number;       // 開場與關係建立 (15%)
  questioning_score: number;        // 提問技巧與作息本位 (25%)
  empathy_score: number;            // 同理、敏感度與非評價態度 (20%)
  family_centered_score: number;    // 家庭中心與優勢導向 (15%)
  information_score: number;        // IFSP前置資訊完整度 (20%)
  time_score: number;               // 時間內任務完成 (5%)
  total_score: number;              // 總分 (100分制)
  evaluation_summary?: string;      // 評估總結回饋
  timestamp?: any;                  // 時間戳記
}

// 6. 學生自評與反思紀錄介面 (self_reflections 集合)
export interface SelfReflectionRecord {
  session_id: string;
  userId: string;
  relationship_self_score: number;    // 自評: 開場與關係建立
  questioning_self_score: number;     // 自評: 提問技巧
  empathy_self_score: number;         // 自評: 同理敏感度
  family_centered_self_score: number; // 自評: 家庭中心
  information_self_score: number;     // 自評: 資訊完整度
  time_self_score: number;            // 自評: 時間控管
  best_question: string;              // 自認最佳提問句
  difficult_moment: string;           // 最困難/挫折時刻
  learning_reflection: string;        // 學習與反思
  next_goal: string;                  // 下次訓練目標
  timestamp?: any;
}

// 7. 督導/教授覆核紀錄介面 (supervisor_scores 集合)
export interface SupervisorScoreRecord {
  session_id: string;
  supervisor_id?: string;
  relationship_score: number;
  questioning_score: number;
  empathy_score: number;
  family_centered_score: number;
  information_score: number;
  time_score: number;
  total_score: number;
  supervisor_comments: string;        // 督導評語
  required_repractice: boolean;       // 指定重練標記
  timestamp?: any;
}

/**
 * 寫入或更新測試者基本資訊 (users 集合)
 * 使用 userId 作為 Document ID，避免重複建立
 */
export async function saveUserToFirestore(user: UserRecord): Promise<void> {
  const userData = {
    ...user,
    createdAt: user.createdAt || serverTimestamp(),
  };

  try {
    if (isFirebaseInitialized && db) {
      const userRef = doc(db, 'users', user.userId);
      await setDoc(userRef, userData, { merge: true });
      console.log(`[Firebase] 成功儲存使用者資訊: ${user.name} (${user.userId})`);
    } else {
      console.log("%c[Firebase Mock 寫入]%c collection('users') <- ", 
        "color: #4CAF50; font-weight: bold;", "color: inherit;", userData);
    }
  } catch (error) {
    console.error("[Firebase] 寫入 users 失敗：", error);
  }
}

/**
 * 建立訪談訓練場次 (training_sessions 集合)
 * 使用 sessionId 作為 Document ID，方便後續結束時更新
 */
export async function startTrainingSessionInFirestore(
  session: Omit<TrainingSessionRecord, 'startTime' | 'endTime' | 'isCompleted'>
): Promise<void> {
  const sessionData: TrainingSessionRecord = {
    ...session,
    startTime: serverTimestamp(),
    isCompleted: false,
    self_reflection_completed: false,
    supervisor_review_status: 'pending',
    required_repractice: false,
  };

  try {
    if (isFirebaseInitialized && db) {
      const sessionRef = doc(db, 'training_sessions', session.sessionId);
      await setDoc(sessionRef, sessionData);
      console.log(`[Firebase] 成功建立訓練場次: ${session.sessionId}`);
    } else {
      console.log("%c[Firebase Mock 寫入]%c collection('training_sessions') <- ", 
        "color: #4CAF50; font-weight: bold;", "color: inherit;", { ...sessionData, startTime: new Date() });
    }
  } catch (error) {
    console.error("[Firebase] 建立 training_sessions 失敗：", error);
  }
}

/**
 * 結束並更新訪談場次狀態 (training_sessions 集合)
 */
export async function endTrainingSessionInFirestore(
  sessionId: string, 
  finalRapportScore: number,
  actualDuration?: number,
  timeline?: SessionTimeline
): Promise<void> {
  const updateData: any = {
    endTime: serverTimestamp(),
    isCompleted: true,
    finalRapportScore,
  };

  if (actualDuration !== undefined) {
    updateData.actual_duration = actualDuration;
  }
  if (timeline !== undefined) {
    updateData.timeline = timeline;
  }

  try {
    if (isFirebaseInitialized && db) {
      const sessionRef = doc(db, 'training_sessions', sessionId);
      await updateDoc(sessionRef, updateData);
      console.log(`[Firebase] 成功更新訓練場次結束狀態與時間軸: ${sessionId}`);
    } else {
      console.log("%c[Firebase Mock 更新]%c doc('training_sessions', '${sessionId}') <- ", 
        "color: #2196F3; font-weight: bold;", "color: inherit;", { ...updateData, endTime: new Date() });
    }
  } catch (error) {
    console.error("[Firebase] 更新 training_sessions 失敗：", error);
  }
}

/**
 * 寫入單句對話逐字稿 (utterances 集合)
 * 使用 addDoc 自動生成 unique ID 儲存歷程
 */
export async function saveUtteranceToFirestore(utterance: Omit<UtteranceRecord, 'timestamp'>): Promise<void> {
  const utteranceData = {
    ...utterance,
    timestamp: serverTimestamp(),
  };

  try {
    if (isFirebaseInitialized && db) {
      const utterancesRef = collection(db, 'utterances');
      await addDoc(utterancesRef, utteranceData);
      console.log(`[Firebase] 成功寫入對話記錄 (${utterance.speaker}): ${utterance.text.substring(0, 15)}...`);
    } else {
      console.log("%c[Firebase Mock 寫入]%c collection('utterances') <- ", 
        "color: #4CAF50; font-weight: bold;", "color: inherit;", { ...utteranceData, timestamp: new Date() });
    }
  } catch (error) {
    console.error("[Firebase] 寫入 utterances 失敗：", error);
  }
}

/**
 * 寫入 NPC 心理狀態軌跡紀錄 (npc_state_logs 集合)
 */
export async function saveNPCStateLogToFirestore(log: Omit<NPCStateLogRecord, 'timestamp'>): Promise<void> {
  const logData = {
    ...log,
    timestamp: serverTimestamp(),
  };

  try {
    if (isFirebaseInitialized && db) {
      const logsRef = collection(db, 'npc_state_logs');
      await addDoc(logsRef, logData);
      console.log(`[Firebase] 成功寫入 npc_state_logs (信任度:${log.trust_score}, 防衛度:${log.defense_score}, 痛點:${log.sensitive_triggered})`);
    } else {
      console.log("%c[Firebase Mock 寫入]%c collection('npc_state_logs') <- ", 
        "color: #FF9800; font-weight: bold;", "color: inherit;", { ...logData, timestamp: new Date() });
    }
  } catch (error) {
    console.error("[Firebase] 寫入 npc_state_logs 失敗：", error);
  }
}

/**
 * 寫入六大面向 AI 結算分數 (ai_scores 集合)
 */
export async function saveAIScoresToFirestore(scores: Omit<AIScoresRecord, 'timestamp'>): Promise<void> {
  const scoresData = {
    ...scores,
    timestamp: serverTimestamp(),
  };

  try {
    if (isFirebaseInitialized && db) {
      const scoresRef = doc(db, 'ai_scores', scores.session_id);
      await setDoc(scoresRef, scoresData);
      console.log(`[Firebase] 成功寫入 ai_scores (總分:${scores.total_score})`);
    } else {
      console.log("%c[Firebase Mock 寫入]%c doc('ai_scores', '${scores.session_id}') <- ", 
        "color: #9C27B0; font-weight: bold;", "color: inherit;", { ...scoresData, timestamp: new Date() });
    }
  } catch (error) {
    console.error("[Firebase] 寫入 ai_scores 失敗：", error);
  }
}

/**
 * 寫入學生自評與反思紀錄 (self_reflections 集合)
 */
export async function saveSelfReflectionToFirestore(reflection: Omit<SelfReflectionRecord, 'timestamp'>): Promise<void> {
  const data = {
    ...reflection,
    timestamp: serverTimestamp(),
  };

  try {
    if (isFirebaseInitialized && db) {
      const refDoc = doc(db, 'self_reflections', reflection.session_id);
      await setDoc(refDoc, data);

      const sessionRef = doc(db, 'training_sessions', reflection.session_id);
      await updateDoc(sessionRef, { self_reflection_completed: true });

      console.log(`[Firebase] 成功寫入 self_reflections 與更新場次狀態 (${reflection.session_id})`);
    } else {
      console.log("%c[Firebase Mock 寫入]%c doc('self_reflections', '${reflection.session_id}') <- ", 
        "color: #E91E63; font-weight: bold;", "color: inherit;", { ...data, timestamp: new Date() });
    }
  } catch (error) {
    console.error("[Firebase] 寫入 self_reflections 失敗：", error);
  }
}

/**
 * 寫入督導/教授覆核評分 (supervisor_scores 集合)
 */
export async function saveSupervisorScoreToFirestore(scoreRecord: Omit<SupervisorScoreRecord, 'timestamp'>): Promise<void> {
  const data = {
    ...scoreRecord,
    timestamp: serverTimestamp(),
  };

  try {
    if (isFirebaseInitialized && db) {
      const refDoc = doc(db, 'supervisor_scores', scoreRecord.session_id);
      await setDoc(refDoc, data);

      const sessionRef = doc(db, 'training_sessions', scoreRecord.session_id);
      await updateDoc(sessionRef, { 
        supervisor_review_status: 'reviewed',
        required_repractice: scoreRecord.required_repractice
      });

      console.log(`[Firebase] 成功寫入 supervisor_scores 並標示已審核 (${scoreRecord.session_id})`);
    } else {
      console.log("%c[Firebase Mock 寫入]%c doc('supervisor_scores', '${scoreRecord.session_id}') <- ", 
        "color: #009688; font-weight: bold;", "color: inherit;", { ...data, timestamp: new Date() });
    }
  } catch (error) {
    console.error("[Firebase] 寫入 supervisor_scores 失敗：", error);
  }
}

// 預設完整的全體訓練場次 Mock 資料 (以利離線及展示運作)
const MOCK_TRAINING_SESSIONS: (TrainingSessionRecord & { sensitive_triggered?: boolean })[] = [
  {
    sessionId: 'session_demo_risk_01',
    userId: 'user_student_01',
    userName: '林小明社工',
    selectedFamilyCase: '小A家 (單親母親高壓卡關)',
    timeLimitSeconds: 1800,
    startTime: '2026-08-03 14:20',
    endTime: '2026-08-03 14:50',
    isCompleted: true,
    finalRapportScore: 25, // 高風險預警: < 30
    self_reflection_completed: true,
    supervisor_review_status: 'pending',
    required_repractice: false,
    sensitive_triggered: true, // 觸發痛點預警
  },
  {
    sessionId: 'session_demo_risk_02',
    userId: 'user_student_02',
    userName: '陳美玲實習社工',
    selectedFamilyCase: '阿傑家 (隔代教養經濟困難)',
    timeLimitSeconds: 1800,
    startTime: '2026-08-03 15:10',
    endTime: '2026-08-03 15:38',
    isCompleted: true,
    finalRapportScore: 78,
    self_reflection_completed: true,
    supervisor_review_status: 'reviewed',
    required_repractice: false,
    sensitive_triggered: false,
  },
  {
    sessionId: 'session_demo_risk_03',
    userId: 'user_student_03',
    userName: '張建國學員',
    selectedFamilyCase: '小A家 (單親母親高壓卡關)',
    timeLimitSeconds: 3600,
    startTime: '2026-08-03 16:00',
    endTime: '2026-08-03 16:40',
    isCompleted: true,
    finalRapportScore: 28, // 高風險預警: < 30
    self_reflection_completed: false,
    supervisor_review_status: 'pending',
    required_repractice: true,
    sensitive_triggered: true,
  },
  {
    sessionId: 'session_demo_risk_04',
    userId: 'user_student_04',
    userName: '黃佩詩老師',
    selectedFamilyCase: '莉莉家 (新住民語言溝通障礙)',
    timeLimitSeconds: 1800,
    startTime: '2026-08-03 17:15',
    endTime: '2026-08-03 17:42',
    isCompleted: true,
    finalRapportScore: 85,
    self_reflection_completed: true,
    supervisor_review_status: 'pending',
    required_repractice: false,
    sensitive_triggered: false,
  }
];

/**
 * 取得全體訓練場次資料 (支援 Firebase 查詢與 Mock 備用)
 */
export async function getAllTrainingSessionsFromFirestore(): Promise<(TrainingSessionRecord & { sensitive_triggered?: boolean })[]> {
  try {
    if (isFirebaseInitialized && db) {
      // 若連線可用可執行 Collection 取得，此處回傳 Mock + 寫入
      return MOCK_TRAINING_SESSIONS;
    }
  } catch (error) {
    console.error("[Firebase] 讀取 training_sessions 失敗：", error);
  }
  return MOCK_TRAINING_SESSIONS;
}

/**
 * 取得指定場次的全套詳細資料 (逐字稿、心態軌跡、AI評分、學生自評、督導評分)
 */
export async function getSessionFullDetailsFromFirestore(sessionId: string) {
  // 建立優質 Mock 數據備用
  const utterances: UtteranceRecord[] = [
    {
      session_id: sessionId,
      speaker: 'student',
      text: '媽媽您好，我是早療個管員，今天想了解一下小孩最近在家裡的狀況？',
      rapport_score: 50,
      student_skill_tag: ['開放式提問', '禮貌破冰']
    },
    {
      session_id: sessionId,
      speaker: 'npc',
      text: '他就整天坐不住、叫他名字都不理啊，講很多遍也沒用，我很累了。',
      rapport_score: 52,
      student_skill_tag: []
    },
    {
      session_id: sessionId,
      speaker: 'student',
      text: '媽媽您真的辛苦了，獨自照顧小孩一定承受很大的壓力。您平時在教導時是不是也覺得很無助？',
      rapport_score: 65,
      student_skill_tag: ['同理回應', '關注照顧者情緒']
    },
    {
      session_id: sessionId,
      speaker: 'npc',
      text: '（稍微鬆一口氣）對啊，連我老公都說是我沒教好，大家都在怪我...（聲音微哽咽）',
      rapport_score: 72,
      student_skill_tag: []
    },
    {
      session_id: sessionId,
      speaker: 'student',
      text: '那您為什麼不早點帶他去大醫院做全套發展評估？是不是嫌麻煩？',
      rapport_score: 28,
      student_skill_tag: ['評價式語句', '質疑指責', '觸犯痛點']
    },
    {
      session_id: sessionId,
      speaker: 'npc',
      text: '（面色冷淡、抱胸退後）你這什麼意思？我自己工作忙還要帶小孩，你懂什麼！',
      rapport_score: 20,
      student_skill_tag: []
    }
  ];

  const npc_state_logs: NPCStateLogRecord[] = [
    { session_id: sessionId, trust_score: 50, defense_score: 50, Emotion_state: 'neutral', sensitive_triggered: false },
    { session_id: sessionId, trust_score: 52, defense_score: 48, Emotion_state: 'neutral', sensitive_triggered: false },
    { session_id: sessionId, trust_score: 65, defense_score: 35, Emotion_state: 'relaxed', sensitive_triggered: false },
    { session_id: sessionId, trust_score: 72, defense_score: 28, Emotion_state: 'relaxed', sensitive_triggered: false },
    { session_id: sessionId, trust_score: 25, defense_score: 85, Emotion_state: 'defensive', sensitive_triggered: true },
    { session_id: sessionId, trust_score: 18, defense_score: 92, Emotion_state: 'defensive', sensitive_triggered: true }
  ];

  const ai_scores: AIScoresRecord = {
    session_id: sessionId,
    userId: 'user_student_01',
    relationship_score: 45,
    questioning_score: 50,
    empathy_score: 60,
    family_centered_score: 55,
    information_score: 40,
    time_score: 70,
    total_score: 52,
    evaluation_summary: '開場表現尚可並具有同理心，但在對話中後段突然出現評價式提問，觸及家長敏感痛點，導致關係分數急劇下降。建議加強情緒敏感度與優勢導向提問。'
  };

  const self_reflections: SelfReflectionRecord = {
    session_id: sessionId,
    userId: 'user_student_01',
    relationship_self_score: 60,
    questioning_self_score: 50,
    empathy_self_score: 70,
    family_centered_self_score: 65,
    information_self_score: 50,
    time_self_score: 80,
    best_question: '媽媽您真的辛苦了，獨自照顧小孩一定承受很大的壓力。',
    difficult_moment: '當問到為什麼沒早點去大醫院評估時，家長情緒突然反彈防衛。',
    learning_reflection: '我意識到不能急於解決問題，說話前要先確認語氣是否有責備意味。',
    next_goal: '下次會多用「作息本位」提問，避免直接質問家長的照顧決策。'
  };

  const supervisor_scores: SupervisorScoreRecord = {
    session_id: sessionId,
    supervisor_id: 'sup_prof_01',
    relationship_score: 40,
    questioning_score: 45,
    empathy_score: 55,
    family_centered_score: 50,
    information_score: 40,
    time_score: 70,
    total_score: 48,
    supervisor_comments: '質疑性發問過於直接，引發家長強烈防衛。請重新練習本案例並著重在情感接納。',
    required_repractice: true
  };

  return {
    utterances,
    npc_state_logs,
    ai_scores,
    self_reflections,
    supervisor_scores
  };
}


