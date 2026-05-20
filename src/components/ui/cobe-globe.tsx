'use client';

import { useEffect, useRef, useCallback } from 'react';
import createGlobe from 'cobe';

interface Marker {
  id: string;
  location: [number, number];
  size?: number;
}

interface GlobeProps {
  markers?: Marker[];
  className?: string;
  markerColor?: [number, number, number];
  baseColor?: [number, number, number];
  glowColor?: [number, number, number];
  dark?: number;
  mapBrightness?: number;
  markerSize?: number;
  speed?: number;
  theta?: number;
  diffuse?: number;
  mapSamples?: number;
}

export function Globe({
  markers = [],
  className = '',
  markerColor = [0.23, 0.21, 0.91],
  baseColor = [1, 1, 1],
  glowColor = [0.82, 0.82, 0.96],
  dark = 0,
  mapBrightness = 9,
  markerSize = 0.03,
  speed = 0.0015,
  theta = 0.25,
  diffuse = 1.4,
  mapSamples = 20000,
}: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null);
  const lastPointer = useRef<{ x: number; y: number; t: number } | null>(null);
  const dragOffset = useRef({ phi: 0, theta: 0 });
  const velocity = useRef({ phi: 0, theta: 0 });
  const phiOffsetRef = useRef(0);
  const thetaOffsetRef = useRef(0);
  const isPausedRef = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerInteracting.current = { x: e.clientX, y: e.clientY };
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
    isPausedRef.current = true;
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (pointerInteracting.current !== null) {
      const deltaX = e.clientX - pointerInteracting.current.x;
      const deltaY = e.clientY - pointerInteracting.current.y;
      dragOffset.current = { phi: deltaX / 280, theta: deltaY / 900 };
      const now = Date.now();
      if (lastPointer.current) {
        const dt = Math.max(now - lastPointer.current.t, 1);
        const max = 0.12;
        velocity.current = {
          phi: Math.max(-max, Math.min(max, ((e.clientX - lastPointer.current.x) / dt) * 0.3)),
          theta: Math.max(-max, Math.min(max, ((e.clientY - lastPointer.current.y) / dt) * 0.08)),
        };
      }
      lastPointer.current = { x: e.clientX, y: e.clientY, t: now };
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi;
      thetaOffsetRef.current += dragOffset.current.theta;
      dragOffset.current = { phi: 0, theta: 0 };
      lastPointer.current = null;
    }
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
    isPausedRef.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    let globe: ReturnType<typeof createGlobe> | null = null;
    let animationId: number;
    let phi = 0;

    function init() {
      const width = canvas.offsetWidth;
      if (width === 0 || globe) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      globe = createGlobe(canvas, {
        devicePixelRatio: dpr,
        width,
        height: width,
        phi: 0,
        theta,
        dark,
        diffuse,
        mapSamples,
        mapBrightness,
        baseColor,
        markerColor,
        glowColor,
        markerElevation: 0.01,
        markers: markers.map((m) => ({ location: m.location, size: m.size ?? markerSize, id: m.id })),
        arcs: [],
        arcColor: markerColor,
        arcWidth: 0,
        arcHeight: 0,
        opacity: 0.85,
      });

      function animate() {
        if (!isPausedRef.current) {
          phi += speed;
          if (Math.abs(velocity.current.phi) > 0.0001 || Math.abs(velocity.current.theta) > 0.0001) {
            phiOffsetRef.current += velocity.current.phi;
            thetaOffsetRef.current += velocity.current.theta;
            velocity.current.phi *= 0.94;
            velocity.current.theta *= 0.94;
          }
          const tMin = -0.35, tMax = 0.35;
          if (thetaOffsetRef.current < tMin) thetaOffsetRef.current += (tMin - thetaOffsetRef.current) * 0.1;
          else if (thetaOffsetRef.current > tMax) thetaOffsetRef.current += (tMax - thetaOffsetRef.current) * 0.1;
        }
        globe!.update({
          phi: phi + phiOffsetRef.current + dragOffset.current.phi,
          theta: theta + thetaOffsetRef.current + dragOffset.current.theta,
          dark,
          mapBrightness,
          markerColor,
          baseColor,
          markerElevation: 0.01,
          markers: markers.map((m) => ({ location: m.location, size: m.size ?? markerSize, id: m.id })),
        });
        animationId = requestAnimationFrame(animate);
      }
      animate();
      setTimeout(() => { if (canvas) canvas.style.opacity = '1'; });
    }

    if (canvas.offsetWidth > 0) {
      init();
    } else {
      const ro = new ResizeObserver((entries) => {
        if (entries[0]?.contentRect.width > 0) { ro.disconnect(); init(); }
      });
      ro.observe(canvas);
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (globe) globe.destroy();
    };
  }, [markers, markerColor, baseColor, glowColor, dark, mapBrightness, markerSize, speed, theta, diffuse, mapSamples]);

  return (
    <div className={`relative aspect-square select-none ${className}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        style={{
          width: '100%',
          height: '100%',
          cursor: 'grab',
          opacity: 0,
          transition: 'opacity 1.4s ease',
          borderRadius: '50%',
          touchAction: 'none',
        }}
      />
    </div>
  );
}
