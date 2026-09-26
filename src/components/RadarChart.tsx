import React from 'react';

export interface RadarDimension {
  key: string;
  name: string;
  score: number;
  max: number;
  supervisorScore?: number;
}
export const RadarDimension = {};

interface RadarChartProps {
  dimensions: RadarDimension[];
  size?: number;
  showSupervisor?: boolean;
}

export const RadarChart: React.FC<RadarChartProps> = ({ 
  dimensions, 
  size = 320, 
  showSupervisor = false 
}) => {
  const center = size / 2;
  const radius = size * 0.38;
  const total = dimensions.length;

  if (total < 3) return null;

  const angleStep = (Math.PI * 2) / total;
  // Offset so first point is at top (-PI/2)
  const getAngle = (i: number) => -Math.PI / 2 + i * angleStep;

  // Grid levels (25%, 50%, 75%, 100%)
  const levels = [0.25, 0.5, 0.75, 1.0];

  const getCoordinates = (angle: number, distance: number) => {
    return {
      x: center + distance * Math.cos(angle),
      y: center + distance * Math.sin(angle),
    };
  };

  // Build polygon path for AI score
  const aiPoints = dimensions.map((d, i) => {
    const ratio = Math.max(0, Math.min(1, d.score / d.max));
    const dist = ratio * radius;
    const { x, y } = getCoordinates(getAngle(i), dist);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  // Build polygon path for Supervisor score
  const supPoints = dimensions.map((d, i) => {
    const s = d.supervisorScore !== undefined ? d.supervisorScore : d.score;
    const ratio = Math.max(0, Math.min(1, s / d.max));
    const dist = ratio * radius;
    const { x, y } = getCoordinates(getAngle(i), dist);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="flex flex-col items-center select-none">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* Background Concentric Webs */}
        {levels.map((lvl) => {
          const webPoints = dimensions.map((_, i) => {
            const { x, y } = getCoordinates(getAngle(i), radius * lvl);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          }).join(' ');
          return (
            <polygon
              key={lvl}
              points={webPoints}
              fill={lvl === 1.0 ? 'rgba(15, 23, 42, 0.6)' : 'none'}
              stroke="#334155"
              strokeWidth={lvl === 1.0 ? '1.5' : '1'}
              strokeDasharray={lvl < 1.0 ? '2 2' : 'none'}
            />
          );
        })}

        {/* Axes */}
        {dimensions.map((_, i) => {
          const { x, y } = getCoordinates(getAngle(i), radius);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="#334155"
              strokeWidth="1"
            />
          );
        })}

        {/* AI Scores Polygon */}
        <polygon
          points={aiPoints}
          fill="rgba(56, 189, 248, 0.25)"
          stroke="#38bdf8"
          strokeWidth="2.5"
        />

        {/* AI Score Points */}
        {dimensions.map((d, i) => {
          const ratio = Math.max(0, Math.min(1, d.score / d.max));
          const { x, y } = getCoordinates(getAngle(i), ratio * radius);
          return (
            <circle
              key={`ai-pt-${i}`}
              cx={x}
              cy={y}
              r="4"
              fill="#0284c7"
              stroke="#e0f2fe"
              strokeWidth="1.5"
            />
          );
        })}

        {/* Supervisor Scores Polygon (if active) */}
        {showSupervisor && (
          <>
            <polygon
              points={supPoints}
              fill="rgba(168, 85, 247, 0.25)"
              stroke="#a855f7"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
            {dimensions.map((d, i) => {
              const s = d.supervisorScore !== undefined ? d.supervisorScore : d.score;
              const ratio = Math.max(0, Math.min(1, s / d.max));
              const { x, y } = getCoordinates(getAngle(i), ratio * radius);
              return (
                <circle
                  key={`sup-pt-${i}`}
                  cx={x}
                  cy={y}
                  r="4"
                  fill="#7e22ce"
                  stroke="#f3e8ff"
                  strokeWidth="1.5"
                />
              );
            })}
          </>
        )}

        {/* Dimension Labels */}
        {dimensions.map((d, i) => {
          const labelDist = radius + 24;
          const { x, y } = getCoordinates(getAngle(i), labelDist);
          const isTop = y < center - 20;
          const isBottom = y > center + 20;
          const textAnchor = Math.abs(x - center) < 15 ? 'middle' : x > center ? 'start' : 'end';

          return (
            <g key={`lbl-${i}`} transform={`translate(${x}, ${y})`}>
              <text
                textAnchor={textAnchor}
                className="text-[11px] font-medium fill-slate-300"
                dy={isTop ? '-4' : isBottom ? '12' : '4'}
              >
                {d.name}
              </text>
              <text
                textAnchor={textAnchor}
                className="text-[10px] font-bold fill-sky-400 font-mono"
                dy={isTop ? '8' : isBottom ? '24' : '16'}
              >
                {d.score} / {d.max}分
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-sky-400 border border-sky-200"></span>
          <span className="text-slate-300">AI 初評</span>
        </div>
        {showSupervisor && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-purple-500 border border-purple-200"></span>
            <span className="text-slate-300">督導覆評</span>
          </div>
        )}
      </div>
    </div>
  );
};
