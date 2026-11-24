import React from 'react';
import { Image } from 'react-native';

const LOGO = require('../../../assets/logo.png');

/** The Vilarci logo (white mark on red), as a small rounded tile. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      source={LOGO}
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
      accessibilityRole="image"
      accessibilityLabel="Vilarci"
    />
  );
}
