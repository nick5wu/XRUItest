export interface ChangelogItem {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

export const CHANGELOG_DATA: ChangelogItem[] = [
  {
    version: 'v1.2.0',
    date: '2026-08-03',
    title: '新增提問監控、動態心態軌跡與六大面向綜合評估',
    changes: [
      '新增關係分數硬性字數限制與動態防衛機制。',
      '新增 npc_state_logs 對話狀態與防衛/信任度軌跡追蹤。',
      '新增 Focus Tracker 提問焦點監控（兒童/家庭/其他）。',
      '新增六大面向綜合結算報告與 Gemini 評估產出。'
    ]
  },
  {
    version: 'v1.1.0',
    date: '2026-06-22',
    title: '新增訪談輔助工具與多案例支援',
    changes: [
      '新增「暫停求救」功能：遇到瓶頸時可即時獲取督導教練的提問建議。',
      '新增「盤點資訊」功能：以 AI 檢核是否已問出家庭結構、經濟狀況、發展史等關鍵 IFSP 資訊。',
      '新增「結束訪談」與結算報告：鎖定對話並產生包含同理心、資訊蒐集、風險評估的多維度分析報告。',
      '支援「多案例切換」：可自由選擇不同的家庭背景案例與訓練限時（30/60/90 分鐘）。',
      '整合 Firebase Firestore 寫入：自動儲存測試者、訓練場次與對話逐字稿。'
    ]
  },
  {
    version: 'v1.0.0',
    date: '2026-06-01',
    title: '系統初始版本發佈 (MVP)',
    changes: [
      '支援與 Gemini AI 進行沉浸式早療家長訪談模擬。',
      '實作即時關係分數 (Rapport Score) 進度條與家長情緒反饋。',
      '提供 AI 督導即時分析面板與學員提問技巧標籤 (Skill Tags)。',
      '提供 Gemini API 金鑰前端記憶體暫存配置介面。'
    ]
  }
];
