
import React, { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import createGlobe from 'cobe';
import { useSpring } from '@react-spring/web';
import { LocationMarker, CameraControlRef } from '../types';

interface SceneProps {
  markers: LocationMarker[];
  selectedMarker: LocationMarker | null;
  onMarkerClick: (marker: LocationMarker) => void;
  isPaused: boolean;
  markerColor?: any;
  onLoadMore?: () => void;
}

// Helper to generate a consistent, bright color from a string ID
const getDeterministicColor = (id: string): [number, number, number] => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }

  // HSL to RGB conversion
  // Hue: 0-1 based on hash
  const h = Math.abs(hash % 360) / 360;
  // Saturation: High (0.8) for pop
  const s = 0.8;
  // Lightness: Medium-High (0.6) for glow
  const l = 0.6;

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);

  return [r, g, b];
};

const GlobeScene = forwardRef<CameraControlRef, SceneProps>(({ markers, selectedMarker, onMarkerClick, isPaused, markerColor = [1, 0.5, 0.1], onLoadMore }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<{ x: number, y: number } | null>(null);
  const pointerInteractionMovement = useRef({ x: 0, y: 0 });
  const pinchDist = useRef<number | null>(null);
  const rotationOffset = useRef({ phi: 0, theta: 0 });
  const globeInstance = useRef<any>(null);
  const isMobile = useRef(false);

  // Projection State for Bubbles
  const [bubblePositions, setBubblePositions] = useState<{ id: string, x: number, y: number, visible: boolean }[]>([]);
  const frameId = useRef(0);

  const [{ phi, theta, scale }, api] = useSpring(() => ({
    phi: 0,
    theta: 0.3,
    scale: window.innerWidth < 768 ? 0.65 : 1.1,
    config: { mass: 1, tension: 280, friction: 60 },
  }));

  useImperativeHandle(ref, () => ({
    flyTo: (lat: number, lng: number) => {
      const targetPhi = (lng * Math.PI) / 180;
      const targetTheta = ((90 - lat) * Math.PI) / 180;
      const adjustedPhi = targetPhi - rotationOffset.current.phi;
      const adjustedTheta = targetTheta - rotationOffset.current.theta;
      api.start({
        phi: adjustedPhi,
        theta: adjustedTheta,
        scale: isMobile.current ? 1.0 : 1.5,
      });
    },
    zoomIn: api.start.bind(null, { scale: Math.min(2.0, scale.get() + 0.4) }),
    zoomOut: api.start.bind(null, { scale: Math.max(0.8, scale.get() - 0.4) }),
    resetView: () => api.start({ phi: phi.get(), theta: 0.3, scale: 1.1 })
  }));

  useEffect(() => {
    let width = 0;
    let height = 0;
    const onResize = () => {
      if (canvasRef.current) {
        width = canvasRef.current.offsetWidth;
        height = canvasRef.current.offsetHeight;
        isMobile.current = window.innerWidth < 768;
      }
    };
    window.addEventListener('resize', onResize);
    onResize();

    if (!canvasRef.current) return;

    const cobeMarkers = markers
      .map(m => ({
        location: [m.latitude, m.longitude],
        size: selectedMarker && m.id === selectedMarker.id ? 0.08 : 0.02,
        // User Request: Real users = Golden Glow, Rest = Default White
        color: m.isUserPost ? [1, 0.8, 0.2] : [1, 1, 1]
      }));

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: width * 2,
      height: height * 2,
      phi: 0,
      theta: 0.3,
      dark: 1,
      diffuse: 1.2,
      scale: 1.1,
      mapSamples: 16000,
      mapBrightness: 12,
      baseColor: [0.3, 0.3, 0.35],
      markerColor: markerColor as [number, number, number],
      glowColor: [1.2, 0.8, 0.4],
      opacity: 0.8,
      markers: cobeMarkers,
      onRender: (state) => {
        if (!pointerInteracting.current && !isPaused) {
          rotationOffset.current.phi += 0.003;
        }

        state.phi = phi.get() + pointerInteractionMovement.current.x + rotationOffset.current.phi;
        state.theta = theta.get() + pointerInteractionMovement.current.y + rotationOffset.current.theta;
        state.scale = scale.get();
        state.width = width * 2;
        state.height = height * 2;

        // --- PROJECTION LOGIC WITH COLLISION DETECTION ---
        // Run for Events AND AI Posts
        if (markers.some(m => m.type === 'Event' || (m.type === 'Post' && !m.isUserPost))) {
          const candidates: any[] = [];

          // Pagination Logic
          const PAGE_SIZE = 20;
          const rotation = Math.abs(state.phi); // Use absolute rotation
          const pageIndex = Math.floor(rotation / (Math.PI * 2)); // One full spin = new page

          // Filter valid items first
          const feedItems = markers.filter(m => m.type === 'Event' || (m.type === 'Post' && !m.isUserPost));

          // Calculate slice
          // We modulo the index so it loops back if we run out but haven't loaded more yet?
          // Or just clamp?
          // User: "anticlockwise spin the old one should popup" -> implies mapping rotation to index directly.

          // Check if we need to load more
          if ((pageIndex + 1) * PAGE_SIZE > feedItems.length) {
            // Debounce calling loadMore? 
            // We rely on parent to handle debounce or check 'hasMore'.
            // We can't call this Every Frame. 
            // Let's use a throttle check via a Ref or simpler: check if we are at the edge.
            // Actually, onLoadMore is a function. We should only call it once per page boundary?
            // For simplicity, just call it, parent (NewsContext) checks isLoading.
            if (onLoadMore) onLoadMore();
          }

          // Safe Slice (Cyclical fallback if we really run out or just clamp?)
          // User said "infinite spin".
          // If we have 40 items (2 pages). 
          // Spin 0: 0-20. Spin 1: 20-40. Spin 2: 40-?? -> Load More.
          // If load more fails/ends, we should probably loop or stay at end?
          // Let's loop for visual continuity if no more data.

          let startIndex = pageIndex * PAGE_SIZE;
          if (startIndex >= feedItems.length) {
            if (feedItems.length > 0) {
              startIndex = startIndex % feedItems.length;
            } else {
              startIndex = 0;
            }
          }

          const currentSlice = feedItems.slice(startIndex, startIndex + PAGE_SIZE);

          currentSlice.forEach(m => {
            // Already validated type above

            const theta = m.latitude * Math.PI / 180;
            const phi = m.longitude * Math.PI / 180;

            // 1. Cartesian on sphere
            const x = Math.sin(phi) * Math.cos(theta);
            const y = Math.sin(theta);
            const z = Math.cos(phi) * Math.cos(theta);

            // 2. Rotate by state.phi
            const rPhi = state.phi;
            const x1 = x * Math.cos(rPhi) - z * Math.sin(rPhi);
            const y1 = y;
            const z1 = x * Math.sin(rPhi) + z * Math.cos(rPhi);

            // 3. Rotate by state.theta
            const rTheta = state.theta;
            const x2 = x1;
            const y2 = y1 * Math.cos(rTheta) - z1 * Math.sin(rTheta);
            const z2 = y1 * Math.sin(rTheta) + z1 * Math.cos(rTheta);

            // 4. Project
            const projectedScale = (state.width / 2) * state.scale;
            const screenX = (state.width / 2 + x2 * projectedScale) / 2;
            const screenY = (state.height / 2 - y2 * projectedScale) / 2;

            // Cull backside
            if (z2 > 0) {
              candidates.push({
                id: m.id,
                x: screenX,
                y: screenY,
                z: z2, // Depth for sorting
                marker: m
              });
            }
          });

          // Sort by Depth (Closest first) to ensure front labels take priority
          candidates.sort((a, b) => b.z - a.z);

          // Collision Detection
          const occupied: { x: number, y: number, w: number, h: number }[] = [];
          const visiblePositions: any[] = [];
          const LABEL_WIDTH = 200; // Increased for full headline
          const LABEL_HEIGHT = 60; // Increased for multi-tine

          candidates.forEach(c => {
            // Check collision
            // We assume the point (c.x, c.y) is the CENTER or TOP-LEFT?
            // CSS has transform translate. Usually centers it if we didn't offset.
            // Let's assume centered anchor for simplicity or adjust.
            // In CSS: transform: translate(x, y). 
            // We usually want to center the div on the point.
            // Let's define the box as centered on x,y.

            const box = {
              x: c.x - LABEL_WIDTH / 2,
              y: c.y - LABEL_HEIGHT / 2,
              w: LABEL_WIDTH,
              h: LABEL_HEIGHT
            };

            let hasCollision = false;
            for (const ob of occupied) {
              if (
                box.x < ob.x + ob.w &&
                box.x + box.w > ob.x &&
                box.y < ob.y + ob.h &&
                box.y + box.h > ob.y
              ) {
                hasCollision = true;
                break;
              }
            }

            if (!hasCollision) {
              occupied.push(box);
              visiblePositions.push({ ...c, visible: true });
            } else {
              // Optional: We could still track it as invisible if we wanted to animate out?
              // For now, simpler to just not render/hide.
              visiblePositions.push({ ...c, visible: false });
            }
          });

          // Update DOM
          if (bubbleContainerRef.current) {
            const children = bubbleContainerRef.current.children;
            for (let i = 0; i < children.length; i++) {
              const el = children[i] as HTMLElement;
              const id = el.dataset.id;
              const match = visiblePositions.find(p => p.id === id);

              if (match && match.visible) {
                // Offset to center the element
                el.style.transform = `translate(${match.x}px, ${match.y}px) translate(-50%, -50%)`;
                el.style.opacity = '1';
                el.style.pointerEvents = 'auto';
                el.style.zIndex = Math.floor(match.z * 100).toString(); // Stack order
              } else {
                el.style.opacity = '0';
                el.style.pointerEvents = 'none';
              }
            }
            latestPositionsRef.current = visiblePositions.filter(p => p.visible);
          }
        }
      },
    });

    globeInstance.current = globe;

    return () => {
      globe.destroy();
      window.removeEventListener('resize', onResize);
    };
  }, [markers, selectedMarker, isPaused, markerColor]);

  // Ref for bubbles projection
  const bubbleContainerRef = useRef<HTMLDivElement>(null);
  const latestPositionsRef = useRef<any[]>([]);

  // ... (Interaction Helpers)
  const [ripples, setRipples] = React.useState<{ x: number, y: number, id: number }[]>([]);

  const addRipple = (e: React.PointerEvent) => {
    // ... same ...
  };

  // Re-implement bindHelper/etc
  const bindHelper = (x: number, y: number, e?: any) => {
    pointerInteracting.current = { x: x - pointerInteractionMovement.current.x, y: y - pointerInteractionMovement.current.y };
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
    // Click Detection Logic here? No, 'bind' is down.
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';

    // CLICK DETECTION
    // If movement was small, it's a click
    // We don't track drag distance here explicitly for click, but usually 'click' event relies on it.
    // Let's use a standard onClick handler on the DIV.

    // Update physics
    rotationOffset.current.phi += pointerInteractionMovement.current.x;
    rotationOffset.current.theta += pointerInteractionMovement.current.y;
    pointerInteractionMovement.current = { x: 0, y: 0 };
    pinchDist.current = null;
  };

  const handleClick = (e: React.MouseEvent) => {
    // Check distance to projected markers
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    let bestMatch = null;
    let minDist = 30; // 30px hit radius

    latestPositionsRef.current.forEach(p => {
      const dist = Math.sqrt(Math.pow(p.x - clickX, 2) + Math.pow(p.y - clickY, 2));
      if (dist < minDist) {
        minDist = dist;
        bestMatch = p.marker;
      }
    });

    if (bestMatch) {
      onMarkerClick(bestMatch);
    }
  };

  const moveHelper = (x: number, y: number) => {
    if (pointerInteracting.current !== null) {
      const deltaX = x - pointerInteracting.current.x;
      const deltaY = y - pointerInteracting.current.y;
      pointerInteractionMovement.current = {
        x: deltaX * 0.005,
        y: Math.max(-0.8, Math.min(0.8, deltaY * 0.005))
      };
    }
  };

  // Render Bubbles (Static List)
  const renderBubbles = markers.filter(m => m.type === 'Event' || (m.type === 'Post' && !m.isUserPost));

  return (
    <div
      className="w-full h-full flex items-center justify-center bg-black overflow-hidden relative"
      onPointerDown={(e) => bindHelper(e.clientX, e.clientY, e)}
      onPointerUp={handlePointerUp}
      onPointerOut={handlePointerUp}
      onMouseMove={(e) => moveHelper(e.clientX, e.clientY)}
      onClick={handleClick}
      onTouchStart={(e) => {
        if (e.touches.length === 1) bindHelper(e.touches[0].clientX, e.touches[0].clientY);
      }}
      onTouchEnd={handlePointerUp}
      onTouchMove={(e) => {
        if (e.touches.length === 1) moveHelper(e.touches[0].clientX, e.touches[0].clientY);
      }}
    >
      <div
        className="absolute w-[200%] h-[200%] pointer-events-none opacity-30"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(255, 200, 100, 0.4) 0%, rgba(255, 100, 50, 0.1) 40%, transparent 70%)',
          zIndex: 0
        }}
      />

      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', contain: 'layout paint size', opacity: 1, zIndex: 10 }}
      />

      {/* BUBBLES CONTAINER */}
      <div ref={bubbleContainerRef} className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
        {renderBubbles.map(m => (
          <div
            key={m.id}
            data-id={m.id}
            onClick={(e) => {
              e.stopPropagation();
              onMarkerClick(m);
            }}
            className="absolute flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-black/70 via-black/60 to-black/70 backdrop-blur-md border border-yellow-500/40 shadow-[0_0_20px_rgba(255,200,100,0.3)] transition-opacity duration-200 cursor-pointer group hover:bg-black/80 hover:border-yellow-400/60 hover:shadow-[0_0_25px_rgba(255,200,100,0.5)]"
            style={{
              transform: 'translate(-50%, -50%)',
              opacity: 0,
              maxWidth: '200px',
              pointerEvents: 'auto'
            }}
          >
            <div className="w-2 h-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 animate-pulse shrink-0 shadow-[0_0_8px_rgba(255,200,100,0.6)]"></div>
            <span className="text-[10px] text-yellow-100 font-medium drop-shadow-md leading-tight">{m.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

export default GlobeScene;
