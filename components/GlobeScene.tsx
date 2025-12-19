
import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import createGlobe from 'cobe';
import { useSpring } from '@react-spring/web';
import { LocationMarker, CameraControlRef } from '../types';

interface SceneProps {
  markers: LocationMarker[];
  selectedMarker: LocationMarker | null;
  onMarkerClick: (marker: LocationMarker) => void;
  isPaused: boolean;
  markerColor?: any; // Relaxed type to avoid tuple/array conflicts with Cobe
}

const GlobeScene = forwardRef<CameraControlRef, SceneProps>(({ markers, selectedMarker, onMarkerClick, isPaused, markerColor = [1, 0.5, 0.1] }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<{ x: number, y: number } | null>(null);
  const pointerInteractionMovement = useRef({ x: 0, y: 0 });
  const pinchDist = useRef<number | null>(null);
  const rotationOffset = useRef({ phi: 0, theta: 0 }); // Accumulates rotation
  const globeInstance = useRef<any>(null);
  const isMobile = useRef(false);

  const [{ phi, theta, scale }, api] = useSpring(() => ({
    phi: 0,
    theta: 0.3,
    scale: window.innerWidth < 768 ? 0.65 : 1.1,
    config: { mass: 1, tension: 280, friction: 60 },
  }));

  useImperativeHandle(ref, () => ({
    flyTo: (lat: number, lng: number) => {
      // Calculate target phi (longitude) and theta (latitude)
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
    zoomIn: () => {
      api.start({ scale: Math.min(2.0, scale.get() + 0.4) });
    },
    zoomOut: () => {
      api.start({ scale: Math.max(0.8, scale.get() - 0.4) });
    },
    resetView: () => {
      api.start({
        phi: phi.get(),
        theta: 0.3,
        scale: 1.1,
      });
    }
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

    // Cobe only reliably updates markers on initialization or complete rebuild
    const cobeMarkers = markers.map(m => {
      const isSelected = selectedMarker && m.id === selectedMarker.id;
      // If nothing is selected, make ALL markers prominent (0.15).
      // If something is selected, make it very large (0.2) and others small (0.08).
      const size = selectedMarker
        ? (isSelected ? 0.2 : 0.08)
        : 0.15;

      return {
        location: [m.latitude, m.longitude],
        size: size
      };
    });

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: width * 2,
      height: height * 2,
      phi: 0, // Init value, will be overridden by onRender immediately
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
        // Auto-rotation logic
        if (!pointerInteracting.current && !isPaused) {
          rotationOffset.current.phi += 0.003;
        }

        // Living Atoms: Breathing Effect
        // Safeguard against mismatch in marker arrays
        if (state.markers) {
          state.markers.forEach((marker, i) => {
            const baseMarker = cobeMarkers[i];
            if (!baseMarker) return;

            const baseSize = baseMarker.size;
            // Oscillate by +/- 15% 
            const oscillation = Math.sin((Date.now() / 1000) * 2 + i) * 0.15 * baseSize;
            marker.size = baseSize + oscillation;
          });
        }

        // Combine spring physics with manual rotation/auto-rotation offset
        state.phi = phi.get() + pointerInteractionMovement.current.x + rotationOffset.current.phi;
        state.theta = theta.get() + pointerInteractionMovement.current.y + rotationOffset.current.theta;
        state.scale = scale.get();

        state.width = width * 2;
        state.height = height * 2;
      },
    });

    globeInstance.current = globe;

    return () => {
      globe.destroy();
      window.removeEventListener('resize', onResize);
    };
  }, [markers, selectedMarker, isPaused]); // Rebuild globe when markers change to ensure dots appear.

  const [ripples, setRipples] = React.useState<{ x: number, y: number, id: number }[]>([]);

  const addRipple = (e: React.PointerEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newRipple = { x, y, id: Date.now() };

    setRipples(prev => [...prev, newRipple]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newRipple.id));
    }, 1000);
  };

  const bindHelper = (x: number, y: number, e?: any) => {
    pointerInteracting.current = { x: x - pointerInteractionMovement.current.x, y: y - pointerInteractionMovement.current.y };
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
    if (e && e.pointerType !== 'touch') addRipple(e);
  };

  const contentHelper = () => {
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';

    rotationOffset.current.phi += pointerInteractionMovement.current.x;
    rotationOffset.current.theta += pointerInteractionMovement.current.y;
    pointerInteractionMovement.current = { x: 0, y: 0 };
    pinchDist.current = null;
  };

  const moveHelper = (x: number, y: number) => {
    if (pointerInteracting.current !== null) {
      const deltaX = x - pointerInteracting.current.x;
      const deltaY = y - pointerInteracting.current.y;
      pointerInteractionMovement.current = {
        x: deltaX * 0.005,
        y: Math.max(-0.8, Math.min(0.8, deltaY * 0.005)) // Bound vertical rotation
      };
    }
  };

  return (
    <div
      className="w-full h-full flex items-center justify-center bg-black overflow-hidden relative"
      onPointerDown={(e) => bindHelper(e.clientX, e.clientY, e)}
      onPointerUp={contentHelper}
      onPointerOut={contentHelper}
      onMouseMove={(e) => moveHelper(e.clientX, e.clientY)}
      onTouchStart={(e) => {
        if (e.touches.length === 1) {
          bindHelper(e.touches[0].clientX, e.touches[0].clientY);
        } else if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          pinchDist.current = Math.sqrt(dx * dx + dy * dy);
        }
      }}
      onTouchMove={(e) => {
        if (e.touches.length === 1) {
          moveHelper(e.touches[0].clientX, e.touches[0].clientY);
        } else if (e.touches.length === 2 && pinchDist.current !== null) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const delta = (dist - pinchDist.current) * 0.01;
          api.start({ scale: Math.max(0.5, Math.min(2.5, scale.get() + delta)) });
          pinchDist.current = dist;
        }
      }}
      onTouchEnd={contentHelper}
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
        style={{
          width: '100%',
          height: '100%',
          contain: 'layout paint size',
          opacity: 0,
          transition: 'opacity 1s ease',
          position: 'absolute',
          zIndex: 10,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)'
        }}
        onContextMenu={(e) => e.preventDefault()}
      />

      {ripples.map(ripple => (
        <div
          key={ripple.id}
          className="absolute rounded-full border border-orange-300 pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: '20px',
            height: '20px',
            transform: 'translate(-50%, -50%)',
            animation: 'ripple 1s ease-out forwards',
            zIndex: 20
          }}
        />
      ))}

      <style>{`
        canvas { opacity: 1 !important; }
        @keyframes ripple {
          0% { width: 0px; height: 0px; opacity: 1; border-width: 2px; }
          100% { width: 100px; height: 100px; opacity: 0; border-width: 0px; }
        }
      `}</style>
    </div>
  );
});

export default GlobeScene;
