import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  Sparkles, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Heart,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { apiClient, ApiChatResponse, ApiEvaluationReport } from '../services/apiClient';
import { caseProfiles, type CaseProfile } from '../constants/cases';
import { useWebSpeech } from '../hooks/useWebSpeech';

import type { CurrentUser } from '../services/supabaseClient';

interface Message {
  id: string;
  sender: 'user' | 'npc';
  text: string;
  timestamp: Date;
  emotionTag?: 'defensive' | 'relaxed' | 'neutral';
  skillTags?: string[];
  scoreChange?: number;
  reasoning?: string;
  inputMode?: 'text' | 'voice';
}

interface InteractiveTrainerProps {
  onSessionEnded?: (sessionId: string) => void;
  currentUser?: CurrentUser | null;
}

export const InteractiveTrainer: React.FC<InteractiveTrainerProps> = ({
  onSessionEnded,
  currentUser
}) => {
  const [selectedCaseId, setSelectedCaseId] = useState<string>('persona_1');
  const [selectedDuration, setSelectedDuration] = useState<'30' | '60' | '90'>('30');
  const [userId, setUserId] = useState<string>(currentUser?.id || 'trainee_web_01');
  const [sessionId, setSessionId] = useState<string>('');
  
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [isEnding, setIsEnding] = useState<boolean>(false);

  // 當前 NPC 狀態
  const [trustScore, setTrustScore] = useState<number>(30);
  const [defenseScore, setDefenseScore] = useState<number>(75);
  const [rapportScore, setRapportScore] = useState<number>(50);
  const [emotionTag, setEmotionTag] = useState<'defensive' | 'relaxed' | 'neutral'>('neutral');

  // 四大範疇進度
  const [checklist, setChecklist] = useState({
    child_function: 15,
    daily_routine: 10,
    family_needs: 10,
    strengths_resources: 10
  });

  // 語音 Hook
  const {
    isListening,
    recognitionText,
    startListening,
    stopListening,
    resetRecognitionText,
    isSpeaking,
    speakText,
    cancelSpeech
  } = useWebSpeech();

  const [enableTts, setEnableTts] = useState<boolean>(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 當語音辨識有文字產出時，填入輸入框
  useEffect(() => {
    if (recognitionText) {
      setInputText(recognitionText);
    }
  }, [recognitionText]);

  // 同步當前登入者 ID
  useEffect(() => {
    if (currentUser?.id) {
      setUserId(currentUser.id);
    }
  }, [currentUser]);

  // 自動滾動對話框
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // 取得當前選定個案
  const currentCase = caseProfiles.find(c => c.case_id === selectedCaseId) || caseProfiles[0];

  // 啟動訪談場次
  const handleStartSession = async () => {
    setIsThinking(true);
    try {
      const res = await apiClient.startSession(userId, selectedCaseId, selectedDuration);
      setSessionId(res.sessionId);
      setTrustScore(res.initialTrust);
      setDefenseScore(res.initialDefense);
      setRapportScore(50);
      setEmotionTag('neutral');
      setIsSessionActive(true);

      const initialMsg: Message = {
        id: `msg_${Date.now()}`,
        sender: 'npc',
        text: res.initialNpcReply,
        timestamp: new Date(),
        emotionTag: 'neutral'
      };
      setMessages([initialMsg]);

      if (enableTts) {
        speakText(res.initialNpcReply);
      }
    } catch (e) {
      console.error('啟動場次失敗', e);
    } finally {
      setIsThinking(false);
    }
  };

  // 發送對話訊息
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || !sessionId || isThinking) return;

    if (isListening) {
      stopListening();
    }
    resetRecognitionText();
    setInputText('');

    const userMsg: Message = {
      id: `msg_u_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date(),
      inputMode: isListening ? 'voice' : 'text'
    };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const reply = await apiClient.sendChat(
        sessionId,
        text,
        userMsg.inputMode || 'text',
        Math.max(2, Math.round(text.length * 0.2))
      );

      setTrustScore(reply.trust_score);
      setDefenseScore(reply.defense_score);
      setRapportScore(reply.current_rapport_score);
      setEmotionTag(reply.npc_emotion_tag);

      if (reply.information_progress) {
        setChecklist({
          child_function: reply.information_progress.child_function_score,
          daily_routine: reply.information_progress.daily_routine_score,
          family_needs: reply.information_progress.family_needs_score,
          strengths_resources: reply.information_progress.strengths_resources_score
        });
      }

      const npcMsg: Message = {
        id: `msg_npc_${Date.now()}`,
        sender: 'npc',
        text: reply.npc_reply,
        timestamp: new Date(),
        emotionTag: reply.npc_emotion_tag,
        scoreChange: reply.rapport_score_change,
        reasoning: reply.ai_reasoning
      };
      setMessages(prev => [...prev, npcMsg]);

      if (enableTts && reply.npc_reply) {
        speakText(reply.npc_reply);
      }
    } catch (e) {
      console.error('發送對話失敗', e);
    } finally {
      setIsThinking(false);
    }
  };

  // 結束場次並結算評分
  const handleEndSession = async () => {
    if (!sessionId || isEnding) return;
    setIsEnding(true);
    cancelSpeech();

    try {
      const report = await apiClient.endSession(sessionId, 600);
      setIsSessionActive(false);
      if (onSessionEnded) {
        onSessionEnded(sessionId);
      }
    } catch (e) {
      console.error('結算失敗', e);
    } finally {
      setIsEnding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 頂部控制面板 */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-sky-400" />
            VR/網頁雙模訪談互動訓練器 (Interactive Simulator)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            可直接於瀏覽器模擬 Unity VR 學員發話、測試 8 個家庭劇本、語音辨識與即時情緒防衛反饋
          </p>
        </div>

        {/* 場次狀態列 */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEnableTts(!enableTts)}
            className={`p-2 rounded-xl border text-xs flex items-center gap-1.5 transition-colors ${
              enableTts
                ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title="NPC 語音朗讀開關"
          >
            {enableTts ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{enableTts ? '語音朗讀開啟' : '語音靜音'}</span>
          </button>

          {isSessionActive && (
            <button
              onClick={handleEndSession}
              disabled={isEnding}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {isEnding ? '結算評分中...' : '結束訪談並進行 AI 結算'}
            </button>
          )}
        </div>
      </div>

      {!isSessionActive ? (
        /* 未開始：個案與時長選擇設定卡 */
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-3xl mx-auto space-y-6">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white">啟動新的訪談訓練場次</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              請選擇本次欲訓練的家庭劇本、訪談規劃時長與學員身分
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 登入者身分 (由 Supabase 統一認證，避免竄改) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>受訓學員身分 (Supabase 認證)</span>
                <span className="text-[10px] text-emerald-400 font-mono">● 已綁定登入者</span>
              </label>
              <div className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></div>
                  <span className="font-semibold text-white truncate">
                    {currentUser?.name || '已認證學員'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono truncate hidden sm:inline">
                    ({currentUser?.id || userId})
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] bg-sky-500/10 text-sky-300 border border-sky-500/30 shrink-0 font-bold">
                  {currentUser?.role === 'owner' || currentUser?.role === 'assistant' ? '督導身分' : '學員身分'}
                </span>
              </div>
            </div>

            {/* 時長設定 */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                規劃訪談時長 (動態權重規準)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['30', '60', '90'] as const).map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDuration(d)}
                    className={`py-2 text-xs rounded-xl font-bold border transition-all ${
                      selectedDuration === d
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {d} 分鐘
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 8 大家庭劇本選擇 */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              選擇 8 大家庭劇本 (Persona 1 ~ 8)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
              {caseProfiles.map((c) => (
                <div
                  key={c.case_id}
                  onClick={() => setSelectedCaseId(c.case_id)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    selectedCaseId === c.case_id
                      ? 'bg-sky-950/40 border-sky-500 text-white shadow-md shadow-sky-500/10'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-200">{c.persona_name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-400">
                      {c.case_id}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {c.background_prompt}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
                    <span>初始信任: {c.initial_trust}%</span>
                    <span>初始防衛: {c.initial_defense}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 啟動按鈕 */}
          <button
            onClick={handleStartSession}
            disabled={isThinking}
            className="w-full py-3 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-sky-600/25 transition-all cursor-pointer disabled:opacity-50"
          >
            {isThinking ? '場次初始化中...' : '開始模擬家庭訪談'}
          </button>
        </div>
      ) : (
        /* 已開始：對話與狀態面板 */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 左側對話歷程 (8 欄) */}
          <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col h-[620px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div>
                <span className="text-xs text-sky-400 font-bold">{currentCase.persona_name}</span>
                <p className="text-[11px] text-slate-400 truncate max-w-md">
                  隱藏痛點：{currentCase.hidden_pain_point}
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                時長：{selectedDuration}分鐘
              </span>
            </div>

            {/* 滾動訊息區 */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {messages.map((m) => {
                const isUser = m.sender === 'user';
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
                  >
                    <span className="text-[11px] text-slate-400 px-1 font-semibold">
                      {isUser ? '我 (受訓人員)' : currentCase.persona_name}
                    </span>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        isUser
                          ? 'bg-sky-600 text-white rounded-tr-none'
                          : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
                      }`}
                    >
                      <p>{m.text}</p>
                    </div>

                    {!isUser && m.scoreChange !== undefined && (
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 px-1">
                        <span>
                          關係變動: 
                          <span className={m.scoreChange >= 0 ? 'text-emerald-400 font-bold ml-1' : 'text-rose-400 font-bold ml-1'}>
                            {m.scoreChange >= 0 ? `+${m.scoreChange}` : m.scoreChange}
                          </span>
                        </span>
                        {m.reasoning && (
                          <span className="italic text-slate-500 truncate max-w-xs">
                            ({m.reasoning})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {isThinking && (
                <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
                  <div className="w-3 h-3 bg-sky-400 rounded-full animate-ping"></div>
                  <span>家長 NPC 正在思考反應中...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 輸入控制列 */}
            <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isListening) stopListening();
                  else startListening();
                }}
                className={`p-2.5 rounded-xl border transition-all ${
                  isListening
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
                title="語音輸入 (Web Speech STT)"
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
                placeholder="請輸入家訪提問（例：平常早上的時候，小A大概是怎麼樣的作息呢？）..."
                className="flex-1 bg-slate-950 border border-slate-800 focus:border-sky-500 text-slate-200 text-xs rounded-xl px-4 py-2.5 outline-none transition-colors"
              />

              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isThinking}
                className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>發送</span>
              </button>
            </div>
          </div>

          {/* 右側心理狀態與進度儀表 (4 欄) */}
          <div className="lg:col-span-4 space-y-4">
            {/* NPC 心理狀態 */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl text-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-white">家長心理狀態儀表</span>
                <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                  emotionTag === 'relaxed'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : emotionTag === 'defensive'
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-slate-700 text-slate-300'
                }`}>
                  {emotionTag.toUpperCase()}
                </span>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>信任度 (Trust)</span>
                  <span className="font-mono text-emerald-400 font-bold">{trustScore}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${trustScore}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>防衛度 (Defense)</span>
                  <span className="font-mono text-rose-400 font-bold">{defenseScore}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-rose-500 h-full rounded-full transition-all" style={{ width: `${defenseScore}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>關係分數 (Rapport)</span>
                  <span className="font-mono text-amber-400 font-bold">{rapportScore}</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full transition-all" style={{ width: `${rapportScore}%` }} />
                </div>
              </div>
            </div>

            {/* 四大範疇資訊盤點 */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl text-xs space-y-3">
              <span className="font-bold text-white block border-b border-slate-800 pb-2">
                IFSP 四大範疇收集進度
              </span>
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>兒童功能表現</span>
                  <span className="font-mono text-sky-400">{checklist.child_function}%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-sky-500 h-full rounded-full" style={{ width: `${checklist.child_function}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>日常作息活動</span>
                  <span className="font-mono text-indigo-400">{checklist.daily_routine}%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${checklist.daily_routine}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>家庭需求與照顧壓力</span>
                  <span className="font-mono text-emerald-400">{checklist.family_needs}%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${checklist.family_needs}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>家庭優勢與資源</span>
                  <span className="font-mono text-amber-400">{checklist.strengths_resources}%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${checklist.strengths_resources}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
