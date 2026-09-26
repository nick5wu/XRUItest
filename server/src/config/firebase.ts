import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

let db: admin.firestore.Firestore;
let isFirebaseAdminInitialized = false;

// 候選金鑰檔案路徑清單
const candidatePaths = [
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ? path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH) : '',
  path.resolve(process.cwd(), 'serviceAccountKey.json'),
  path.resolve(process.cwd(), 'server', 'serviceAccountKey.json'),
  path.resolve(__dirname, '..', '..', 'serviceAccountKey.json'),
  path.resolve(__dirname, '..', 'serviceAccountKey.json'),
  path.resolve(__dirname, 'serviceAccountKey.json')
].filter(Boolean);

let loadedPath = '';
for (const p of candidatePaths) {
  if (fs.existsSync(p)) {
    loadedPath = p;
    break;
  }
}

try {
  if (admin.apps.length === 0) {
    if (loadedPath) {
      const serviceAccount = JSON.parse(fs.readFileSync(loadedPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      isFirebaseAdminInitialized = true;
      console.log(`[Firebase Admin] 成功載入 serviceAccountKey.json (${loadedPath}) 憑證並初始化成功！`);
    } else if (process.env.FIREBASE_PROJECT_ID) {
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID
      });
      isFirebaseAdminInitialized = true;
      console.log(`[Firebase Admin] 透過 Project ID (${process.env.FIREBASE_PROJECT_ID}) 初始化連線`);
    } else {
      admin.initializeApp();
      isFirebaseAdminInitialized = true;
      console.log('[Firebase Admin] 透過預設應用憑證 (Application Default Credentials) 初始化');
    }
  }

  db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
} catch (error) {
  console.warn('[Firebase Admin 警告] 初始化 Firebase Admin SDK 失敗，將運行於模擬/防護模式。錯誤訊息：', error);
  // @ts-ignore
  db = null as any;
}

export { admin, db, isFirebaseAdminInitialized };

