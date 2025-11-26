
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
        Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN || process.env.VITE_CESIUM_ION_TOKEN;

        viewer = new Cesium.Viewer(containerRef.current, {
          imageryProvider: false,
          terrainProvider: undefined,
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
              antialias: false,
              preserveDrawingBuffer: true,
              failIfMajorPerformanceCaveat: false,
              powerPreference: "high-performance"
            }
          },
          requestRenderMode: false,
          maximumRenderTimeChange: Infinity
        });

        if (!viewer || !viewer.scene) {
          console.error("Cesium Viewer failed to initialize");
          return;
        }

        await Promise.allSettled([
          Cesium.IonImageryProvider.fromAssetId(3).then((provider: any) => {
            if (!viewer.isDestroyed()) viewer.imageryLayers.addImageryProvider(provider);
          }).catch(async (e: any) => {
            console.error("Failed to load Ion Imagery, falling back to ArcGIS", e);
            const fallback = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
              "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer"
            );
            if (!viewer.isDestroyed()) viewer.imageryLayers.addImageryProvider(fallback);
          }),
          Cesium.createWorldTerrainAsync({
            requestWaterMask: false,
            requestVertexNormals: false
          }).then((provider: any) => {
            if (!viewer.isDestroyed()) viewer.scene.terrainProvider = provider;
          }).catch((e: any) => {
            console.warn("Failed to load World Terrain, using Ellipsoid", e);
            if (!viewer.isDestroyed()) viewer.scene.terrainProvider = new Cesium.EllipsoidTerrainProvider();
          })
        ]);

        if (viewer.isDestroyed()) return;

        const noonTime = Cesium.JulianDate.fromIso8601("2024-06-01T12:00:00Z");
        viewer.clock.currentTime = noonTime;
        viewer.clock.shouldAnimate = false;

        viewer.scene.globe.enableLighting = true;
        viewer.scene.highDynamicRange = true;
        viewer.scene.globe.depthTestAgainstTerrain = true;
        viewer.scene.globe.showGroundAtmosphere = true;
        viewer.scene.globe.maximumScreenSpaceError = 2.0;
        viewer.resolutionScale = window.devicePixelRatio;

        if (viewer.scene.postProcessStages.fxaa) {
          viewer.scene.postProcessStages.fxaa.enabled = true;
        }

        viewer.scene.verticalExaggeration = 1.5;
        viewer.scene.skyAtmosphere.show = true;
        viewer.scene.skyAtmosphere.saturationShift = 0.6;
        viewer.scene.skyAtmosphere.brightnessShift = 0.4;
        viewer.scene.fog.enabled = true;
        viewer.scene.fog.density = 0.0001;
        viewer.scene.fog.screenSpaceErrorFactor = 2.0;

        viewer.scene.postProcessStages.bloom.enabled = false; // Disable bloom for flat look

        const creditContainer = viewer.bottomContainer;
        if (creditContainer) creditContainer.style.display = 'none';

        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(0, 20, 20000000)
        });

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

  useEffect(() => {
    if (!isViewerReady || !viewerRef.current) return;
    const Cesium = window.Cesium;
    const viewer = viewerRef.current;

    viewer.dataSources.removeAll();

    const pinSource = new Cesium.CustomDataSource('markers');
    viewer.dataSources.add(pinSource);
    dataSourcesRef.current = pinSource;

    const getLocationSpecs = (type?: string) => {
      switch (type) {
        case 'Country': return { dist: new Cesium.DistanceDisplayCondition(0.0, 20000000.0), radius: 500000.0, height: 4000000.0 };
        case 'State': return { dist: new Cesium.DistanceDisplayCondition(0.0, 5000000.0), radius: 100000.0, height: 1000000.0 };
        case 'City': return { dist: new Cesium.DistanceDisplayCondition(0.0, 5000000.0), radius: 15000.0, height: 150000.0 };
        case 'Place': return { dist: new Cesium.DistanceDisplayCondition(0.0, 50000.0), radius: 2000.0, height: 15000.0 };
        case 'Business': return { dist: new Cesium.DistanceDisplayCondition(0.0, 25000.0), radius: 500.0, height: 5000.0 };
        case 'Landmark': return { dist: new Cesium.DistanceDisplayCondition(0.0, 100000.0), radius: 1000.0, height: 10000.0 };
        default: return { dist: new Cesium.DistanceDisplayCondition(0.0, 5000000.0), radius: 50000.0, height: 200000.0 };
      }
    };

    const loadMarkers = async () => {
      const loadPromises = markers.map(async (marker) => {
        const specs = getLocationSpecs(marker.type);

        // GeoJSON loading removed as per user request

        pinSource.entities.add({
          position: Cesium.Cartesian3.fromDegrees(marker.longitude, marker.latitude),
          billboard: {
            image: `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64"><circle cx="12" cy="12" r="6" fill="#00aaff" stroke="white" stroke-width="2"/><path d="M12 18 L12 24" stroke="#00aaff" stroke-width="2" /></svg>`)}`,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            scale: 1.0,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            distanceDisplayCondition: specs.dist
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
            distanceDisplayCondition: specs.dist
          },
          properties: { markerData: marker, viewHeight: specs.height }
        });

        // Removed ellipse/glow entity logic as per user request
        // Removed cylinder entity logic as per user request
      });

      await Promise.all(loadPromises);
      viewer.scene.requestRender();
    };

    loadMarkers();
  }, [markers, isViewerReady]);

  useImperativeHandle(ref, () => ({
    flyTo: (lat: number, lng: number) => {
      if (!viewerRef.current || !window.Cesium) return;
      const Cesium = window.Cesium;

      // GeoJSON flyTo logic removed

      let targetHeight = 50000.0;
      if (dataSourcesRef.current) {
        const entities = dataSourcesRef.current.entities.values;
        for (const entity of entities) {
          const pos = entity.position?.getValue(Cesium.JulianDate.now());
          if (pos) {
            const cart = Cesium.Cartographic.fromCartesian(pos);
            const epsilon = 0.0001;
            if (Math.abs(Cesium.Math.toDegrees(cart.latitude) - lat) < epsilon &&
              Math.abs(Cesium.Math.toDegrees(cart.longitude) - lng) < epsilon) {
              if (entity.properties && entity.properties.viewHeight) {
                targetHeight = entity.properties.viewHeight.getValue();
                break;
              }
            }
          }
        }
      }

      viewerRef.current.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lng, lat, targetHeight),
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
      camera.zoomIn(height * 0.5);
    },
    zoomOut: () => {
      if (!viewerRef.current) return;
      const camera = viewerRef.current.camera;
      const height = camera.positionCartographic.height;
      camera.zoomOut(height * 1.0);
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
