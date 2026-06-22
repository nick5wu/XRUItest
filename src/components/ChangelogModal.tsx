import React from 'react';
import { X, Calendar } from 'lucide-react';
import { CHANGELOG_DATA } from '../constants/changelog';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangelogModal({ isOpen, onClose }: ChangelogModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn">
      {/* 點擊背景關閉 */}
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <div className="w-full max-w-xl glass-panel p-6 rounded-3xl shadow-2xl border border-slate-700 relative overflow-hidden animate-scaleUp z-10">
        {/* 背景裝飾 */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-pink-500/5 rounded-full blur-3xl"></div>
        
        {/* 右上角 X 關閉按鈕 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/50 transition duration-200"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 標頭 */}
        <div className="flex items-center gap-3 mb-6 pb-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 text-base">
            🚀
          </div>
          <div>
            <h3 className="font-extrabold text-base text-slate-100 font-sans">系統更新日誌 (Changelog)</h3>
            <p className="text-[10px] text-slate-400 font-sans">追蹤系統功能迭代與修復紀錄</p>
          </div>
        </div>

        {/* 時間軸內容 */}
        <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
          {CHANGELOG_DATA.map((item, index) => (
            <div key={item.version} className="relative pl-6 pb-2 last:pb-0 font-sans">
              {/* 時間軸垂直引導線 */}
              {index !== CHANGELOG_DATA.length - 1 && (
                <span className="absolute left-[9px] top-4 bottom-0 w-[2px] bg-slate-800" aria-hidden="true" />
              )}
              {/* 時間軸圓點 */}
              <span 
                className={`absolute left-[4px] top-1.5 w-3 h-3 rounded-full border-2 ${
                  index === 0 
                    ? 'bg-indigo-500 border-indigo-300 shadow-[0_0_8px_rgba(99,102,241,0.8)]' 
                    : 'bg-slate-800 border-slate-600'
                }`} 
                aria-hidden="true" 
              />
              
              <div className="space-y-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md ${
                    index === 0 
                      ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300' 
                      : 'bg-slate-800 border border-slate-700 text-slate-400'
                  }`}>
                    {item.version}
                  </span>
                  <span className="text-xs text-slate-200 font-bold">{item.title}</span>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium ml-auto">
                    <Calendar className="w-3.5 h-3.5" />
                    {item.date}
                  </span>
                </div>
                
                <ul className="space-y-1.5 pl-1">
                  {item.changes.map((change, cIdx) => (
                    <li key={cIdx} className="text-xs text-slate-400 leading-relaxed flex items-start gap-1.5">
                      <span className="text-indigo-400 shrink-0 mt-1.5 w-1 h-1 rounded-full bg-indigo-400" />
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* 底部關閉按鈕 */}
        <div className="flex mt-6 justify-end font-sans">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl border border-slate-750 hover:border-slate-700 transition cursor-pointer"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
