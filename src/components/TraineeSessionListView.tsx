import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Radio, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Filter, 
  ChevronRight, 
  FileText, 
  CheckSquare, 
  Clock, 
  Calendar,
  Sparkles,
  RefreshCw,
  ArrowUpDown,
  Eye,
  SlidersHorizontal
} from 'lucide-react';
import { apiClient, ApiSession } from '../services/apiClient';
import { caseProfiles } from '../constants/cases';

interface TraineeSessionListViewProps {
  onSelectSessionForReport: (sessionId: string) => void;
  onSelectSessionForReview: (sessionId: string) => void;
  onSelectSessionForLive: (sessionId: string) => void;
}

export const TraineeSessionListView: React.FC<TraineeSessionListViewProps> = ({
  onSelectSessionForReport,
  onSelectSessionForReview,
  onSelectSessionForLive,
}) => {
  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'reviewed' | 'warning'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'score_desc' | 'score_asc'>('newest');

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getSessions();
      setSessions(data);
    } catch (err) {
      console.error('取得受訓人員場次列表失敗:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  // 取得案例名稱對應
  const getCaseName = (caseId: string) => {
    const found = caseProfiles.find(c => c.case_id === caseId || c.id === caseId);
    return found ? found.persona_name : caseId;
  };

  // 格式化日期時間
  const formatTime = (ts: any) => {
    if (!ts) return '剛才';
    try {
      if (typeof ts === 'object' && ts.seconds) {
        return new Date(ts.seconds * 1000).toLocaleString('zh-TW', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      return new Date(ts).toLocaleString('zh-TW', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(ts);
    }
  };

  // 指標計算
  const totalCount = sessions.length;
  const activeSessions = sessions.filter(s => s.status === 'active');
  const activeCount = activeSessions.length;
  const pendingReviewCount = sessions.filter(s => s.status === 'completed' && !s.supervisor_reviewed).length;
  const warningCount = sessions.filter(s => 
    (s.final_score !== undefined && s.final_score < 70) || s.require_repetition
  ).length;

  // 篩選
  const filtered = sessions.filter(s => {
    const caseName = getCaseName(s.case_id);
    const matchesSearch = 
      s.user_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      caseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.session_id.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'active') return s.status === 'active';
    if (statusFilter === 'pending') return s.status === 'completed' && !s.supervisor_reviewed;
    if (statusFilter === 'reviewed') return Boolean(s.supervisor_reviewed);
    if (statusFilter === 'warning') return (s.final_score !== undefined && s.final_score < 70) || s.require_repetition;
    return true;
  });

  // 排序
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'score_desc') {
      const scoreA = a.supervisor_total_score ?? a.final_score ?? 0;
      const scoreB = b.supervisor_total_score ?? b.final_score ?? 0;
      return scoreB - scoreA;
    }
    if (sortBy === 'score_asc') {
      const scoreA = a.supervisor_total_score ?? a.final_score ?? 0;
      const scoreB = b.supervisor_total_score ?? b.final_score ?? 0;
      return scoreA - scoreB;
    }
    // 預設最新優先
    return 0;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 頂部標題說明 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-sky-400" />
            受訓人員與訪談場次總覽
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            即時檢視受訓學員虛擬家訪進度、AI 自動化初評、督導覆核狀態與異常預警
          </p>
        </div>

        <button
          onClick={fetchSessions}
          disabled={isLoading}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition flex items-center gap-2 cursor-pointer shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
          <span>重新載入清單</span>
        </button>
      </div>

      {/* 4 大核心 KPI 統計卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 卡片 1: 總訓練場次 */}
        <div 
          onClick={() => setStatusFilter('all')}
          className={`cursor-pointer group relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 shadow-lg ${
            statusFilter === 'all'
              ? 'bg-slate-900/90 border-sky-500/50 shadow-sky-500/10'
              : 'bg-slate-900/60 hover:bg-slate-900/90 border-slate-800/80 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-300">
              累計訓練場次
            </span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-mono tracking-tight">
              {totalCount}
            </span>
            <span className="text-xs text-slate-400">場</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
            <span>點擊篩選全部紀錄</span>
          </div>
        </div>

        {/* 卡片 2: 即時進行中 */}
        <div 
          onClick={() => setStatusFilter('active')}
          className={`cursor-pointer group relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 shadow-lg ${
            statusFilter === 'active'
              ? 'bg-emerald-950/30 border-emerald-500/50 shadow-emerald-500/10'
              : 'bg-slate-900/60 hover:bg-slate-900/90 border-slate-800/80 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400/90">
              即時進行中 (Live)
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-400 font-mono tracking-tight">
              {activeCount}
            </span>
            <span className="text-xs text-emerald-500/80">在線連線</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-400/70 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span>可直接進入即時鏡像</span>
          </div>
        </div>

        {/* 卡片 3: 待督導審核 */}
        <div 
          onClick={() => setStatusFilter('pending')}
          className={`cursor-pointer group relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 shadow-lg ${
            statusFilter === 'pending'
              ? 'bg-amber-950/30 border-amber-500/50 shadow-amber-500/10'
              : 'bg-slate-900/60 hover:bg-slate-900/90 border-slate-800/80 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400/90">
              待督導覆核
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-400 font-mono tracking-tight">
              {pendingReviewCount}
            </span>
            <span className="text-xs text-amber-500/80">筆待審核</span>
          </div>
          <div className="mt-2 text-[11px] text-amber-400/70 flex items-center gap-1">
            <span>需教授核定覆評分數</span>
          </div>
        </div>

        {/* 卡片 4: 預警與指定重練 */}
        <div 
          onClick={() => setStatusFilter('warning')}
          className={`cursor-pointer group relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 shadow-lg ${
            statusFilter === 'warning'
              ? 'bg-rose-950/30 border-rose-500/50 shadow-rose-500/10'
              : 'bg-slate-900/60 hover:bg-slate-900/90 border-slate-800/80 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-400/90">
              預警 / 需重新練習
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-400 font-mono tracking-tight">
              {warningCount}
            </span>
            <span className="text-xs text-rose-500/80">場次需輔導</span>
          </div>
          <div className="mt-2 text-[11px] text-rose-400/70 flex items-center gap-1">
            <span>訪談分 &lt; 70 或已標註重練</span>
          </div>
        </div>
      </div>

      {/* 控制列：搜尋與條件切換 Tab */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Tab 標籤群組 */}
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === 'all'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            全部場次 ({totalCount})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === 'active'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            🟢 進行中 ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === 'pending'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            待覆核 ({pendingReviewCount})
          </button>
          <button
            onClick={() => setStatusFilter('reviewed')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === 'reviewed'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            已覆核 ({sessions.filter(s => s.supervisor_reviewed).length})
          </button>
          <button
            onClick={() => setStatusFilter('warning')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === 'warning'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            ⚠️ 預警關注 ({warningCount})
          </button>
        </div>

        {/* 搜尋與排序 */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜尋學員帳號、個案名稱..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950/60 border border-slate-800 text-xs text-slate-200 rounded-xl focus:outline-none focus:border-sky-500 placeholder-slate-500 transition"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950/60 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-400">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-transparent text-slate-300 text-xs outline-none cursor-pointer"
            >
              <option value="newest" className="bg-slate-900 text-slate-200">最新排序</option>
              <option value="score_desc" className="bg-slate-900 text-slate-200">得分高至低</option>
              <option value="score_asc" className="bg-slate-900 text-slate-200">得分低至高</option>
            </select>
          </div>
        </div>
      </div>

      {/* 資料展示區：現代化表格 (Card Table) */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/70 font-semibold">
                <th className="py-3.5 px-4">受訓學員 (Trainee)</th>
                <th className="py-3.5 px-4">訪談家庭劇本</th>
                <th className="py-3.5 px-3">訓練狀態</th>
                <th className="py-3.5 px-3">訪談得分 / 關係</th>
                <th className="py-3.5 px-3">督導覆核審查</th>
                <th className="py-3.5 px-3">時長 / 盤點</th>
                <th className="py-3.5 px-3">建立時間</th>
                <th className="py-3.5 px-4 text-right">快捷操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-400 mb-2" />
                    <span>正在載入受訓場次數據...</span>
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    <Users className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <span>尚無符合條件的訓練場次紀錄</span>
                  </td>
                </tr>
              ) : (
                sorted.map((s) => {
                  const score = s.supervisor_total_score ?? s.final_score ?? 0;
                  const isLowScore = score < 70 && s.status === 'completed';

                  // 評分標籤樣式
                  let scoreBadge = null;
                  if (s.status === 'completed' || s.final_score !== undefined) {
                    if (score >= 90) {
                      scoreBadge = (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          {score} 分 · 卓越
                        </span>
                      );
                    } else if (score >= 80) {
                      scoreBadge = (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                          {score} 分 · 優良
                        </span>
                      );
                    } else if (score >= 70) {
                      scoreBadge = (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          {score} 分 · 合格
                        </span>
                      );
                    } else {
                      scoreBadge = (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          {score} 分 · 需加強
                        </span>
                      );
                    }
                  } else {
                    scoreBadge = (
                      <span className="text-slate-500 text-[11px]">進行中計算</span>
                    );
                  }

                  return (
                    <tr 
                      key={s.session_id} 
                      className={`hover:bg-slate-800/40 transition-colors ${
                        s.status === 'active' ? 'bg-emerald-950/10' : ''
                      }`}
                    >
                      {/* 學員資訊 */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-300 font-mono font-bold text-xs">
                            {s.user_id.slice(-2).toUpperCase() || 'TR'}
                          </div>
                          <div>
                            <div className="font-bold text-white font-mono text-xs">
                              {s.user_id}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono truncate max-w-[110px]" title={s.session_id}>
                              ID: {s.session_id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 訪談案例 */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-200 text-xs">
                          {getCaseName(s.case_id)}
                        </div>
                        <span className="text-[10px] text-slate-500">
                          劇本代碼: {s.case_id}
                        </span>
                      </td>

                      {/* 狀態標籤 */}
                      <td className="py-3 px-3">
                        {s.status === 'active' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                            進行中
                          </span>
                        ) : s.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            <CheckCircle2 className="w-3 h-3 text-sky-400" />
                            已結算
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            已中止
                          </span>
                        )}
                      </td>

                      {/* 評分標籤 */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          {scoreBadge}
                          {s.final_score !== undefined && (
                            <span className="text-[10px] text-slate-400">
                              關係建立度: {s.final_score}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 督導覆核 */}
                      <td className="py-3 px-3">
                        {s.supervisor_reviewed ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 inline-block w-fit">
                              已覆核 ({s.supervisor_total_score ?? '已核定'} 分)
                            </span>
                            {s.require_repetition && (
                              <span className="text-[10px] text-rose-400 font-bold flex items-center gap-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" /> 需重新練習
                              </span>
                            )}
                          </div>
                        ) : s.status === 'completed' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            待督導審核
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">-</span>
                        )}
                      </td>

                      {/* 時長與盤點 */}
                      <td className="py-3 px-3">
                        <div className="text-[11px] text-slate-300">
                          {s.selected_duration} 分鐘
                        </div>
                        <div className="text-[10px] text-slate-500">
                          盤點 {s.inventory_count || 0} · 求助 {s.help_count || 0}
                        </div>
                      </td>

                      {/* 建立時間 */}
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {formatTime(s.created_at)}
                      </td>

                      {/* 操作按鈕群 */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {s.status === 'active' ? (
                            <button
                              onClick={() => onSelectSessionForLive(s.session_id)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1 shadow-sm cursor-pointer"
                              title="開啟即時鏡像監看"
                            >
                              <Radio className="w-3.5 h-3.5 animate-pulse" />
                              <span>即時監看</span>
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => onSelectSessionForReport(s.session_id)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-purple-600 text-slate-300 hover:text-white border border-slate-700 hover:border-purple-500 transition flex items-center gap-1 cursor-pointer"
                                title="查看詳細訪談雷達圖與分析報告"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">深度報告</span>
                              </button>

                              <button
                                onClick={() => onSelectSessionForReview(s.session_id)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1 cursor-pointer ${
                                  s.supervisor_reviewed
                                    ? 'bg-slate-800/80 hover:bg-emerald-700 text-emerald-400 hover:text-white border-emerald-500/30'
                                    : 'bg-emerald-600/90 hover:bg-emerald-500 text-white border-emerald-500/40'
                                }`}
                                title="進行督導覆評與評語撰寫"
                              >
                                <CheckSquare className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">
                                  {s.supervisor_reviewed ? '重新覆核' : '進行覆核'}
                                </span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
