import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  LifeBuoy, 
  RotateCcw, 
  Sparkles, 
  Award, 
  User, 
  Lock, 
  AlertCircle
} from 'lucide-react';
import { GeminiService } from './services/geminiService';
import type { GeminiResponse, InfoCheckResponse } from './services/geminiService';
import { 
  saveUserToFirestore, 
  startTrainingSessionInFirestore, 
  endTrainingSessionInFirestore, 
  saveUtteranceToFirestore 
} from './services/firebaseService';
import { familyCases } from './constants/cases';
import ChangelogModal from './components/ChangelogModal';
import { CHANGELOG_DATA } from './constants/changelog';


interface Message {
  id: string;
  sender: 'trainee' | 'npc' | 'coach';
  text: string;
  timestamp: Date;
  emotionTag?: 'defensive' | 'relaxed' | 'neutral';
  skillTags?: string[];
  scoreChange?: number;
  reasoning?: string;
}

export default function App() {
  // 核心狀態
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [rapportScore, setRapportScore] = useState(50);
  const [currentEmotion, setCurrentEmotion] = useState<'defensive' | 'relaxed' | 'neutral'>('neutral');
  const [latestAnalysis, setLatestAnalysis] = useState<{
    reasoning: string;
    skillTags: string[];
    scoreChange: number;
  } | null>(null);
  
  const [isTyping, setIsTyping] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isServiceConfigured, setIsServiceConfigured] = useState(false);
  const [showKeySetup, setShowKeySetup] = useState(false);

  // Firebase 測試者與場次狀態
  const [userId] = useState(() => 'user_mvp_' + Math.random().toString(36).substring(2, 9));
  const [userName] = useState('測試受訓人員');
  const [sessionId, setSessionId] = useState('');

  // 畫面控制與案例設定狀態
  const [isChatStarted, setIsChatStarted] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState('case-a');
  const [selectedTimeMode, setSelectedTimeMode] = useState<number>(30);

  // 輔助功能狀態管理
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [coachSuggestion, setCoachSuggestion] = useState('');
  const [coachReasoning, setCoachReasoning] = useState('');

  const [showCheckModal, setShowCheckModal] = useState(false);
  const [isCheckingInfo, setIsCheckingInfo] = useState(false);
  const [checkResult, setCheckResult] = useState<InfoCheckResponse | null>(null);

  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // 求救狀態
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);

  // 統計狀態（用於結算報告）
  const [allSkillTags, setAllSkillTags] = useState<string[]>([]);

  // 更新日誌狀態
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);

  // 服務實例與 DOM 參考
  const geminiServiceRef = useRef<GeminiService>(new GeminiService());

  const chatEndRef = useRef<HTMLDivElement>(null);

  // 滾動至對話最下方
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // 初始化檢查
  useEffect(() => {
    const isConfigured = geminiServiceRef.current.isConfigured();
    setIsServiceConfigured(isConfigured);
    if (!isConfigured) {
      setShowKeySetup(true);
    }
  }, []);

  // 設定暫存金鑰
  const handleSaveTempKey = () => {
    if (!apiKeyInput.trim()) return;
    // 將金鑰寫入環境變數的 runtime 覆蓋
    import.meta.env.VITE_GEMINI_API_KEY = apiKeyInput;
    // 重新建構服務
    geminiServiceRef.current = new GeminiService();
    const isConfigured = geminiServiceRef.current.isConfigured();
    setIsServiceConfigured(isConfigured);
    
    if (isConfigured) {
      setShowKeySetup(false);
      handleRestartChat();
    } else {
      alert("金鑰無效或配置失敗，請重試。");
    }
  };

  // 啟動或重新開始對話 (回到設定面板)
  const handleRestartChat = () => {
    setIsChatStarted(false);
    setIsEnded(false);
    setMessages([]);
    setSessionId('');
  };

  // 點擊「開始訪談」後的初始化與 Firebase 註冊行為
  const handleStartInterview = async () => {
    if (!isServiceConfigured) {
      setShowKeySetup(true);
      return;
    }

    try {
      setIsChatStarted(true);
      setIsTyping(true);
      const initialScore = 50;
      setRapportScore(initialScore);
      setCurrentEmotion('neutral');
      setLatestAnalysis(null);
      setIsEnded(false);
      setAllSkillTags([]);

      const service = geminiServiceRef.current;
      const initialResponse = service.startNewChat(initialScore, selectedCaseId, selectedTimeMode);

      const initialMessage: Message = {
        id: 'init-npc',
        sender: 'npc',
        text: initialResponse.npc_reply,
        timestamp: new Date(),
        emotionTag: initialResponse.npc_emotion_tag,
        skillTags: initialResponse.student_skill_tag,
        scoreChange: initialResponse.rapport_score_change,
        reasoning: initialResponse.ai_reasoning
      };

      setMessages([initialMessage]);
      
      // 生成本場次隨機 sessionId
      const newSessionId = 'session_' + Date.now();
      setSessionId(newSessionId);

      // 1. 寫入/更新使用者基本資訊
      saveUserToFirestore({
        userId,
        name: userName,
        role: '早療人員'
      });

      // 2. 建立訓練場次
      const selectedCase = familyCases.find(c => c.id === selectedCaseId) || familyCases[0];
      startTrainingSessionInFirestore({
        sessionId: newSessionId,
        userId,
        selectedFamilyCase: selectedCase.name,
        timeLimitSeconds: selectedTimeMode * 60
      });

      // 3. 寫入初始對話記錄
      saveUtteranceToFirestore({
        session_id: newSessionId,
        speaker: 'npc',
        text: initialResponse.npc_reply,
        rapport_score: initialScore,
        student_skill_tag: initialResponse.student_skill_tag
      });

    } catch (err: any) {
      console.error(err);
      alert(err.message || "啟動對話失敗");
      setIsChatStarted(false);
    } finally {
      setIsTyping(false);
    }
  };

  // 送出學員對話
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isTyping || isEnded || !isServiceConfigured) return;

    const traineeText = inputText.trim();
    setInputText('');

    // 1. 新增學員訊息到 UI
    const traineeMsgId = `trainee-${Date.now()}`;
    const traineeMessage: Message = {
      id: traineeMsgId,
      sender: 'trainee',
      text: traineeText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, traineeMessage]);

    // 2. 啟動打字狀態，發送請求給 Gemini
    setIsTyping(true);

    try {
      const currentScore = rapportScore;
      const response: GeminiResponse = await geminiServiceRef.current.sendMessage(traineeText, currentScore);
      
      // 3. 計算新關係分數（限制在 0-100 之間）
      const calculatedScore = Math.max(0, Math.min(100, currentScore + response.rapport_score_change));
      setRapportScore(calculatedScore);
      setCurrentEmotion(response.npc_emotion_tag);

      // 4. 更新分析面板
      setLatestAnalysis({
        reasoning: response.ai_reasoning,
        skillTags: response.student_skill_tag,
        scoreChange: response.rapport_score_change
      });

      // 累計所有技巧
      if (response.student_skill_tag.length > 0) {
        setAllSkillTags(prev => {
          const combined = [...prev, ...response.student_skill_tag];
          return Array.from(new Set(combined)); // 去重
        });
      }

      // 5. 新增 NPC 回應訊息到 UI
      const npcMsgId = `npc-${Date.now()}`;
      const npcMessage: Message = {
        id: npcMsgId,
        sender: 'npc',
        text: response.npc_reply,
        timestamp: new Date(),
        emotionTag: response.npc_emotion_tag,
        skillTags: response.student_skill_tag,
        scoreChange: response.rapport_score_change,
        reasoning: response.ai_reasoning
      };

      setMessages(prev => [...prev, npcMessage]);

      // 6. 異步寫入 Firestore（受訓人員的對話）
      saveUtteranceToFirestore({
        session_id: sessionId,
        speaker: 'student',
        text: traineeText,
        rapport_score: calculatedScore,
        student_skill_tag: response.student_skill_tag
      });

      // 異步寫入 Firestore（NPC 的回應）
      saveUtteranceToFirestore({
        session_id: sessionId,
        speaker: 'npc',
        text: response.npc_reply,
        rapport_score: calculatedScore,
        student_skill_tag: []
      });

    } catch (err: any) {
      console.error("Gemini communication error:", err);
      
      const errText = err?.message || String(err);
      const isApiKeyError = errText.includes("API_KEY_INVALID") || 
                            errText.includes("not found") || 
                            errText.includes("API key") || 
                            errText.includes("400") || 
                            errText.includes("403") || 
                            errText.includes("404");
      
      const errMsgId = `npc-error-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: errMsgId,
        sender: 'npc',
        text: isApiKeyError 
          ? "⚠️【系統連線失敗】您的 Gemini API 金鑰似乎無效、過期或設定錯誤（API 回傳 404/403/400 錯誤）。請點選右上角「設定 Gemini 金鑰」重新貼上有效的金鑰，或檢查 .env 檔案中 VITE_GEMINI_API_KEY 的設定。"
          : "（系統目前有點忙碌，我剛才沒有聽清楚，您可以再跟我說一次嗎？）",
        timestamp: new Date(),
        emotionTag: currentEmotion
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  // 暫停求救 🆘
  const handleHelpSeek = async () => {
    if (isEnded || isTyping || !isServiceConfigured) return;

    setIsLoadingSuggestion(true);
    try {
      const data = await geminiServiceRef.current.getHelpSuggestion(rapportScore);
      setCoachSuggestion(data.coach_suggestion);
      setCoachReasoning(data.coach_reasoning);
      setShowHelpModal(true);
    } catch (err: any) {
      console.error(err);
      alert("取得建議失敗，請稍後再試。");
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  // 盤點資訊 📊
  const handleCheckInfo = async () => {
    if (isEnded || isTyping || !isServiceConfigured) return;

    setIsCheckingInfo(true);
    try {
      const data = await geminiServiceRef.current.checkIFSPInformation();
      setCheckResult(data);
      setShowCheckModal(true);
    } catch (err: any) {
      console.error(err);
      alert("盤點資訊失敗，請稍後再試。");
    } finally {
      setIsCheckingInfo(false);
    }
  };

  // 結束訪談（按鈕點擊，觸發載入與鎖定對話）🛑
  const handleEndInterviewClick = () => {
    setIsEnded(true); // 鎖定對話框，不讓使用者繼續輸入
    setIsGeneratingReport(true); // 顯示產生報告中...載入畫面

    if (sessionId) {
      endTrainingSessionInFirestore(sessionId, rapportScore);
    }

    // 模擬 2 秒的報告分析與結算
    setTimeout(() => {
      setIsGeneratingReport(false);
    }, 2000);
  };

  // 判斷技巧標籤是否為「風傷標記」或「加分技巧」
  const getTagType = (tag: string): 'positive' | 'negative' => {
    const negativeTags = ['評價式語句', '評價指責', '封閉式提問', '連續封閉式提問', '觸碰痛點', '過早給建議', '身家調查'];
    return negativeTags.some(neg => tag.includes(neg)) ? 'negative' : 'positive';
  };

  // 計算結算報告評價等級
  const getRating = () => {
    if (rapportScore >= 80) return { title: '優秀 (Rapport 融洽)', color: 'text-emerald-400', desc: '您能展現極佳的同理心，成功修復與建立與小A媽媽的信賴關係，讓她願意主動分享家庭困境。' };
    if (rapportScore >= 50) return { title: '合格 (基本溝通建立)', color: 'text-amber-400', desc: '您完成了基本的訪談，但小A媽媽心中仍有一些防線。可以多嘗試開放式提問來深入家庭核心。' };
    return { title: '待加強 (關係受挫/防衛)', color: 'text-rose-400', desc: '訪談中出現了較多評價指責或封閉式問題，觸碰到了家長的痛點，導致關係緊張。建議多使用同理字句修補關係。' };
  };

  return (
    <div className="flex flex-col h-screen text-slate-100 font-sans overflow-hidden">
      
      {/* 頂部導航列 */}
      <header className="flex items-center justify-between px-6 py-4 glass-panel border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-indigo-200">
              IFSP 前置家庭訪談能力訓練系統 <span className="text-xs bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/20">MVP</span>
            </h1>
            <p className="text-xs text-slate-400">早療與社工專業訪談模擬 AI 系統</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsChangelogOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 rounded-lg text-xs transition duration-200 cursor-pointer font-sans font-bold"
          >
            🚀 {CHANGELOG_DATA[0].version}
          </button>
          {!isServiceConfigured && (
            <button 
              onClick={() => setShowKeySetup(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/30 text-rose-200 rounded-lg text-xs transition duration-200"
            >
              <Lock className="w-3.5 h-3.5" />
              設定 Gemini 金鑰
            </button>
          )}
          {isServiceConfigured && (
            <div className="flex items-center gap-2 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              AI 大腦已就緒
            </div>
          )}
        </div>

      </header>

      {/* API 金鑰設定彈窗 */}
      {showKeySetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl shadow-2xl border border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-100">配置 Gemini API 金鑰</h3>
                <p className="text-xs text-slate-400">需要金鑰以驅動 NPC AI 與評分教練</p>
              </div>
            </div>
            
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              請在下方貼上您的 Google Gemini API Key。此金鑰僅會暫存在您的瀏覽器記憶體中，重新整理網頁即會清除。
              若要永久設定，請於專案根目錄的 <code className="bg-slate-900 text-indigo-300 px-1 py-0.5 rounded text-xs">.env</code> 檔案中填寫 <code className="bg-slate-900 text-indigo-300 px-1 py-0.5 rounded text-xs">VITE_GEMINI_API_KEY</code>。
            </p>

            <input 
              type="password" 
              placeholder="AIzaSy..." 
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition mb-4"
            />

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                沒有金鑰？
                <a 
                  href="https://aistudio.google.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:underline ml-1"
                >
                  去 Google AI Studio 免費申請
                </a>
              </span>
              <div className="flex gap-2">
                {isServiceConfigured && (
                  <button 
                    onClick={() => setShowKeySetup(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition"
                  >
                    取消
                  </button>
                )}
                <button 
                  onClick={handleSaveTempKey}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-indigo-600/35 transition"
                >
                  儲存並開始
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 主介面左右分欄 */}
      <main className="flex flex-1 overflow-hidden bg-slate-950/50">
        {!isChatStarted ? (
          <div className="flex-1 flex items-center justify-center p-6 bg-slate-950/80 overflow-y-auto">
            <div className="w-full max-w-2xl glass-panel p-8 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden animate-fadeIn">
              {/* 背景微光裝飾 */}
              <div className="absolute -top-12 -right-12 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl"></div>
              
              <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-slate-800/80">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
                  <Sparkles className="w-5.5 h-5.5" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold tracking-wide text-white">訪談訓練參數設定</h2>
                  <p className="text-xs text-slate-400 mt-0.5">請選取您要進行訪談模擬的家庭案例與對話時間長度</p>
                </div>
              </div>

              <div className="space-y-6">
                
                {/* 1. 選擇家庭案例 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                    第一步：選擇家庭案例
                  </label>
                  <select 
                    value={selectedCaseId}
                    onChange={(e) => setSelectedCaseId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 text-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none transition-all cursor-pointer shadow-inner"
                  >
                    {familyCases.map((c) => (
                      <option key={c.id} value={c.id} className="bg-slate-950 text-slate-200">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 案例詳情卡片 */}
                {(() => {
                  const selectedCase = familyCases.find(c => c.id === selectedCaseId) || familyCases[0];
                  return (
                    <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 space-y-4 shadow-sm animate-fadeIn">
                      <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold tracking-wider uppercase">
                        <span>📋</span> 案例檔案 (Case File)
                      </div>
                      
                      <div className="space-y-3.5">
                        <div>
                          <span className="text-[11px] text-slate-500 block mb-1">家庭背景說明</span>
                          <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/30 p-3 rounded-lg border border-slate-800/40">
                            {selectedCase.background_prompt}
                          </p>
                        </div>
                        <div>
                          <span className="text-[11px] text-pink-400/90 flex items-center gap-1 mb-1 font-medium">
                            <span>🔑</span> 隱藏痛點提示
                          </span>
                          <p className="text-xs text-pink-300/80 leading-relaxed bg-pink-950/10 p-3 rounded-lg border border-pink-950/20">
                            {selectedCase.hidden_pain_point}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 2. 選擇訪談時間 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                    第二步：選擇時間模式 (分鐘)
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[30, 60, 90].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setSelectedTimeMode(mins)}
                        className={`py-3 rounded-xl border font-bold text-xs tracking-wider transition-all duration-200 flex flex-col items-center justify-center gap-1 cursor-pointer ${
                          selectedTimeMode === mins
                            ? 'bg-gradient-to-tr from-indigo-600/20 to-pink-500/20 border-indigo-500 text-indigo-300 shadow-lg shadow-indigo-500/10'
                            : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-400'
                        }`}
                      >
                        <span className="text-sm font-extrabold">{mins} 分鐘</span>
                        <span className="text-[9px] opacity-60">限時訪談</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. 開始訪談按鈕 */}
                <div className="pt-4">
                  <button
                    onClick={handleStartInterview}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-pink-500 hover:from-indigo-500 hover:to-pink-400 text-white font-bold text-sm tracking-widest shadow-xl shadow-indigo-600/20 hover:shadow-indigo-500/30 transition-all duration-300 transform active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer cursor-glowing font-sans"
                  >
                    <span>🚀</span> 開始訪談訓練
                  </button>
                </div>

              </div>
            </div>
          </div>
        ) : (
          <>
            {/* 左側：沉浸式對話區 (60%) */}
            <section className="w-3/5 flex flex-col h-full border-r border-slate-900 relative">
              {/* 輔助功能工具列 */}
              {!isEnded && isChatStarted && (
                <div className="flex items-center justify-between px-6 py-3 bg-slate-900/40 border-b border-slate-800/80 shrink-0 gap-3">
                  <div className="text-xs text-slate-400 font-semibold tracking-wider uppercase flex items-center gap-1.5">
                    <span>🔧</span> 訪談輔助工具
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleHelpSeek}
                      disabled={isLoadingSuggestion || isTyping}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600/10 hover:bg-amber-600/25 disabled:opacity-50 border border-amber-500/20 text-amber-300 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm shadow-amber-950/20"
                    >
                      <span>🆘</span> {isLoadingSuggestion ? '分析中...' : '暫停求救'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCheckInfo}
                      disabled={isCheckingInfo || isTyping}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600/10 hover:bg-indigo-600/25 disabled:opacity-50 border border-indigo-500/20 text-indigo-300 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm shadow-indigo-950/20"
                    >
                      <span>📊</span> {isCheckingInfo ? '盤點中...' : '盤點資訊'}
                    </button>
                    <button
                      type="button"
                      onClick={handleEndInterviewClick}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600/10 hover:bg-rose-600/25 border border-rose-500/20 text-rose-300 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm shadow-rose-950/20"
                    >
                      <span>🛑</span> 結束訪談
                    </button>
                  </div>
                </div>
              )}
          
              {/* 對話記錄窗 */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar">
            {messages.map((msg) => {
              if (msg.sender === 'trainee') {
                return (
                  <div key={msg.id} className="flex justify-end items-start gap-3 animate-slideInRight">
                    <div className="flex flex-col items-end max-w-[70%]">
                      <span className="text-[10px] text-slate-500 mb-1">受訓人員</span>
                      <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-none px-4 py-3 shadow-md border border-indigo-500/20">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      </div>
                      <span className="text-[9px] text-slate-600 mt-1">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-4">
                      <User className="w-4 h-4" />
                    </div>
                  </div>
                );
              } else if (msg.sender === 'coach') {
                return (
                  <div key={msg.id} className="flex justify-center items-start gap-3 animate-fadeIn">
                    <div className="w-full max-w-[90%] glass-panel-accent rounded-2xl px-5 py-4 border border-indigo-500/30 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl"></div>
                      <div className="flex items-center gap-2 mb-2 text-indigo-400">
                        <LifeBuoy className="w-4 h-4 animate-spin-slow" />
                        <span className="text-xs font-bold tracking-wider">督導教練即時指導</span>
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                );
              } else {
                // NPC Parent
                const activeCase = familyCases.find(c => c.id === selectedCaseId) || familyCases[0];
                const activeShortName = activeCase.name.split(' ')[0];
                return (
                  <div key={msg.id} className="flex justify-start items-start gap-3 animate-slideInLeft">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500/20 to-orange-500/20 border border-pink-500/30 flex flex-col items-center justify-center shadow-inner shrink-0">
                      <span className="text-base">👩</span>
                      <span className="text-[8px] text-pink-400 font-bold scale-90">{activeShortName}</span>
                    </div>
                    <div className="flex flex-col items-start max-w-[70%]">
                      <span className="text-[10px] text-slate-500 mb-1">{activeCase.name}</span>
                      <div className="glass-panel text-slate-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-md border border-slate-700/50">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-slate-600">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.emotionTag && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${
                            msg.emotionTag === 'defensive' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                            msg.emotionTag === 'relaxed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                            'bg-slate-500/10 border-slate-500/20 text-slate-400'
                          }`}>
                            {msg.emotionTag === 'defensive' ? '🛡️ 防衛' : msg.emotionTag === 'relaxed' ? '😌 放鬆' : '😐 中立'}
                          </span>
                        )}
                        {msg.scoreChange !== undefined && msg.scoreChange !== 0 && (
                          <span className={`text-[9px] font-bold ${msg.scoreChange > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {msg.scoreChange > 0 ? `+${msg.scoreChange}` : msg.scoreChange} Rapport
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
            })}

            {/* NPC 打字中動畫 */}
            {isTyping && (() => {
              const activeCase = familyCases.find(c => c.id === selectedCaseId) || familyCases[0];
              const activeShortName = activeCase.name.split(' ')[0];
              return (
                <div className="flex justify-start items-start gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex flex-col items-center justify-center shrink-0">
                    <span className="text-base">👩</span>
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] text-slate-500 mb-1">{activeShortName}家長正在打字...</span>
                    <div className="glass-panel rounded-2xl rounded-tl-none px-4 py-3 border border-slate-800">
                      <div className="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div ref={chatEndRef} />
          </div>



          {/* 底部輸入欄 */}
          <div className="p-4 bg-slate-900/60 border-t border-slate-900 shrink-0">
            <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isEnded || !isServiceConfigured}
                placeholder={
                  !isServiceConfigured ? '請先設定右上角的 Gemini 金鑰' :
                  isEnded ? '訪談已結束，點選右側「重新開始」按鈕以開啟新練習。' : 
                  '請以專業社工技巧展開提問或同理家長...'
                }
                className="flex-1 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3.5 text-sm text-slate-200 focus:outline-none transition disabled:opacity-60"
              />
              <button 
                type="submit" 
                disabled={isEnded || !inputText.trim() || isTyping || !isServiceConfigured}
                className="w-12 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 transition duration-200 shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>

        </section>

        {/* 右側：督導與即時分析儀表板 (40%) */}
        <section className="w-2/5 flex flex-col h-full bg-slate-900/30 overflow-y-auto custom-scrollbar p-6 space-y-6">
          
          {/* NPC 狀態面板 */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-full blur-3xl"></div>
            <h3 className="text-sm font-bold tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-pink-400" />
              NPC 家長即時狀態
            </h3>
            
            {/* 關係分數 */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  關係分數 (Rapport Score)
                </span>
                <span className="text-sm font-bold text-white">{rapportScore} / 100</span>
              </div>
              
              {/* 進度條 */}
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800/80">
                <div 
                  className={`h-full rounded-full rapport-transition ${
                    rapportScore >= 80 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                    rapportScore >= 30 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                    'bg-gradient-to-r from-rose-600 to-red-500'
                  }`}
                  style={{ width: `${rapportScore}%` }}
                ></div>
              </div>
              
              <div className="flex justify-between items-center mt-1 text-[9px] text-slate-500">
                <span>0 極度防衛 (拒答)</span>
                <span>50 中立</span>
                <span>100 放鬆分享</span>
              </div>
            </div>

            {/* 當前情緒狀態 */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-400">當前情緒狀態標籤</span>
              <div className="flex gap-2">
                <span className={`text-xs px-3 py-1 rounded-full font-semibold border flex items-center gap-1.5 ${
                  currentEmotion === 'defensive' 
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' 
                    : 'bg-rose-950/20 border-slate-800 text-slate-500'
                }`}>
                  <span>🛡️</span> 防衛 (defensive)
                </span>
                <span className={`text-xs px-3 py-1 rounded-full font-semibold border flex items-center gap-1.5 ${
                  currentEmotion === 'neutral' 
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                    : 'bg-amber-950/20 border-slate-800 text-slate-500'
                }`}>
                  <span>😐</span> 中立 (neutral)
                </span>
                <span className={`text-xs px-3 py-1 rounded-full font-semibold border flex items-center gap-1.5 ${
                  currentEmotion === 'relaxed' 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                    : 'bg-emerald-950/20 border-slate-800 text-slate-500'
                }`}>
                  <span>😌</span> 放鬆 (relaxed)
                </span>
              </div>
            </div>
          </div>

          {/* AI 即時分析面板 */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex-1 flex flex-col justify-between min-h-[300px]">
            <div>
              <h3 className="text-sm font-bold tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                AI 督導即時分析 (對上一句話)
              </h3>

              {latestAnalysis ? (
                <div className="space-y-4 animate-fadeIn">
                  
                  {/* 分數變動 */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">關係分數變動:</span>
                    <span className={`text-sm font-extrabold flex items-center gap-1 ${
                      latestAnalysis.scoreChange > 0 ? 'text-emerald-400' :
                      latestAnalysis.scoreChange < 0 ? 'text-rose-400' : 'text-slate-400'
                    }`}>
                      {latestAnalysis.scoreChange > 0 ? `+${latestAnalysis.scoreChange}` : latestAnalysis.scoreChange}
                      {latestAnalysis.scoreChange > 0 ? ' (加分)' : latestAnalysis.scoreChange < 0 ? ' (扣分)' : ' (無變動)'}
                    </span>
                  </div>

                  {/* 技巧標記與風傷標記 */}
                  <div>
                    <span className="text-xs text-slate-400 block mb-2">訪談語句特徵標記:</span>
                    {latestAnalysis.skillTags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {latestAnalysis.skillTags.map((tag, idx) => {
                          const type = getTagType(tag);
                          return (
                            <span 
                              key={idx} 
                              className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${
                                type === 'positive' 
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                              }`}
                            >
                              {type === 'positive' ? '💡 ' : '⚠️ '}
                              {tag}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-600 italic">無特徵標記</span>
                    )}
                  </div>

                  {/* 判定理由 */}
                  <div className="pt-3 border-t border-slate-800/80">
                    <span className="text-xs text-slate-400 block mb-1.5">判定理由 (AI Reasoning):</span>
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                      {latestAnalysis.reasoning}
                    </p>
                  </div>

                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                  <AlertCircle className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-xs">等待對話開始或受訓人員發言...</p>
                </div>
              )}
            </div>

            {/* 背景提示 */}
            {(() => {
              const activeCase = familyCases.find(c => c.id === selectedCaseId) || familyCases[0];
              return (
                <div className="bg-slate-950/30 border border-slate-900 rounded-xl p-3 text-[11px] text-slate-500 mt-4 leading-relaxed animate-fadeIn">
                  <span className="font-semibold text-slate-400 block mb-1">💡 {activeCase.name.split(' ')[0]} 的引導提示：</span>
                  請使用同理心、避免評價或連續性封閉式質問，並嘗試理解家庭的隱藏痛點。
                </div>
              );
            })()}
          </div>

          {/* 結算報告區 (在訪談結束後渲染) */}
          {isEnded && (
            <div className="glass-panel p-5 rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/40 to-slate-950/60 shadow-2xl animate-scaleUp">
              <div className="flex items-center gap-2 mb-3">
                <Award className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm tracking-wider text-amber-400">訪談訓練結算報告</h3>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs text-slate-300">
                  <span>最終關係分數:</span>
                  <span className="font-bold text-lg text-white">{rapportScore} / 100</span>
                </div>

                <div className="text-xs text-slate-300">
                  <span>評價等級:</span>
                  <span className={`font-bold block text-sm mt-0.5 ${getRating().color}`}>
                    {getRating().title}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {getRating().desc}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <span className="text-xs text-slate-300 block mb-1">展現的技巧/特徵累計：</span>
                  {allSkillTags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {allSkillTags.map((tag, idx) => (
                        <span 
                          key={idx} 
                          className={`text-[10px] px-2 py-0.5 rounded ${
                            getTagType(tag) === 'positive' 
                              ? 'bg-emerald-950/40 border border-emerald-900 text-emerald-300' 
                              : 'bg-rose-950/40 border border-rose-900 text-rose-300'
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-500 italic">無統計資料</span>
                  )}
                </div>

                <button 
                  onClick={handleRestartChat}
                  className="w-full mt-3 flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition duration-200"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  重新開始一場訪談
                </button>
              </div>
            </div>
          )}

          {/* 若非結束狀態，顯示基本控制 */}
          {!isEnded && (
            <button 
              onClick={handleRestartChat}
              disabled={isTyping}
              className="flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs border border-slate-800 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重新開始對話
            </button>
          )}

        </section>
      </>
    )}
  </main>
      {/* 暫停求救 Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn">
          <div className="w-full max-w-lg glass-panel p-6 rounded-3xl shadow-2xl border border-slate-700 relative overflow-hidden animate-scaleUp">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl"></div>
            
            <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                🆘
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-100 font-sans">AI 督導指導建議</h3>
                <p className="text-[10px] text-slate-400 font-sans">根據當前對話脈絡提供的專業引導技巧</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-amber-400 block font-semibold uppercase tracking-wider mb-1 font-sans">💡 建議問法 (你可以這樣說)：</span>
                <p className="text-sm font-bold text-white bg-slate-950/80 p-4 rounded-2xl border border-amber-500/20 leading-relaxed shadow-inner font-sans">
                  「{coachSuggestion}」
                </p>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 block font-semibold uppercase tracking-wider mb-1 font-sans">🧠 技巧與脈絡分析：</span>
                <p className="text-xs text-slate-300 bg-slate-900/40 p-4 rounded-2xl border border-slate-800 leading-relaxed max-h-48 overflow-y-auto font-sans">
                  {coachReasoning}
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 mt-6 justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer font-sans"
              >
                關閉
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputText(coachSuggestion);
                  setShowHelpModal(false);
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-amber-600/25 transition cursor-pointer font-sans"
              >
                直接填入輸入框
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 盤點資訊 Modal */}
      {showCheckModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn">
          <div className="w-full max-w-xl glass-panel p-6 rounded-3xl shadow-2xl border border-slate-700 relative overflow-hidden animate-scaleUp">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl"></div>
            
            <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                📊
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-100 font-sans">IFSP 關鍵資訊盤點</h3>
                <p className="text-[10px] text-slate-400 font-sans">分析對話是否已揭露個別化家庭服務計畫所需的關鍵指標</p>
              </div>
            </div>

            {checkResult ? (
              <div className="space-y-4">
                
                {/* 盤點卡片 - 家庭結構 */}
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex gap-3.5 items-start">
                  <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-bold text-xs ${
                    checkResult.family_structure.achieved 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {checkResult.family_structure.achieved ? '✓' : '✗'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-200 font-sans">1. 家庭結構 (Family Structure)</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-sans ${
                        checkResult.family_structure.achieved 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      }`}>
                        {checkResult.family_structure.achieved ? '已達成' : '未完成'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed font-sans">{checkResult.family_structure.evidence}</p>
                  </div>
                </div>

                {/* 盤點卡片 - 經濟狀況 */}
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex gap-3.5 items-start">
                  <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-bold text-xs ${
                    checkResult.financial_status.achieved 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {checkResult.financial_status.achieved ? '✓' : '✗'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-200 font-sans">2. 經濟狀況 (Financial Status)</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-sans ${
                        checkResult.financial_status.achieved 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      }`}>
                        {checkResult.financial_status.achieved ? '已達成' : '未完成'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed font-sans">{checkResult.financial_status.evidence}</p>
                  </div>
                </div>

                {/* 盤點卡片 - 發展史 */}
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex gap-3.5 items-start">
                  <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-bold text-xs ${
                    checkResult.developmental_history.achieved 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {checkResult.developmental_history.achieved ? '✓' : '✗'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-200 font-sans">3. 發展史 (Developmental History)</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-sans ${
                        checkResult.developmental_history.achieved 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      }`}>
                        {checkResult.developmental_history.achieved ? '已達成' : '未完成'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed font-sans">{checkResult.developmental_history.evidence}</p>
                  </div>
                </div>

              </div>
            ) : (
              <div className="text-center text-xs text-slate-500 py-6 font-sans">尚無盤點資料</div>
            )}

            <div className="flex mt-6 justify-end font-sans">
              <button
                type="button"
                onClick={() => setShowCheckModal(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-indigo-600/25 transition cursor-pointer"
              >
                關閉盤點面板
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 產生報告中 Loading 畫面 */}
      {isGeneratingReport && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 border-r-pink-500 animate-spin"></div>
              <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
            </div>
            
            <div className="text-center font-sans">
              <h3 className="font-extrabold text-lg text-slate-100 tracking-wider">產生評估報告中...</h3>
              <p className="text-xs text-slate-400 mt-1.5 animate-pulse">AI 督導正在彙整訪談對話與評估關鍵技巧...</p>
            </div>
          </div>
        </div>
      )}

      {/* 系統更新日誌彈窗 */}
      <ChangelogModal isOpen={isChangelogOpen} onClose={() => setIsChangelogOpen(false)} />

    </div>
  );
}

