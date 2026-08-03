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

// 2. 訪談訓練場次紀錄介面
export interface TrainingSessionRecord {
  sessionId: string;            // 訪談場次唯一識別碼
  userId: string;               // 關聯的測試者 ID
  selectedFamilyCase: string;   // 選擇的家庭案例 (例如：'小A家')
  timeLimitSeconds?: number;    // 時間設定 (限制秒數，無限制則不填)
  startTime?: any;              // 開始時間
  endTime?: any;                // 結束時間
  isCompleted: boolean;         // 是否已結束
  finalRapportScore?: number;   // 結算時的最終關係分數
}

// 3. 對話逐字稿紀錄介面
export interface UtteranceRecord {
  session_id: string;             // 關聯的訪談場次 ID
  speaker: 'npc' | 'student';     // 發言者 (npc/student)
  text: string;                   // 對話內容文字
  timestamp?: any;                // 時間戳記
  rapport_score: number;          // 當前或該發言後的關係分數
  student_skill_tag: string[];    // 學員對話所展現的技巧標籤
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
  finalRapportScore: number
): Promise<void> {
  const updateData = {
    endTime: serverTimestamp(),
    isCompleted: true,
    finalRapportScore,
  };

  try {
    if (isFirebaseInitialized && db) {
      const sessionRef = doc(db, 'training_sessions', sessionId);
      await updateDoc(sessionRef, updateData);
      console.log(`[Firebase] 成功更新訓練場次結束狀態: ${sessionId}`);
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

