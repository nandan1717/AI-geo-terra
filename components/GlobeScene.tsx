
import React, { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { LocationMarker, CameraControlRef } from '../types';

declare global {
  interface Window {
    Cesium: any;
  }
}

interface SceneProps {
  markers: LocationMarker[];
  onMarkerClick: (marker: LocationMarker) => void;
  isPaused: boolean;
}

const GlobeScene = forwardRef<CameraControlRef, SceneProps>(({ markers, onMarkerClick, isPaused }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const dataSourcesRef = useRef<any>(null);
  const [isViewerReady, setIsViewerReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !window.Cesium) return;

    const Cesium = window.Cesium;
    let viewer: any = null;
    let handler: any = null;

    const initCesium = async () => {
      try {
        // 0. Set Access Token
        Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN || process.env.VITE_CESIUM_ION_TOKEN;

        // 1. Initialize Viewer with minimal options first to ensure container is ready
        viewer = new Cesium.Viewer(containerRef.current, {
          imageryProvider: false, // We will add this manually
          terrainProvider: undefined, // We will add this manually
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          navigationHelpButton: false,
          animation: false,
          fullscreenButton: false,
          scene3DOnly: true,
          skyAtmosphere: new Cesium.SkyAtmosphere(),
          contextOptions: {
            webgl: {
              alpha: false,
              antialias: false, // Disable antialias for perf
              preserveDrawingBuffer: true,
              failIfMajorPerformanceCaveat: false,
              powerPreference: "high-performance"
            }
          },
          requestRenderMode: false, // Revert to continuous rendering for smoothness
          maximumRenderTimeChange: Infinity
        });

        if (!viewer) {
          console.error("Cesium Viewer failed to initialize");
          return;
        }

        console.log("DEBUG: Viewer initialized", viewer);
        if (!viewer.scene) {
          return;
        }

        // Parallelize Asset Loading
        console.log("Initializing Planetary Assets...");

        const [imageryResult, terrainResult] = await Promise.allSettled([
          // 1. Imagery
          Cesium.IonImageryProvider.fromAssetId(3).then((provider: any) => {
            if (!viewer.isDestroyed()) viewer.imageryLayers.addImageryProvider(provider);
          }).catch(async (e: any) => {
            console.error("Failed to load Ion Imagery, falling back to ArcGIS", e);
            const fallback = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
              "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer"
            );
            if (!viewer.isDestroyed()) viewer.imageryLayers.addImageryProvider(fallback);
          }),

          // 2. Terrain
          Cesium.createWorldTerrainAsync({
            requestWaterMask: false,
            requestVertexNormals: false
          }).then((provider: any) => {
            if (!viewer.isDestroyed()) viewer.scene.terrainProvider = provider;
          }).catch((e: any) => {
            console.warn("Failed to load World Terrain, using Ellipsoid", e);
            if (!viewer.isDestroyed()) viewer.scene.terrainProvider = new Cesium.EllipsoidTerrainProvider();
          }),

          // 3. Buildings - REMOVED for performance
          // Cesium.createOsmBuildingsAsync().then((tileset: any) => {
          //   if (!viewer.isDestroyed()) viewer.scene.primitives.add(tileset);
          // }).catch((e: any) => {
          //   console.warn("Could not load OSM Buildings", e);
          // })
        ]);

        if (viewer.isDestroyed()) return; // Final safety check

        // 5. Configure Lighting & Environment
        // Fix: Set time to Noon to ensure visibility
        const noonTime = Cesium.JulianDate.fromIso8601("2024-06-01T12:00:00Z");
        viewer.clock.currentTime = noonTime;
        viewer.clock.shouldAnimate = false;

        viewer.scene.globe.enableLighting = true; // Enable lighting for depth
        viewer.scene.highDynamicRange = true; // Enable HDR for glow

        // Fix: Do NOT set baseColor to Black if you want to avoid "black holes" when imagery fails.
        // However, for a space look, black is standard. We rely on imagery loading.
        // viewer.scene.globe.baseColor = Cesium.Color.BLACK; // This line is now effectively overridden by the DEBUG line above

        viewer.scene.globe.depthTestAgainstTerrain = true;
        viewer.scene.globe.showGroundAtmosphere = true; // Enable ground atmosphere for that "blue marble" look

        // 6. Quality Tuning
        viewer.scene.globe.maximumScreenSpaceError = 2.0;
        viewer.resolutionScale = window.devicePixelRatio; // Native resolution for 4K/Retina
        if (viewer.scene.postProcessStages.fxaa) {
          viewer.scene.postProcessStages.fxaa.enabled = true; // Enable FXAA for smoother edges
        }

        // Vertical Exaggeration for depth
        viewer.scene.verticalExaggeration = 1.5;

        // Atmosphere Tuning - Vibrant & Glowing
        viewer.scene.skyAtmosphere.show = true;
        viewer.scene.skyAtmosphere.saturationShift = 0.6; // Boost saturation for deep blue
        viewer.scene.skyAtmosphere.brightnessShift = 0.4; // Boost brightness for halo glow

        viewer.scene.fog.enabled = true; // Enable fog for atmospheric depth
        viewer.scene.fog.density = 0.0001; // Light fog
        viewer.scene.fog.screenSpaceErrorFactor = 2.0;

        // Hide Credits
        const creditContainer = viewer.bottomContainer;
        if (creditContainer) creditContainer.style.display = 'none';

        // Initial View
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(0, 20, 20000000)
        });

        // Setup Refs & Click Handlers
        viewerRef.current = viewer;
        dataSourcesRef.current = new Cesium.CustomDataSource('markers');
        viewer.dataSources.add(dataSourcesRef.current);

        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((click: any) => {
          const pickedObject = viewer.scene.pick(click.position);
          if (Cesium.defined(pickedObject) && pickedObject.id) {
            const entity = pickedObject.id;
            if (entity.properties && entity.properties.markerData) {
              const markerData = entity.properties.markerData.getValue();
              onMarkerClick(markerData);
            }
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        setIsViewerReady(true);

      } catch (error) {
        console.error("Cesium Critical Init Error:", error);
      }
    };

    initCesium();

    return () => {
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
      if (handler && !handler.isDestroyed()) handler.destroy();
    };
  }, []);

  // Sync Markers
  useEffect(() => {
    if (!isViewerReady || !viewerRef.current || !dataSourcesRef.current) return;
    const Cesium = window.Cesium;
    const dataSource = dataSourcesRef.current;

    dataSource.entities.removeAll();

    // Helper for LOD
    const getDistanceCondition = (type?: string) => {
      const Cesium = window.Cesium;
      switch (type) {
        case 'Country': return new Cesium.DistanceDisplayCondition(0.0, 20000000.0); // Visible from far
        case 'State': return new Cesium.DistanceDisplayCondition(0.0, 5000000.0);
        case 'City': return new Cesium.DistanceDisplayCondition(0.0, 250000.0); // Visible only when closer (< 250km)
        case 'Place': return new Cesium.DistanceDisplayCondition(0.0, 50000.0); // Visible only when very close (< 50km)
        case 'Business': return new Cesium.DistanceDisplayCondition(0.0, 25000.0); // Visible only when extremely close (< 25km)
        case 'Landmark': return new Cesium.DistanceDisplayCondition(0.0, 100000.0); // Visible from moderate distance (< 100km)
        default: return new Cesium.DistanceDisplayCondition(0.0, 5000000.0); // Default to State level
      }
    };

    markers.forEach(marker => {
      const distanceCondition = getDistanceCondition(marker.type);

      dataSource.entities.add({
        position: Cesium.Cartesian3.fromDegrees(marker.longitude, marker.latitude),
        billboard: {
          image: `data:image/svg+xml;base64,${btoa(`
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64">
                        <defs>
                            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                                <feMerge>
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                        </defs>
                        <circle cx="12" cy="12" r="6" fill="#00aaff" stroke="white" stroke-width="2" filter="url(#glow)"/>
                        <path d="M12 18 L12 24" stroke="#00aaff" stroke-width="2" />
                    </svg>
                `)}`,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          scale: 1.0,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          distanceDisplayCondition: distanceCondition
        },
        label: {
          text: marker.name,
          font: '14px sans-serif',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          verticalOrigin: Cesium.VerticalOrigin.TOP,
          pixelOffset: new Cesium.Cartesian2(0, 32),
          distanceDisplayCondition: distanceCondition
        },
        properties: { markerData: marker }
      });
    });

    viewerRef.current.scene.requestRender();
  }, [markers, isViewerReady]);



  // FlyTo & Zoom Controls
  useImperativeHandle(ref, () => ({
    flyTo: (lat: number, lng: number) => {
      if (!viewerRef.current || !window.Cesium) return;
      const Cesium = window.Cesium;

      viewerRef.current.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lng, lat, 5000.0),
        orientation: {
          heading: Cesium.Math.toRadians(0.0),
          pitch: Cesium.Math.toRadians(-45.0),
          roll: 0.0
        },
        duration: 3.0
      });
    },
    zoomIn: () => {
      if (!viewerRef.current) return;
      const camera = viewerRef.current.camera;
      const height = camera.positionCartographic.height;
      camera.zoomIn(height * 0.5); // Zoom in by 50% of current height
    },
    zoomOut: () => {
      if (!viewerRef.current) return;
      const camera = viewerRef.current.camera;
      const height = camera.positionCartographic.height;
      camera.zoomOut(height * 1.0); // Zoom out by 100% of current height
    },
    resetView: () => {
      if (!viewerRef.current || !window.Cesium) return;
      const Cesium = window.Cesium;
      viewerRef.current.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(0, 20, 20000000),
        duration: 2.0
      });
    }
  }));

  return <div ref={containerRef} className="w-full h-full bg-black" />;
});

export default GlobeScene;
