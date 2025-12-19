
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
  const pointerInteracting = useRef<any>(null);
  const pointerInteractionMovement = useRef(0);
  const rotationOffset = useRef(0); // Accumulates auto-rotation
  const globeInstance = useRef<any>(null);

  const [{ phi, theta, scale }, api] = useSpring(() => ({
    phi: 0,
    theta: 0.3,
    scale: 1.1,
    config: { mass: 1, tension: 280, friction: 60 },
  }));

  useImperativeHandle(ref, () => ({
    flyTo: (lat: number, lng: number) => {
      // Calculate target phi (longitude) and theta (latitude)
      const targetPhi = (lng * Math.PI) / 180;
      const targetTheta = ((90 - lat) * Math.PI) / 180;

      // Adjust target phi to account for current rotation offset
      // visualPhi = springPhi + offset
      // targetVisualPhi = newSpringPhi + offset
      // => newSpringPhi = targetVisualPhi - offset

      const adjustedPhi = targetPhi - rotationOffset.current;

      api.start({
        phi: adjustedPhi,
        theta: targetTheta,
        scale: 1.5,
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
          rotationOffset.current += 0.003;
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
        state.phi = phi.get() + pointerInteractionMovement.current + rotationOffset.current;
        state.theta = theta.get();
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

  const bindHelper = (e: any) => {
    pointerInteracting.current = e.clientX - pointerInteractionMovement.current;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
    addRipple(e);
  };

  const contentHelper = (e: any) => {
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';

    const delta = pointerInteractionMovement.current;
    rotationOffset.current += delta;
    pointerInteractionMovement.current = 0;
  };

  const moveHelper = (e: any) => {
    if (pointerInteracting.current !== null) {
      const delta = e.clientX - pointerInteracting.current;
      pointerInteractionMovement.current = delta * 0.005;
    }
  };

  return (
    <div
      className="w-full h-full flex items-center justify-center bg-black overflow-hidden relative"
      onPointerDown={bindHelper}
      onPointerUp={contentHelper}
      onPointerOut={contentHelper}
      onMouseMove={moveHelper}
      onTouchStart={(e) => bindHelper(e.touches[0])}
      onTouchMove={(e) => moveHelper(e.touches[0])}
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
        style={{ width: '100%', height: '100%', contain: 'layout paint size', opacity: 0, transition: 'opacity 1s ease', position: 'relative', zIndex: 10 }}
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
