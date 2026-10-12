import { useState, useEffect } from 'react';
import { 
  Radio, 
  FileText, 
  CheckSquare, 
  BarChart3, 
  Sparkles, 
  HelpCircle,
  User,
  LogOut,
  ExternalLink,
  ShieldCheck,
  GraduationCap,
  Loader2
} from 'lucide-react';
import { apiClient } from './services/apiClient';
import { requireLogin, supabase, type CurrentUser } from './services/supabaseClient';
import { LiveMonitorView } from './components/LiveMonitorView';
import { SessionReportView } from './components/SessionReportView';
import { SupervisorReviewPanel } from './components/SupervisorReviewPanel';
import { AnalyticsExportView } from './components/AnalyticsExportView';
import { InteractiveTrainer } from './components/InteractiveTrainer';
import ChangelogModal from './components/ChangelogModal';
import { CHANGELOG_DATA } from './constants/changelog';

export type DashboardTab = 'live' | 'report' | 'review' | 'analytics' | 'trainer';

export default function App() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>('trainer');
  const [targetSessionId, setTargetSessionId] = useState<string>('');
  const [serverStatus, setServerStatus] = useState<{ online: boolean; message?: string }>({ online: false });
  const [showChangelog, setShowChangelog] = useState<boolean>(false);

  // 1. 身分驗證初始化 (依方案 #4：沒登入導回入口頁面；依角色限制分頁)
  useEffect(() => {
    let isMounted = true;
    requireLogin().then(res => {
      if (!isMounted) return;
      if (res) {
        setCurrentUser(res.user);
        const isStaffRole = res.user.role === 'owner' || res.user.role === 'assistant';
        // 督導預設開 live 監控，學生僅允許 trainer
        setActiveTab(isStaffRole ? 'live' : 'trainer');
      }
      setIsLoadingAuth(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. 檢查後端伺服器健康狀態
  useEffect(() => {
    apiClient.checkHealth().then(status => {
      setServerStatus(status);
    });

    const interval = setInterval(() => {
      apiClient.checkHealth().then(status => {
        setServerStatus(status);
      });
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleSelectSessionForReport = (sessionId: string) => {
    setTargetSessionId(sessionId);
    setActiveTab('report');
  };

  const handleSelectSessionForReview = (sessionId: string) => {
    setTargetSessionId(sessionId);
    setActiveTab('review');
  };

  const handleSessionEndedInTrainer = (sessionId: string) => {
    setTargetSessionId(sessionId);
    // 督導身分結束後可看完整深度報告，學生則留在訓練器中
    if (currentUser?.role === 'owner' || currentUser?.role === 'assistant') {
      setActiveTab('report');
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Sign out warning:', e);
    }
    window.location.href = '/?next=' + encodeURIComponent('/xr/');
  };

  const isStaff = currentUser?.role === 'owner' || currentUser?.role === 'assistant';

  // 正在檢查身分時顯示載入遮罩
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 bg-slate-900/80 border border-slate-800 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/30">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">正在同步身分驗證...</h2>
            <p className="text-xs text-slate-400 mt-1">
              檢查 IEP 入口網站登入狀態與角色權限
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* 頂部主導航列 */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* 系統 Logo 與標題 */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white font-black text-xl tracking-tight">
              XR
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base tracking-tight text-white">
                  IFSP 家訪 AI 訓練與即時監控儀表板
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                  國科會計畫專用
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden md:block">
                Unity VR 虛擬實境串接 · 即時逐字稿鏡像 · AI/督導雙軌評分 · LSA 行為序列分析
              </p>
            </div>
          </div>

          {/* 右側：使用者身分、入口返回與伺服器連線狀態指示 */}
          <div className="flex items-center gap-3">
            {/* 使用者身分膠囊 */}
            {currentUser && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300">
                {isStaff ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                ) : (
                  <GraduationCap className="w-3.5 h-3.5 text-sky-400" />
                )}
                <span className="font-medium text-white truncate max-w-[120px]">
                  {currentUser.name}
                </span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                  isStaff 
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                    : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                }`}>
                  {isStaff ? '督導' : '學員'}
                </span>
              </div>
            )}

            {/* 返回入口網站 */}
            <a
              href="/portal"
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl text-xs flex items-center gap-1 border border-slate-800 transition-colors"
              title="返回 IEP 整合平台選擇頁"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">平台入口</span>
            </a>

            {/* 伺服器狀態標籤 */}
            <div className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              serverStatus.online
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/40 text-amber-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                serverStatus.online ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}></span>
              <span>
                {serverStatus.online 
                  ? `AI 核心在線 (${serverStatus.message || 'Gemini 2.5 Flash'})` 
                  : '離線模擬防護模式'}
              </span>
            </div>

            <button
              onClick={() => setShowChangelog(true)}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl text-xs flex items-center gap-1 border border-slate-800 transition-colors"
              title="系統架構與版本歷程"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden lg:inline">規格歷程</span>
            </button>

            {/* 登出按鈕 */}
            <button
              onClick={handleSignOut}
              className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl text-xs flex items-center gap-1 border border-rose-500/20 transition-colors cursor-pointer"
              title="登出帳號"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">登出</span>
            </button>
          </div>
        </div>

        {/* 核心視圖導航分頁 (Tabs：督導看全部，學員僅看 trainer) */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 border-t border-slate-800/60 overflow-x-auto custom-scrollbar">
          {/* 訪談訓練模擬器 (學員與督導皆可操作) */}
          <button
            onClick={() => setActiveTab('trainer')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'trainer'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>【訪談訓練模擬器】 (VR/Web Trainer)</span>
          </button>

          {/* 督導專用分頁 (依方案 #4：僅 owner, assistant 可見) */}
          {isStaff && (
            <>
              <button
                onClick={() => setActiveTab('live')}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-bold whitespace-nowrap transition-all ${
                  activeTab === 'live'
                    ? 'border-sky-400 text-sky-400 bg-sky-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Radio className={`w-4 h-4 ${activeTab === 'live' ? 'animate-pulse' : ''}`} />
                <span>【即時監控視圖】 (Live Monitor)</span>
              </button>

              <button
                onClick={() => setActiveTab('report')}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-bold whitespace-nowrap transition-all ${
                  activeTab === 'report'
                    ? 'border-purple-400 text-purple-400 bg-purple-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>【單次訪談深度報告】 (Session Report)</span>
              </button>

              <button
                onClick={() => setActiveTab('review')}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-bold whitespace-nowrap transition-all ${
                  activeTab === 'review'
                    ? 'border-emerald-400 text-emerald-400 bg-emerald-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                <span>【督導審查與覆評】 (Supervisor Review)</span>
              </button>

              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-bold whitespace-nowrap transition-all ${
                  activeTab === 'analytics'
                    ? 'border-indigo-400 text-indigo-400 bg-indigo-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>【總體數據與研究匯出】 (Analytics & LSA)</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* 主內容容器 */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'trainer' && (
          <InteractiveTrainer
            currentUser={currentUser}
            onSessionEnded={handleSessionEndedInTrainer}
          />
        )}

        {isStaff && activeTab === 'live' && (
          <LiveMonitorView
            onSelectSessionForReport={handleSelectSessionForReport}
            onSelectSessionForReview={handleSelectSessionForReview}
          />
        )}

        {isStaff && activeTab === 'report' && (
          <SessionReportView
            initialSessionId={targetSessionId}
            onGoToReview={handleSelectSessionForReview}
          />
        )}

        {isStaff && activeTab === 'review' && (
          <SupervisorReviewPanel
            initialSessionId={targetSessionId}
          />
        )}

        {isStaff && activeTab === 'analytics' && (
          <AnalyticsExportView />
        )}
      </main>

      {/* 頁尾 */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-4 text-center text-xs text-slate-500">
        <p>
          國立臺中教育大學 · 國科會專題研究計畫 · IFSP 家庭訪談能力訓練系統 (Unity VR + Gemini 2.5 Flash + Express + Firestore)
        </p>
      </footer>

      {/* 更新歷程與規格彈窗 */}
      <ChangelogModal
        isOpen={showChangelog}
        onClose={() => setShowChangelog(false)}
        changelogs={CHANGELOG_DATA}
      />
    </div>
  );
}
