# 🧠 XR 家庭訪談訓練系統 - AI 語音/防衛大腦後端伺服器 (Express.js + TypeScript)

本後端伺服器專為 **Unity VR (Quest / XR Toolkit)** 與 **Gemini AI / Firebase Firestore** 打造，負責扮演中介安全大腦。它完整繼承 Web 端成熟的 **動態防衛機制 (v1.4.1)**、**痛點觸發**、**Focus Tracker 提問焦點監控** 與 **30/60/90 分鐘六大面向結算**。

---

## 📁 目錄結構

```text
server/
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── README.md
└── src/
    ├── config/
    │   └── firebase.ts        # Firebase Admin SDK 初始化與安全降級
    ├── constants/
    │   ├── cases.ts           # 8 大家庭個案庫 (小A、小B阿寬外婆、小C新住民等)
    │   └── prompts.ts         # NPC Prompt (防衛短句限制)、六面向評估 Prompt
    ├── services/
    │   ├── firestoreService.ts # Firestore 資料表讀寫 (sessions, utterances, logs, scores)
    │   └── geminiService.ts   # Google Gemini 1.5 呼叫與 JSON 解析
    └── server.ts              # Express 應用與三大對接端點實作
```

---

## 🚀 快速開始

### 1. 安裝套件
進入 `server` 目錄並安裝相依套件：
```bash
cd server
npm install
```

### 2. 配置環境變數 (`.env`)
複製 `.env.example` 為 `.env`：
```bash
cp .env.example .env
```
編輯 `.env` 填入您的 Google Gemini API Key 與 Firebase 憑證：
```env
PORT=3001
GEMINI_API_KEY=AIzaSyYourActualGeminiApiKeyHere
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
# 或者填寫 Project ID
FIREBASE_PROJECT_ID=xr-interview-platform
```

> 💡 **Firebase Admin 金鑰取得方式**：
> 1. 前往 [Firebase Console](https://console.firebase.google.com/) ➔ 專案設定 ➔ **服務帳戶 (Service Accounts)**。
> 2. 點擊 **產生新的私密金鑰 (Generate New Private Key)**。
> 3. 將下載的 `.json` 檔案放置於 `server/serviceAccountKey.json`。

### 3. 啟動伺服器
- **開發模式 (自動熱重載)**：
  ```bash
  npm run dev
  ```
- **編譯與正式上線**：
  ```bash
  npm run build
  npm start
  ```

---

## 🔌 三大 Unity 對接端點說明

### 1. 【POST /api/session/start】場次初始化
* **URL**：`http://localhost:3001/api/session/start`
* **Request 範例**：
  ```json
  {
    "user_id": "trainee_001",
    "case_id": "case-b",
    "selected_duration": "30"
  }
  ```
* **Response 範例**：
  ```json
  {
    "success": true,
    "session_id": "session_1725000000_abc123",
    "case_id": "case-b",
    "case_name": "小B家 (隔代教養祖孫家庭 - 阿寬外婆)",
    "initial_npc_reply": "社工喔...阿孫他在看電視啦。我們家沒什麼事，你們來做什麼？",
    "selected_duration": "30"
  }
  ```

---

### 2. 【POST /api/chat】對話主引擎 (對齊 Unity 合約)
* **URL**：`http://localhost:3001/api/chat`
* **Request 範例**：
  ```json
  {
    "session_id": "session_1725000000_abc123",
    "text": "阿嬤您好，看您一個人照顧阿孫很辛苦，平時都幾點準備早餐呢？",
    "input_mode": "text"
  }
  ```
* **Response 範例 (Unity 端直接解析)**：
  ```json
  {
    "NPC_Reply": "唉...早上六點就要起來煮粥啦，骨頭常常很酸痛。",
    "Emotion_Tag": "relaxed",
    "Rapport_Score": 55,
    "Focus_Warning": false,
    "trust_score": 55,
    "defense_score": 45,
    "sensitive_triggered": false,
    "question_target": "family",
    "student_skill_tag": ["同理回應", "開放式提問"]
  }
  ```

---

### 3. 【POST /api/session/end】結束與六大面向結算
* **URL**：`http://localhost:3001/api/session/end`
* **Request 範例**：
  ```json
  {
    "session_id": "session_1725000000_abc123",
    "actual_duration": 1780
  }
  ```
* **Response 範例**：
  ```json
  {
    "success": true,
    "session_id": "session_1725000000_abc123",
    "total_score": 83,
    "relationship_score": 85,
    "questioning_score": 80,
    "empathy_score": 90,
    "family_centered_score": 75,
    "information_score": 82,
    "time_score": 95,
    "evaluation_summary": "受訓學員開場破冰自然，能及時同理外婆的照顧重擔，並成功探詢到家庭作息與日常支持網絡。"
  }
  ```

---

## 🥽 Unity 端配置教學

在 Unity 專案中，找到掛載 `GeminiApiClient.cs` 的 `[NetworkManager]` 物件：

1. **本機 Unity Editor 測試**：
   * 將 `apiEndpointUrl` 設定為：
     `http://localhost:3001/api/chat`
2. **Meta Quest 實機連線測試**：
   * 將電腦與 Quest 連接至同一個 Wi-Fi 區域網路。
   * 查詢電腦區域網路 IP（例如 `192.168.1.105`）。
   * 將 `apiEndpointUrl` 設定為：
     `http://192.168.1.105:3001/api/chat`
