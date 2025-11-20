
import React, { useState, useCallback, useRef } from 'react';
import GlobeScene from './components/GlobeScene';
import UIOverlay from './components/UIOverlay';
import { LocationMarker, SearchState, LocalPersona, ChatMessage, CameraControlRef, CrowdMember } from './types';
import { fetchLocationsFromQuery, fetchCrowd, connectWithCrowdMember, chatWithPersona, getPlaceFromCoordinates } from './services/geminiService';

const App: React.FC = () => {
  // App Data State
  const [markers, setMarkers] = useState<LocationMarker[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<LocationMarker | null>(null);
  
  // Crowd State
  const [crowd, setCrowd] = useState<CrowdMember[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // Persona/Chat State
  const [persona, setPersona] = useState<LocalPersona | null>(null);
  const [isSummoning, setIsSummoning] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  const globeRef = useRef<CameraControlRef>(null);

  const [searchState, setSearchState] = useState<SearchState>({
    isLoading: false,
    error: null,
    query: '',
  });

  const handleSearch = useCallback(async (query: string) => {
    setSearchState({ isLoading: true, error: null, query });
    setSelectedMarker(null); 
    setPersona(null);
    setSuggestions([]);
    setCrowd([]);
    setMarkers([]);
    
    try {
      const locations = await fetchLocationsFromQuery(query);
      
      if (locations.length > 0) {
          setMarkers(locations);
          if (globeRef.current) {
              globeRef.current.flyTo(locations[0].latitude, locations[0].longitude);
          }
      } else {
         // Clear markers if no results found to prevent showing old data with new error
         setMarkers([]);
         setSearchState(prev => ({ ...prev, error: "No habitable sectors found." }));
      }

    } catch (error: any) {
      setSearchState(prev => ({ ...prev, error: error.message || "Scan failed." }));
    } finally {
      setSearchState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const handleClearResults = useCallback(() => {
      setMarkers([]);
      setSearchState({ isLoading: false, error: null, query: '' });
  }, []);

  const handleUseCurrentLocation = useCallback(() => {
      if (!navigator.geolocation) {
          setSearchState(prev => ({ ...prev, error: "GPS sensors not detected." }));
          return;
      }

      setSearchState(prev => ({ ...prev, isLoading: true, error: null }));

      navigator.geolocation.getCurrentPosition(
          async (position) => {
              const { latitude, longitude } = position.coords;
              try {
                  const place = await getPlaceFromCoordinates(latitude, longitude);
                  setMarkers([place]);
                  setSelectedMarker(place); 
                  
                  if (globeRef.current) {
                      globeRef.current.flyTo(latitude, longitude);
                  }
              } catch (error: any) {
                  setSearchState(prev => ({ ...prev, error: "Unable to triangulate current position." }));
              } finally {
                  setSearchState(prev => ({ ...prev, isLoading: false }));
              }
          },
          (error) => {
              console.error(error);
              setSearchState(prev => ({ ...prev, isLoading: false, error: "GPS permission denied or signal weak." }));
          }
      );
  }, []);

  const handleSelectMarker = useCallback((marker: LocationMarker) => {
    setSelectedMarker(marker);
    if (globeRef.current) {
        globeRef.current.flyTo(marker.latitude, marker.longitude);
    }
  }, []);

  const handleMarkerClick = useCallback((marker: LocationMarker) => {
    handleSelectMarker(marker);
    setPersona(null);
    setSuggestions([]);
    setCrowd([]);
  }, [handleSelectMarker]);

  const handleCloseMarker = useCallback(() => {
    setSelectedMarker(null);
    setPersona(null);
    setSuggestions([]);
    setCrowd([]);
  }, []);

  const handleScanCrowd = useCallback(async (marker: LocationMarker) => {
      setIsScanning(true);
      try {
          const crowdMembers = await fetchCrowd(marker);
          setCrowd(crowdMembers);
      } catch (error: any) {
          setSearchState(prev => ({ ...prev, error: error.message }));
      } finally {
          setIsScanning(false);
      }
  }, []);

  const handleSelectMember = useCallback(async (member: CrowdMember) => {
      if (!selectedMarker) return;
      
      setIsSummoning(true);
      try {
          const localPersona = await connectWithCrowdMember(member, selectedMarker);
          setPersona(localPersona);
          setChatHistory([{ role: 'model', text: localPersona.message }]);
          setSuggestions(localPersona.suggestedQuestions);
      } catch (error: any) {
          setSearchState(prev => ({ ...prev, error: error.message }));
      } finally {
          setIsSummoning(false);
      }
  }, [selectedMarker]);

  const handleClosePersona = useCallback(() => {
    setPersona(null);
    setChatHistory([]);
    setSuggestions([]);
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
      if (!persona || !selectedMarker) return;

      const newUserMessage: ChatMessage = { role: 'user', text };
      
      // Optimistically update history
      setChatHistory(prev => [...prev, newUserMessage]);
      
      // Clear suggestions while loading
      setSuggestions([]);
      setIsChatLoading(true);

      try {
          // Note: We pass the updated history array (including newUserMessage)
          // The service will handle slicing it correctly for the API call
          const { text: responseText, suggestions: newSuggestions, sources } = await chatWithPersona(
              persona,
              selectedMarker.name,
              [...chatHistory, newUserMessage], 
              text
          );
          
          setChatHistory(prev => [...prev, { role: 'model', text: responseText, sources: sources }]);
          setSuggestions(newSuggestions);
      } catch (error) {
          console.error("Failed to send message", error);
      } finally {
          setIsChatLoading(false);
      }
  }, [persona, selectedMarker, chatHistory]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      
      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-0">
        <GlobeScene 
            ref={globeRef}
            markers={markers} 
            onMarkerClick={handleMarkerClick}
            isPaused={!!selectedMarker}
        />
      </div>

      {/* UI Layer */}
      <UIOverlay 
        onSearch={handleSearch} 
        onClearResults={handleClearResults}
        searchState={searchState}
        
        markers={markers}
        selectedMarker={selectedMarker}
        onSelectMarker={handleSelectMarker}
        onCloseMarker={handleCloseMarker}
        onUseCurrentLocation={handleUseCurrentLocation}
        
        onScanCrowd={handleScanCrowd}
        isScanning={isScanning}
        crowd={crowd}
        onSelectMember={handleSelectMember}

        persona={persona}
        isSummoning={isSummoning}
        onClosePersona={handleClosePersona}
        chatHistory={chatHistory}
        onSendMessage={handleSendMessage}
        isChatLoading={isChatLoading}
        suggestions={suggestions}
      />
    </div>
  );
};

export default App;
