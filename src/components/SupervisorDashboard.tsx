import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Search, 
  FileText, 
  TrendingUp, 
  ShieldAlert, 
  User, 
  RotateCcw, 
  X, 
  Save, 
  BookOpen, 
  Award, 
  Activity,
  ChevronRight
} from 'lucide-react';
import { 
  getAllTrainingSessionsFromFirestore, 
  getSessionFullDetailsFromFirestore, 
  saveSupervisorScoreToFirestore,
  TrainingSessionRecord,
  UtteranceRecord,
  NPCStateLogRecord,
  AIScoresRecord,
  SelfReflectionRecord,
  SupervisorScoreRecord 
} from '../services/firebaseService';

interface SupervisorDashboardProps {
  onBackToTraining?: () => void;
}

export default function SupervisorDashboard({ onBackToTraining }: SupervisorDashboardProps) {
  const [sessions, setSessions] = useState<(TrainingSessionRecord & { sensitive_triggered?: boolean })[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'reviewed' | 'warning'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 覆核 Modal 相關狀態
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<{
    utterances: UtteranceRecord[];
    npc_state_logs: NPCStateLogRecord[];
    ai_scores: AIScoresRecord;
    self_reflections: SelfReflectionRecord | null;
    supervisor_scores: SupervisorScoreRecord | null;
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  // 督導編輯表單狀態
  const [editScores, setEditScores] = useState<{
    relationship_score: number;
    questioning_score: number;
    empathy_score: number;
    family_centered_score: number;
    information_score: number;
    time_score: number;
  }>({
    relationship_score: 50,
    questioning_score: 50,
    empathy_score: 50,
    family_centered_score: 50,
    information_score: 50,
    time_score: 50
  });

  const [supervisorComments, setSupervisorComments] = useState<string>('');
  const [requiredRepractice, setRequiredRepractice] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string>('');

  // 載入全體場次
  const fetchSessions = async () => {
    setLoading(true);
    const data = await getAllTrainingSessionsFromFirestore();
    setSessions(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  // 開啟覆核 Modal
  const handleOpenReviewModal = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsModalOpen(true);
    setIsLoadingDetails(true);
    setSubmitSuccessMsg('');

    const details = await getSessionFullDetailsFromFirestore(sessionId);
    setSessionDetails(details);

    // 帶入初始評分 (若有已寫入的督導評分則優先帶入，否則帶入 AI 評分)
    if (details.supervisor_scores) {
      setEditScores({
        relationship_score: details.supervisor_scores.relationship_score,
        questioning_score: details.supervisor_scores.questioning_score,
        empathy_score: details.supervisor_scores.empathy_score,
        family_centered_score: details.supervisor_scores.family_centered_score,
        information_score: details.supervisor_scores.information_score,
        time_score: details.supervisor_scores.time_score,
      });
      setSupervisorComments(details.supervisor_scores.supervisor_comments || '');
      setRequiredRepractice(details.supervisor_scores.required_repractice || false);
    } else if (details.ai_scores) {
      setEditScores({
        relationship_score: details.ai_scores.relationship_score,
        questioning_score: details.ai_scores.questioning_score,
        empathy_score: details.ai_scores.empathy_score,
        family_centered_score: details.ai_scores.family_centered_score,
        information_score: details.ai_scores.information_score,
        time_score: details.ai_scores.time_score,
      });
      setSupervisorComments(details.ai_scores.evaluation_summary ? `[基於 AI 建議] ${details.ai_scores.evaluation_summary}` : '');
      setRequiredRepractice(false);
    }

    setIsLoadingDetails(false);
  };

  // 計算督導覆核總分 (權重: 15%, 25%, 20%, 15%, 20%, 5%)
  const calculatedTotalScore = Math.round(
    editScores.relationship_score * 0.15 +
    editScores.questioning_score * 0.25 +
    editScores.empathy_score * 0.20 +
    editScores.family_centered_score * 0.15 +
    editScores.information_score * 0.20 +
    editScores.time_score * 0.05
  );

  // 提交督導覆核
  const handleSubmitReview = async () => {
    if (!selectedSessionId) return;
    setIsSubmitting(true);

    const scoreData: Omit<SupervisorScoreRecord, 'timestamp'> = {
      session_id: selectedSessionId,
      supervisor_id: 'supervisor_prof_01',
      relationship_score: editScores.relationship_score,
      questioning_score: editScores.questioning_score,
      empathy_score: editScores.empathy_score,
      family_centered_score: editScores.family_centered_score,
      information_score: editScores.information_score,
      time_score: editScores.time_score,
      total_score: calculatedTotalScore,
      supervisor_comments: supervisorComments,
      required_repractice: requiredRepractice,
    };

    await saveSupervisorScoreToFirestore(scoreData);
    setIsSubmitting(false);
    setSubmitSuccessMsg('督導審核與覆核評分已成功儲存！');

    // 更新本地狀態
    setSessions(prev => prev.map(s => {
      if (s.sessionId === selectedSessionId) {
        return {
          ...s,
          supervisor_review_status: 'reviewed',
          required_repractice: requiredRepractice
        };
      }
      return s;
    }));

    setTimeout(() => {
      setSubmitSuccessMsg('');
    }, 3000);
  };

  // 篩選高風險預警場次 (finalRapportScore < 30 或 sensitive_triggered === true)
  const warningSessions = sessions.filter(s => (s.finalRapportScore !== undefined && s.finalRapportScore < 30) || s.sensitive_triggered);

  // 依 Tab 及搜尋字串篩選場次
  const filteredSessions = sessions.filter(s => {
    const matchesSearch = 
      (s.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.selectedFamilyCase || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.sessionId || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'pending') return s.supervisor_review_status === 'pending';
    if (activeTab === 'reviewed') return s.supervisor_review_status === 'reviewed';
    if (activeTab === 'warning') return (s.finalRapportScore !== undefined && s.finalRapportScore < 30) || s.sensitive_triggered;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      {/* 頂部 Header 與標題 */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/30 border border-indigo-500/40 rounded-xl text-indigo-400">
              <Award className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">
                督導與教授審核後台
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                IFSP 前置家庭訪談能力訓練系統 · 學生訓練成績檢核與心態軌跡監控
              </p>
            </div>
          </div>
        </div>

        {onBackToTraining && (
          <button
            onClick={onBackToTraining}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition font-medium text-sm self-start md:self-auto"
          >
            <RotateCcw className="w-4 h-4" />
            返回學生訓練模式
          </button>
        )}
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* 高風險預警區 Banner */}
        {warningSessions.length > 0 && (
          <div className="bg-rose-950/40 border border-rose-600/60 rounded-2xl p-5 shadow-lg relative overflow-hidden backdrop-blur-md">
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-rose-600/10 to-transparent pointer-events-none" />
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-600/20 rounded-xl text-rose-400 border border-rose-500/40 shrink-0 mt-0.5 animate-pulse">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-rose-300 flex items-center gap-2">
                    高風險預警通知 (High-Risk Alert)
                    <span className="text-xs bg-rose-600/80 text-white px-2 py-0.5 rounded-full font-mono">
                      {warningSessions.length} 個異常場次
                    </span>
                  </h2>
                </div>
                <p className="text-sm text-rose-200/80 mt-1">
                  系統自動監測到以下訓練場次存在「關係崩解 (Rapport Score &lt; 30)」或「強烈觸發家長隱藏痛點」狀況，請督導優先審核輔導：
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  {warningSessions.map(session => (
                    <div 
                      key={session.sessionId}
                      onClick={() => handleOpenReviewModal(session.sessionId)}
                      className="bg-slate-900/80 border border-rose-500/40 hover:border-rose-400 p-3.5 rounded-xl cursor-pointer transition flex items-center justify-between group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200 text-sm">{session.userName || '學員'}</span>
                          <span className="text-xs text-slate-400">({session.selectedFamilyCase})</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          {session.finalRapportScore !== undefined && session.finalRapportScore < 30 && (
                            <span className="text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800/60 font-semibold">
                              ⚠️ 關係破裂 (關係分 {session.finalRapportScore})
                            </span>
                          )}
                          {session.sensitive_triggered && (
                            <span className="text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/60 font-semibold">
                              ⚡ 觸發敏感痛點
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-rose-400 group-hover:translate-x-1 transition" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 控制面板：搜尋與分類 Tab */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4">
          {/* Tab 切換 */}
          <div className="flex items-center bg-slate-900/80 p-1.5 rounded-xl border border-slate-700/80 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === 'all' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              全部場次 ({sessions.length})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === 'pending' 
                  ? 'bg-amber-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              待審核 ({sessions.filter(s => s.supervisor_review_status === 'pending').length})
            </button>
            <button
              onClick={() => setActiveTab('reviewed')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === 'reviewed' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              已審核 ({sessions.filter(s => s.supervisor_review_status === 'reviewed').length})
            </button>
            <button
              onClick={() => setActiveTab('warning')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === 'warning' 
                  ? 'bg-rose-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              預警場次 ({warningSessions.length})
            </button>
          </div>

          {/* 搜尋框 */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜尋學員姓名、案例名稱..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>
        </div>

        {/* 訓練場次列表表格 */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="py-16 text-center text-slate-400 animate-pulse">
              <Activity className="w-8 h-8 mx-auto text-indigo-400 mb-2 animate-spin" />
              正在讀取全體訓練場次紀錄...
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              無符合條件的訓練場次紀錄。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700">
                  <tr>
                    <th className="py-3.5 px-4">學員 / 測試者</th>
                    <th className="py-3.5 px-4">模擬家庭案例</th>
                    <th className="py-3.5 px-4">最終關係分數</th>
                    <th className="py-3.5 px-4">學生自評狀態</th>
                    <th className="py-3.5 px-4">督導審核狀態</th>
                    <th className="py-3.5 px-4 text-center">指定重練</th>
                    <th className="py-3.5 px-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredSessions.map(session => {
                    const isWarning = (session.finalRapportScore !== undefined && session.finalRapportScore < 30) || session.sensitive_triggered;
                    return (
                      <tr 
                        key={session.sessionId}
                        className={`hover:bg-slate-800/70 transition ${isWarning ? 'bg-rose-950/10' : ''}`}
                      >
                        <td className="py-4 px-4 font-semibold text-slate-200 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs text-indigo-300">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <div>{session.userName || '學員'}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{session.sessionId.substring(0, 16)}</div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300 font-medium">
                            {session.selectedFamilyCase}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono text-sm font-bold ${
                              (session.finalRapportScore ?? 50) >= 80 ? 'text-emerald-400' :
                              (session.finalRapportScore ?? 50) < 30 ? 'text-rose-400 font-extrabold' : 'text-amber-400'
                            }`}>
                              {session.finalRapportScore ?? 'N/A'} 分
                            </span>
                            {isWarning && (
                              <span className="px-1.5 py-0.5 bg-rose-600/30 text-rose-400 border border-rose-500/40 rounded text-[10px]">
                                ⚠️ 預警
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          {session.self_reflection_completed ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-800/50">
                              <CheckCircle className="w-3.5 h-3.5" /> 已自評
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700">
                              <Clock className="w-3.5 h-3.5" /> 未自評
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          {session.supervisor_review_status === 'reviewed' ? (
                            <span className="inline-flex items-center gap-1 text-indigo-300 bg-indigo-950/60 px-2.5 py-1 rounded-full border border-indigo-800/50">
                              <Award className="w-3.5 h-3.5" /> 已覆核
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded-full border border-amber-800/50">
                              <AlertTriangle className="w-3.5 h-3.5" /> 待審核
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {session.required_repractice ? (
                            <span className="px-2 py-0.5 bg-rose-600 text-white rounded font-semibold text-[10px]">
                              需重練
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => handleOpenReviewModal(session.sessionId)}
                            className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg transition font-medium text-xs flex items-center gap-1 ml-auto"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            審核與覆核
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 覆核 Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col my-8">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/30 text-indigo-400 rounded-xl border border-indigo-500/40">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-100">
                    督導審核與成績覆核面板
                  </h2>
                  <p className="text-xs text-slate-400 font-mono">
                    Session ID: {selectedSessionId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-8 flex-1">
              {isLoadingDetails ? (
                <div className="py-20 text-center text-slate-400">
                  <Activity className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-2" />
                  載入場次細節、逐字稿與心態軌跡中...
                </div>
              ) : sessionDetails ? (
                <>
                  {/* 區塊 1: NPC 心理狀態動態軌跡圖 (SVG Chart) */}
                  <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-indigo-400" />
                        家長 NPC 心理狀態動態軌跡 (npc_state_logs)
                      </h3>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> 信任度 (Trust)
                        </span>
                        <span className="flex items-center gap-1.5 text-rose-400 font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> 防衛度 (Defense)
                        </span>
                      </div>
                    </div>

                    {/* SVG 繪製折線圖 */}
                    <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-700/80 overflow-x-auto">
                      {sessionDetails.npc_state_logs.length > 0 ? (
                        <div className="w-full min-w-[500px] h-44 relative">
                          <svg className="w-full h-full overflow-visible" viewBox="0 0 500 140">
                            {/* 背景水平參考線 */}
                            <line x1="0" y1="20" x2="500" y2="20" stroke="#334155" strokeDasharray="3 3" />
                            <line x1="0" y1="70" x2="500" y2="70" stroke="#334155" strokeDasharray="3 3" />
                            <line x1="0" y1="120" x2="500" y2="120" stroke="#334155" strokeDasharray="3 3" />

                            {/* 繪製信任度 Polyline */}
                            <polyline
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="3"
                              points={sessionDetails.npc_state_logs.map((log, idx) => {
                                const count = sessionDetails.npc_state_logs.length;
                                const x = (idx / Math.max(1, count - 1)) * 480 + 10;
                                const y = 130 - (log.trust_score / 100) * 110;
                                return `${x},${y}`;
                              }).join(' ')}
                            />

                            {/* 繪製防衛度 Polyline */}
                            <polyline
                              fill="none"
                              stroke="#f43f5e"
                              strokeWidth="3"
                              points={sessionDetails.npc_state_logs.map((log, idx) => {
                                const count = sessionDetails.npc_state_logs.length;
                                const x = (idx / Math.max(1, count - 1)) * 480 + 10;
                                const y = 130 - (log.defense_score / 100) * 110;
                                return `${x},${y}`;
                              }).join(' ')}
                            />

                            {/* 繪製亮點與痛點標示 */}
                            {sessionDetails.npc_state_logs.map((log, idx) => {
                              const count = sessionDetails.npc_state_logs.length;
                              const x = (idx / Math.max(1, count - 1)) * 480 + 10;
                              const yTrust = 130 - (log.trust_score / 100) * 110;
                              const yDefense = 130 - (log.defense_score / 100) * 110;

                              return (
                                <g key={idx}>
                                  <circle cx={x} cy={yTrust} r="4" fill="#10b981" />
                                  <circle cx={x} cy={yDefense} r="4" fill="#f43f5e" />
                                  {log.sensitive_triggered && (
                                    <g>
                                      <circle cx={x} cy={yDefense} r="8" fill="none" stroke="#f59e0b" strokeWidth="2" className="animate-ping" />
                                      <text x={x} y={yDefense - 12} fill="#f59e0b" fontSize="10" textAnchor="middle" fontWeight="bold">
                                        ⚡痛點
                                      </text>
                                    </g>
                                  )}
                                </g>
                              );
                            })}
                          </svg>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-slate-500 text-xs">無心態軌跡紀錄</div>
                      )}
                    </div>
                  </div>

                  {/* 區塊 2: 學生自評與反思內容 (若有) */}
                  <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 space-y-3">
                    <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-amber-400" />
                      學生自評與反思紀錄 (Self Reflection)
                    </h3>
                    {sessionDetails.self_reflections ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-700 space-y-1">
                          <span className="text-slate-400 font-semibold">1. 最滿意/最佳提問：</span>
                          <p className="text-slate-200 mt-1">{sessionDetails.self_reflections.best_question}</p>
                        </div>
                        <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-700 space-y-1">
                          <span className="text-slate-400 font-semibold">2. 感到困難/挫折時刻：</span>
                          <p className="text-slate-200 mt-1">{sessionDetails.self_reflections.difficult_moment}</p>
                        </div>
                        <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-700 space-y-1">
                          <span className="text-slate-400 font-semibold">3. 學習與反思心得：</span>
                          <p className="text-slate-200 mt-1">{sessionDetails.self_reflections.learning_reflection}</p>
                        </div>
                        <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-700 space-y-1">
                          <span className="text-slate-400 font-semibold">4. 下次訓練改進目標：</span>
                          <p className="text-slate-200 mt-1">{sessionDetails.self_reflections.next_goal}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-slate-500 text-xs bg-slate-900/50 p-4 rounded-xl text-center">
                        學生尚未填寫自評與反思表單。
                      </div>
                    )}
                  </div>

                  {/* 區塊 3: 督導手動覆核評分與評語表單 */}
                  <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                      <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                        <Award className="w-4 h-4 text-emerald-400" />
                        督導覆核評分 (Six Dimensions Supervisor Grading)
                      </h3>
                      <div className="text-right">
                        <span className="text-xs text-slate-400">覆核總分 (Total): </span>
                        <span className="text-xl font-bold font-mono text-emerald-400 ml-1">
                          {calculatedTotalScore} 分
                        </span>
                      </div>
                    </div>

                    {/* 六大面向 Slider / Input 評分表 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      {[
                        { key: 'relationship_score', label: '1. 開場與關係建立 (15%)' },
                        { key: 'questioning_score', label: '2. 提問技巧與作息本位 (25%)' },
                        { key: 'empathy_score', label: '3. 同理、敏感度與非評價 (20%)' },
                        { key: 'family_centered_score', label: '4. 家庭中心與優勢導向 (15%)' },
                        { key: 'information_score', label: '5. IFSP前置資訊完整度 (20%)' },
                        { key: 'time_score', label: '6. 時間內任務完成 (5%)' },
                      ].map(item => (
                        <div key={item.key} className="bg-slate-900/80 p-3 rounded-xl border border-slate-700 space-y-2">
                          <div className="flex justify-between font-semibold text-slate-300">
                            <span>{item.label}</span>
                            <span className="text-indigo-400 font-mono font-bold">
                              {(editScores as any)[item.key]} 分
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={(editScores as any)[item.key]}
                            onChange={(e) => setEditScores({ ...editScores, [item.key]: parseInt(e.target.value) })}
                            className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                          />
                        </div>
                      ))}
                    </div>

                    {/* 督導評語 */}
                    <div className="space-y-2 pt-2">
                      <label className="text-xs font-semibold text-slate-300 block">
                        督導綜合評語與指導建議 (Supervisor Comments)：
                      </label>
                      <textarea
                        rows={3}
                        value={supervisorComments}
                        onChange={(e) => setSupervisorComments(e.target.value)}
                        placeholder="請撰寫給學員的具體改進建議與輔導評語..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>

                    {/* Checkbox: 指定重練 */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="requiredRepractice"
                        checked={requiredRepractice}
                        onChange={(e) => setRequiredRepractice(e.target.checked)}
                        className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
                      />
                      <label htmlFor="requiredRepractice" className="text-xs font-semibold text-rose-300 cursor-pointer">
                        指定重練 (Required Repractice) — 將本場次標記為需重新練習
                      </label>
                    </div>

                    {/* 儲存按鈕 */}
                    <div className="flex items-center justify-end gap-3 pt-3">
                      {submitSuccessMsg && (
                        <span className="text-xs text-emerald-400 font-semibold animate-fade-in">
                          {submitSuccessMsg}
                        </span>
                      )}
                      <button
                        onClick={handleSubmitReview}
                        disabled={isSubmitting}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition text-xs flex items-center gap-1.5 shadow-lg disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        {isSubmitting ? '正在儲存覆核...' : '儲存覆核評分'}
                      </button>
                    </div>
                  </div>

                  {/* 區塊 4: 對話逐字稿歷程 */}
                  <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 space-y-3">
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      訪談全場對話逐字稿 (Utterance History)
                    </h3>
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                      {sessionDetails.utterances.map((u, idx) => (
                        <div 
                          key={idx}
                          className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                            u.speaker === 'student'
                              ? 'bg-indigo-950/40 border-indigo-800/50 text-indigo-100 ml-4'
                              : 'bg-slate-900/80 border-slate-700 text-slate-200 mr-4'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                            <span>{u.speaker === 'student' ? '學員發言' : '家長 (NPC)'}</span>
                            <span className="font-mono">關係分: {u.rapport_score}</span>
                          </div>
                          <p className="leading-relaxed">{u.text}</p>
                          {u.student_skill_tag && u.student_skill_tag.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {u.student_skill_tag.map((tag, tIdx) => (
                                <span key={tIdx} className="bg-indigo-900/80 text-indigo-300 border border-indigo-700 px-1.5 py-0.5 rounded text-[10px]">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
