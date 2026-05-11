import React, { useEffect, useRef, useState, useCallback } from 'react';
import { pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut, BookOpen, Maximize2, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface PustakViewerProps {
  file: string;
  title?: string;
  author?: string;
  coverUrl?: string;
  onClose: () => void;
  isAdmin?: boolean;
}

const PustakViewer: React.FC<PustakViewerProps> = ({ file, title, author, coverUrl, onClose, isAdmin }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nPages, setNPages] = useState(0);
  const [curPage, setCurPage] = useState(1);
  const [zoomF, setZoomF] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [showBars, setShowBars] = useState(false);
  const [loadingText, setLoadingText] = useState('Loading PDF...');

  const stateRef = useRef({
    pdf: null as any,
    pW: 0,
    pH: 0,
    bScale: 1.0,
    cache: new Map<number, OffscreenCanvas>(),
    raf: null as number | null,
    busy: false,
    cur: 1,
    zoomF: 1.0,
    W: 0,
    H: 0
  });

  const barsTimerRef = useRef<NodeJS.Timeout | null>(null);

  const toggleBars = useCallback(() => {
    setShowBars(prev => !prev);
    if (barsTimerRef.current) clearTimeout(barsTimerRef.current);
    if (!showBars) {
      barsTimerRef.current = setTimeout(() => setShowBars(false), 3500);
    }
  }, [showBars]);

  const resizeCanvas = useCallback(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const W = containerRef.current.clientWidth;
    const H = containerRef.current.clientHeight;
    stateRef.current.W = W;
    stateRef.current.H = H;
    
    const dpr = window.devicePixelRatio || 1;
    canvasRef.current.width = W * dpr;
    canvasRef.current.height = H * dpr;
    canvasRef.current.style.width = W + 'px';
    canvasRef.current.style.height = H + 'px';
    
    if (stateRef.current.pdf) {
      stateRef.current.bScale = Math.min(W / stateRef.current.pW, H / stateRef.current.pH);
    }
  }, []);

  const getPageRect = useCallback(() => {
    const { W, H, bScale, zoomF, pW, pH } = stateRef.current;
    const s = bScale * zoomF;
    const pw = pW * s;
    const ph = pH * s;
    return { x: (W - pw) / 2, y: (H - ph) / 2, w: pw, h: ph };
  }, []);

  const drawPage = useCallback((ctx: CanvasRenderingContext2D, oc: OffscreenCanvas, x: number, y: number, w: number, h: number) => {
    const dpr = window.devicePixelRatio || 1;
    ctx.drawImage(oc, x * dpr, y * dpr, w * dpr, h * dpr);
  }, []);

  const addBindingShadow = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    const dpr = window.devicePixelRatio || 1;
    const sw = Math.min(w * 0.04, 18) * dpr;
    const gx = x * dpr, gy = y * dpr, gh = h * dpr;
    const g = ctx.createLinearGradient(gx, 0, gx + sw, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.38)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(gx, gy, sw, gh);
  }, []);

  const drawStatic = useCallback((n: number) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    const oc = stateRef.current.cache.get(n);
    if (!oc) return;
    
    const { W, H } = stateRef.current;
    const dpr = window.devicePixelRatio || 1;
    
    ctx.save();
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, W * dpr, H * dpr);
    
    const { x, y, w, h } = getPageRect();
    drawPage(ctx, oc, x, y, w, h);
    addBindingShadow(ctx, x, y, w, h);
    ctx.restore();
  }, [getPageRect, drawPage, addBindingShadow]);

  const ensurePage = async (n: number) => {
    if (stateRef.current.cache.has(n)) return;
    try {
      const page = await stateRef.current.pdf.getPage(n);
      const { bScale, zoomF } = stateRef.current;
      const s = bScale * zoomF;
      const dpr = window.devicePixelRatio || 1;
      const vp = page.getViewport({ scale: s * dpr });
      const oc = new OffscreenCanvas(Math.round(vp.width), Math.round(vp.height));
      const oc2 = oc.getContext('2d');
      if (oc2) {
        oc2.fillStyle = '#fffef8';
        oc2.fillRect(0, 0, oc.width, oc.height);
        await page.render({ canvasContext: oc2, viewport: vp }).promise;
        stateRef.current.cache.set(n, oc);
      }
    } catch (e) {
      console.error('Error rendering page:', e);
    }
  };

  const precache = async (n: number) => {
    for (let d = 1; d <= 3; d++) {
      if (n + d <= stateRef.current.pdf.numPages) ensurePage(n + d);
      if (n - d >= 1) ensurePage(n - d);
    }
  };

  const drawCurl = useCallback((dir: 'next' | 'prev', fromOC: OffscreenCanvas, toOC: OffscreenCanvas, t: number) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const { x, y, w, h } = getPageRect();
    const dpr = window.devicePixelRatio || 1;
    const { W, H } = stateRef.current;

    const PX = x * dpr, PY = y * dpr, PW = w * dpr, PH = h * dpr;
    const foldPos = dir === 'next' ? PW * (1 - t) : PW * t;

    ctx.save();
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, W * dpr, H * dpr);
    
    // 1. Draw toPage background
    drawPage(ctx, toOC, x, y, w, h);

    // 2. Shadow cast by lifting page
    if (dir === 'next') {
      const shW = Math.min(foldPos * 0.35, PW * 0.18);
      if (shW > 1) {
        const sg = ctx.createLinearGradient(PX + foldPos, PY, PX + foldPos - shW, PY);
        sg.addColorStop(0, `rgba(0,0,0,${0.42 * (1 - t)})`);
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(PX + foldPos - shW, PY, shW, PH);
      }
    } else {
      const shW = Math.min((PW - foldPos) * 0.35, PW * 0.18);
      if (shW > 1) {
        const sg = ctx.createLinearGradient(PX + foldPos, PY, PX + foldPos + shW, PY);
        sg.addColorStop(0, `rgba(0,0,0,${0.42 * t})`);
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(PX + foldPos, PY, shW, PH);
      }
    }

    // 3. Draw curling fromPage with warp
    const COLS = Math.ceil(PW);
    const colW = PW / COLS;

    ctx.save();
    ctx.beginPath();
    ctx.rect(PX, PY, PW, PH);
    ctx.clip();

    const fromOCContext = fromOC.getContext('2d');

    for (let c = 0; c < COLS; c++) {
      const sx = c * colW;
      let draw = false;
      let destX = 0, brightness = 1, alpha = 1;

      if (dir === 'next') {
        if (sx < foldPos) continue;
        draw = true;
        const localT = (sx - foldPos) / (PW - foldPos + 0.001);
        const curl = Math.sin(Math.PI * localT * 0.5);
        destX = PX + foldPos + (sx - foldPos) * (1 - t * 0.92 * curl);
        brightness = 0.72 + 0.28 * Math.sin(Math.PI * localT);
        alpha = localT < 0.05 ? localT / 0.05 : 1;
      } else {
        if (sx > foldPos) continue;
        draw = true;
        const localT = (foldPos - sx) / (foldPos + 0.001);
        const curl = Math.sin(Math.PI * localT * 0.5);
        destX = PX + foldPos - (foldPos - sx) * (1 - (1 - t) * 0.92 * curl);
        brightness = 0.72 + 0.28 * Math.sin(Math.PI * localT);
        alpha = localT < 0.05 ? localT / 0.05 : 1;
      }

      if (draw) {
        ctx.globalAlpha = alpha;
        ctx.drawImage(
          fromOC,
          Math.round(sx), 0, Math.ceil(colW), fromOC.height,
          Math.round(destX), PY, Math.ceil(colW), PH
        );
        if (brightness < 1) {
          ctx.globalAlpha = alpha * (1 - brightness) * 0.75;
          ctx.fillStyle = 'rgba(0,0,0,1)';
          ctx.fillRect(Math.round(destX), PY, Math.ceil(colW), PH);
        } else if (brightness > 1) {
          ctx.globalAlpha = alpha * (brightness - 1) * 0.5;
          ctx.fillStyle = 'rgba(255,255,255,1)';
          ctx.fillRect(Math.round(destX), PY, Math.ceil(colW), PH);
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // 4. Crease highlight
    const creaseX = PX + foldPos;
    const creaseW = Math.min(PW * 0.008, 5) * dpr;
    const cg = ctx.createLinearGradient(creaseX - creaseW, PY, creaseX + creaseW, PY);
    cg.addColorStop(0, 'rgba(255,255,255,0)');
    cg.addColorStop(0.5, `rgba(255,255,255,${0.55 * Math.sin(Math.PI * t)})`);
    cg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(creaseX - creaseW, PY, creaseW * 2, PH);

    addBindingShadow(ctx, x, y, w, h);
    ctx.restore();
  }, [getPageRect, drawPage, addBindingShadow]);

  const startCurl = useCallback((dir: 'next' | 'prev', fromOC: OffscreenCanvas, toOC: OffscreenCanvas) => {
    if (stateRef.current.raf) cancelAnimationFrame(stateRef.current.raf);
    const DUR = 560;
    let t0: number | null = null;

    const frame = (ts: number) => {
      if (!t0) t0 = ts;
      let p = Math.min((ts - t0) / DUR, 1);
      // ease-in-out quart
      p = p < 0.5 ? 8 * p * p * p * p : 1 - Math.pow(-2 * p + 2, 4) / 2;

      drawCurl(dir, fromOC, toOC, p);

      if (p < 1) {
        stateRef.current.raf = requestAnimationFrame(frame);
      } else {
        stateRef.current.raf = null;
        drawStatic(stateRef.current.cur);
        stateRef.current.busy = false;
        setIsBusy(false);
        setCurPage(stateRef.current.cur);
        precache(stateRef.current.cur);
      }
    };
    stateRef.current.raf = requestAnimationFrame(frame);
  }, [drawCurl, drawStatic]);

  const changePage = useCallback(async (dir: 'next' | 'prev') => {
    if (stateRef.current.busy) return;
    const { cur } = stateRef.current;
    if (dir === 'next' && cur >= nPages) return;
    if (dir === 'prev' && cur <= 1) return;

    stateRef.current.busy = true;
    setIsBusy(true);

    const from = cur;
    const to = dir === 'next' ? cur + 1 : cur - 1;
    stateRef.current.cur = to;

    setLoadingText('');
    setIsLoading(true);
    await Promise.all([ensurePage(from), ensurePage(to)]);
    setIsLoading(false);

    const fromOC = stateRef.current.cache.get(from);
    const toOC = stateRef.current.cache.get(to);
    if (fromOC && toOC) {
      startCurl(dir, fromOC, toOC);
    } else {
      stateRef.current.busy = false;
      setIsBusy(false);
      setCurPage(to);
      drawStatic(to);
    }
  }, [nPages, startCurl, drawStatic]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      setLoadingText('Loading PDF...');
      try {
        const loadingTask = pdfjs.getDocument(file);
        const pdf = await loadingTask.promise;
        stateRef.current.pdf = pdf;
        setNPages(pdf.numPages);
        
        const page1 = await pdf.getPage(1);
        const vp = page1.getViewport({ scale: 1 });
        stateRef.current.pW = vp.width;
        stateRef.current.pH = vp.height;
        
        stateRef.current.cache.clear();
        resizeCanvas();
        
        setLoadingText('Rendering...');
        await ensurePage(1);
        drawStatic(1);
        precache(1);
        setIsLoading(false);
      } catch (e) {
        console.error('PDF error:', e);
        toast.error('Failed to load PDF');
      }
    };

    if (file) {
      init();
    }

    return () => {
      if (stateRef.current.raf) cancelAnimationFrame(stateRef.current.raf);
    };
  }, [file]);

  useEffect(() => {
    const handleResize = () => {
      resizeCanvas();
      if (stateRef.current.pdf) {
        stateRef.current.cache.clear();
        (async () => {
          await ensurePage(stateRef.current.cur);
          drawStatic(stateRef.current.cur);
          precache(stateRef.current.cur);
        })();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [resizeCanvas, drawStatic]);

  const handleZoom = (d: number) => {
    const newZoom = Math.max(0.4, Math.min(3, stateRef.current.zoomF + d));
    stateRef.current.zoomF = newZoom;
    setZoomF(newZoom);
    stateRef.current.cache.clear();
    (async () => {
      await ensurePage(stateRef.current.cur);
      drawStatic(stateRef.current.cur);
      precache(stateRef.current.cur);
    })();
  };

  return (
    <div ref={containerRef} className="fixed inset-0 z-[100] bg-[#0a0a0f] flex flex-col overflow-hidden select-none touch-none">
      {/* Header Bar */}
      <div className={`absolute top-0 left-0 right-0 h-16 bg-black/40 backdrop-blur-xl border-b border-white/5 z-50 flex items-center justify-between px-6 transition-opacity duration-500 ${showBars ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex items-center gap-4">
          {coverUrl && <div className="w-8 h-11 bg-zinc-800 rounded shadow-lg overflow-hidden shrink-0">
             <img src={coverUrl} alt="" className="w-full h-full object-cover" />
          </div>}
          <div className="flex flex-col">
            <span className="text-white font-black tracking-tight text-sm line-clamp-1">{title || 'pustak'}</span>
            <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest leading-none">by {author || 'pustak.online'}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-4">
          <div className="flex items-center bg-white/5 rounded-xl border border-white/10 p-0.5">
            <Button variant="ghost" size="icon" onClick={() => handleZoom(-0.15)} className="h-8 w-8 text-zinc-400 hover:text-white shrink-0">
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-[10px] font-black text-white w-10 text-center">{Math.round(zoomF * 100)}%</span>
            <Button variant="ghost" size="icon" onClick={() => handleZoom(0.15)} className="h-8 w-8 text-zinc-400 hover:text-white shrink-0">
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 bg-white/5 rounded-xl border border-white/10 px-3 h-9 sm:flex hidden">
             <span className="text-[10px] font-black text-white">PAGE</span>
             <input 
               type="number" 
               value={curPage} 
               onChange={(e) => {
                 const v = parseInt(e.target.value);
                 if (!isNaN(v)) {
                   stateRef.current.cur = Math.max(1, Math.min(nPages, v));
                   setCurPage(stateRef.current.cur);
                   (async () => {
                     await ensurePage(stateRef.current.cur);
                     drawStatic(stateRef.current.cur);
                     precache(stateRef.current.cur);
                   })();
                 }
               }}
               className="w-10 bg-transparent border-none text-white text-center font-black text-xs h-full"
             />
             <span className="text-[10px] font-black text-zinc-500">/ {nPages}</span>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white" asChild>
              <a href={file} target="_blank" rel="noopener noreferrer">
                <Download className="w-5 h-5" />
              </a>
            </Button>}
            <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-400 hover:text-white hover:bg-white/10 rounded-full">
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Canvas Container */}
      <canvas 
        ref={canvasRef} 
        id="cv" 
        onClick={(e) => {
          const zone = e.clientX / stateRef.current.W;
          if (zone < 0.25) changePage('prev');
          else if (zone > 0.75) changePage('next');
          else toggleBars();
        }}
        className="cursor-pointer"
      />

      {/* Progress Footer Bar */}
      <div className={`absolute bottom-0 left-0 right-0 h-16 bg-black/40 backdrop-blur-xl border-t border-white/5 z-50 flex items-center gap-6 px-6 transition-opacity duration-500 ${showBars ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <Button 
          variant="ghost" 
          size="icon" 
          disabled={curPage <= 1 || isBusy} 
          onClick={() => changePage('prev')}
          className="text-white disabled:opacity-20 h-10 w-10 shrink-0"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        
        <div 
          className="flex-grow h-1.5 bg-white/10 rounded-full relative cursor-pointer group"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            const targetPage = Math.max(1, Math.min(nPages, Math.round(pct * nPages)));
            stateRef.current.cur = targetPage;
            setCurPage(targetPage);
            (async () => {
              setIsLoading(true);
              setLoadingText('Jumping to page...');
              await ensurePage(targetPage);
              drawStatic(targetPage);
              precache(targetPage);
              setIsLoading(false);
            })();
          }}
        >
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange-500 to-rose-500 rounded-full transition-all duration-300" 
            style={{ width: `${((curPage - 1) / Math.max(nPages - 1, 1)) * 100}%` }}
          />
          {/* Tooltip on hover could go here */}
        </div>

        <Button 
          variant="ghost" 
          size="icon" 
          disabled={curPage >= nPages || isBusy} 
          onClick={() => changePage('next')}
          className="text-white disabled:opacity-20 h-10 w-10 shrink-0"
        >
          <ChevronRight className="w-6 h-6" />
        </Button>
      </div>

      {/* Side Hit Areas (Desktop) */}
      <div 
        className={`fixed top-1/2 left-6 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white cursor-pointer hover:bg-white/10 transition-all z-[60] ${curPage <= 1 ? 'opacity-0 pointer-events-none' : 'opacity-100 md:flex hidden'}`}
        onClick={() => changePage('prev')}
      >
        <ChevronLeft className="w-6 h-6" />
      </div>
      <div 
        className={`fixed top-1/2 right-6 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white cursor-pointer hover:bg-white/10 transition-all z-[60] ${curPage >= nPages ? 'opacity-0 pointer-events-none' : 'opacity-100 md:flex hidden'}`}
        onClick={() => changePage('next')}
      >
        <ChevronRight className="w-6 h-6" />
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-[1000] bg-[#0a0a0f]/90 flex flex-col items-center justify-center gap-6 animate-in fade-in duration-500">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-white/5 border-t-orange-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-orange-500" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
             <span className="text-white font-black uppercase italic tracking-tighter text-xl">pustak</span>
             <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">{loadingText}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PustakViewer;
