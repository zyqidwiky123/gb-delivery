import React, { useRef, useEffect, useCallback, useState } from 'react';
import { m } from 'framer-motion';
import { getOptimizedImageUrl } from '../utils/imageUtils';

const ImageViewer = ({ images = [], initialIndex = 0, onClose }) => {
  const [currentIdx, setCurrentIdx] = useState(initialIndex);
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  const g = useRef({
    scale: 1, tx: 0, ty: 0,
    initDist: 0, initScale: 1, initTx: 0, initTy: 0,
    startX: 0, startY: 0, lastTap: 0,
    isPinch: false, isDrag: false, moved: false,
  });

  const apply = useCallback(() => {
    if (imgRef.current) {
      const { scale, tx, ty } = g.current;
      imgRef.current.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    }
  }, []);

  const animateTo = useCallback((s, x, y) => {
    const r = g.current;
    r.scale = s; r.tx = x; r.ty = y;
    if (imgRef.current) {
      imgRef.current.style.transition = 'transform 0.3s cubic-bezier(0.32,0.72,0,1)';
      apply();
      setTimeout(() => { if (imgRef.current) imgRef.current.style.transition = 'none'; }, 320);
    }
  }, [apply]);

  const reset = useCallback((animate = true) => {
    if (animate) animateTo(1, 0, 0);
    else { g.current.scale = 1; g.current.tx = 0; g.current.ty = 0; apply(); }
  }, [animateTo, apply]);

  const dist = (a, b) => Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);

  const onTS = useCallback((e) => {
    const r = g.current;
    r.moved = false;

    if (e.touches.length === 2) {
      e.preventDefault();
      r.isPinch = true; r.isDrag = false;
      r.initDist = dist(e.touches[0], e.touches[1]);
      r.initScale = r.scale; r.initTx = r.tx; r.initTy = r.ty;
      return;
    }

    if (e.touches.length === 1) {
      const now = Date.now();
      if (now - r.lastTap < 300) {
        e.preventDefault();
        if (r.scale > 1.5) { reset(true); }
        else {
          const rect = containerRef.current.getBoundingClientRect();
          const tapX = e.touches[0].clientX - rect.left - rect.width / 2;
          const tapY = e.touches[0].clientY - rect.top - rect.height / 2;
          animateTo(2.5, -tapX * 1.5, -tapY * 1.5);
        }
        r.lastTap = 0;
        return;
      }
      r.lastTap = now;
      r.startX = e.touches[0].clientX;
      r.startY = e.touches[0].clientY;
      r.initTx = r.tx; r.initTy = r.ty;
      r.isDrag = true;
    }
  }, [reset, animateTo]);

  const onTM = useCallback((e) => {
    const r = g.current;

    if (r.isPinch && e.touches.length === 2) {
      e.preventDefault();
      const ratio = dist(e.touches[0], e.touches[1]) / r.initDist;
      r.scale = Math.min(Math.max(r.initScale * ratio, 0.8), 5);
      r.moved = true;
      apply();
    } else if (r.isDrag && e.touches.length === 1) {
      const dx = e.touches[0].clientX - r.startX;
      const dy = e.touches[0].clientY - r.startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) r.moved = true;

      if (r.scale > 1) {
        e.preventDefault();
        r.tx = r.initTx + dx;
        r.ty = r.initTy + dy;
        apply();
      }
    }
  }, [apply]);

  const onTE = useCallback((e) => {
    const r = g.current;

    if (r.isPinch) {
      r.isPinch = false;
      if (r.scale < 1.05) reset(true);
      return;
    }

    if (r.isDrag) {
      r.isDrag = false;
      if (r.scale <= 1 && r.moved && e.changedTouches[0]) {
        const dx = e.changedTouches[0].clientX - r.startX;
        const dy = e.changedTouches[0].clientY - r.startY;

        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
          if (dx < 0 && currentIdx < images.length - 1) setCurrentIdx(p => p + 1);
          else if (dx > 0 && currentIdx > 0) setCurrentIdx(p => p - 1);
        } else if (dy > 80 && Math.abs(dy) > Math.abs(dx)) {
          onClose();
        }
      }
    }
  }, [currentIdx, images.length, onClose, reset]);

  useEffect(() => { reset(false); }, [currentIdx, reset]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (!images.length) return null;

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[200] bg-black/95 flex flex-col select-none"
    >
      {/* Top bar */}
      <div className="flex-none flex items-center justify-between px-4 pt-4 pb-2 z-10">
        <span className="text-xs font-bold text-on-background/50">{currentIdx + 1} / {images.length}</span>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-on-background/10 flex items-center justify-center text-on-background/70 active:scale-90 transition-transform"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden flex items-center justify-center"
        onTouchStart={onTS}
        onTouchMove={onTM}
        onTouchEnd={onTE}
        style={{ touchAction: 'none' }}
      >
        <img
          ref={imgRef}
          src={getOptimizedImageUrl(images[currentIdx], { width: 800, height: 1200, fit: 'inside' })}
          alt={`Menu ${currentIdx + 1}`}
          className="max-w-full max-h-full object-contain"
          style={{ transformOrigin: 'center center', willChange: 'transform' }}
          draggable={false}
        />
      </div>

      {/* Bottom thumbnails + hint */}
      <div className="flex-none px-4 pb-5 pt-2 space-y-2">
        {images.length > 1 && (
          <div className="flex gap-2 justify-center overflow-x-auto no-scrollbar">
            {images.map((url, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIdx(idx)}
                className={`flex-none w-12 h-12 rounded-xl overflow-hidden border-2 transition-all ${
                  idx === currentIdx ? 'border-primary opacity-100' : 'border-on-background/10 opacity-40'
                }`}
              >
                <img
                  src={getOptimizedImageUrl(url, { width: 64, height: 64 })}
                  alt={`Thumb ${idx + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
        <p className="text-[9px] text-center text-on-background/25 font-medium">
          Cubit untuk zoom · Ketuk 2x untuk perbesar · Geser untuk navigasi
        </p>
      </div>
    </m.div>
  );
};

export default ImageViewer;
