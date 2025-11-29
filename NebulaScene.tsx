import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AppSettings, HandData, ParticleShape } from '../types';
import { ProcessedData } from '../services/imageProcessing';

// --- SHADERS ---

const vertexShader = `
uniform float uTime;
uniform float uSize;
uniform vec3 uHandPos;
uniform float uHandActive; // 0.0 or 1.0
uniform float uInteractionRadius;
uniform float uInteractionStrength;
uniform float uReturnSpeed;
uniform float uExplosion; // 0.0 to 1.0 (Explode Out)
uniform float uBlackHole; // 0.0 to 1.0 (Implode In)

attribute float aSize;
attribute vec3 aColor;

varying vec3 vColor;
varying float vDepth;

// Simplex noise for organic movement
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) { 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}

// Rotation matrix
mat3 rotateZ(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat3(
        c, -s, 0.0,
        s,  c, 0.0,
        0.0, 0.0, 1.0
    );
}

void main() {
  vColor = aColor;
  vec3 pos = position;
  float extraSize = 1.0;
  
  // 1. Base Depth Enhancement
  pos.z *= 1.5;

  // 2. Ambient Floating
  if (uBlackHole < 0.1 && uExplosion < 0.1) {
      float drift = snoise(vec3(pos.xy * 0.005, uTime * 0.1));
      pos.z += drift * 20.0;
  }

  // --- EXPLOSION: VOLUMETRIC NEBULA CLOUD ---
  if (uExplosion > 0.001) {
      // Create a dense cloud structure to fill the screen
      
      // Noise for clustering
      float noiseVal = snoise(pos * 0.015 + uTime * 0.1); 
      
      // Radial Expansion restricted to visible volume
      // Max radius ~300 ensures it doesn't fly off screen
      float maxExpansion = 300.0 * uExplosion; 
      
      // Non-linear speed: distinct layers
      // Layer mask: -1 to 1.
      float speedVar = smoothstep(-0.5, 1.0, noiseVal); 
      vec3 dir = normalize(pos);
      
      // Expansion logic:
      // Mix between keeping shape (0.4) and expanding (0.6 * variable)
      pos += dir * maxExpansion * (0.4 + 0.6 * speedVar);
      
      // Turbulence for smoke detail
      vec3 turb = vec3(
          snoise(pos * 0.01 + vec3(0.0, uTime * 0.3, 0.0)),
          snoise(pos * 0.01 + vec3(100.0, uTime * 0.3, 100.0)),
          snoise(pos * 0.01 + vec3(200.0, 200.0, uTime * 0.3))
      );
      
      pos += turb * 80.0 * uExplosion;
      
      // Slow Galaxy Rotation
      pos = rotateZ(uExplosion * 0.4) * pos;
      
      // CRITICAL: Size Boost
      // As particles spread, they must get massive to simulate gas volume
      extraSize += uExplosion * 8.0; 
  }
  
  // --- BLACK HOLE: QUASAR / JETS ---
  if (uBlackHole > 0.001) {
      // 1. Flatten to Accretion Disk
      pos.z *= mix(1.0, 0.05, uBlackHole);
      
      // 2. Vortex Spin
      float r = length(pos.xy);
      // Spin faster near center
      float spin = (400.0 / (r + 10.0)) * uTime * 1.0 * uBlackHole;
      pos = rotateZ(spin) * pos;
      
      // 3. Gravitational Compression (Ring)
      float targetR = 30.0 + r * 0.2; 
      float pull = uBlackHole * 0.95; 
      
      if (r > 1.0) {
          float newR = mix(r, targetR, pull);
          pos.xy = normalize(pos.xy) * newR;
      }
      
      // 4. RELATIVISTIC JETS (Cool Factor)
      // Pick random particles to form jets
      // Use original position for stable noise
      float jetSignal = snoise(vec3(position.xy * 0.8, 42.0)); 
      
      if (jetSignal > 0.7 && r < 120.0) {
          float jetIntensity = uBlackHole;
          
          // Shoot up/down along Z
          float jetLen = 500.0 * jetIntensity;
          float side = sign(position.z);
          if (side == 0.0) side = 1.0;
          
          // Squeeze tight in XY
          pos.xy *= 0.05; 
          
          // Stretch Z
          pos.z = side * (50.0 + jetLen * abs(jetSignal)); 
          
          // Spiral the jet
          float jetTwist = pos.z * 0.05 - uTime * 5.0;
          pos.x += sin(jetTwist) * 10.0;
          pos.y += cos(jetTwist) * 10.0;
          
          // High Energy Look
          extraSize += 5.0 * jetIntensity;
          vColor = mix(vColor, vec3(0.6, 0.8, 1.0), jetIntensity); // Blue Jets
      } else {
          // Disk Glow
          float currentR = length(pos.xy);
          if (currentR < 60.0) {
              float heat = (1.0 - currentR / 60.0) * uBlackHole;
              vColor = mix(vColor, vec3(1.0, 0.9, 0.6), heat); // Gold Core
              extraSize += 3.0 * heat;
          }
      }
  }

  // --- Hand Interaction (Repulse) ---
  if (uHandActive > 0.5 && uBlackHole < 0.1 && uExplosion < 0.1) {
    vec3 toHand = pos - uHandPos;
    float dist = length(toHand);
    if (dist < uInteractionRadius) {
        vec3 dir = normalize(toHand);
        float force = (1.0 - dist / uInteractionRadius);
        force = pow(force, 2.0) * uInteractionStrength;
        pos += dir * force;
    }
  }

  vDepth = pos.z;
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  
  // Perspective Size Attenuation
  gl_PointSize = uSize * aSize * extraSize * (300.0 / -mvPosition.z);
  
  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = `
