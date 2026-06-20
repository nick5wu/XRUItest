import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  LifeBuoy, 
  XOctagon, 
  RotateCcw, 
  Sparkles, 
  Award, 
  User, 
  Lock, 
  AlertCircle
} from 'lucide-react';
import { GeminiService } from './services/geminiService';
import type { GeminiResponse } from './services/geminiService';
import { saveUtteranceToFirestore } from './services/firebaseService';

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

  // 求救狀態
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);

  // 統計狀態（用於結算報告）
  const [allSkillTags, setAllSkillTags] = useState<string[]>([]);

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
    if (isConfigured) {
      handleRestartChat();
    } else {
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

  // 啟動或重新開始對話
  const handleRestartChat = () => {
    try {
      setIsTyping(true);
      const initialScore = 50;
      setRapportScore(initialScore);
      setCurrentEmotion('neutral');
      setLatestAnalysis(null);
      setIsEnded(false);
      setAllSkillTags([]);

      const service = geminiServiceRef.current;
      const initialResponse = service.startNewChat(initialScore);

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
      
      // 異步寫入 Firestore
      saveUtteranceToFirestore({
        speaker: 'npc',
        text: initialResponse.npc_reply,
        skill_tags: initialResponse.student_skill_tag,
        rapport_score_after: initialScore,
        emotion_state: initialResponse.npc_emotion_tag
      });

    } catch (err: any) {
      console.error(err);
      alert(err.message || "啟動對話失敗");
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
        speaker: 'trainee',
        text: traineeText,
        skill_tags: response.student_skill_tag, // 標記在這句學員發言上
        rapport_score_after: calculatedScore,
        emotion_state: response.npc_emotion_tag
      });

      // 異步寫入 Firestore（NPC 的回應）
      saveUtteranceToFirestore({
        speaker: 'npc',
        text: response.npc_reply,
        skill_tags: [],
        rapport_score_after: calculatedScore,
        emotion_state: response.npc_emotion_tag
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

      // 將教練訊息加入對話框作為指引
      const coachMsgId = `coach-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: coachMsgId,
        sender: 'coach',
        text: `【督導建議問法】：「${data.coach_suggestion}」\n\n【技巧分析】：${data.coach_reasoning}`,
        timestamp: new Date()
      }]);

      // 自動將建議問法填入輸入框，方便學員使用
      setInputText(data.coach_suggestion);

    } catch (err: any) {
      console.error(err);
      alert("取得建議失敗，請稍後再試。");
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  // 結束訪談 🛑
  const handleEndInterview = () => {
    setIsEnded(true);
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
        
        {/* 左側：沉浸式對話區 (60%) */}
        <section className="w-3/5 flex flex-col h-full border-r border-slate-900 relative">
          
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
                return (
                  <div key={msg.id} className="flex justify-start items-start gap-3 animate-slideInLeft">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500/20 to-orange-500/20 border border-pink-500/30 flex flex-col items-center justify-center shadow-inner shrink-0">
                      <span className="text-base">👩</span>
                      <span className="text-[8px] text-pink-400 font-bold scale-90">小A媽</span>
                    </div>
                    <div className="flex flex-col items-start max-w-[70%]">
                      <span className="text-[10px] text-slate-500 mb-1">小A媽媽 (24歲單親)</span>
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
            {isTyping && (
              <div className="flex justify-start items-start gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex flex-col items-center justify-center shrink-0">
                  <span className="text-base">👩</span>
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-[10px] text-slate-500 mb-1">小A媽媽正在打字...</span>
                  <div className="glass-panel rounded-2xl rounded-tl-none px-4 py-3 border border-slate-800">
                    <div className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* 懸浮快捷鍵區域 */}
          {!isEnded && isServiceConfigured && (
            <div className="absolute bottom-24 left-6 flex items-center gap-3 z-10">
              <button 
                onClick={handleHelpSeek}
                disabled={isLoadingSuggestion || isTyping}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 text-white rounded-full text-xs font-semibold shadow-lg shadow-amber-900/30 border border-amber-500/30 transition duration-200"
              >
                <span>🆘</span> {isLoadingSuggestion ? '正在分析脈絡...' : '暫停求救 (AI 建議)'}
              </button>
              <button 
                onClick={handleEndInterview}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-full text-xs font-semibold shadow-lg shadow-rose-900/30 border border-rose-500/30 transition duration-200"
              >
                <XOctagon className="w-3.5 h-3.5" />
                結束訪談結算
              </button>
            </div>
          )}

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
            <div className="bg-slate-950/30 border border-slate-900 rounded-xl p-3 text-[11px] text-slate-500 mt-4 leading-relaxed">
              <span className="font-semibold text-slate-400 block mb-1">💡 小A媽媽的隱藏設定：</span>
              24歲單親媽媽，育有三子。有家暴史，對社工的調查極度防衛。請使用同理心、避免評價或連續性封閉式質問。
            </div>
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

      </main>

    </div>
  );
}
