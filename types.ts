export enum DepthMode {
  Brightness = 'Brightness',
  InverseBrightness = 'InverseBrightness',
  Hue = 'Hue',
  Saturation = 'Saturation',
  Perlin = 'Perlin',
  Radial = 'Radial',
  Layered = 'Layered'
}

export enum ParticleShape {
  Circle = 'Circle',
  Square = 'Square',
  Star = 'Star',
  Snowflake = 'Snowflake'
}

export interface AppSettings {
  // Particle Generation
  density: number; // 1 to 10 step
  threshold: number; // 0-255
  maxParticles: number;
  baseSize: number;
  
  // Depth Mapping
  depthMode: DepthMode;
  depthRange: number;
  depthInvert: boolean;
  noiseStrength: number; // For Perlin

  // Visuals
  bloomStrength: number;
  particleShape: ParticleShape;
  colorSaturation: number;
  
  // Physics / Interaction
  interactionRadius: number;
  interactionStrength: number;
  interactionType: 'repulse' | 'attract';
  damping: number;
  returnSpeed: number;
  
  // Camera
  autoRotate: boolean;
  autoRotateSpeed: number;
}

export interface HandData {
  isActive: boolean;
  x: number; // Normalized -1 to 1
  y: number; // Normalized -1 to 1
  z: number; // Normalized depth
  isPinching: boolean;
  isClosed: boolean; // Fist detection
}