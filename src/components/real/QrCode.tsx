import React, { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { create } from 'qrcode';

/** The standard's quiet zone: 4 light modules around the code. */
const QUIET = 4;

/**
 * A real, scannable QR code (the `qrcode` encoder, error correction M) drawn
 * with SVG. Always dark on light — cameras need the contrast, also in dark mode.
 */
export function QrCode({
  value,
  size = 220,
  color = '#141414',
  background = '#FFFFFF',
}: {
  value: string;
  size?: number;
  color?: string;
  background?: string;
}) {
  const { d, span } = useMemo(() => {
    const qr = create(value, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size;
    const data = qr.modules.data;
    // One rectangle per run of dark modules in a row: no hairline seams between squares.
    let path = '';
    for (let y = 0; y < n; y++) {
      let x = 0;
      while (x < n) {
        if (!data[y * n + x]) {
          x += 1;
          continue;
        }
        const from = x;
        while (x < n && data[y * n + x]) x += 1;
        path += `M${from + QUIET} ${y + QUIET}h${x - from}v1h${from - x}z`;
      }
    }
    return { d: path, span: n + QUIET * 2 };
  }, [value]);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${span} ${span}`} accessibilityRole="image" accessibilityLabel="Join QR code">
      <Rect width={span} height={span} fill={background} />
      <Path d={d} fill={color} />
    </Svg>
  );
}
