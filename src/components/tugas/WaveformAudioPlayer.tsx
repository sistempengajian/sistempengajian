'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, FastForward } from 'lucide-react';

interface WaveformAudioPlayerProps {
  audioUrl: string;
  title?: string;
  className?: string;
}

export default function WaveformAudioPlayer({
  audioUrl,
  title,
  className = '',
}: WaveformAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.25 | 1.5>(1);

  // Array dummy tinggi bar visual waveform
  const waveformBars = [
    25, 45, 65, 85, 95, 75, 40, 60, 90, 100,
    70, 45, 80, 85, 60, 40, 75, 95, 60, 35,
    50, 70, 90, 80, 60, 40, 70, 85, 55, 30,
  ];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('durationchange', updateDuration);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch((e) => console.error(e));
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, clickX / rect.width));
    audio.currentTime = percent * duration;
    setCurrentTime(audio.currentTime);
  };

  const cyclePlaybackRate = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const nextRate: 1 | 1.25 | 1.5 =
      playbackRate === 1 ? 1.25 : playbackRate === 1.25 ? 1.5 : 1;
    audio.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-teal-50/70 via-white to-slate-50 border border-teal-200/70 shadow-2xs space-y-2.5 ${className}`}
    >
      <audio ref={audioRef} src={audioUrl} preload="none" />

      {title && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-teal-600" />
            <span className="truncate">{title}</span>
          </span>
          <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">
            Audio Rekaman
          </span>
        </div>
      )}

      {/* Baris Waveform & Playback */}
      <div className="flex items-center gap-3">
        {/* Tombol Play / Pause */}
        <button
          type="button"
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-teal-600 hover:bg-teal-700 active:scale-95 text-white flex items-center justify-center shadow-xs transition-all cursor-pointer shrink-0"
          title={isPlaying ? 'Jeda Audio' : 'Putar Audio'}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        {/* Visual Waveform Bars Interaktif */}
        <div
          onClick={handleSeek}
          className="flex-1 h-9 flex items-center gap-[3px] sm:gap-1 px-2 bg-white/80 rounded-xl border border-slate-200/70 cursor-pointer overflow-hidden relative"
          title="Klik untuk geser posisi waktu pemutaran"
        >
          {waveformBars.map((heightPercent, index) => {
            const barProgress = (index / waveformBars.length) * 100;
            const isFilled = barProgress <= progressPercent;

            return (
              <div
                key={index}
                className="flex-1 rounded-full transition-all duration-150"
                style={{
                  height: `${Math.max(15, heightPercent * 0.75)}%`,
                  backgroundColor: isFilled ? '#0d9488' : '#cbd5e1',
                }}
              />
            );
          })}
        </div>

        {/* Tombol Pengatur Kecepatan Putar (1.0x, 1.25x, 1.5x) */}
        <button
          type="button"
          onClick={cyclePlaybackRate}
          className="h-9 px-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0 flex items-center gap-1 shadow-2xs"
          title="Ubah kecepatan putar audio (1.0x / 1.25x / 1.5x)"
        >
          <FastForward className="w-3.5 h-3.5 text-teal-600" />
          <span>{playbackRate}x</span>
        </button>
      </div>

      {/* Time Tracker Info */}
      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 px-1">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