uniform vec3 uColor;
uniform float uShape; // 0=circle, 1=square, 2=star, 3=snowflake
uniform float uSaturation;

varying vec3 vColor;
varying float vDepth;

vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  
  // Shape Logic
  if (uShape < 0.5) { // Circle
    if (dist > 0.5) discard;
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
    gl_FragColor = vec4(vColor, alpha);
  } 
  else if (uShape < 1.5) { // Square
    if (abs(coord.x) > 0.45 || abs(coord.y) > 0.45) discard;
    gl_FragColor = vec4(vColor, 1.0);
  } 
  else if (uShape < 2.5) { // Star
    float angle = atan(coord.y, coord.x);
    float r = 0.5 * (0.55 + 0.45 * cos(5.0 * angle)); 
    if (dist > r) discard;
    float glow = 1.0 - smoothstep(0.0, r, dist);
    gl_FragColor = vec4(vColor, 0.8 + glow * 0.2);
  }
  else { // Snowflake
     float angle = atan(coord.y, coord.x);
     float f = abs(cos(angle * 3.0)); 
     f += 0.5 * abs(cos(angle * 12.0));
     float r = 0.5 * clamp(f, 0.3, 0.8);
     if (dist > r && dist > 0.2) discard; 
     gl_FragColor = vec4(vColor, 1.0);
  }

  // Saturation
  vec3 color = gl_FragColor.rgb;
  if (uSaturation != 1.0) {
     vec3 hsv = rgb2hsv(color);
     hsv.y *= uSaturation;
     color = hsv2rgb(hsv);
  }
  
  gl_FragColor.rgb = color;
}
`;

interface NebulaSceneProps {
  data: ProcessedData | null;
  settings: AppSettings;
  handData: React.MutableRefObject<HandData>;
}

const NebulaScene: React.FC<NebulaSceneProps> = ({ data, settings, handData }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);

  const currentExplosionRef = useRef(0);
  const targetExplosionRef = useRef(0);
  
  const currentBlackHoleRef = useRef(0);
  const targetBlackHoleRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.FogExp2(0x000000, 0.001);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 4000); 
    camera.position.set(0, 0, 800); 
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = settings.autoRotate;
    controlsRef.current = controls;

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0;
    bloomPass.strength = settings.bloomStrength;
    bloomPass.radius = 0.5;
    bloomPassRef.current = bloomPass;

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composerRef.current = composer;

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current || !composerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
      composerRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const clock = new THREE.Clock();

    const animate = () => {
      requestAnimationFrame(animate);

      const time = clock.getElapsedTime();
      const hand = handData.current;

      let lerpSpeed = 0.03;

      if (hand.isActive) {
          if (hand.isClosed) {
              // FIST -> QUASAR (Black Hole)
              targetBlackHoleRef.current = 1.0;
              targetExplosionRef.current = 0.0;
              lerpSpeed = 0.05; 
          } else {
              // OPEN HAND -> NEBULA CLOUD
              targetBlackHoleRef.current = 0.0;
              targetExplosionRef.current = 1.0;
              lerpSpeed = 0.03; 
          }
      } else {
          // RESTORE
          targetBlackHoleRef.current = 0.0;
          targetExplosionRef.current = 0.0;
          lerpSpeed = 0.02;
      }

      currentExplosionRef.current += (targetExplosionRef.current - currentExplosionRef.current) * lerpSpeed;
      currentBlackHoleRef.current += (targetBlackHoleRef.current - currentBlackHoleRef.current) * lerpSpeed;

      if (materialRef.current) {
        materialRef.current.uniforms.uTime.value = time;
        materialRef.current.uniforms.uExplosion.value = currentExplosionRef.current;
        materialRef.current.uniforms.uBlackHole.value = currentBlackHoleRef.current;
        
        if (hand.isActive) {
            const vector = new THREE.Vector3(hand.x, hand.y, 0.5); 
            vector.unproject(camera);
            const dir = vector.sub(camera.position).normalize();
            const distance = -camera.position.z / dir.z; 
            const pos = camera.position.clone().add(dir.multiplyScalar(distance));
            
            materialRef.current.uniforms.uHandPos.value.set(pos.x, pos.y, pos.z);
            materialRef.current.uniforms.uHandActive.value = 1.0;
        } else {
            materialRef.current.uniforms.uHandActive.value = 0.0;
        }
      }

      if (controlsRef.current) controlsRef.current.update();
      if (composerRef.current) composerRef.current.render();
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      scene.clear();
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []); 

  useEffect(() => {
    if (!data || !sceneRef.current) return;

    if (pointsRef.current) {
      sceneRef.current.remove(pointsRef.current);
      pointsRef.current.geometry.dispose();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(data.colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(data.sizes, 1));
    geometry.center();

    let shapeVal = 0.0;
    if (settings.particleShape === ParticleShape.Square) shapeVal = 1.0;
    if (settings.particleShape === ParticleShape.Star) shapeVal = 2.0;
    if (settings.particleShape === ParticleShape.Snowflake) shapeVal = 3.0;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: settings.baseSize * 4.0 }, 
        uHandPos: { value: new THREE.Vector3() },
        uHandActive: { value: 0.0 },
        uInteractionRadius: { value: settings.interactionRadius },
        uInteractionStrength: { value: settings.interactionStrength },
        uReturnSpeed: { value: settings.returnSpeed },
        uExplosion: { value: 0.0 },
        uBlackHole: { value: 0.0 },
        uColor: { value: new THREE.Color(0xffffff) },
        uShape: { value: shapeVal },
        uSaturation: { value: settings.colorSaturation },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);
    sceneRef.current.add(points);
    pointsRef.current = points;
    materialRef.current = material;

  }, [data]);

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uSize.value = settings.baseSize * 4.0;
      materialRef.current.uniforms.uInteractionRadius.value = settings.interactionRadius;
      materialRef.current.uniforms.uInteractionStrength.value = settings.interactionStrength;
      materialRef.current.uniforms.uSaturation.value = settings.colorSaturation;
      
      let shapeVal = 0.0;
      if (settings.particleShape === ParticleShape.Square) shapeVal = 1.0;
      if (settings.particleShape === ParticleShape.Star) shapeVal = 2.0;
      if (settings.particleShape === ParticleShape.Snowflake) shapeVal = 3.0;
      materialRef.current.uniforms.uShape.value = shapeVal;
    }

    if (bloomPassRef.current) {
        bloomPassRef.current.strength = settings.bloomStrength;
    }

    if (controlsRef.current) {
      controlsRef.current.autoRotate = settings.autoRotate;
      controlsRef.current.autoRotateSpeed = settings.autoRotateSpeed;
    }
  }, [settings]);

  return <div ref={containerRef} className="w-full h-full bg-black relative" />;
};

export default NebulaScene;