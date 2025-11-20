
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
        Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyYTg0NjdhYy04MzNhLTRlOTYtOTA0Zi1mNzYxYmZiYmYzNTQiLCJpZCI6MzYyMTQwLCJpYXQiOjE3NjM2MzAyMzN9.zo4xcLIcxWIfdjXOEoCqAPYGazcI_cB2FXQcOBNazI8";

        // 1. Initialize Viewer with minimal options first to ensure container is ready
        // We disable imageryProvider initially to manage it explicitly
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
              antialias: true,
              preserveDrawingBuffer: true,
              failIfMajorPerformanceCaveat: false,
              powerPreference: "high-performance"
            }
          },
          requestRenderMode: false, // Force constant rendering for smooth updates
          maximumRenderTimeChange: Infinity
        });

        // 2. Explicitly Add Imagery Layer (Bing Maps Hybrid - Asset ID 3)
        try {
          console.log("Loading Imagery...");
          const imageryProvider = await Cesium.IonImageryProvider.fromAssetId(3);
          viewer.imageryLayers.addImageryProvider(imageryProvider);
        } catch (e) {
          console.error("Failed to load Ion Imagery, falling back to ArcGIS", e);
          const fallbackImagery = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
            "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer"
          );
          viewer.imageryLayers.addImageryProvider(fallbackImagery);
        }

        // 3. Explicitly Add Terrain (Cesium World Terrain)
        try {
          console.log("Loading Terrain...");
          const terrainProvider = await Cesium.createWorldTerrainAsync({
            requestWaterMask: true,
            requestVertexNormals: true
          });
          viewer.scene.terrainProvider = terrainProvider;
        } catch (e) {
          console.warn("Failed to load World Terrain, using Ellipsoid", e);
          viewer.scene.terrainProvider = new Cesium.EllipsoidTerrainProvider();
        }

        // 4. Add 3D Buildings (OSM)
        try {
          console.log("Loading 3D Buildings...");
          const buildingsTileset = await Cesium.createOsmBuildingsAsync();
          viewer.scene.primitives.add(buildingsTileset);
        } catch (e) {
          console.warn("Could not load OSM Buildings", e);
        }

        // 5. Configure Lighting & Environment
        // Fix: Set time to Noon to ensure visibility
        const noonTime = Cesium.JulianDate.fromIso8601("2024-06-01T12:00:00Z");
        viewer.clock.currentTime = noonTime;
        viewer.clock.shouldAnimate = false;

        viewer.scene.globe.enableLighting = true;
        viewer.scene.highDynamicRange = true;

        // Fix: Do NOT set baseColor to Black if you want to avoid "black holes" when imagery fails.
        // However, for a space look, black is standard. We rely on imagery loading.
        viewer.scene.globe.baseColor = Cesium.Color.BLACK;

        viewer.scene.globe.depthTestAgainstTerrain = true;
        viewer.scene.globe.showGroundAtmosphere = true;

        // 6. Quality Tuning
        viewer.scene.globe.maximumScreenSpaceError = 1.2; // Balance detail/perf
        viewer.resolutionScale = window.devicePixelRatio || 1.0;
        if (viewer.scene.postProcessStages.fxaa) {
          viewer.scene.postProcessStages.fxaa.enabled = true;
        }

        // Vertical Exaggeration for depth
        viewer.scene.verticalExaggeration = 1.5;

        // Atmosphere Tuning
        viewer.scene.skyAtmosphere.show = true;
        viewer.scene.skyAtmosphere.saturationShift = 0.1;
        viewer.scene.skyAtmosphere.brightnessShift = 0.1;

        viewer.scene.fog.enabled = true;
        viewer.scene.fog.density = 0.0001;
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

    markers.forEach(marker => {
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
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        properties: { markerData: marker }
      });
    });

    viewerRef.current.scene.requestRender();
  }, [markers, isViewerReady]);



  // FlyTo
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
    }
  }));

  return <div ref={containerRef} className="w-full h-full bg-black" />;
});

export default GlobeScene;
