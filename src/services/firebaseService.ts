import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

export interface UtteranceRecord {
  speaker: 'trainee' | 'npc';
  text: string;
  skill_tags: string[];
  rapport_score_after: number;
  emotion_state: 'defensive' | 'relaxed' | 'neutral';
}

// 讀取環境變數中的 Firebase 設定
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

let db: any = null;
let isFirebaseInitialized = false;

try {
  // 檢查是否提供了 projectId（非佔位符）
  if (firebaseConfig.projectId && firebaseConfig.projectId !== 'YOUR_FIREBASE_PROJECT_ID_HERE') {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    isFirebaseInitialized = true;
    console.log("[Firebase] 初始化成功。");
  } else {
    console.warn("[Firebase] 缺少設定或使用預設值。將使用 Mock 模式運作，資料不會寫入雲端。");
  }
} catch (error) {
  console.error("[Firebase] 初始化發生錯誤：", error);
}

/**
 * 預留並實作 saveUtteranceToFirestore 函數。
 * 將對話內容寫入 Firestore 的 utterances 集合中。
 */
export async function saveUtteranceToFirestore(record: UtteranceRecord): Promise<void> {
  const documentData = {
    ...record,
    timestamp: new Date()
  };

  try {
    if (isFirebaseInitialized && db) {
      const utterancesRef = collection(db, 'utterances');
      await addDoc(utterancesRef, {
        ...documentData,
        timestamp: serverTimestamp() // 寫入 Firestore 伺服器時間
      });
      console.log(`[Firebase] 成功寫入 ${record.speaker} 的對話記錄。`);
    } else {
      // Mock 模擬輸出
      console.log("%c[Firebase Mock 寫入]%c collection('utterances') <- ", 
        "color: #4CAF50; font-weight: bold;", 
        "color: inherit;", 
        documentData
      );
    }
  } catch (error) {
    // 網路延遲或 API 錯誤保護，印出錯誤訊息，使 LINE/前端溫和繼續
    console.error("[Firebase] 寫入 Firestore 失敗：", error);
  }
}
