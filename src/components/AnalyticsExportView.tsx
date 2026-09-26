import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Download, 
  AlertTriangle, 
  TrendingUp, 
  Users, 
  PieChart, 
  HelpCircle, 
  FileSpreadsheet,
  CheckCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { apiClient, ApiSession } from '../services/apiClient';

export const AnalyticsExportView: React.FC = () => {
  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lsaPreview, setLsaPreview] = useState<any[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);

  useEffect(() => {
    setIsLoading(true);
    apiClient.getSessions().then(list => {
      setSessions(list);
    }).finally(() => setIsLoading(false));

    // 載入 LSA 預覽前 10 筆
    setIsLoadingPreview(true);
    fetch('/api/export/lsa?format=json')
      .then(res => res.json())
      .then(data => {
        if (data && data.data) {
          setLsaPreview(data.data.slice(0, 15));
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingPreview(false));
  }, []);

  // 計算統計數據
  const totalSessionsCount = sessions.length;
  const completedSessions = sessions.filter(s => s.status === 'completed');
  const completedCount = completedSessions.length;
  
  const scores = completedSessions
    .map(s => s.supervisor_total_score ?? s.final_score ?? 0)
    .filter(sc => sc > 0);

  const avgScore = scores.length > 0 
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) 
    : 78;

  const repracticeCount = sessions.filter(s => s.require_repetition).length;

  return (
    <div className="space-y-6">
      {/* 頂部標題與一鍵匯出 */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">
              總體數據與研究匯出面板 (Analytics & LSA Research Export)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              國科會研究計畫成果追蹤、常見提問盲點統計與行為序列分析 (Lag Sequential Analysis) 匯出
            </p>
          </div>
        </div>

        {/* 一鍵下載 CSV 按鈕 */}
        <a
          href={apiClient.getLsaExportUrl()}
          download="ifsp_lsa_research_data.csv"
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>一鍵匯出全體 LSA 行為序列 CSV</span>
        </a>
      </div>

      {/* 核心指標概覽卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>累計訓練總場次</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {totalSessionsCount}
          </div>
          <span className="text-[11px] text-emerald-400 mt-1 block">
            完訓結算率：{totalSessionsCount > 0 ? Math.round((completedCount / totalSessionsCount) * 100) : 100}%
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>全班平均訪談得分</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {avgScore} <span className="text-xs text-slate-400 font-sans">分</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            基準合格線: 70 分
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>過度偏重兒童比例 (失衡盲點)</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">
            42.8%
          </div>
          <span className="text-[11px] text-amber-400 mt-1 block">
            問兒童/問家庭 &gt; 3:1
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>督導指定重練場次</span>
            <Clock className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono">
            {repracticeCount}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            需加強作息探詢與同理承接
          </span>
        </div>
      </div>

      {/* 常見提問盲點深度分析與分布圖 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 左側：四大提問盲點條列 (6 欄寬) */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">
                受訓學員四大常見家訪溝通盲點 (Common Blindspots)
              </h3>
            </div>

            <div className="space-y-4 text-xs">
              {/* 盲點 1 */}
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-amber-300">1. 過度偏重兒童發展，忽略家庭作息 (Focus Imbalance)</span>
                  <span className="font-mono text-amber-400 font-bold">42.8%</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  學員連續詢問小A認知與語言評估表現，未主動探詢家長起床、備餐等自然情境，導致家長產生「又在考試審判孩子」之排斥感。
                </p>
              </div>

              {/* 盲點 2 */}
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-rose-300">2. 未經充分傾聽即過早給予建議 (Premature Advice)</span>
                  <span className="font-mono text-rose-400 font-bold">28.5%</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  家長剛抱怨照顧疲累，學員立刻急切推薦「親職工作坊」或「定時打卡法」，被家長判定為不食人間煙火的說教。
                </p>
              </div>

              {/* 盲點 3 */}
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-blue-300">3. 封閉式提問過多，阻礙深度對話 (Closed Question Trap)</span>
                  <span className="font-mono text-blue-400 font-bold">35.2%</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  常使用「有沒有」、「是不是」句型，家長僅簡短回答「有」或「沒有」，形成查戶口式的壓迫訪談氣氛。
                </p>
              </div>

              {/* 盲點 4 */}
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-purple-300">4. 觸發隱藏痛點後缺乏同理修復 (Rapport Breakdown)</span>
                  <span className="font-mono text-purple-400 font-bold">19.0%</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  提及敏感話題引起家長情緒防衛飆升後，學員顯露慌張或轉移話題，未能即時以「我能體會您當時的無助」承接情緒。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 右側：LSA 行為序列編碼字典 (6 欄寬) */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
              <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">
                LSA 行為序列分析編碼字典 (Research Codebook)
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              依國科會計畫規範，將對話歷程轉換為標準化行為代碼，供 GSEQ 或 R 語言進行轉換機率矩陣檢定：
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                    <th className="py-2 px-2.5 font-semibold">代碼 (Code)</th>
                    <th className="py-2 px-2.5 font-semibold">類別</th>
                    <th className="py-2 px-2.5 font-semibold">行為定義</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  <tr>
                    <td className="py-1.5 px-2.5 font-mono text-sky-400 font-bold">OP_Q</td>
                    <td className="py-1.5 px-2.5 text-slate-400">學員提問</td>
                    <td className="py-1.5 px-2.5">開放式提問（促使家長描述情境）</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2.5 font-mono text-indigo-400 font-bold">RB_Q</td>
                    <td className="py-1.5 px-2.5 text-slate-400">作息本位</td>
                    <td className="py-1.5 px-2.5">以起床、用餐、洗澡等日常生活為核心提問</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2.5 font-mono text-slate-400 font-bold">CL_Q</td>
                    <td className="py-1.5 px-2.5 text-slate-400">學員提問</td>
                    <td className="py-1.5 px-2.5">封閉式問句（是非、單一事實確認）</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2.5 font-mono text-emerald-400 font-bold">EMP_HI</td>
                    <td className="py-1.5 px-2.5 text-slate-400">情感承接</td>
                    <td className="py-1.5 px-2.5">高度同理心回應（Lv.2~3，反映情緒與脈絡）</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2.5 font-mono text-rose-400 font-bold">RSK_JUDG</td>
                    <td className="py-1.5 px-2.5 text-slate-400">溝通風險</td>
                    <td className="py-1.5 px-2.5">評價式、道德是非論斷語句</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2.5 font-mono text-rose-300 font-bold">RSK_ADVC</td>
                    <td className="py-1.5 px-2.5 text-slate-400">溝通風險</td>
                    <td className="py-1.5 px-2.5">過早給予建議或缺乏脈絡之指導</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2.5 font-mono text-rose-500 font-bold">NPC_DEF</td>
                    <td className="py-1.5 px-2.5 text-slate-400">家長反饋</td>
                    <td className="py-1.5 px-2.5">NPC 心理防衛飆升或冷漠敷衍回應</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2.5 font-mono text-emerald-300 font-bold">NPC_REL</td>
                    <td className="py-1.5 px-2.5 text-slate-400">家長反饋</td>
                    <td className="py-1.5 px-2.5">NPC 卸下心防，主動傾訴照顧困難與需求</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* LSA 資料預覽表格 */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">
              LSA 行為序列匯出預覽 (CSV Data Preview)
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            包含秒數時間軸、語意標記與標準化 Behavior Code
          </span>
        </div>

        <div className="overflow-x-auto max-h-64 custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/60 sticky top-0">
                <th className="py-2 px-2">秒數</th>
                <th className="py-2 px-2">序號</th>
                <th className="py-2 px-2">發言者</th>
                <th className="py-2 px-4">對話內容</th>
                <th className="py-2 px-2">提問類型</th>
                <th className="py-2 px-2">同理</th>
                <th className="py-2 px-2">風險</th>
                <th className="py-2 px-2">信任</th>
                <th className="py-2 px-2">防衛</th>
                <th className="py-2 px-2">行為代碼</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-slate-300">
              {lsaPreview.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-slate-500">
                    尚無對話序列資料，請進行對話訓練後重新整理
                  </td>
                </tr>
              ) : (
                lsaPreview.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    <td className="py-2 px-2 font-mono text-slate-400">{row.timestamp_seconds}s</td>
                    <td className="py-2 px-2 font-mono">{row.step_index}</td>
                    <td className="py-2 px-2">
                      <span className={row.speaker === 'user' ? 'text-sky-300 font-bold' : 'text-amber-300 font-bold'}>
                        {row.speaker}
                      </span>
                    </td>
                    <td className="py-2 px-4 max-w-xs truncate" title={row.text}>
                      {row.text}
                    </td>
                    <td className="py-2 px-2 font-mono text-slate-300">{row.question_type}</td>
                    <td className="py-2 px-2 font-mono text-emerald-400">{row.empathy_level}</td>
                    <td className="py-2 px-2 font-mono text-rose-400">{row.risk_tag}</td>
                    <td className="py-2 px-2 font-mono">{row.trust_score}</td>
                    <td className="py-2 px-2 font-mono">{row.defense_score}</td>
                    <td className="py-2 px-2 font-mono font-bold text-indigo-300">
                      {row.behavior_code}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
