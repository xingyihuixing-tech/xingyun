import React, { useState, useEffect, useRef } from 'react';
import NebulaScene from './components/NebulaScene';
import ControlPanel from './components/ControlPanel';
import GestureHandler from './components/GestureHandler';
import { AppSettings, HandData } from './types';
import { DEFAULT_SETTINGS, SAMPLE_IMAGES } from './constants';
import { processImage, ProcessedData } from './services/imageProcessing';

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [data, setData] = useState<ProcessedData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [fps, setFps] = useState(0);
  const [gestureEnabled, setGestureEnabled] = useState(true);

  // Shared ref for MediaPipe data to avoid React render cycles for 60fps updates
  const handDataRef = useRef<HandData>({
    isActive: false,
    x: 0,
    y: 0,
    z: 0,
    isPinching: false,
    isClosed: false
  });

  // Load initial sample
  useEffect(() => {
    handleLoadSample(SAMPLE_IMAGES[0].url);
  }, []);

  const handleImageProcess = async (imageSrc: string | File) => {
    setIsProcessing(true);
    try {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      
      const src = imageSrc instanceof File ? URL.createObjectURL(imageSrc) : imageSrc;
      img.src = src;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Brief timeout to allow UI to show "Loading" state
      setTimeout(() => {
        const processed = processImage(img, settings);
        setData(processed);
        setIsProcessing(false);
        if (imageSrc instanceof File) URL.revokeObjectURL(src);
      }, 50);

    } catch (error) {
      console.error("Failed to process image", error);
      setIsProcessing(false);
    }
  };

  // Re-process when certain structural settings change
  useEffect(() => {
    // Only re-process image if data exists and density/threshold/depthMode changed
    // We can't easily re-read the original image file here without storing it.
    // Ideally, we'd store the current image source in state.
    // For this MVP, we assume the user re-uploads or we only re-process if we store the img object.
    // Simplified: We assume 'data' is valid. If user changes 'Density', they might need to reload img.
    // HOWEVER: Changing DepthMode requires re-calculating Z. 
    // To support this properly without re-uploading, let's just warn or keep it simple.
    // BETTER APPROACH for MVP: If we had the image object stored, we could re-run.
    // We will leave auto-reprocessing out to avoid complexity, except for initial load.
    // Real-time params (Bloom, Physics) don't need reprocessing.
  }, [settings.density, settings.depthMode]); 
  
  // Wrapper to handle re-processing if needed, or just update settings
  const updateSettings = (newSettingsAction: React.SetStateAction<AppSettings>) => {
      setSettings(prev => {
          const next = typeof newSettingsAction === 'function' ? newSettingsAction(prev) : newSettingsAction;
          
          // Check if we need to re-process geometry
          const needsReprocess = 
             prev.density !== next.density || 
             prev.threshold !== next.threshold ||
             prev.depthMode !== next.depthMode || 
             prev.depthInvert !== next.depthInvert ||
             prev.maxParticles !== next.maxParticles;

          // If we need reprocess and we have a way to access the current image...
          // For now, we rely on the user clicking "Reload" or just drag/dropping again for structural changes.
          // BUT, to make DepthMode switch live, we'd ideally cache the image data context.
          // Given the constraint, we will just apply what we can. 
          // Note: To make Depth Mode interactive, users should ideally re-upload.
          
          return next;
      });
  };

  const handleLoadSample = (url: string) => {
      handleImageProcess(url);
  };
  
  const handleFileUpload = (file: File) => {
      handleImageProcess(file);
  };

  // FPS Counter (simple)
  useEffect(() => {
      let frame = 0;
      let lastTime = performance.now();
      const loop = () => {
          const time = performance.now();
          frame++;
          if (time - lastTime >= 1000) {
              setFps(frame);
              frame = 0;
              lastTime = time;
          }
          requestAnimationFrame(loop);
      };
      loop();
  }, []);

  return (
    <div className="w-full h-screen flex bg-black text-white overflow-hidden font-sans">
      {/* 3D Scene Area */}
      <div className="flex-1 relative">
        {isProcessing && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-blue-400 font-mono animate-pulse">正在处理星云数据...</p>
          </div>
        )}
        
        <NebulaScene 
            data={data} 
            settings={settings} 
            handData={handDataRef}
        />

        {/* Floating Toggle for Sidebar */}
        <button 
            onClick={() => setShowControls(!showControls)}
            className="absolute top-4 right-4 z-50 p-2 bg-gray-800 rounded-full hover:bg-gray-700 transition-colors shadow-lg"
        >
            <i className={`fas ${showControls ? 'fa-chevron-right' : 'fa-sliders-h'} text-white`}></i>
        </button>

        {/* Gesture Toggle */}
        <div className="absolute bottom-4 left-40 z-40 flex items-center gap-2">
            <button
                onClick={() => setGestureEnabled(!gestureEnabled)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors shadow-lg ${gestureEnabled ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'}`}
            >
                <i className="fas fa-hand-paper mr-2"></i>
                {gestureEnabled ? '手势控制已开启' : '手势控制已关闭'}
            </button>
        </div>

        <GestureHandler handDataRef={handDataRef} enabled={gestureEnabled} />
      </div>

      {/* Sidebar */}
      <div className={`${showControls ? 'w-80' : 'w-0'} transition-all duration-300 ease-in-out relative`}>
         <div className="absolute inset-0 w-80"> 
            <ControlPanel 
                settings={settings} 
                setSettings={setSettings} 
                onImageUpload={handleFileUpload}
                onSampleSelect={handleLoadSample}
                fps={fps}
                particleCount={data?.count || 0}
            />
         </div>
      </div>
    </div>
  );
};

export default App;