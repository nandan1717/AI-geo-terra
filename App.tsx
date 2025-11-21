import React, { useState, useCallback, useRef, useEffect, Suspense } from 'react';
// Lazy load the heavy 3D component
const GlobeScene = React.lazy(() => import('./components/GlobeScene'));
import UIOverlay from './components/UIOverlay';
import { LocationMarker, SearchState, LocalPersona, ChatMessage, CameraControlRef, CrowdMember } from './types';
import { fetchLocationsFromQuery, fetchCrowd, connectWithCrowdMember, chatWithPersona, getPlaceFromCoordinates } from './services/geminiService';

const App: React.FC = () => {
  // App Data State
  const [markers, setMarkers] = useState<LocationMarker[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<LocationMarker | null>(null);

  // Crowd State
  const [crowd, setCrowd] = useState<LocalPersona[]>([]); // Changed type from Persona[] to LocalPersona[]
  const [isLoadingCrowd, setIsLoadingCrowd] = useState(false); // Renamed from isScanning

  // Persona/Chat State
  const [persona, setPersona] = useState<LocalPersona | null>(null); // Changed type from Persona to LocalPersona
  const [lastPersona, setLastPersona] = useState<LocalPersona | null>(null); // Changed type from Persona to LocalPersona
  const [lastChatHistory, setLastChatHistory] = useState<ChatMessage[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isSummoning, setIsSummoning] = useState(false); // Restored isSummoning state
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const globeRef = useRef<CameraControlRef>(null);

  const [searchState, setSearchState] = useState<SearchState>({
    isLoading: false,
    error: null,
    query: '',
  });

  const [timezone, setTimezone] = useState<string>('');

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    setSearchState({ isLoading: true, error: null, query });
    setSelectedMarker(null);
    setPersona(null);
    setSuggestions([]);
    setCrowd([]);
    setMarkers([]);
    setLastPersona(null); // Clear last persona on new search
    setLastChatHistory([]); // Clear last chat history on new search

    try {
      const locations = await fetchLocationsFromQuery(query);

      if (locations.length > 0) {
        setMarkers(locations);
        // Removed auto-fly to allow user to select from results first
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
    setSelectedMarker(null);
    setPersona(null);
    setSuggestions([]);
    setCrowd([]);
    setLastPersona(null);
    setLastChatHistory([]);
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

  const handleSelectMarker = useCallback(async (marker: LocationMarker) => {
    setSelectedMarker(marker);
    setPersona(null);
    setSuggestions([]);
    setCrowd([]);

    if (globeRef.current) {
      globeRef.current.flyTo(marker.latitude, marker.longitude);
    }

    setIsLoadingCrowd(true);
    try {
      const crowdMembers = await fetchCrowd(marker);
      const localCrowd: LocalPersona[] = crowdMembers.map(m => ({
        ...m,
        message: "",
        imageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.name}`,
        suggestedQuestions: []
      }));
      setCrowd(localCrowd);
    } catch (error: any) {
      setSearchState(prev => ({ ...prev, error: error.message }));
    } finally {
      setIsLoadingCrowd(false);
    }
  }, []);

  const handleMarkerClick = useCallback((marker: LocationMarker) => {
    handleSelectMarker(marker);
  }, [handleSelectMarker]);

  const handleCloseMarker = useCallback(() => {
    setSelectedMarker(null);
    setPersona(null);
    setSuggestions([]);
    setCrowd([]);
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
    if (persona) { // Save current persona and chat history before closing
      setLastPersona(persona);
      setLastChatHistory(chatHistory);
    }
    setPersona(null);
    setChatHistory([]);
    setSuggestions([]);
  }, [persona, chatHistory]);

  const handleResumeChat = useCallback(() => { // Fixed handleResumeChat
    if (lastPersona) {
      setPersona(lastPersona);
      setChatHistory(lastChatHistory);
      // Clear last persona and chat history after resuming
      setLastPersona(null);
      setLastChatHistory([]);
    }
  }, [lastPersona, lastChatHistory]);

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

  const handleZoomIn = useCallback(() => {
    if (globeRef.current) {
      globeRef.current.zoomIn();
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (globeRef.current) {
      globeRef.current.zoomOut();
    }
  }, []);

  const handleResetView = useCallback(() => {
    if (globeRef.current) {
      globeRef.current.resetView();
    }
  }, []);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">

      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-0">
        <Suspense fallback={<div className="w-full h-full bg-black flex items-center justify-center text-white">Initializing Planetary Systems...</div>}>
          <GlobeScene
            ref={globeRef}
            markers={markers}
            onMarkerClick={handleMarkerClick}
            isPaused={!!selectedMarker}
          />
        </Suspense>
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

        isLoadingCrowd={isLoadingCrowd}
        crowd={crowd}
        onSelectMember={handleSelectMember}

        persona={persona}
        isSummoning={isSummoning}
        onClosePersona={handleClosePersona}
        lastPersona={lastPersona}
        onResumeChat={handleResumeChat}
        timezone={selectedMarker?.timezone}
        chatHistory={chatHistory}
        onSendMessage={handleSendMessage}
        isChatLoading={isChatLoading}
        suggestions={suggestions}

        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
      />
    </div>
  );
};

export default App;
