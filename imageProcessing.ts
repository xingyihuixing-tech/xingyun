import { AppSettings, DepthMode } from '../types';
import * as THREE from 'three';

// Simple Perlin-like noise function for 2D inputs
function noise(x: number, y: number) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
  return n - Math.floor(n);
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l]; // h, s, l in [0, 1]
}

export interface ProcessedData {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array; // Normalized size multiplier based on brightness
  count: number;
}

export const processImage = (
  img: HTMLImageElement,
  settings: AppSettings
): ProcessedData => {
  const canvas = document.createElement('canvas');
  // Limit resolution for performance if image is huge
  const maxSize = 2048;
  let width = img.width;
  let height = img.height;
  
  if (width > maxSize || height > maxSize) {
    const ratio = Math.min(maxSize / width, maxSize / height);
    width = Math.floor(width * ratio);
    height = Math.floor(height * ratio);
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Estimate particle count to allocate buffers
  const step = Math.max(1, Math.floor(settings.density));
  let estimatedCount = Math.ceil((width * height) / (step * step));
  if (settings.maxParticles > 0) estimatedCount = Math.min(estimatedCount, settings.maxParticles);

  const positions = new Float32Array(estimatedCount * 3);
  const colors = new Float32Array(estimatedCount * 3);
  const sizes = new Float32Array(estimatedCount);

  let particleIndex = 0;
  const cx = width / 2;
  const cy = height / 2;

  // Pre-calculate perlin offsets if needed
  const usePerlin = settings.depthMode === DepthMode.Perlin;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (particleIndex >= estimatedCount) break;

      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Brightness calculation (perceived)
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

      // Threshold check
      if (brightness < settings.threshold || a < 50) continue;

      // Calculate Z based on mode
      let z = 0;
      const normalizedBrightness = brightness / 255;
      
      switch (settings.depthMode) {
        case DepthMode.InverseBrightness:
          z = (1.0 - normalizedBrightness) * settings.depthRange;
          break;
        case DepthMode.Hue:
          const [h] = rgbToHsl(r, g, b);
          z = h * settings.depthRange;
          break;
        case DepthMode.Saturation:
          const [, s] = rgbToHsl(r, g, b);
          z = s * settings.depthRange;
          break;
        case DepthMode.Perlin:
          const noiseVal = noise(x * 0.01, y * 0.01);
          z = normalizedBrightness * (settings.depthRange * 0.5) + noiseVal * settings.noiseStrength;
          break;
        case DepthMode.Radial:
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx*dx + dy*dy);
          const maxDist = Math.sqrt(cx*cx + cy*cy);
          z = (1.0 - (dist / maxDist)) * settings.depthRange;
          break;
        case DepthMode.Layered:
           if (brightness < 64) z = 0;
           else if (brightness < 128) z = settings.depthRange * 0.33;
           else if (brightness < 192) z = settings.depthRange * 0.66;
           else z = settings.depthRange;
           break;
        case DepthMode.Brightness:
        default:
          z = normalizedBrightness * settings.depthRange;
          break;
      }

      if (settings.depthInvert) z = -z;

      // X, Y mapping (centered)
      const posX = x - cx;
      const posY = -(y - cy); // Flip Y

      positions[particleIndex * 3] = posX;
      positions[particleIndex * 3 + 1] = posY;
      positions[particleIndex * 3 + 2] = z;

      colors[particleIndex * 3] = r / 255;
      colors[particleIndex * 3 + 1] = g / 255;
      colors[particleIndex * 3 + 2] = b / 255;

      // Size based on brightness
      sizes[particleIndex] = normalizedBrightness;

      particleIndex++;
    }
  }

  return {
    positions: positions.slice(0, particleIndex * 3),
    colors: colors.slice(0, particleIndex * 3),
    sizes: sizes.slice(0, particleIndex),
    count: particleIndex
  };
};