import { useState, useEffect } from 'react';
import { 
  Radio, 
  FileText, 
  CheckSquare, 
  BarChart3, 
  Sparkles, 
  HelpCircle,
  LogOut,
  ExternalLink,
  ShieldCheck,
  GraduationCap,
  Loader2,
  Users,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Compass,
  MonitorPlay
} from 'lucide-react';
import { apiClient } from './services/apiClient';
import { requireLogin, supabase, type CurrentUser } from './services/supabaseClient';
import { TraineeSessionListView } from './components/TraineeSessionListView';
import { LiveMonitorView } from './components/LiveMonitorView';
import { SessionReportView } from './components/SessionReportView';
import { SupervisorReviewPanel } from './components/SupervisorReviewPanel';
import { AnalyticsExportView } from './components/AnalyticsExportView';
import { InteractiveTrainer } from './components/InteractiveTrainer';
import ChangelogModal from './components/ChangelogModal';
import { CHANGELOG_DATA } from './constants/changelog';

export type DashboardTab = 'sessions' | 'live' | 'report' | 'review' | 'analytics' | 'trainer';

export default function App() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>('trainer');
  const [targetSessionId, setTargetSessionId] = useState<string>('');
  const [serverStatus, setServerStatus] = useState<{ online: boolean; message?: string }>({ online: false });
  const [showChangelog, setShowChangelog] = useState<boolean>(false);
  
  // Sidebar 展開/收合狀態 (桌面版) 與 手機版抽屜開關
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // 1. 身分驗證初始化 (依方案 #4：沒登入導回入口頁面；依角色限制分頁)
  useEffect(() => {
    let isMounted = true;
    requireLogin().then(res => {
      if (!isMounted) return;
      if (res) {
        setCurrentUser(res.user);
        const isStaffRole = res.user.role === 'owner' || res.user.role === 'assistant';
        // 督導預設開受訓人員總覽，學員僅允許 trainer
        setActiveTab(isStaffRole ? 'sessions' : 'trainer');
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

  const handleSelectSessionForLive = (sessionId: string) => {
    setTargetSessionId(sessionId);
    setActiveTab('live');
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

  // 取得當前視圖中文名稱與麵包屑
  const getViewMeta = (tab: DashboardTab) => {
    switch (tab) {
      case 'sessions':
        return { category: '督導管理', title: '受訓人員場次總覽', icon: Users, color: 'text-sky-400' };
      case 'live':
        return { category: '即時監控', title: 'VR 訓練即時鏡像', icon: Radio, color: 'text-emerald-400' };
      case 'report':
        return { category: '訪談評鑑', title: '單次訪談深度報告', icon: FileText, color: 'text-purple-400' };
      case 'review':
        return { category: '督導評鑑', title: '督導審核與覆核評分', icon: CheckSquare, color: 'text-indigo-400' };
      case 'analytics':
        return { category: '研究分析', title: '總體數據與 LSA 匯出', icon: BarChart3, color: 'text-blue-400' };
      case 'trainer':
        return { category: '模擬訓練', title: 'IFSP 家庭訪談模擬器', icon: Sparkles, color: 'text-amber-400' };
    }
  };

  const currentMeta = getViewMeta(activeTab);

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-row font-sans selection:bg-sky-500 selection:text-white">
      {/* ========================================================= */}
      {/* 1. 現代化側邊欄 (Sidebar) - 支援收合與分組導航 */}
      {/* ========================================================= */}
      
      {/* 手機版 Overlay 遮罩 */}
      {isMobileSidebarOpen && (
        <div 
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 h-screen z-50 flex flex-col bg-slate-950/95 lg:bg-slate-950/80 backdrop-blur-2xl border-r border-slate-800/80 transition-all duration-300 ease-in-out shadow-2xl ${
          // 桌面版收合邏輯
          isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'
        } ${
          // 手機版滑動進出邏輯
          isMobileSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Sidebar Header: Logo & 系統標題 */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 text-white font-black text-lg shrink-0">
              XR
            </div>
            {(!isSidebarCollapsed || isMobileSidebarOpen) && (
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-extrabold text-xs tracking-tight text-white truncate">
                    IFSP 家訪訓練後台
                  </h1>
                </div>
                <p className="text-[10px] text-sky-400 font-semibold truncate">
                  國科會專案 · 督導儀表板
                </p>
              </div>
            )}
          </div>

          {/* 桌面收合按鈕 */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
            title={isSidebarCollapsed ? '展開側邊欄' : '收合側邊欄'}
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>

          {/* 手機關閉按鈕 */}
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Nav Items */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-6">
          {/* 區塊 1: 訓練營運 (Operations) */}
          <div className="space-y-1">
            {(!isSidebarCollapsed || isMobileSidebarOpen) && (
              <span className="px-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                訓練與監控營運
              </span>
            )}

            {/* 受訓人員場次總覽 (僅督導) */}
            {isStaff && (
              <button
                onClick={() => {
                  setActiveTab('sessions');
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all group ${
                  activeTab === 'sessions'
                    ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-md shadow-sky-500/5'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
                title="受訓人員場次總覽"
              >
                <Users className={`w-4 h-4 shrink-0 ${activeTab === 'sessions' ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                {(!isSidebarCollapsed || isMobileSidebarOpen) && (
                  <span className="truncate">受訓人員場次列表</span>
                )}
              </button>
            )}

            {/* 即時鏡像監看 (僅督導) */}
            {isStaff && (
              <button
                onClick={() => {
                  setActiveTab('live');
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all group ${
                  activeTab === 'live'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-md shadow-emerald-500/5'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
                title="VR 訓練場次即時鏡像監看"
              >
                <Radio className={`w-4 h-4 shrink-0 ${activeTab === 'live' ? 'text-emerald-400 animate-pulse' : 'text-slate-400 group-hover:text-slate-200'}`} />
                {(!isSidebarCollapsed || isMobileSidebarOpen) && (
                  <div className="flex items-center justify-between flex-1 truncate">
                    <span className="truncate">即時鏡像監看</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  </div>
                )}
              </button>
            )}

            {/* 訪談訓練模擬器 (全部身分) */}
            <button
              onClick={() => {
                setActiveTab('trainer');
                setIsMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all group ${
                activeTab === 'trainer'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-md shadow-amber-500/5'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
              title="訪談訓練模擬器 (Web/VR Trainer)"
            >
              <Sparkles className={`w-4 h-4 shrink-0 ${activeTab === 'trainer' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              {(!isSidebarCollapsed || isMobileSidebarOpen) && (
                <span className="truncate">訪談訓練模擬器</span>
              )}
            </button>
          </div>

          {/* 區塊 2: 督導審查與學術研究 (僅督導) */}
          {isStaff && (
            <div className="space-y-1">
              {(!isSidebarCollapsed || isMobileSidebarOpen) && (
                <span className="px-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                  督導評鑑與研究
                </span>
              )}

              {/* 單次訪談深度報告 */}
              <button
                onClick={() => {
                  setActiveTab('report');
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all group ${
                  activeTab === 'report'
                    ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-md shadow-purple-500/5'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
                title="單次訪談深度報告"
              >
                <FileText className={`w-4 h-4 shrink-0 ${activeTab === 'report' ? 'text-purple-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                {(!isSidebarCollapsed || isMobileSidebarOpen) && (
                  <span className="truncate">訪談深度分析報告</span>
                )}
              </button>

              {/* 督導審查與覆評 */}
              <button
                onClick={() => {
                  setActiveTab('review');
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all group ${
                  activeTab === 'review'
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-md shadow-indigo-500/5'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
                title="督導審查與覆評"
              >
                <CheckSquare className={`w-4 h-4 shrink-0 ${activeTab === 'review' ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                {(!isSidebarCollapsed || isMobileSidebarOpen) && (
                  <span className="truncate">督導審查與覆評</span>
                )}
              </button>

              {/* 總體數據與研究匯出 */}
              <button
                onClick={() => {
                  setActiveTab('analytics');
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all group ${
                  activeTab === 'analytics'
                    ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30 shadow-md shadow-blue-500/5'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
                title="總體數據與研究匯出"
              >
                <BarChart3 className={`w-4 h-4 shrink-0 ${activeTab === 'analytics' ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                {(!isSidebarCollapsed || isMobileSidebarOpen) && (
                  <span className="truncate">數據統計與 LSA 匯出</span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Footer: 使用者資訊卡片與登出 */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
          {currentUser && (
            <div className={`flex items-center gap-2.5 rounded-xl p-2 bg-slate-900/80 border border-slate-800/90 ${
              isSidebarCollapsed && !isMobileSidebarOpen ? 'justify-center' : ''
            }`}>
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                {isStaff ? (
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                ) : (
                  <GraduationCap className="w-4 h-4 text-sky-400" />
                )}
              </div>
              
              {(!isSidebarCollapsed || isMobileSidebarOpen) && (
                <div className="flex-1 truncate">
                  <div className="text-xs font-bold text-white truncate">
                    {currentUser.name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      isStaff 
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                        : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    }`}>
                      {isStaff ? '督導/教授' : '受訓學員'}
                    </span>
                  </div>
                </div>
              )}

              {(!isSidebarCollapsed || isMobileSidebarOpen) && (
                <button
                  onClick={handleSignOut}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                  title="登出帳號"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 2. 主內容區域：頂部導覽列 (Navbar) + 主展示區 (Main Content) */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* 頂部導覽列 (Navbar) */}
        <header className="sticky top-0 z-30 h-16 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between shadow-lg shadow-slate-950/20">
          {/* 左側：漢堡按鈕 + 麵包屑導航 */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl transition"
              title="開啟側邊選單"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* 麵包屑導航 (Breadcrumbs) */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 hidden sm:inline">後台系統</span>
              <span className="text-slate-600 hidden sm:inline">/</span>
              <span className="text-slate-400 font-medium hidden sm:inline">{currentMeta.category}</span>
              <span className="text-slate-600 hidden sm:inline">/</span>
              <div className="flex items-center gap-1.5 font-bold text-white bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded-lg">
                <currentMeta.icon className={`w-3.5 h-3.5 ${currentMeta.color}`} />
                <span>{currentMeta.title}</span>
              </div>
            </div>
          </div>

          {/* 右側：AI 狀態 + 平台入口 + 規格歷程 */}
          <div className="flex items-center gap-2.5">
            {/* 伺服器狀態標籤 */}
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              serverStatus.online
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/40 text-amber-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                serverStatus.online ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}></span>
              <span className="hidden sm:inline">
                {serverStatus.online 
                  ? `AI 核心在線 (${serverStatus.message || 'Gemini 2.5 Flash'})` 
                  : '離線模擬防護模式'}
              </span>
              <span className="sm:hidden font-mono">
                {serverStatus.online ? 'AI 正常' : '離線'}
              </span>
            </div>

            {/* 返回整合平台 */}
            <a
              href="/portal"
              className="px-3 py-1.5 text-slate-300 hover:text-white bg-slate-900/90 hover:bg-slate-800 rounded-xl text-xs flex items-center gap-1.5 border border-slate-800 transition shadow-sm"
              title="返回 IEP 整合平台首頁"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden md:inline">整合平台</span>
            </a>

            {/* 規格歷程 */}
            <button
              onClick={() => setShowChangelog(true)}
              className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900/90 hover:bg-slate-800 rounded-xl text-xs flex items-center gap-1 border border-slate-800 transition"
              title="系統架構與版本歷程"
            >
              <HelpCircle className="w-4 h-4 text-slate-400" />
              <span className="hidden xl:inline text-slate-300">規格說明</span>
            </button>
          </div>
        </header>

        {/* 主資料展示區 (Main Content) */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {/* 1. 受訓人員場次總覽 (全新卡片+表格面板) */}
          {isStaff && activeTab === 'sessions' && (
            <TraineeSessionListView
              onSelectSessionForReport={handleSelectSessionForReport}
              onSelectSessionForReview={handleSelectSessionForReview}
              onSelectSessionForLive={handleSelectSessionForLive}
            />
          )}

          {/* 2. 即時鏡像監控 */}
          {isStaff && activeTab === 'live' && (
            <LiveMonitorView
              initialSessionId={targetSessionId}
              onSelectSessionForReport={handleSelectSessionForReport}
              onSelectSessionForReview={handleSelectSessionForReview}
            />
          )}

          {/* 3. 單次訪談深度報告 */}
          {isStaff && activeTab === 'report' && (
            <SessionReportView
              initialSessionId={targetSessionId}
              onGoToReview={handleSelectSessionForReview}
            />
          )}

          {/* 4. 督導審查與覆評 */}
          {isStaff && activeTab === 'review' && (
            <SupervisorReviewPanel
              initialSessionId={targetSessionId}
            />
          )}

          {/* 5. 總體數據與研究匯出 */}
          {isStaff && activeTab === 'analytics' && (
            <AnalyticsExportView />
          )}

          {/* 6. 訪談訓練模擬器 */}
          {activeTab === 'trainer' && (
            <InteractiveTrainer
              currentUser={currentUser}
              onSessionEnded={handleSessionEndedInTrainer}
            />
          )}
        </main>

        {/* 頁尾 */}
        <footer className="border-t border-slate-900/80 bg-slate-950/60 py-4 px-6 text-center text-xs text-slate-500">
          <p>
            國立臺中教育大學 · 國科會專題研究計畫 · IFSP 家庭訪談能力訓練系統 (Unity VR + Gemini 2.5 Flash + Express + Firestore)
          </p>
        </footer>
      </div>

      {/* 更新歷程與規格彈窗 */}
      <ChangelogModal
        isOpen={showChangelog}
        onClose={() => setShowChangelog(false)}
        changelogs={CHANGELOG_DATA}
      />
    </div>
  );
}
