import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

// 讀取環境變數中的 Firebase 設定
const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || '').trim(),
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim(),
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim(),
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim(),
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID || '').trim(),
};

let db: Firestore | null = null;
let isFirebaseInitialized = false;

try {
  // 檢查是否提供了 projectId（非空且非佔位符）
  if (firebaseConfig.projectId && firebaseConfig.projectId !== 'YOUR_FIREBASE_PROJECT_ID_HERE') {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    isFirebaseInitialized = true;
    console.log("[Firebase] 初始化成功。");
  } else {
    console.warn("[Firebase] 缺少設定或使用預設值。將使用 Mock 模式運作，資料不會實際寫入雲端。");
  }
} catch (error) {
  console.error("[Firebase] 初始化發生錯誤：", error);
}

export { db, isFirebaseInitialized };
