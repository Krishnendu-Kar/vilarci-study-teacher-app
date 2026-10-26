import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

const N = 21;
const FINDERS: [number, number][] = [
  [0, 0],
  [N - 7, 0],
  [0, N - 7],
];

function prng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
}

/** null = outside every finder pattern; otherwise whether that module is dark. */
function finderModule(x: number, y: number): boolean | null {
  for (const [ox, oy] of FINDERS) {
    const lx = x - ox;
    const ly = y - oy;
    if (lx < 0 || ly < 0 || lx > 6 || ly > 6) continue;
    const ring = lx === 0 || ly === 0 || lx === 6 || ly === 6;
    const core = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4;
    return ring || core;
  }
  return null;
}

/**
 * Deterministic QR-style check-in matrix drawn in pure SVG, seeded by deck and
 * date so it rotates daily — the mobile port of the portal's SVG QR terminal.
 * It is a visual classroom token, not an ISO QR encoding.
 */
export function CheckInCode({
  seed,
  size = 168,
  color = '#16110F',
  bg = '#FFFFFF',
}: {
  seed: string;
  size?: number;
  color?: string;
  bg?: string;
}) {
  const cells = useMemo(() => {
    const rand = prng(seed);
    const on: [number, number][] = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const finder = finderModule(x, y);
        if (finder ?? rand() > 0.52) on.push([x, y]);
      }
    }
    return on;
  }, [seed]);

  const quiet = 2;
  const unit = size / (N + quiet * 2);
  return (
    <View style={{ width: size, height: size, borderRadius: 14, overflow: 'hidden', backgroundColor: bg }}>
      <Svg width={size} height={size}>
        {cells.map(([x, y]) => (
          <Rect
            key={`${x}-${y}`}
            x={(x + quiet) * unit}
            y={(y + quiet) * unit}
            width={unit + 0.3}
            height={unit + 0.3}
            fill={color}
          />
        ))}
      </Svg>
    </View>
  );
}
