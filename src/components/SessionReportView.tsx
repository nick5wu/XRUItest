import React, { useState, useEffect } from 'react';
import { 
  Award, 
  FileText, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  Filter, 
  Sparkles, 
  ArrowRight,
  BookOpen,
  User,
  HeartHandshake,
  Download
} from 'lucide-react';
import { apiClient, ApiSessionFullDetail, ApiSession } from '../services/apiClient';
import { RadarChart, RadarDimension } from './RadarChart';

interface SessionReportViewProps {
  initialSessionId?: string;
  onGoToReview?: (sessionId: string) => void;
}

export const SessionReportView: React.FC<SessionReportViewProps> = ({
  initialSessionId,
  onGoToReview
}) => {
  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(initialSessionId || '');
  const [detail, setDetail] = useState<ApiSessionFullDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'risk' | 'repair' | 'routine'>('all');

  useEffect(() => {
    apiClient.getSessions().then(list => {
      setSessions(list);
      if (!selectedSessionId && list.length > 0) {
        setSelectedSessionId(list[0].session_id);
      }
    });
  }, []);

  useEffect(() => {
    if (initialSessionId) {
      setSelectedSessionId(initialSessionId);
    }
  }, [initialSessionId]);

  useEffect(() => {
    if (selectedSessionId) {
      setIsLoading(true);
      apiClient.getSessionDetail(selectedSessionId).then(data => {
        setDetail(data);
      }).finally(() => setIsLoading(false));
    }
  }, [selectedSessionId]);

  const aiScores = detail?.aiScores;
  const currentSession = detail?.session;
  const currentCase = detail?.caseProfile;

  // 六大面向雷達圖維度配置 (100分制)
  const radarDimensions: RadarDimension[] = [
    {
      key: 'd1',
      name: '開場與關係建立',
      score: aiScores?.dimension_1_rapport || 0,
      max: 15,
      supervisorScore: detail?.supervisorScores?.dimension_1_rapport
    },
    {
      key: 'd2',
      name: '提問技巧與作息本位',
      score: aiScores?.dimension_2_questioning || 0,
      max: 25,
      supervisorScore: detail?.supervisorScores?.dimension_2_questioning
    },
    {
      key: 'd3',
      name: '同理敏感度與非評價',
      score: aiScores?.dimension_3_empathy || 0,
      max: 20,
      supervisorScore: detail?.supervisorScores?.dimension_3_empathy
    },
    {
      key: 'd4',
      name: '家庭中心與優勢導向',
      score: aiScores?.dimension_4_family_centered || 0,
      max: 15,
      supervisorScore: detail?.supervisorScores?.dimension_4_family_centered
    },
    {
      key: 'd5',
      name: 'IFSP前置資訊完整度',
      score: aiScores?.dimension_5_ifsp_info || 0,
      max: 20,
      supervisorScore: detail?.supervisorScores?.dimension_5_ifsp_info
    },
    {
      key: 'd6',
      name: '時間任務完成與組織',
      score: aiScores?.dimension_6_time_mgmt || 0,
      max: 5,
      supervisorScore: detail?.supervisorScores?.dimension_6_time_mgmt
    }
  ];

  // 微觀時間軸資料計算
  let cumulativeSeconds = 0;
  const timelineItems = (detail?.utterances || []).map((u, i) => {
    const ann = detail?.annotations?.find(a => a.utterance_id === u.utterance_id);
    const log = detail?.npcLogs?.[Math.min(i, (detail?.npcLogs?.length || 1) - 1)];
    const sec = cumulativeSeconds;
    cumulativeSeconds += (u.speech_duration || 2) + 2;

    const isRisk = Boolean(ann?.risk_tag);
    const isRepair = (ann?.empathy_level || 0) >= 2;
    const isRoutine = ann?.question_type === 'routine_based';

    return {
      index: i + 1,
      seconds: sec,
      speaker: u.speaker,
      text: u.text,
      ann,
      log,
      isRisk,
      isRepair,
      isRoutine,
      timeFormatted: `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
    };
  });

  // 篩選時間軸
  const filteredTimeline = timelineItems.filter(item => {
    if (timelineFilter === 'risk') return item.isRisk;
    if (timelineFilter === 'repair') return item.isRepair;
    if (timelineFilter === 'routine') return item.isRoutine;
    return true;
  });

  const totalScore = aiScores?.total_score ?? (currentSession?.final_score || 0);

  // 評級判定
  let gradeBadge = { text: '尚未結算', color: 'bg-slate-700 text-slate-300' };
  if (aiScores) {
    if (totalScore >= 90) gradeBadge = { text: '卓越 (A+)', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
    else if (totalScore >= 80) gradeBadge = { text: '優良 (A)', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40' };
    else if (totalScore >= 70) gradeBadge = { text: '合格 (B)', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
    else gradeBadge = { text: '需加強 (C)', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' };
  }

  return (
    <div className="space-y-6">
      {/* 頂部切換與匯出列 */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">
              單次訪談深度評估報告 (Session Detailed Report)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              國科會研究計畫 IFSP 六大能力面向 100 分制診斷與 LSA 序列微觀分析
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-purple-500"
          >
            {sessions.map((s) => (
              <option key={s.session_id} value={s.session_id}>
                {s.session_id.substring(0, 16)}... ({s.case_id}) - {s.status === 'completed' ? '已結算' : '進行中'}
              </option>
            ))}
          </select>

          {/* 匯出本場次 LSA CSV */}
          <a
            href={apiClient.getLsaExportUrl(selectedSessionId)}
            download
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>匯出本場 LSA CSV</span>
          </a>

          {onGoToReview && selectedSessionId && (
            <button
              onClick={() => onGoToReview(selectedSessionId)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all"
            >
              <span>進入督導覆評</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <span>正在讀取並解析全場次對話與評估報告...</span>
        </div>
      ) : !detail ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          請選擇上方訓練場次以檢視完整評估報告
        </div>
      ) : (
        <>
          {/* 核心成績摘要卡片 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* 左側：總分與面向得分進度條 (7 欄寬) */}
            <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4">
                  <div>
                    <span className="text-xs text-slate-400">學員：{detail.user?.name || currentSession?.user_id}</span>
                    <h3 className="text-lg font-bold text-white mt-0.5">
                      {currentCase?.persona_name || currentSession?.case_id}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      訪談設定時長：{currentSession?.selected_duration} 分鐘 | 總發話對話：{detail.utterances.length} 句
                    </p>
                  </div>

                  {/* 總分圓形大標籤 */}
                  <div className="text-right">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border mb-1 ${gradeBadge.color}`}>
                      {gradeBadge.text}
                    </span>
                    <div className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-300 to-purple-400 font-mono">
                      {totalScore} <span className="text-sm text-slate-400 font-sans">/ 100 分</span>
                    </div>
                  </div>
                </div>

                {/* 六大面向細項條列 */}
                <div className="space-y-3.5">
                  {radarDimensions.map((dim) => {
                    const pct = Math.round((dim.score / dim.max) * 100);
                    return (
                      <div key={dim.key} className="text-xs">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-slate-300 font-medium">{dim.name}</span>
                          <span className="font-mono text-slate-200">
                            <span className="text-sky-400 font-bold">{dim.score}</span> / {dim.max} 分
                            <span className="text-slate-500 ml-1.5">({pct}%)</span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-sky-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 總結講評 */}
              {aiScores?.feedback_comments && (
                <div className="mt-5 p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs text-slate-300 leading-relaxed">
                  <div className="flex items-center gap-1.5 text-purple-300 font-bold mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>AI 督導綜合講評</span>
                  </div>
                  <p>{aiScores.feedback_comments}</p>
                </div>
              )}
            </div>

            {/* 右側：六大能力面向雷達圖 (5 欄寬) */}
            <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col items-center justify-center">
              <h4 className="text-sm font-bold text-white mb-2 self-start flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-sky-400" />
                六大面向能力雷達剖面
              </h4>
              <p className="text-xs text-slate-400 mb-4 self-start">
                評估學員在關係破冰、作息本位提問、同理心與前置資訊盤點之均衡性
              </p>
              <RadarChart 
                dimensions={radarDimensions} 
                size={290} 
                showSupervisor={Boolean(detail.supervisorScores)}
              />
            </div>
          </div>

          {/* AI 診斷亮點：最佳問句與建議替換問句 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 最佳問句 */}
            <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>全場最佳提問 (Best Question)</span>
              </div>
              <blockquote className="p-3 bg-slate-950/60 border-l-4 border-emerald-500 rounded-r-xl text-xs text-slate-200 italic mb-2">
                "{aiScores?.best_question || '（尚未選出）'}"
              </blockquote>
              <p className="text-xs text-slate-400">
                <span className="text-emerald-300 font-semibold">推薦原因：</span>
                {aiScores?.best_question_reason || '能敏銳顧及家長照顧辛勞，並自然引導作息情境探索。'}
              </p>
            </div>

            {/* 踩雷/建議替換問句 */}
            <div className="bg-slate-900/90 border border-rose-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span>最需優化問句與改寫示範 (Growth Advice)</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 bg-rose-950/30 border border-rose-800/40 rounded-xl text-rose-200 line-through opacity-80">
                  原句："{aiScores?.suboptimal_question || '（尚無踩雷語句）'}"
                </div>
                <div className="flex items-center gap-1.5 text-purple-300 font-semibold pt-1">
                  <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
                  <span>建議改寫為作息/同理本位問句：</span>
                </div>
                <div className="p-2.5 bg-purple-950/30 border border-purple-800/40 rounded-xl text-purple-100 font-medium">
                  "{aiScores?.suggested_alternative || '「平常在跟小A互動時，您覺得什麼時候是他最自在的狀態呢？」'}"
                </div>
              </div>
            </div>
          </div>

          {/* 逐字稿微觀時間軸 (LSA Timeline) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 mb-4 gap-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-white">
                  逐字稿微觀時間軸 (LSA Micro-Timeline)
                </h3>
              </div>

              {/* 篩選標籤 */}
              <div className="flex items-center gap-1.5 text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
                <button
                  onClick={() => setTimelineFilter('all')}
                  className={`px-2.5 py-1 rounded-lg border transition-all ${
                    timelineFilter === 'all'
                      ? 'bg-slate-700 text-white border-slate-600'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200'
                  }`}
                >
                  全部對話 ({timelineItems.length})
                </button>
                <button
                  onClick={() => setTimelineFilter('risk')}
                  className={`px-2.5 py-1 rounded-lg border transition-all ${
                    timelineFilter === 'risk'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200'
                  }`}
                >
                  踩雷點 (防衛飆升/評價)
                </button>
                <button
                  onClick={() => setTimelineFilter('repair')}
                  className={`px-2.5 py-1 rounded-lg border transition-all ${
                    timelineFilter === 'repair'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200'
                  }`}
                >
                  關係修復點 (同理)
                </button>
                <button
                  onClick={() => setTimelineFilter('routine')}
                  className={`px-2.5 py-1 rounded-lg border transition-all ${
                    timelineFilter === 'routine'
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200'
                  }`}
                >
                  作息提問
                </button>
              </div>
            </div>

            {/* 時間軸條目列表 */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredTimeline.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  此篩選條件下無任何相符發話記錄
                </div>
              ) : (
                filteredTimeline.map((item) => {
                  const isUser = item.speaker === 'user';
                  return (
                    <div
                      key={item.index}
                      className={`p-3 rounded-xl border text-xs transition-all ${
                        item.isRisk
                          ? 'bg-rose-950/20 border-rose-800/50'
                          : item.isRepair
                          ? 'bg-emerald-950/20 border-emerald-800/50'
                          : 'bg-slate-800/40 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sky-400 font-bold">
                            [{item.timeFormatted}]
                          </span>
                          <span className={isUser ? 'text-sky-300 font-semibold' : 'text-amber-300 font-semibold'}>
                            {isUser ? '學員' : '家長 NPC'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span>信任: {item.log?.trust_score ?? 50}</span>
                          <span>防衛: {item.log?.defense_score ?? 50}</span>
                        </div>
                      </div>

                      <p className="text-slate-200 text-xs leading-relaxed">{item.text}</p>

                      {/* 標籤小列 */}
                      {isUser && item.ann && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {item.ann.question_type !== 'none' && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                              {item.ann.question_type}
                            </span>
                          )}
                          {item.ann.empathy_level > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px]">
                              同理 Lv.{item.ann.empathy_level}
                            </span>
                          )}
                          {item.ann.risk_tag && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                              ⚠️ {item.ann.risk_tag}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
