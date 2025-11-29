import { AppSettings, DepthMode, ParticleShape } from './types';

export const DEFAULT_SETTINGS: AppSettings = {
  density: 2,
  threshold: 30,
  maxParticles: 200000,
  baseSize: 1.5,
  
  depthMode: DepthMode.Brightness,
  depthRange: 400, // Increased for better 3D effect
  depthInvert: false,
  noiseStrength: 40,

  bloomStrength: 1.5,
  particleShape: ParticleShape.Circle,
  colorSaturation: 1.2,

  interactionRadius: 150,
  interactionStrength: 80,
  interactionType: 'repulse',
  damping: 0.9,
  returnSpeed: 1.5,

  autoRotate: true,
  autoRotateSpeed: 0.3,
};

export const SAMPLE_IMAGES = [
  { name: "猎户座星云", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg/600px-Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg" },
  { name: "创生之柱", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Pillars_of_creation_2014_HST_WFC3-UVIS_full-res_denoised.jpg/600px-Pillars_of_creation_2014_HST_WFC3-UVIS_full-res_denoised.jpg" },
  { name: "船底座星云", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Carina_Nebula_by_Harel_Boren_%2815166162815%29.jpg/640px-Carina_Nebula_by_Harel_Boren_%2815166162815%29.jpg" }
];