import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  RefreshCw, 
  Radio, 
  AlertTriangle, 
  ShieldCheck, 
  HelpCircle, 
  Package, 
  Clock, 
  User, 
  Heart,
  ChevronRight,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { apiClient, ApiSessionFullDetail, ApiSession } from '../services/apiClient';
import { DynamicStateChart, StatePoint } from './DynamicStateChart';

interface LiveMonitorViewProps {
  onSelectSessionForReport?: (sessionId: string) => void;
  onSelectSessionForReview?: (sessionId: string) => void;
}

export const LiveMonitorView: React.FC<LiveMonitorViewProps> = ({
  onSelectSessionForReport,
  onSelectSessionForReview,
}) => {
  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [sessionDetail, setSessionDetail] = useState<ApiSessionFullDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // 載入全場次清單
  const loadSessions = async () => {
    try {
      const list = await apiClient.getSessions();
      setSessions(list);
      // 若當前沒有選取場次，預設選取第一個進行中 (active) 或最新的場次
      if (!selectedSessionId && list.length > 0) {
        const active = list.find(s => s.status === 'active');
        setSelectedSessionId(active ? active.session_id : list[0].session_id);
      }
    } catch (e) {
      console.error('載入場次清單錯誤', e);
    }
  };

  // 載入選定場次明細
  const loadDetail = async (sessionId: string) => {
    if (!sessionId) return;
    try {
      const data = await apiClient.getSessionDetail(sessionId);
      if (data) {
        setSessionDetail(data);
        setLastRefreshedAt(new Date());
      }
    } catch (e) {
      console.error('載入場次細節失敗', e);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      setIsLoading(true);
      loadDetail(selectedSessionId).finally(() => setIsLoading(false));
    }
  }, [selectedSessionId]);

  // 自動輪詢 (每 3 秒刷新鏡像)
  useEffect(() => {
    if (!isAutoRefresh || !selectedSessionId) return;
    const interval = setInterval(() => {
      loadDetail(selectedSessionId);
    }, 3000);
    return () => clearInterval(interval);
  }, [isAutoRefresh, selectedSessionId]);

  // 自動滾動逐字稿至底部
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sessionDetail?.utterances]);

  // 轉換 NPC 狀態軌跡點給圖表
  const chartData: StatePoint[] = (sessionDetail?.npcLogs || []).map((log, idx) => ({
    index: idx + 1,
    trust: log.trust_score,
    defense: log.defense_score,
    rapport: log.rapport_score,
    label: `第 ${idx + 1} 輪`
  }));

  const checklist = sessionDetail?.checklist || {
    child_function_score: 15,
    daily_routine_score: 10,
    family_needs_score: 10,
    strengths_resources_score: 10
  };

  const currentSession = sessionDetail?.session || sessions.find(s => s.session_id === selectedSessionId);
  const currentCase = sessionDetail?.caseProfile;

  return (
    <div className="space-y-6">
      {/* 頂部操作與場次選擇欄 */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-500/10 border border-sky-500/30 rounded-xl text-sky-400">
            <Radio className="w-5 h-5 animate-pulse text-sky-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                VR 訓練場次即時鏡像監看 (Live Mirror)
              </h2>
              {currentSession?.status === 'active' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  正在進行中
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-700/60 text-slate-300 border border-slate-600">
                  已結算完成
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              同步連線 Unity VR 頭盔學員對話、逐字語意標記與 NPC 心理防衛走勢
            </p>
          </div>
        </div>

        {/* 場次選擇器與控制 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 whitespace-nowrap">選擇場次:</span>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-sky-500 max-w-xs transition-colors"
            >
              {sessions.length === 0 ? (
                <option value="">（尚無場次，請啟動訓練）</option>
              ) : (
                sessions.map((s) => (
                  <option key={s.session_id} value={s.session_id}>
                    [{s.status === 'active' ? '🟢 進行中' : '⚪ 已結束'}] {s.session_id.substring(0, 16)}... (個案: {s.case_id})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 自動刷新按鈕 */}
          <button
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border transition-all ${
              isAutoRefresh
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="開關即時自動輪詢"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAutoRefresh ? 'animate-spin' : ''}`} />
            <span>{isAutoRefresh ? '即時鏡像中' : '暫停輪詢'}</span>
          </button>

          {/* 手動刷新 */}
          <button
            onClick={() => {
              if (selectedSessionId) loadDetail(selectedSessionId);
            }}
            disabled={isLoading}
            className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 transition-colors"
            title="手動立即刷新"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 場次基本資訊卡 */}
      {currentSession && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[11px] text-slate-400 font-medium">受訓學員</span>
            <div className="flex items-center gap-2 mt-1">
              <User className="w-4 h-4 text-sky-400" />
              <span className="text-sm font-bold text-white font-mono">
                {currentSession.user_id}
              </span>
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[11px] text-slate-400 font-medium">訪談家庭劇本</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-bold text-sky-300 truncate">
                {currentCase?.persona_name || currentSession.case_id}
              </span>
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[11px] text-slate-400 font-medium">設定時長 / 當前關係</span>
            <div className="flex items-center gap-2 mt-1">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-slate-200">
                {currentSession.selected_duration} 分鐘
              </span>
              <span className="text-xs text-amber-400 font-mono ml-auto">
                關係分: {currentSession.final_score ?? 50}
              </span>
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-medium">求助 / 盤點次數</span>
              <div className="flex items-center gap-3 mt-1 text-xs">
                <span className="flex items-center gap-1 text-slate-300">
                  <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                  求助: {currentSession.help_count || 0}
                </span>
                <span className="flex items-center gap-1 text-slate-300">
                  <Package className="w-3.5 h-3.5 text-purple-400" />
                  盤點: {currentSession.inventory_count || 0}
                </span>
              </div>
            </div>
            {currentSession.status === 'completed' && onSelectSessionForReport && (
              <button
                onClick={() => onSelectSessionForReport(currentSession.session_id)}
                className="px-2.5 py-1 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors flex items-center gap-1"
              >
                看報告 <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 主監控區塊：左側即時逐字稿流，右側 NPC 狀態折線圖與四大範疇進度 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 左側：即時逐字稿流 (7 欄寬) */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col h-[640px] shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-bold text-white">
                即時逐字稿對話流 (Live Transcript)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              總發話句數: {sessionDetail?.utterances?.length || 0}
            </span>
          </div>

          {/* 逐字稿訊息滾動區 */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {!sessionDetail || sessionDetail.utterances.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                <span>等待對話發話中...請學員在 VR 內或訓練模擬器開始提問</span>
              </div>
            ) : (
              sessionDetail.utterances.map((u, idx) => {
                const isUser = u.speaker === 'user';
                const ann = sessionDetail.annotations?.find(a => a.utterance_id === u.utterance_id);

                return (
                  <div
                    key={u.id || u.utterance_id || idx}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
                  >
                    {/* 發話者標籤與時間 */}
                    <div className="flex items-center gap-2 px-1 text-[11px] text-slate-400">
                      <span className={`font-semibold ${isUser ? 'text-sky-400' : 'text-amber-400'}`}>
                        {isUser ? '學員 (Trainee)' : '家長 (Parent NPC)'}
                      </span>
                      {u.input_mode && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-400">
                          {u.input_mode === 'voice' ? '🎙️ 語音' : '⌨️ 文字'}
                        </span>
                      )}
                    </div>

                    {/* 對話氣泡 */}
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-md ${
                        isUser
                          ? 'bg-sky-600/90 text-white rounded-tr-none border border-sky-400/30'
                          : 'bg-slate-800/90 text-slate-100 rounded-tl-none border border-slate-700'
                      }`}
                    >
                      <p>{u.text}</p>
                    </div>

                    {/* 學員發言之 AI 語意標記 Badges */}
                    {isUser && ann && (
                      <div className="flex flex-wrap items-center gap-1.5 justify-end max-w-[90%] pt-0.5">
                        {/* 提問類型 */}
                        {ann.question_type === 'open' && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            開放式提問
                          </span>
                        )}
                        {ann.question_type === 'routine_based' && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-indigo-500/25 text-indigo-300 border border-indigo-500/40">
                            作息本位提問 (Routine)
                          </span>
                        )}
                        {ann.question_type === 'closed' && (
                          <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-slate-700/50 text-slate-300 border border-slate-600">
                            封閉式提問
                          </span>
                        )}

                        {/* 同理心層級 */}
                        {ann.empathy_level > 0 && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <Heart className="w-2.5 h-2.5" />
                            同理回應 Lv.{ann.empathy_level}
                          </span>
                        )}

                        {/* 風險標籤 */}
                        {ann.risk_tag && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {ann.risk_tag === 'judgment' && '評價式語句'}
                            {ann.risk_tag === 'blame' && '責備式語句'}
                            {ann.risk_tag === 'premature_advice' && '過早給予建議'}
                          </span>
                        )}

                        {/* 四大範疇領域 */}
                        {ann.domain_tag && ann.domain_tag !== 'other' && (
                          <span className="px-1.5 py-0.5 text-[9px] rounded bg-slate-800 text-slate-400 border border-slate-700">
                            #{ann.domain_tag}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* 右側：NPC 動態心理圖表 + IFSP 四大範疇資訊盤點進度條 (5 欄寬) */}
        <div className="lg:col-span-5 flex flex-col space-y-6">
          
          {/* 1. NPC 狀態動態折線圖 */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  NPC 心理狀態動態走勢
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">
                更新於: {lastRefreshedAt.toLocaleTimeString()}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              即時追蹤家長信任度 (綠) 是否穩定爬升，並防範防衛度 (紅) 異常飆升。
            </p>
            <DynamicStateChart data={chartData} height={200} />
          </div>

          {/* 2. IFSP 四大範疇資訊盤點進度條 */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-bold text-white">
                    IFSP 前置四大範疇資訊收集達成率
                  </h3>
                </div>
                <span className="text-xs font-bold text-purple-400">
                  綜合：
                  {Math.round(
                    ((checklist.child_function_score || 0) +
                      (checklist.daily_routine_score || 0) +
                      (checklist.family_needs_score || 0) +
                      (checklist.strengths_resources_score || 0)) /
                      4
                  )}
                  %
                </span>
              </div>

              {/* 四大領域進度條列表 */}
              <div className="space-y-4 text-xs">
                {/* 1. 兒童功能表現 */}
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span className="font-medium">1. 兒童功能表現 (Child Function)</span>
                    <span className="font-mono text-sky-400 font-bold">
                      {checklist.child_function_score}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, checklist.child_function_score)}%` }}
                    />
                  </div>
                </div>

                {/* 2. 日常作息活動 */}
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span className="font-medium">2. 日常生活作息活動 (Daily Routine)</span>
                    <span className="font-mono text-indigo-400 font-bold">
                      {checklist.daily_routine_score}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, checklist.daily_routine_score)}%` }}
                    />
                  </div>
                </div>

                {/* 3. 家庭主要需求 */}
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span className="font-medium">3. 家庭照顧壓力與需求 (Family Needs)</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {checklist.family_needs_score}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, checklist.family_needs_score)}%` }}
                    />
                  </div>
                </div>

                {/* 4. 家庭優勢與資源 */}
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span className="font-medium">4. 家庭優勢與自然支持資源 (Strengths)</span>
                    <span className="font-mono text-amber-400 font-bold">
                      {checklist.strengths_resources_score}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, checklist.strengths_resources_score)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 底部快速操作 */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>狀態: 連線穩定 (Unity VR 串接就緒)</span>
              {currentSession && onSelectSessionForReview && (
                <button
                  onClick={() => onSelectSessionForReview(currentSession.session_id)}
                  className="text-sky-400 hover:text-sky-300 font-medium underline flex items-center gap-1"
                >
                  切換至督導覆評介面 &gt;
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
