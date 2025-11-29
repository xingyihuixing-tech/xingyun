import React from 'react';
import { AppSettings, DepthMode, ParticleShape } from '../types';
import { SAMPLE_IMAGES } from '../constants';

interface ControlPanelProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onImageUpload: (file: File) => void;
  onSampleSelect: (url: string) => void;
  fps: number;
  particleCount: number;
}

const DepthModeLabels: Record<DepthMode, string> = {
  [DepthMode.Brightness]: '亮度映射',
  [DepthMode.InverseBrightness]: '反向亮度',
  [DepthMode.Hue]: '色相映射',
  [DepthMode.Saturation]: '饱和度映射',
  [DepthMode.Perlin]: '柏林噪声',
  [DepthMode.Radial]: '径向距离',
  [DepthMode.Layered]: '分层深度'
};

const ParticleShapeLabels: Record<ParticleShape, string> = {
  [ParticleShape.Circle]: '圆形',
  [ParticleShape.Square]: '方形',
  [ParticleShape.Star]: '五角星',
  [ParticleShape.Snowflake]: '雪花'
};

const ControlGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-6 border-b border-white/10 pb-4">
    <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-3">{title}</h3>
    <div className="space-y-4">{children}</div>
  </div>
);

const RangeControl: React.FC<{ 
  label: string; 
  value: number; 
  min: number; 
  max: number; 
  step?: number; 
  onChange: (val: number) => void; 
}> = ({ label, value, min, max, step = 1, onChange }) => (
  <div className="flex flex-col">
    <div className="flex justify-between text-xs text-gray-400 mb-1">
      <span>{label}</span>
      <span>{value.toFixed(1)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
    />
  </div>
);

const ControlPanel: React.FC<ControlPanelProps> = ({ 
  settings, 
  setSettings, 
  onImageUpload, 
  onSampleSelect,
  fps,
  particleCount
}) => {
  const handleChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="w-80 h-full bg-neutral-900/90 backdrop-blur-md border-l border-white/10 overflow-y-auto p-4 z-40 transition-all">
      <div className="mb-6">
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 mb-1">
          星云 3D 可视化
        </h1>
        <div className="flex justify-between text-xs text-gray-500 font-mono">
           <span>FPS: {fps}</span>
           <span>粒子数: {(particleCount / 1000).toFixed(1)}k</span>
        </div>
      </div>

      <ControlGroup title="图像源">
        <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 text-center hover:border-blue-500 transition-colors cursor-pointer relative">
          <input 
            type="file" 
            accept="image/*" 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => {
              if (e.target.files?.[0]) onImageUpload(e.target.files[0]);
            }}
          />
          <i className="fas fa-cloud-upload-alt text-2xl text-gray-400 mb-2"></i>
          <p className="text-xs text-gray-300">拖拽或点击上传图片</p>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {SAMPLE_IMAGES.map((img, i) => (
            <button 
              key={i}
              onClick={() => onSampleSelect(img.url)}
              className="h-12 rounded bg-gray-800 hover:ring-2 hover:ring-blue-500 bg-cover bg-center text-xs text-white/0 hover:text-white/100 transition-all flex items-center justify-center font-bold shadow-sm"
              style={{ backgroundImage: `url(${img.url})` }}
            >
              加载
            </button>
          ))}
        </div>
      </ControlGroup>

      <ControlGroup title="粒子生成">
        <RangeControl label="采样步长 (越小越密)" value={settings.density} min={1} max={10} step={1} onChange={(v) => handleChange('density', v)} />
        <RangeControl label="亮度阈值" value={settings.threshold} min={0} max={100} onChange={(v) => handleChange('threshold', v)} />
        <RangeControl label="基础大小" value={settings.baseSize} min={0.1} max={5.0} step={0.1} onChange={(v) => handleChange('baseSize', v)} />
      </ControlGroup>

      <ControlGroup title="3D 深度映射">
        <div className="mb-3">
          <label className="block text-xs text-gray-400 mb-1">映射模式</label>
          <select 
            value={settings.depthMode}
            onChange={(e) => handleChange('depthMode', e.target.value as DepthMode)}
            className="w-full bg-gray-800 text-white text-xs p-2 rounded border border-gray-700 focus:border-blue-500 outline-none"
          >
            {Object.values(DepthMode).map(mode => (
              <option key={mode} value={mode}>{DepthModeLabels[mode]}</option>
            ))}
          </select>
        </div>
        <RangeControl label="深度范围" value={settings.depthRange} min={0} max={800} onChange={(v) => handleChange('depthRange', v)} />
        <div className="flex items-center space-x-2 text-xs text-gray-300">
          <input 
            type="checkbox" 
            checked={settings.depthInvert} 
            onChange={(e) => handleChange('depthInvert', e.target.checked)}
            className="rounded bg-gray-700 border-gray-600"
          />
          <span>反转深度</span>
        </div>
      </ControlGroup>

      <ControlGroup title="视觉效果">
        <RangeControl label="辉光强度" value={settings.bloomStrength} min={0} max={3.0} step={0.1} onChange={(v) => handleChange('bloomStrength', v)} />
        <RangeControl label="色彩饱和度" value={settings.colorSaturation} min={0} max={2.0} step={0.1} onChange={(v) => handleChange('colorSaturation', v)} />
        <div className="grid grid-cols-2 gap-2 mt-2">
            {Object.values(ParticleShape).map(shape => (
                <button
                    key={shape}
                    onClick={() => handleChange('particleShape', shape)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${settings.particleShape === shape ? 'bg-blue-600 border-blue-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}
                >
                    {ParticleShapeLabels[shape]}
                </button>
            ))}
        </div>
      </ControlGroup>

      <ControlGroup title="物理与交互">
        <RangeControl label="交互强度" value={settings.interactionStrength} min={0} max={200} onChange={(v) => handleChange('interactionStrength', v)} />
        <RangeControl label="影响半径" value={settings.interactionRadius} min={10} max={300} onChange={(v) => handleChange('interactionRadius', v)} />
        <RangeControl label="回弹速度" value={settings.returnSpeed} min={0.1} max={5.0} step={0.1} onChange={(v) => handleChange('returnSpeed', v)} />
      </ControlGroup>

      <ControlGroup title="相机控制">
        <div className="flex items-center space-x-2 text-xs text-gray-300 mb-2">
          <input 
            type="checkbox" 
            checked={settings.autoRotate} 
            onChange={(e) => handleChange('autoRotate', e.target.checked)}
            className="rounded bg-gray-700 border-gray-600"
          />
          <span>自动旋转</span>
        </div>
        <RangeControl label="旋转速度" value={settings.autoRotateSpeed} min={0} max={2.0} step={0.1} onChange={(v) => handleChange('autoRotateSpeed', v)} />
      </ControlGroup>

      <div className="mt-8 p-4 bg-gray-800 rounded-lg">
        <h4 className="text-xs font-bold text-white mb-2">交互说明</h4>
        <ul className="text-xs text-gray-400 list-disc pl-4 space-y-1">
            <li><strong>鼠标/触控:</strong> 旋转视角</li>
            <li><strong>滚轮:</strong> 缩放视角</li>
            <li><strong>手掌平移:</strong> 推开粒子</li>
            <li><strong>手掌张开:</strong> 绚烂爆炸 (Start)</li>
            <li><strong>握拳:</strong> 黑洞能量球 (Aggregate)</li>
        </ul>
      </div>
    </div>
  );
};

export default ControlPanel;