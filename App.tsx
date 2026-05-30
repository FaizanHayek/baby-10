
import React, { useState, useRef, useEffect } from 'react';
import { AppState, AuraAnalysis, ImageData, DetailedTip } from './types';
import { analyzeAura, generateTransformation } from './services/geminiService';
import { playBassyWhoosh, playSparkle } from './components/SoundManager';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.LANDING);
  const [images, setImages] = useState<ImageData[]>([]);
  const [result, setResult] = useState<AuraAnalysis | null>(null);
  const [isGeneratingTransformation, setIsGeneratingTransformation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [activeGuideIndex, setActiveGuideIndex] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Camera & Recording
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadProgress(0);
    const newMedia: ImageData[] = [];
    const filesArray = Array.from(files).slice(0, 3) as File[];
    
    let processed = 0;
    filesArray.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newMedia.push({
          base64: reader.result as string,
          mimeType: file.type
        });
        processed++;
        if (processed === filesArray.length) {
          setImages(newMedia);
          setState(AppState.UPLOADING);
          let prog = 0;
          const interval = setInterval(() => {
            prog += 5;
            setUploadProgress(prog);
            if (prog >= 100) clearInterval(interval);
          }, 30);
          playBassyWhoosh();
          if ('vibrate' in navigator) navigator.vibrate(50);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' }, 
        audio: true 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setState(AppState.CAMERA);
      playBassyWhoosh();
    } catch (err) {
      console.error("Camera access denied", err);
      setError("Camera or microphone access was denied.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
  };

  const capturePhoto = () => {
    if (videoRef.current && !isRecording) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg');
        setImages([{ base64, mimeType: 'image/jpeg' }]);
        stopCamera();
        setState(AppState.UPLOADING);
        setUploadProgress(0);
        let prog = 0;
        const interval = setInterval(() => {
          prog += 10;
          setUploadProgress(prog);
          if (prog >= 100) clearInterval(interval);
        }, 50);
        playBassyWhoosh();
        if ('vibrate' in navigator) navigator.vibrate(50);
      }
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/mp4' });
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages([{ base64: reader.result as string, mimeType: 'video/mp4' }]);
        stopCamera();
        setState(AppState.UPLOADING);
        setUploadProgress(0);
        let prog = 0;
        const interval = setInterval(() => {
          prog += 8;
          setUploadProgress(prog);
          if (prog >= 100) clearInterval(interval);
        }, 40);
        playBassyWhoosh();
      };
      reader.readAsDataURL(blob);
    };

    recorder.start();
    setIsRecording(true);
    timerRef.current = window.setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
    if ('vibrate' in navigator) navigator.vibrate(100);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
      if ('vibrate' in navigator) navigator.vibrate([50, 50]);
    }
  };

  const startAnalysis = async () => {
    setState(AppState.ANALYZING);
    try {
      const analysis = await analyzeAura(images);
      setResult(analysis);
      setState(AppState.RESULTS);
      playSparkle();
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      setState(AppState.LANDING);
    }
  };

  const triggerTransformation = async () => {
    if (!result || result.transformedImageBase64 || isGeneratingTransformation) {
      setShowComparison(!showComparison);
      return;
    }
    
    setIsGeneratingTransformation(true);
    setShowComparison(true);
    try {
      // Use first image for transformation (or a frame if video)
      const targetMedia = images[0];
      const transformedBase64 = await generateTransformation(targetMedia);
      setResult({
        ...result,
        transformedImageBase64: transformedBase64
      });
      playSparkle();
    } catch (err) {
      console.error(err);
      setError("Failed to generate AI transformation.");
    } finally {
      setIsGeneratingTransformation(false);
    }
  };

  const reset = () => {
    stopCamera();
    setImages([]);
    setResult(null);
    setError(null);
    setState(AppState.LANDING);
    setShowComparison(false);
    setActiveGuideIndex(null);
    setUploadProgress(0);
    setIsGeneratingTransformation(false);
    playBassyWhoosh();
  };

  const goToGuide = () => {
    setState(AppState.GUIDE);
    playBassyWhoosh();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const backToResults = () => {
    setState(AppState.RESULTS);
    playBassyWhoosh();
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const hasVideo = images.some(img => img.mimeType.startsWith('video/'));

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 selection:bg-rose-gold selection:text-white pb-20 overflow-y-auto">
      <header className="w-full text-center py-10 z-50">
        <h1 className="font-serif italic text-5xl md:text-7xl iridescent-text drop-shadow-2xl tracking-tighter transition-all duration-1000 animate-iridescent">
          IsYourBaby10??!
        </h1>
        <div className="flex items-center justify-center gap-2 mt-4">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-cyan-400"></span>
          <p className="text-[10px] md:text-xs uppercase tracking-[0.5em] text-cyan-200/60 font-bold">
            THE ULTIMATE VIBE ANALYZER
          </p>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-pink-400"></span>
        </div>
      </header>

      <main className="w-full max-w-5xl flex flex-col items-center gap-8 mb-24">
        {state === AppState.LANDING && (
          <div className="text-center space-y-12 animate-fade-in py-12 w-full max-w-2xl">
            <div className="space-y-6">
              <h2 className="text-4xl md:text-6xl font-extrabold text-white leading-tight">
                Evaluate <span className="iridescent-text italic font-serif">Her Aura.</span>
              </h2>
              <p className="text-gray-400 text-sm md:text-xl max-w-lg mx-auto leading-relaxed">
                Unlock high-fidelity insights into visual impact, confidence, and motion. Serving main character energy, one scan at a time.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
              <button 
                onClick={startCamera}
                className="glass group relative flex flex-col items-center gap-6 p-14 rounded-[3rem] transition-all hover:scale-[1.02] aura-glow-cyan active:scale-95"
              >
                <div className="absolute inset-0 bg-cyan-400/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-[3rem]"></div>
                <div className="w-20 h-20 bg-cyan-400/10 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform shadow-[0_0_30px_rgba(96,239,255,0.2)]">
                  <svg className="w-10 h-10 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="text-white font-bold text-lg tracking-wide uppercase">Capture Live</span>
              </button>

              <label className="cursor-pointer glass group relative flex flex-col items-center gap-6 p-14 rounded-[3rem] transition-all hover:scale-[1.02] aura-glow-pink active:scale-95">
                <div className="absolute inset-0 bg-pink-400/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-[3rem]"></div>
                <div className="w-20 h-20 bg-pink-400/10 rounded-2xl flex items-center justify-center group-hover:-rotate-12 transition-transform shadow-[0_0_30px_rgba(255,94,152,0.2)]">
                  <svg className="w-10 h-10 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-white font-bold text-lg tracking-wide uppercase">Upload Media</span>
                  <span className="text-[10px] text-pink-300/40 uppercase tracking-[0.2em] mt-1 font-semibold">Photos & Clips</span>
                </div>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*,video/*" 
                  className="hidden" 
                  onChange={handleFileChange}
                />
              </label>
            </div>
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-3 rounded-2xl text-sm animate-bounce">
                {error}
              </div>
            )}

            <div className="pt-8 flex flex-col items-center gap-3">
              <div className="flex gap-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}></div>
                ))}
              </div>
              <p className="text-[9px] text-gray-500 uppercase tracking-[0.3em] font-medium">
                Encrypted & Secure • No data storage
              </p>
            </div>
          </div>
        )}

        {state === AppState.CAMERA && (
          <div className="w-full max-w-2xl flex flex-col items-center gap-8 animate-in zoom-in-95 duration-700 py-4 relative">
            <div className="relative w-full aspect-[4/5] md:aspect-[3/4] rounded-[4rem] overflow-hidden border-4 border-white/5 aura-glow-cyan bg-black shadow-2xl">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover mirror-mode"
              />
              <div className="absolute inset-0 pointer-events-none border-[30px] border-black/10"></div>
              {isRecording && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-2 bg-black/60 backdrop-blur-xl border border-red-500/50 rounded-full animate-pulse shadow-2xl">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-xs font-black text-white uppercase tracking-[0.3em]">
                    VIBE RECORDING {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              )}
              {!isRecording && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-64 h-64 border border-cyan-400/20 rounded-full animate-ping opacity-20"></div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-10 mt-6 relative z-10">
              <button 
                onClick={reset}
                className="p-6 rounded-full glass text-white hover:bg-white/10 transition-all hover:scale-110 active:scale-90"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="relative group">
                 <button 
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  onClick={capturePhoto}
                  className={`w-28 h-28 rounded-full border-[6px] border-white/20 flex items-center justify-center transition-all shadow-2xl relative z-10 ${isRecording ? 'bg-red-500 scale-110' : 'bg-white/5 hover:bg-white/10'}`}
                >
                  <div className={`transition-all duration-300 ${isRecording ? 'w-10 h-10 rounded-xl bg-white animate-pulse' : 'w-20 h-20 rounded-full bg-white shadow-inner'}`}></div>
                </button>
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-max opacity-60">
                   <p className="text-[10px] text-white uppercase tracking-[0.2em] font-bold">Tap Photo • Hold Video</p>
                </div>
              </div>
              <div className="w-16 h-16 opacity-0 invisible"></div>
            </div>
          </div>
        )}

        {state === AppState.UPLOADING && (
          <div className="w-full max-w-3xl flex flex-col items-center gap-10 animate-in slide-in-from-bottom-12 duration-700 py-12">
             <div className="text-center space-y-4 w-full">
                <h3 className="text-3xl md:text-4xl font-black text-white">System <span className="iridescent-text italic font-serif">Integration.</span></h3>
                <div className="w-full max-w-md mx-auto h-2 bg-white/10 rounded-full overflow-hidden border border-white/5 relative">
                   <div className="absolute inset-y-0 left-0 shimmer-bar transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }}></div>
                </div>
                <div className="flex justify-between max-w-md mx-auto px-2">
                   <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-widest">{uploadProgress < 100 ? 'Importing frame data' : 'Assets Ready'}</span>
                   <span className="text-[9px] text-pink-400 font-bold uppercase tracking-widest">{uploadProgress}%</span>
                </div>
             </div>

            <div className="flex gap-8 overflow-x-auto p-8 w-full justify-center">
              {images.map((img, idx) => (
                <div key={idx} className="relative w-40 h-56 md:w-56 md:h-80 shrink-0 rounded-[2.5rem] overflow-hidden border-2 border-white/5 shadow-2xl bg-black/40 transition-all hover:scale-105 hover:-rotate-2 aura-glow-gold">
                  {img.mimeType.startsWith('video/') ? (
                    <video src={img.base64} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                  ) : (
                    <img src={img.base64} className="w-full h-full object-cover" alt="Review" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                  <div className="absolute top-4 right-4 glass px-3 py-1 rounded-full flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${img.mimeType.startsWith('video/') ? 'bg-cyan-400' : 'bg-pink-400'}`}></div>
                    <span className="text-[8px] font-bold text-white uppercase tracking-tighter">
                      {img.mimeType.startsWith('video/') ? 'Motion' : 'Static'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center gap-4 w-full">
               <button 
                onClick={startAnalysis}
                disabled={uploadProgress < 100}
                className={`w-full py-7 text-white font-black text-2xl rounded-[2.5rem] shadow-[0_20px_50px_rgba(255,94,152,0.3)] hover:scale-[1.03] active:scale-95 transition-all uppercase tracking-[0.1em] ${uploadProgress < 100 ? 'bg-white/5 cursor-wait opacity-50' : 'btn-iridescent'}`}
              >
                {uploadProgress < 100 ? 'Processing...' : 'Final Vibe Check'}
              </button>
              <button onClick={reset} className="text-gray-500 font-bold text-xs uppercase tracking-widest hover:text-white transition-colors">
                Restart Session
              </button>
            </div>
          </div>
        )}

        {state === AppState.ANALYZING && (
          <div className="flex flex-col items-center gap-16 py-32">
            <div className="relative w-72 h-72">
              <div className="absolute inset-0 border-[10px] border-white/5 rounded-full"></div>
              <div className="absolute inset-0 border-t-[10px] border-cyan-400 rounded-full animate-spin"></div>
              <div className="absolute inset-4 border-[10px] border-white/5 rounded-full"></div>
              <div className="absolute inset-4 border-b-[10px] border-pink-400 rounded-full animate-spin-reverse" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                   <span className="iridescent-text font-serif italic text-4xl block animate-pulse">Scanning...</span>
                   {hasVideo && <span className="text-[9px] text-cyan-400/50 uppercase tracking-[0.4em] font-bold mt-3 block">Analyzing Kinetic Energy</span>}
                </div>
              </div>
            </div>
            <div className="text-center space-y-4 max-w-sm">
              <h3 className="text-3xl text-white font-black uppercase tracking-tight">Processing <span className="text-rose-gold italic">Allure.</span></h3>
              <p className="text-gray-500 text-lg italic leading-relaxed">
                {hasVideo 
                  ? '"Calculating frame-by-frame confidence and posture metrics..."'
                  : '"Mapping facial symmetry and color harmony..."'}
              </p>
            </div>
          </div>
        )}

        {state === AppState.RESULTS && result && (
          <div className="w-full flex flex-col gap-12 animate-in slide-in-from-bottom-12 duration-1000 fill-mode-both pb-12">
            <div className="glass rounded-[4rem] p-8 md:p-16 relative overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.5)] border-white/10">
              <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-cyan-500/10 blur-[150px] rounded-full"></div>
              <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-pink-500/10 blur-[150px] rounded-full"></div>
              
              <div className="relative z-10 flex flex-col items-center gap-12">
                <div className="w-full max-w-sm animate-in zoom-in-90 duration-1000">
                  <div className="relative aspect-[3/4] rounded-[3rem] overflow-hidden border-4 border-white/10 shadow-2xl bg-black aura-glow-cyan">
                    {images[0].mimeType.startsWith('video/') ? (
                      <video src={images[0].base64} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                    ) : (
                      <img src={images[0].base64} className="w-full h-full object-cover" alt="Subject" />
                    )}
                    <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex flex-col items-center">
                       <span className="text-[10px] text-white uppercase tracking-[0.5em] font-black drop-shadow-lg">Subject Validated</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-6">
                  <span className="iridescent-text text-xl md:text-4xl font-black italic tracking-tight animate-pulse">So, your honey is...</span>
                  <div className="relative group animate-score-reveal">
                    <div className="absolute inset-0 bg-gradient-to-tr from-cyan-400 to-pink-500 opacity-20 blur-[100px] group-hover:opacity-40 transition-opacity"></div>
                    <div className="relative flex items-end">
                      <span className="text-[10rem] md:text-[14rem] font-black text-white tracking-tighter leading-none drop-shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                        {Math.floor(result.auraScore)}
                      </span>
                      <div className="flex flex-col mb-6 md:mb-10 ml-2">
                        <span className="iridescent-text text-5xl md:text-8xl font-black">.{(result.auraScore % 1).toFixed(1).substring(2)}</span>
                        <span className="text-gray-500 text-2xl md:text-3xl font-bold opacity-30 tracking-widest">/ 10</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    {[...Array(10)].map((_, i) => (
                      <div key={i} className={`h-2 w-6 md:w-8 rounded-full ${i < result.auraScore ? 'bg-cyan-400 shadow-[0_0_15px_rgba(96,239,255,0.5)]' : 'bg-white/10'}`}></div>
                    ))}
                  </div>
                </div>

                <div className="space-y-10 text-center w-full max-w-3xl">
                  <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                  <p className="text-white text-2xl md:text-4xl leading-snug font-light italic px-4 drop-shadow-lg">
                    "{result.explanation}"
                  </p>
                  <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                </div>

                <div className="flex flex-col items-center w-full">
                  <button 
                    onClick={triggerTransformation}
                    disabled={isGeneratingTransformation}
                    className="group flex items-center gap-4 px-10 py-5 glass border-cyan-400/30 rounded-full hover:bg-cyan-400/10 transition-all mb-12 shadow-xl disabled:opacity-50"
                  >
                    <span className="text-cyan-400 font-black uppercase tracking-[0.2em] text-xs">
                      {isGeneratingTransformation ? "AI Generating..." : showComparison ? "Collapse Vision" : "Reveal AI Transformation"}
                    </span>
                    <svg className={`w-5 h-5 text-cyan-400 transition-transform duration-700 ${showComparison ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showComparison && (
                    <div className="w-full animate-in zoom-in-95 fade-in duration-700 space-y-12 pb-8">
                      {isGeneratingTransformation ? (
                        <div className="flex flex-col items-center gap-6 py-12">
                           <div className="w-16 h-16 border-t-2 border-cyan-400 rounded-full animate-spin"></div>
                           <p className="text-cyan-400 font-bold italic animate-pulse">Rendering peak effortless aura...</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          <div className="flex flex-col gap-6">
                            <span className="text-center font-serif italic text-2xl text-gray-500 uppercase tracking-widest text-[10px]">Reference</span>
                            <div className="aspect-[3/4] rounded-[3.5rem] overflow-hidden border-2 border-white/5 shadow-2xl bg-black relative">
                              {images[0].mimeType.startsWith('video/') ? (
                                <video src={images[0].base64} className="w-full h-full object-cover grayscale opacity-60" autoPlay muted loop playsInline />
                              ) : (
                                <img src={images[0].base64} className="w-full h-full object-cover grayscale opacity-60" alt="Original" />
                              )}
                              <div className="absolute inset-0 bg-cyan-900/20 mix-blend-overlay"></div>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-6">
                            <span className="text-center font-serif italic text-2xl iridescent-text uppercase tracking-widest text-[10px]">AI Vision (Enhanced Pose)</span>
                            <div className="aspect-[3/4] rounded-[3.5rem] border-2 border-pink-400/30 overflow-hidden shadow-2xl bg-black relative aura-glow-pink">
                              {result.transformedImageBase64 ? (
                                <img src={result.transformedImageBase64} className="w-full h-full object-cover" alt="AI Enhanced" />
                              ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center glass">
                                  <p className="text-white text-xl font-light italic font-serif leading-snug">
                                    "{result.vision}"
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 w-full relative z-10">
              <button onClick={reset} className="flex-1 py-7 glass text-white font-black text-xl rounded-[2.5rem] hover:bg-white/10 transition-all shadow-2xl active:scale-95 uppercase tracking-widest border border-white/10">
                Evaluate Another
              </button>
              <button onClick={goToGuide} className="flex-1 py-7 btn-iridescent text-white font-black text-xl rounded-[2.5rem] shadow-[0_20px_50px_rgba(96,239,255,0.3)] hover:scale-[1.03] transition-all active:scale-95 uppercase tracking-widest">
                Optimize Her Look
              </button>
            </div>
          </div>
        )}

        {state === AppState.GUIDE && result && (
          <div className="w-full flex flex-col gap-12 animate-in slide-in-from-right-12 duration-700 py-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4">
              <div className="flex items-center gap-6">
                <button onClick={backToResults} className="p-5 rounded-full glass text-white hover:bg-white/10 transition-colors shadow-xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter">Glow Up <span className="iridescent-text">Protocols.</span></h2>
              </div>
              <div className="glass px-6 py-3 rounded-full flex items-center gap-3 border-cyan-400/20">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></div>
                <span className="text-[10px] text-cyan-400 font-black uppercase tracking-widest">Active Optimization</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
              {result.detailedTips.map((tip, idx) => (
                <div 
                  key={idx}
                  className={`group relative glass rounded-[3rem] p-10 transition-all duration-700 overflow-hidden cursor-pointer hover:bg-white/5 ${activeGuideIndex === idx ? 'aura-glow-cyan border-cyan-400/40' : 'border-white/5'}`}
                  onClick={() => {
                    setActiveGuideIndex(activeGuideIndex === idx ? null : idx);
                    if (activeGuideIndex !== idx) playSparkle();
                  }}
                >
                  <div className="absolute top-0 right-0 p-8 opacity-10 text-white font-black italic text-9xl select-none group-hover:opacity-20 transition-opacity">
                    {idx + 1}
                  </div>
                  <div className="relative z-10 flex flex-col gap-6">
                    <h3 className="text-3xl md:text-4xl font-black text-white group-hover:iridescent-text transition-all duration-500 uppercase tracking-tighter">{tip.title}</h3>
                    <p className="text-gray-400 text-xl leading-relaxed max-w-[80%] font-medium">{tip.description}</p>
                    <div className={`overflow-hidden transition-all duration-700 ${activeGuideIndex === idx ? 'max-h-[600px] opacity-100 mt-6' : 'max-h-0 opacity-0'}`}>
                      <div className="pt-10 border-t border-white/10">
                        <span className="text-cyan-400 text-[10px] font-black uppercase tracking-[0.4em] mb-4 block">Deployment Action</span>
                        <div className="bg-cyan-400/5 p-10 rounded-[2.5rem] border border-cyan-400/20 flex items-center gap-8 shadow-inner group/item relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/5 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity"></div>
                          <div className="w-16 h-16 shrink-0 bg-cyan-400 rounded-2xl flex items-center justify-center text-black shadow-[0_0_30px_rgba(96,239,255,0.4)] relative z-10">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          </div>
                          <p className="text-white font-bold text-xl md:text-2xl leading-snug relative z-10">{tip.action}</p>
                        </div>
                      </div>
                    </div>
                    {activeGuideIndex !== idx && (
                      <div className="flex items-center gap-2 mt-4 animate-pulse">
                        <span className="text-cyan-400/60 text-[10px] font-black uppercase tracking-widest">Expansion Protocol Ready</span>
                        <div className="h-px w-12 bg-cyan-400/20"></div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="glass rounded-[3.5rem] p-12 text-center space-y-6 shadow-2xl border-white/10">
              <h4 className="iridescent-text font-black text-2xl md:text-3xl italic font-serif">"The iteration is immaculate. Go serve."</h4>
              <p className="text-gray-500 text-sm font-bold tracking-wide">Refine your look, then return for a recalibration.</p>
              <button onClick={reset} className="w-full py-6 glass text-white font-black rounded-2xl border border-white/10 hover:bg-white/10 transition-all mt-6 uppercase tracking-widest text-xs">
                Reset System
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 w-full p-6 flex justify-center backdrop-blur-3xl bg-black/40 border-t border-white/5 z-40">
        <div className="flex gap-16 text-[9px] text-gray-500 uppercase tracking-[0.4em] font-black">
          <span className="hover:text-cyan-400 cursor-pointer transition-colors" onClick={reset}>Core</span>
          <span className="hover:text-pink-400 cursor-pointer transition-colors">Privacy</span>
          <span className="hover:text-gold-400 cursor-pointer transition-colors">Legal</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
