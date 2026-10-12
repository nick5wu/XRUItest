import React, { useState, useEffect } from 'react';
import { 
  Award, 
  RotateCcw, 
  Save, 
  CheckCircle, 
  AlertCircle, 
  User, 
  Clock, 
  HelpCircle,
  FileCheck,
  BookOpen
} from 'lucide-react';
import { apiClient, ApiSession, ApiSessionFullDetail } from '../services/apiClient';
import { caseProfiles } from '../constants/cases';

interface SupervisorReviewPanelProps {
  initialSessionId?: string;
}

export const SupervisorReviewPanel: React.FC<SupervisorReviewPanelProps> = ({
  initialSessionId
}) => {
  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(initialSessionId || '');
  const [detail, setDetail] = useState<ApiSessionFullDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 督導評分表單狀態 (對齊 100 分制六大面向權重)
  const [supervisorScores, setSupervisorScores] = useState({
    dimension_1_rapport: 12,        // max 15
    dimension_2_questioning: 20,    // max 25
    dimension_3_empathy: 16,        // max 20
    dimension_4_family_centered: 12,// max 15
    dimension_5_ifsp_info: 15,      // max 20
    dimension_6_time_mgmt: 4        // max 5
  });

  const [supervisorComments, setSupervisorComments] = useState<string>('');
  const [requireRepetition, setRequireRepetition] = useState<boolean>(false);

  // 載入場次清單
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

  // 載入場次細節並同步分數
  useEffect(() => {
    if (selectedSessionId) {
      setIsLoading(true);
      setFeedbackMsg(null);
      apiClient.getSessionDetail(selectedSessionId).then(data => {
        setDetail(data);
        if (data) {
          // 若有既有的督導評分，優先代入；否則以 AI 初評作為基礎代入
          if (data.supervisorScores) {
            setSupervisorScores({
              dimension_1_rapport: data.supervisorScores.dimension_1_rapport ?? 12,
              dimension_2_questioning: data.supervisorScores.dimension_2_questioning ?? 20,
              dimension_3_empathy: data.supervisorScores.dimension_3_empathy ?? 16,
              dimension_4_family_centered: data.supervisorScores.dimension_4_family_centered ?? 12,
              dimension_5_ifsp_info: data.supervisorScores.dimension_5_ifsp_info ?? 15,
              dimension_6_time_mgmt: data.supervisorScores.dimension_6_time_mgmt ?? 4
            });
            setSupervisorComments(data.supervisorScores.feedback_comments || '');
            setRequireRepetition(Boolean(data.supervisorScores.require_repetition));
          } else if (data.aiScores) {
            setSupervisorScores({
              dimension_1_rapport: data.aiScores.dimension_1_rapport ?? 12,
              dimension_2_questioning: data.aiScores.dimension_2_questioning ?? 20,
              dimension_3_empathy: data.aiScores.dimension_3_empathy ?? 16,
              dimension_4_family_centered: data.aiScores.dimension_4_family_centered ?? 12,
              dimension_5_ifsp_info: data.aiScores.dimension_5_ifsp_info ?? 15,
              dimension_6_time_mgmt: data.aiScores.dimension_6_time_mgmt ?? 4
            });
            setSupervisorComments('');
            setRequireRepetition(false);
          }
        }
      }).finally(() => setIsLoading(false));
    }
  }, [selectedSessionId]);

  const handleScoreChange = (field: keyof typeof supervisorScores, value: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, isNaN(value) ? 0 : value));
    setSupervisorScores(prev => ({
      ...prev,
      [field]: clamped
    }));
  };

  const handleFastFillAIScores = () => {
    if (!detail?.aiScores) return;
    setSupervisorScores({
      dimension_1_rapport: detail.aiScores.dimension_1_rapport ?? 0,
      dimension_2_questioning: detail.aiScores.dimension_2_questioning ?? 0,
      dimension_3_empathy: detail.aiScores.dimension_3_empathy ?? 0,
      dimension_4_family_centered: detail.aiScores.dimension_4_family_centered ?? 0,
      dimension_5_ifsp_info: detail.aiScores.dimension_5_ifsp_info ?? 0,
      dimension_6_time_mgmt: detail.aiScores.dimension_6_time_mgmt ?? 0
    });
  };

  const currentTotal = 
    supervisorScores.dimension_1_rapport +
    supervisorScores.dimension_2_questioning +
    supervisorScores.dimension_3_empathy +
    supervisorScores.dimension_4_family_centered +
    supervisorScores.dimension_5_ifsp_info +
    supervisorScores.dimension_6_time_mgmt;

  const handleSubmitReview = async () => {
    if (!selectedSessionId) return;
    setIsSubmitting(true);
    setFeedbackMsg(null);
    try {
      const res = await apiClient.submitSupervisorReview(
        selectedSessionId,
        supervisorScores,
        supervisorComments,
        requireRepetition,
        'supervisor_prof_zhang'
      );
      if (res.success) {
        setFeedbackMsg({
          type: 'success',
          text: `覆核完成！督導核定總分：${res.totalScore} 分${requireRepetition ? '（已標註需重新練習）' : ''}`
        });
        // 重新整理目前場次資訊
        apiClient.getSessionDetail(selectedSessionId).then(data => setDetail(data));
      } else {
        setFeedbackMsg({ type: 'error', text: '儲存失敗，請檢查連線' });
      }
    } catch (e: any) {
      setFeedbackMsg({ type: 'error', text: e.message || '儲存過程發生錯誤' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const aiScores = detail?.aiScores;
  const currentSession = detail?.session;
  const currentCase = detail?.caseProfile;

  return (
    <div className="space-y-6">
      {/* 頂部選單列 */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">
              督導人工審查與雙軌覆評介面 (Supervisor Review Panel)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              提供督導教授進行 AI / 督導雙軌評分對比、撰寫質性指導回饋與指定學員重練
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-emerald-500 max-w-xs"
          >
            {sessions.map((s) => {
              const caseName = caseProfiles.find(c => c.case_id === s.case_id || c.id === s.case_id)?.persona_name || s.case_id;
              return (
                <option key={s.session_id} value={s.session_id}>
                  {s.supervisor_reviewed ? `✅ 已覆核 (${s.supervisor_total_score}分)` : '⏳ 待覆核'} - 學員: {s.user_id} · {caseName}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <span>正在載入場次審查資料...</span>
        </div>
      ) : !detail ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          請選擇場次進行督導人工審查
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* 左欄：場次資訊與 AI 初評結果 (5 欄寬) */}
          <div className="lg:col-span-5 space-y-5">
            {/* 基本資料卡 */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl text-xs space-y-2.5">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="font-bold text-white text-sm">訪談場次摘要</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  currentSession?.supervisor_reviewed 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  {currentSession?.supervisor_reviewed ? '已完成督導審定' : '待督導覆核'}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">受訓學員：</span>
                <span className="font-semibold text-white">{detail.user?.name || currentSession?.user_id}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">個案劇本：</span>
                <span className="font-semibold text-sky-300">{currentCase?.persona_name || currentSession?.case_id}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">設定時長 / 發言數：</span>
                <span className="font-semibold text-slate-200">{currentSession?.selected_duration} 分鐘 / {detail.utterances.length} 句</span>
              </div>
            </div>

            {/* AI 初評對比卡片 (唯讀) */}
            <div className="bg-slate-900/90 border border-sky-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-sky-400" />
                  <h3 className="text-sm font-bold text-white">AI 自動初評 (對照軌)</h3>
                </div>
                <div className="text-right">
                  <span className="text-lg font-extrabold text-sky-400 font-mono">
                    {aiScores?.total_score ?? '無'}
                  </span>
                  <span className="text-xs text-slate-400 ml-1">/ 100 分</span>
                </div>
              </div>

              {aiScores ? (
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">1. 開場與關係建立 (15%)</span>
                    <span className="font-mono text-sky-400 font-bold">{aiScores.dimension_1_rapport} / 15</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">2. 提問技巧與作息本位 (25%)</span>
                    <span className="font-mono text-sky-400 font-bold">{aiScores.dimension_2_questioning} / 25</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">3. 同理敏感度與非評價 (20%)</span>
                    <span className="font-mono text-sky-400 font-bold">{aiScores.dimension_3_empathy} / 20</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">4. 家庭中心與優勢導向 (15%)</span>
                    <span className="font-mono text-sky-400 font-bold">{aiScores.dimension_4_family_centered} / 15</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">5. IFSP 前置資訊完整度 (20%)</span>
                    <span className="font-mono text-sky-400 font-bold">{aiScores.dimension_5_ifsp_info} / 20</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-300">6. 時間任務完成與組織 (5%)</span>
                    <span className="font-mono text-sky-400 font-bold">{aiScores.dimension_6_time_mgmt} / 5</span>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleFastFillAIScores}
                      className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 rounded-xl text-[11px] font-medium transition-colors"
                    >
                      複製 AI 初評分數至右側督導欄位
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 text-center py-6">
                  本場次尚未由 AI 完成結算評分
                </div>
              )}
            </div>

            {/* 學員自評反思 (若有) */}
            {detail.selfReflection && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>學員自評與反思日誌</span>
                </div>
                <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-slate-300 leading-relaxed">
                  <p className="font-semibold text-slate-200 mb-1">心得反思：</p>
                  <p>{detail.selfReflection.reflection_text || '（無輸入文字）'}</p>
                  {detail.selfReflection.key_learnings && (
                    <>
                      <p className="font-semibold text-slate-200 mt-2 mb-1">關鍵學習：</p>
                      <p>{detail.selfReflection.key_learnings}</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 右欄：督導人工覆評表單 (7 欄寬) */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-emerald-500/40 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-base font-bold text-white">
                    督導人工覆審評分表 (審核軌)
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-400 font-mono">
                    {currentTotal}
                  </span>
                  <span className="text-xs text-slate-400 ml-1">/ 100 分</span>
                </div>
              </div>

              {/* 六大面向評分輸入項 */}
              <div className="space-y-4">
                {/* 1. 開場與關係建立 */}
                <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-200">1. 開場與關係建立能力 (15%)</span>
                    <p className="text-[11px] text-slate-400">前 3 分鐘破冰、目的說明與初期信任增幅</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={15}
                      value={supervisorScores.dimension_1_rapport}
                      onChange={(e) => handleScoreChange('dimension_1_rapport', parseInt(e.target.value), 15)}
                      className="w-16 bg-slate-900 border border-slate-700 focus:border-emerald-500 text-center font-mono font-bold text-sm text-emerald-300 rounded-lg py-1 outline-none"
                    />
                    <span className="text-slate-400">/ 15</span>
                  </div>
                </div>

                {/* 2. 提問技巧與作息本位 */}
                <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-200">2. 提問技巧與作息本位能力 (25%)</span>
                    <p className="text-[11px] text-slate-400">開放式問句比例、日常生活作息提問次數</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={25}
                      value={supervisorScores.dimension_2_questioning}
                      onChange={(e) => handleScoreChange('dimension_2_questioning', parseInt(e.target.value), 25)}
                      className="w-16 bg-slate-900 border border-slate-700 focus:border-emerald-500 text-center font-mono font-bold text-sm text-emerald-300 rounded-lg py-1 outline-none"
                    />
                    <span className="text-slate-400">/ 25</span>
                  </div>
                </div>

                {/* 3. 同理、敏感度與非評價態度 */}
                <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-200">3. 同理敏感度與非評價態度 (20%)</span>
                    <p className="text-[11px] text-slate-400">同理語句次數，扣除評價、責備與過早建議</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={supervisorScores.dimension_3_empathy}
                      onChange={(e) => handleScoreChange('dimension_3_empathy', parseInt(e.target.value), 20)}
                      className="w-16 bg-slate-900 border border-slate-700 focus:border-emerald-500 text-center font-mono font-bold text-sm text-emerald-300 rounded-lg py-1 outline-none"
                    />
                    <span className="text-slate-400">/ 20</span>
                  </div>
                </div>

                {/* 4. 家庭中心與優勢導向 */}
                <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-200">4. 家庭中心與優勢導向能力 (15%)</span>
                    <p className="text-[11px] text-slate-400">探詢家庭隱藏痛點、賦權語言與資源盤點</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={15}
                      value={supervisorScores.dimension_4_family_centered}
                      onChange={(e) => handleScoreChange('dimension_4_family_centered', parseInt(e.target.value), 15)}
                      className="w-16 bg-slate-900 border border-slate-700 focus:border-emerald-500 text-center font-mono font-bold text-sm text-emerald-300 rounded-lg py-1 outline-none"
                    />
                    <span className="text-slate-400">/ 15</span>
                  </div>
                </div>

                {/* 5. IFSP 前置資訊完整度 */}
                <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-200">5. IFSP 前置資訊完整度 (20%)</span>
                    <p className="text-[11px] text-slate-400">兒童發展、活動作息、需求與優勢完整率</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={supervisorScores.dimension_5_ifsp_info}
                      onChange={(e) => handleScoreChange('dimension_5_ifsp_info', parseInt(e.target.value), 20)}
                      className="w-16 bg-slate-900 border border-slate-700 focus:border-emerald-500 text-center font-mono font-bold text-sm text-emerald-300 rounded-lg py-1 outline-none"
                    />
                    <span className="text-slate-400">/ 20</span>
                  </div>
                </div>

                {/* 6. 時間任務完成與組織 */}
                <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-200">6. 時間內任務完成與組織能力 (5%)</span>
                    <p className="text-[11px] text-slate-400">在選定時長內收斂結構、歸納與結尾能力</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={supervisorScores.dimension_6_time_mgmt}
                      onChange={(e) => handleScoreChange('dimension_6_time_mgmt', parseInt(e.target.value), 5)}
                      className="w-16 bg-slate-900 border border-slate-700 focus:border-emerald-500 text-center font-mono font-bold text-sm text-emerald-300 rounded-lg py-1 outline-none"
                    />
                    <span className="text-slate-400">/ 5</span>
                  </div>
                </div>
              </div>

              {/* 督導具體評語輸入 */}
              <div className="mt-4">
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  督導質性指導評語 (Feedback Comments)
                </label>
                <textarea
                  value={supervisorComments}
                  onChange={(e) => setSupervisorComments(e.target.value)}
                  rows={3}
                  placeholder="請針對學員作息探詢之深入程度、同理敏銳度與踩雷修復給予指引..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-200 text-xs rounded-xl p-3 outline-none transition-colors"
                />
              </div>

              {/* 指定重練選項 */}
              <div className="mt-3 p-3 bg-rose-950/20 border border-rose-900/40 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-rose-300">指定學員重新練習 (Require Repractice)</span>
                  <p className="text-[11px] text-slate-400">若防衛觸發次數過高或未完成基本作息盤點，可標註要求重新進 VR 模擬</p>
                </div>
                <input
                  type="checkbox"
                  checked={requireRepetition}
                  onChange={(e) => setRequireRepetition(e.target.checked)}
                  className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* 提交與回饋訊息 */}
            <div>
              {feedbackMsg && (
                <div className={`p-3 rounded-xl mb-3 text-xs flex items-center gap-2 ${
                  feedbackMsg.type === 'success' 
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' 
                    : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                }`}>
                  {feedbackMsg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span>{feedbackMsg.text}</span>
                </div>
              )}

              <button
                onClick={handleSubmitReview}
                disabled={isSubmitting}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? '儲存覆核中...' : '送出督導人工覆評並存檔'}</span>
              </button>
            </div>

          </div>

        </div>
      )}
    </div>
  );
};
