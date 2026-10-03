import React from 'react';
import { LinePath } from '@visx/shape';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 88,
  height = 28,
  color = '#10b981',
}) => {
  if (!data || data.length === 0) {
    return <div style={{ width, height }} className="bg-zinc-900/40 rounded-sm" />;
  }

  const effectiveData = data.length === 1 ? [data[0], data[0]] : data;
  const min = Math.min(...effectiveData);
  const max = Math.max(...effectiveData);
  const isFlat = max === min;
  const range = isFlat ? 1 : max - min;
  const paddingY = 4;
  const usableHeight = height - paddingY * 2;

  const getX = (_val: number, index: number) => {
    if (effectiveData.length <= 1) return 0;
    return (index / (effectiveData.length - 1)) * width;
  };

  const getY = (val: number) => {
    if (isFlat) return height / 2;
    return height - paddingY - ((val - min) / range) * usableHeight;
  };

  const lastIndex = effectiveData.length - 1;
  const lastX = Math.max(0, Math.min(width - 4, getX(effectiveData[lastIndex], lastIndex) - 2));
  const lastY = Math.max(0, Math.min(height - 4, getY(effectiveData[lastIndex]) - 2));

  return (
    <svg width={width} height={height} className="overflow-visible block">
      <LinePath<number>
        data={effectiveData}
        x={(d, i) => getX(d, i)}
        y={(d) => getY(d)}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      {effectiveData.length > 0 && (
        <rect
          x={lastX}
          y={lastY}
          width={4}
          height={4}
          fill={color}
          stroke="#09090b"
          strokeWidth={1}
        />
      )}
    </svg>
  );
};
