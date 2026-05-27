import React, { useState, useRef, useEffect } from 'react';
import Hls from 'hls.js';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Settings, 
  ChevronRight, ChevronLeft, RotateCcw, RotateCw, 
  Settings2, Clock, SkipForward, SkipBack
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup
} from '@/components/ui/dropdown-menu';
import { Slider } from '@/components/ui/slider';
import { motion, AnimatePresence } from 'motion/react';

interface CoursePlayerProps {
  playbackId: string;
  title: string;
  onNext?: () => void;
  onPrev?: () => void;
  onEnded?: () => void;
  showNextPrev?: boolean;
}

export default function CoursePlayer({ playbackId, title, onNext, onPrev, onEnded, showNextPrev = true }: CoursePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const playerRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Normalize playback URI
  const getVideoUrl = (idOrUrl: string) => {
    if (!idOrUrl) return '';
    if (idOrUrl.startsWith('http://') || idOrUrl.startsWith('https://')) {
      return idOrUrl;
    }
    // Assume it's a Mux ID
    return `https://stream.mux.com/${idOrUrl}.m3u8`;
  };

  const videoUrl = getVideoUrl(playbackId);

  useEffect(() => {
    const video = playerRef.current;
    if (!video || !videoUrl) return;

    setHasError(false);

    if (Hls.isSupported() && videoUrl.includes('.m3u8')) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });

      hls.loadSource(videoUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.error('HLS Fatal Error:', data);
          setHasError(true);
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = videoUrl;
      video.load();
    } else {
      // Normal video file
      video.src = videoUrl;
      video.load();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [videoUrl]);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = () => {
    if (playerRef.current) {
      if (isPlaying) playerRef.current.pause();
      else playerRef.current.play().catch(err => console.error("Play failed:", err));
    }
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const t = e.currentTarget.currentTime;
    if (Number.isFinite(t)) {
      setCurrentTime(t);
    }
  };

  const handleDurationChange = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const d = e.currentTarget.duration;
    if (Number.isFinite(d)) {
      setDuration(d);
    }
  };

  const handleSeek = (value: number[]) => {
    const time = value[0];
    if (playerRef.current && Number.isFinite(time)) {
      playerRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (time: number) => {
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !isHovering) setShowControls(false);
    }, 3000);
  };

  return (
    <div 
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden group shadow-2xl"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <video
        ref={playerRef}
        className="w-full h-full object-contain"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleDurationChange}
        onEnded={onEnded}
        onError={() => setHasError(true)}
        autoPlay={false}
        playsInline
      />

      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/90 text-white p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
            <VolumeX className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-xl font-black mb-2">Video Unplayable</h3>
          <p className="text-zinc-400 text-sm max-w-xs">
            The video source could not be loaded. Please check the URL or Mux ID in the Admin panel.
          </p>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-6 bg-white text-black hover:bg-zinc-200 rounded-xl"
          >
            Retry Loading
          </Button>
        </div>
      )}

      {/* Custom Controls Overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 flex flex-col justify-between p-4"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between">
              <h2 className="text-white font-black text-sm sm:text-lg tracking-tight truncate max-w-[70%]">
                {title}
              </h2>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 gap-2">
                      <Settings className="w-4 h-4" />
                      <span className="hidden sm:inline">Speed {playbackRate}x</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-zinc-900 border-zinc-800 text-white">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-[10px] font-black uppercase text-zinc-500">Playback Speed</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-zinc-800" />
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                        <DropdownMenuItem 
                          key={rate} 
                          onClick={() => setPlaybackRate(rate)}
                          className={`hover:bg-orange-600 focus:bg-orange-600 ${playbackRate === rate ? 'bg-orange-600/20 text-orange-500' : ''}`}
                        >
                          {rate}x {rate === 1 && '(Normal)'}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Middle: Big Play Button on Click */}
            <div className="flex-1 flex items-center justify-center pointer-events-none">
              <motion.div 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-6 rounded-full bg-orange-600/20 backdrop-blur-sm border border-orange-500/30 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {isPlaying ? <Pause className="w-8 h-8 text-white fill-white" /> : <Play className="w-8 h-8 text-white fill-white ml-1" />}
              </motion.div>
            </div>

            {/* Bottom Bar */}
            <div className="space-y-4">
              {/* Seek Bar */}
              <div className="flex items-center gap-3 group/seek">
                <span className="text-[10px] font-black text-zinc-400 tabular-nums">{formatTime(currentTime)}</span>
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="flex-1 cursor-pointer"
                />
                <span className="text-[10px] font-black text-zinc-400 tabular-nums">{formatTime(duration)}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-4">
                  <Button variant="ghost" size="icon" onClick={togglePlay} className="text-white hover:bg-white/10">
                    {isPlaying ? <Pause className="fill-white" /> : <Play className="fill-white" />}
                  </Button>

                  {showNextPrev && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={onPrev} className="text-white hover:bg-white/10">
                        <SkipBack className="w-5 h-5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={onNext} className="text-white hover:bg-white/10">
                        <SkipForward className="w-5 h-5" />
                      </Button>
                    </div>
                  )}

                  <div className="hidden sm:flex items-center gap-2 group/volume">
                    <Button variant="ghost" size="icon" onClick={() => setIsMuted(!isMuted)} className="text-white hover:bg-white/10">
                      {isMuted || volume === 0 ? <VolumeX /> : <Volume2 />}
                    </Button>
                    <div className="w-0 overflow-hidden group-hover/volume:w-24 transition-all duration-300">
                      <Slider
                        value={[isMuted ? 0 : volume]}
                        max={1}
                        step={0.01}
                        onValueChange={(val) => {
                          setVolume(val[0]);
                          setIsMuted(val[0] === 0);
                        }}
                        className="w-20"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                   <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => playerRef.current?.requestFullscreen()} 
                    className="text-white hover:bg-white/10"
                   >
                    <Maximize className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
