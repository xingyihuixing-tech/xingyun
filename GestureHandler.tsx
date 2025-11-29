import React, { useEffect, useRef, useState } from 'react';
import { HandData } from '../types';
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

interface GestureHandlerProps {
  handDataRef: React.MutableRefObject<HandData>;
  enabled: boolean;
}

const GestureHandler: React.FC<GestureHandlerProps> = ({ handDataRef, enabled }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        handLandmarkerRef.current = handLandmarker;
        setIsLoaded(true);
      } catch (err) {
        console.error(err);
        setError("无法加载 MediaPipe");
      }
    };
    if (enabled) init();
  }, [enabled]);

  useEffect(() => {
    if (!isLoaded || !enabled) return;

    const enableCam = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setError("不支持摄像头");
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.addEventListener("loadeddata", predictWebcam);
            }
        } catch (err) {
            setError("摄像头权限被拒绝");
        }
    };

    enableCam();

    return () => {
        // Cleanup
        if (videoRef.current && videoRef.current.srcObject) {
             const stream = videoRef.current.srcObject as MediaStream;
             stream.getTracks().forEach(track => track.stop());
        }
        cancelAnimationFrame(requestRef.current);
    };
  }, [isLoaded, enabled]);


  const predictWebcam = () => {
    if (!handLandmarkerRef.current || !videoRef.current) return;
    
    let startTimeMs = performance.now();
    
    if (lastVideoTimeRef.current !== videoRef.current.currentTime) {
        lastVideoTimeRef.current = videoRef.current.currentTime;
        const results = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
        
        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];
            
            // 1. Pinch Detection
            // Use index finger tip (8) and thumb tip (4)
            const indexTip = landmarks[8];
            const thumbTip = landmarks[4];
            
            const dx = indexTip.x - thumbTip.x;
            const dy = indexTip.y - thumbTip.y;
            const pinchDist = Math.sqrt(dx*dx + dy*dy);
            const isPinching = pinchDist < 0.05; 

            // 2. Fist (Closed Hand) Detection
            // Compare distance of finger tips to wrist vs finger joints (MCP) to wrist
            const wrist = landmarks[0];
            const tips = [8, 12, 16, 20]; // Index, Middle, Ring, Pinky tips
            const mcps = [5, 9, 13, 17]; // Corresponding MCP joints
            
            let fingersClosedCount = 0;
            for(let i=0; i<4; i++) {
                const tip = landmarks[tips[i]];
                const mcp = landmarks[mcps[i]];
                
                const tipDist = Math.sqrt(Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2));
                const mcpDist = Math.sqrt(Math.pow(mcp.x - wrist.x, 2) + Math.pow(mcp.y - wrist.y, 2));
                
                // If tip is significantly closer to wrist than mcp, finger is curled
                if (tipDist < mcpDist * 1.1) { // 1.1 margin
                    fingersClosedCount++;
                }
            }
            const isClosed = fingersClosedCount >= 3; // 3 or more fingers curled considered closed

            // 3. Position
            const palmX = landmarks[9].x;
            const palmY = landmarks[9].y;

            // Map to Screen Coordinates (-1 to 1), mirrored
            const ndcX = -(palmX * 2 - 1); 
            const ndcY = -(palmY * 2 - 1); 

            handDataRef.current = {
                isActive: true,
                x: ndcX,
                y: ndcY,
                z: landmarks[9].z, 
                isPinching,
                isClosed
            };
        } else {
            handDataRef.current = { ...handDataRef.current, isActive: false };
        }
    }
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  if (!enabled) return null;

  return (
    <div className="absolute bottom-4 left-4 z-50 pointer-events-none">
      <div className="relative border border-white/20 rounded overflow-hidden shadow-lg w-32 h-24 bg-black">
        <video 
            ref={videoRef} 
            className="w-full h-full object-cover opacity-50 transform scale-x-[-1]" 
            autoPlay 
            muted 
            playsInline 
        />
        {error && <div className="absolute inset-0 flex items-center justify-center text-red-500 text-xs text-center p-1 bg-black/80">{error}</div>}
        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      </div>
      <p className="text-xs text-white/50 mt-1 ml-1 font-mono">手势追踪已激活</p>
    </div>
  );
};

export default GestureHandler;