import React from 'react';

export interface StatePoint {
  index: number;
  label?: string;
  trust: number;
  defense: number;
  rapport: number;
  timeSec?: number;
}
export const StatePoint = {};

interface DynamicStateChartProps {
  data: StatePoint[];
  height?: number;
}

export const DynamicStateChart: React.FC<DynamicStateChartProps> = ({ data, height = 220 }) => {
  if (!data || data.length === 0) {
    return (
      <div 
        className="w-full flex flex-col items-center justify-center text-slate-400 text-sm bg-slate-900/60 rounded-xl border border-slate-800"
        style={{ height }}
      >
        <span className="animate-pulse">尚無動態心理狀態紀錄，等待對話產生...</span>
      </div>
    );
  }

  const padding = { top: 20, right: 30, bottom: 30, left: 40 };
  const width = 600; // viewBox width for fluid scaling

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const pointsCount = Math.max(data.length, 2);

  const getX = (idx: number) => {
    if (data.length <= 1) return padding.left + plotWidth / 2;
    return padding.left + (idx / (data.length - 1)) * plotWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    return padding.top + plotHeight - (clamped / 100) * plotHeight;
  };

  const createPath = (key: 'trust' | 'defense' | 'rapport') => {
    return data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(d[key]).toFixed(1)}`).join(' ');
  };

  const trustPath = createPath('trust');
  const defensePath = createPath('defense');
  const rapportPath = createPath('rapport');

  // Area under curve for Trust and Defense
  const createArea = (key: 'trust' | 'defense', path: string) => {
    if (data.length === 0) return '';
    const lastX = getX(data.length - 1);
    const firstX = getX(0);
    const bottomY = getY(0);
    return `${path} L ${lastX.toFixed(1)} ${bottomY.toFixed(1)} L ${firstX.toFixed(1)} ${bottomY.toFixed(1)} Z`;
  };

  const trustArea = createArea('trust', trustPath);
  const defenseArea = createArea('defense', defensePath);

  const latest = data[data.length - 1];

  return (
    <div className="w-full relative flex flex-col bg-slate-950/80 border border-slate-800 rounded-xl p-3 shadow-inner">
      {/* Legend & Stats Bar */}
      <div className="flex items-center justify-between px-2 mb-2 text-xs border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
            <span className="text-emerald-300 font-medium">信任度 (Trust)</span>
            <span className="text-emerald-400 font-bold ml-1">{latest ? Math.round(latest.trust) : 0}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></span>
            <span className="text-rose-300 font-medium">防衛度 (Defense)</span>
            <span className="text-rose-400 font-bold ml-1">{latest ? Math.round(latest.defense) : 0}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"></span>
            <span className="text-amber-300 font-medium">關係分數 (Rapport)</span>
            <span className="text-amber-400 font-bold ml-1">{latest ? Math.round(latest.rapport) : 0}</span>
          </div>
        </div>
        <div className="text-slate-400 text-[11px]">
          對話輪次：<span className="text-slate-200 font-mono font-bold">{data.length}</span>
        </div>
      </div>

      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        className="w-full h-auto overflow-visible select-none"
      >
        <defs>
          <linearGradient id="trustGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="defenseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(val => {
          const y = getY(val);
          return (
            <g key={val}>
              <line 
                x1={padding.left} 
                y1={y} 
                x2={width - padding.right} 
                y2={y} 
                stroke="#334155" 
                strokeDasharray={val === 50 ? '3 3' : '2 2'}
                strokeOpacity={val === 50 ? 0.7 : 0.3}
              />
              <text 
                x={padding.left - 8} 
                y={y + 4} 
                fill="#64748b" 
                fontSize="10" 
                textAnchor="end"
                fontFamily="monospace"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Area Fills */}
        <path d={trustArea} fill="url(#trustGrad)" />
        <path d={defenseArea} fill="url(#defenseGrad)" />

        {/* Line Paths */}
        <path 
          d={trustPath} 
          fill="none" 
          stroke="#10b981" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        <path 
          d={defensePath} 
          fill="none" 
          stroke="#f43f5e" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        <path 
          d={rapportPath} 
          fill="none" 
          stroke="#fbbf24" 
          strokeWidth="1.8" 
          strokeDasharray="4 2" 
          strokeLinecap="round" 
        />

        {/* Data points */}
        {data.map((d, i) => {
          const x = getX(i);
          const yt = getY(d.trust);
          const yd = getY(d.defense);
          return (
            <g key={i}>
              <circle cx={x} cy={yt} r="3" fill="#047857" stroke="#34d399" strokeWidth="1.5" />
              <circle cx={x} cy={yd} r="3" fill="#be123c" stroke="#fb7185" strokeWidth="1.5" />
            </g>
          );
        })}

        {/* Last node highlights */}
        {data.length > 0 && (
          <>
            <circle 
              cx={getX(data.length - 1)} 
              cy={getY(latest.trust)} 
              r="6" 
              fill="#10b981" 
              className="animate-ping opacity-60" 
            />
            <circle 
              cx={getX(data.length - 1)} 
              cy={getY(latest.trust)} 
              r="5" 
              fill="#34d399" 
              stroke="#ffffff" 
              strokeWidth="2" 
            />
            <circle 
              cx={getX(data.length - 1)} 
              cy={getY(latest.defense)} 
              r="5" 
              fill="#f43f5e" 
              stroke="#ffffff" 
              strokeWidth="2" 
            />
          </>
        )}
      </svg>
    </div>
  );
};
