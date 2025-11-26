import React, { useState, useCallback, useRef, useEffect, Suspense } from 'react';
// Lazy load the heavy 3D component
const GlobeScene = React.lazy(() => import('./components/GlobeScene'));
import UIOverlay from './components/UIOverlay';
import Auth from './components/Auth';
import TutorialOverlay, { TutorialStep } from './components/TutorialOverlay';
import ErrorBoundary from './components/ErrorBoundary';
import { supabase } from './services/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { LocationMarker, SearchState, LocalPersona, ChatMessage, CameraControlRef, CrowdMember } from './types';
import { fetchLocationsFromQuery, fetchCrowd, connectWithCrowdMember, chatWithPersona, getPlaceFromCoordinates } from './services/geminiService';

const App: React.FC = () => {
  // Auth State
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

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

  // Tutorial State
  const [tutorialPhase, setTutorialPhase] = useState<'none' | 'initial' | 'post-search'>('none');

  const initialTutorialSteps: TutorialStep[] = [
    {
      title: "Welcome to Gemini Terra",
      content: "This is your planetary interface system. Explore the world, discover local populations, and interact with them in real-time.",
      position: "center"
    },
    {
      targetId: "search-bar",
      title: "Navigation Control",
      content: "Search for any city, country, or region to instantly deploy your view to that sector.",
      position: "bottom"
    },
    {
      targetId: "weather-display",
      title: "Environmental Data",
      content: "Real-time local time and weather conditions for your current view are displayed here.",
      position: "left"
    },
    {
      targetId: "zoom-controls",
      title: "Optical Zoom",
      content: "Adjust your altitude for a broader view or closer inspection of the terrain.",
      position: "left"
    },
    {
      targetId: "locate-btn",
      title: "GPS Triangulation",
      content: "Instantly lock onto your physical coordinates.",
      position: "left"
    },
    {
      targetId: "profile-btn",
      title: "Profile & Settings",
      content: "Access your account, restart this tutorial, or sign out from here.",
      position: "left"
    }
  ];

  const postSearchTutorialSteps: TutorialStep[] = [
    {
      targetId: "results-list", // Needs to be added to UIOverlay
      title: "Sector Analysis",
      content: "Detected locations appear here. Select a sector to initiate a detailed scan.",
      position: "right"
    },
    {
      targetId: "zoom-controls",
      title: "Optical Zoom",
      content: "Adjust your altitude for a broader view or closer inspection of the terrain.",
      position: "left"
    }
  ];

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);

    // Auth check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);


  useEffect(() => {
    // Check if initial tutorial has been seen
    const hasSeenInitial = localStorage.getItem('gemini_terra_tutorial_initial_seen');
    if (!hasSeenInitial && session) {
      setTimeout(() => setTutorialPhase('initial'), 1000);
    }
  }, [session]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const handleTutorialComplete = () => {
    if (tutorialPhase === 'initial') {
      localStorage.setItem('gemini_terra_tutorial_initial_seen', 'true');
    } else if (tutorialPhase === 'post-search') {
      localStorage.setItem('gemini_terra_tutorial_post_search_seen', 'true');
    }
    setTutorialPhase('none');
  };

  const handleRestartTutorial = () => {
    setTutorialPhase('initial');
    // Reset persistence for testing? Or just let them replay 'initial'
  };

  const handleSearch = useCallback(async (query: string) => {
    setSearchState({ isLoading: true, error: null, query });
    setSelectedMarker(null);
    setPersona(null);
    setSuggestions([]);
    setCrowd([]);
    setLastPersona(null); // Clear last persona on new search
    setLastChatHistory([]); // Clear last chat history on new search

    try {
      const locations = await fetchLocationsFromQuery(query);

      if (locations.length > 0) {
        setMarkers(locations);

        // Trigger Post-Search Tutorial if not seen
        const hasSeenPostSearch = localStorage.getItem('gemini_terra_tutorial_post_search_seen');
        if (!hasSeenPostSearch) {
          setTimeout(() => setTutorialPhase('post-search'), 500);
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
  }, [searchState.query]);

  const handleCustomCrowdSearch = useCallback(async (query: string) => {
    if (!selectedMarker) return;
    setIsLoadingCrowd(true);

    try {
      const crowdMembers = await fetchCrowd(selectedMarker, query);
      const localCrowd: LocalPersona[] = crowdMembers.map(m => ({
        ...m,
        message: "",
        suggestedQuestions: [],
        imageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.name}` // Added imageUrl here
      }));
      // Replace existing crowd with new results
      setCrowd(localCrowd);
    } catch (error: any) { // Added any type for error
      console.error("Custom crowd search failed:", error);
    } finally {
      setIsLoadingCrowd(false);
    }
  }, [selectedMarker]);

  const handleMarkerClick = useCallback((marker: LocationMarker) => {
    handleSelectMarker(marker);
  }, [handleSelectMarker]);

  const handleCloseMarker = useCallback(() => {
    setSelectedMarker(null);
    setPersona(null);
    setSuggestions([]);
    setCrowd([]);
  }, []);

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // ... (existing code)

  const handleSelectMember = useCallback(async (member: CrowdMember) => {
    if (!selectedMarker) return;

    setIsSummoning(true);
    try {
      const localPersona = await connectWithCrowdMember(member, selectedMarker);
      setPersona(localPersona);

      // Start a new session in DB
      try {
        const { chatService } = await import('./services/chatService');
        const session = await chatService.createSession(localPersona, selectedMarker);
        setCurrentSessionId(session.id);

        // Save initial greeting
        await chatService.saveMessage(session.id, { role: 'model', text: localPersona.message });
      } catch (e) {
        console.warn("Failed to create chat session:", e);
      }

      setChatHistory([{ role: 'model', text: localPersona.message }]);
      setSuggestions(localPersona.suggestedQuestions);
    } catch (error: any) {
      setSearchState(prev => ({ ...prev, error: error.message }));
    } finally {
      setIsSummoning(false);
    }
  }, [selectedMarker]);

  const handleClosePersona = useCallback(() => {
    // Just close, state is already saved in DB
    setPersona(null);
    setChatHistory([]);
    setSuggestions([]);
    setCurrentSessionId(null);
    setLastPersona(null); // No longer needed for "Resume" button if we have full history
  }, []);

  // Replaced by handleResumeSession from Profile
  const handleResumeChat = useCallback(() => {
    // Legacy resume - can be removed or kept for quick toggle
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!persona || !selectedMarker) return;

    const newUserMessage: ChatMessage = { role: 'user', text };

    // Optimistically update history
    setChatHistory(prev => [...prev, newUserMessage]);

    // Save User Message DB
    if (currentSessionId) {
      import('./services/chatService').then(({ chatService }) => {
        chatService.saveMessage(currentSessionId, newUserMessage);
      });
    }

    // Clear suggestions while loading
    setSuggestions([]);
    setIsChatLoading(true);

    try {
      const { text: responseText, suggestions: newSuggestions, sources } = await chatWithPersona(
        persona,
        selectedMarker.name,
        [...chatHistory, newUserMessage],
        text
      );

      const modelMessage: ChatMessage = { role: 'model', text: responseText, sources: sources };
      setChatHistory(prev => [...prev, modelMessage]);
      setSuggestions(newSuggestions);

      // Save Model Message DB
      if (currentSessionId) {
        import('./services/chatService').then(({ chatService }) => {
          chatService.saveMessage(currentSessionId, modelMessage);
        });
      }

    } catch (error) {
      console.error("Failed to send message", error);
    } finally {
      setIsChatLoading(false);
    }
  }, [persona, selectedMarker, chatHistory, currentSessionId]);

  // New Handler for Resuming from Profile
  const handleResumeSession = useCallback(async (sessionId: string, savedPersona: LocalPersona, location: LocationMarker) => {
    setIsLoadingCrowd(true); // Show loading
    try {
      const { chatService } = await import('./services/chatService');
      const messages = await chatService.getSessionMessages(sessionId);

      // Restore State
      setMarkers([location]);
      setSelectedMarker(location);
      setPersona(savedPersona);
      setChatHistory(messages);
      setCurrentSessionId(sessionId);

      // Fly to location
      if (globeRef.current) {
        globeRef.current.flyTo(location.latitude, location.longitude);
      }

    } catch (e) {
      console.error("Failed to resume session:", e);
    } finally {
      setIsLoadingCrowd(false);
    }
  }, []);

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

  if (authLoading) {
    return <div className="w-full h-screen bg-black flex items-center justify-center text-white">Loading...</div>;
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <ErrorBoundary>
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

          crowd={crowd}
          isLoadingCrowd={isLoadingCrowd}
          onCustomCrowdSearch={handleCustomCrowdSearch}
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

          userEmail={session?.user?.email}
          onSignOut={handleSignOut}
          onRestartTutorial={handleRestartTutorial}
          onResumeSession={handleResumeSession}
        />

        <TutorialOverlay
          isOpen={tutorialPhase !== 'none'}
          steps={tutorialPhase === 'initial' ? initialTutorialSteps : postSearchTutorialSteps}
          onComplete={handleTutorialComplete}
          onSkip={handleTutorialComplete}
        />


      </div>
    </ErrorBoundary>
  );
};

export default App;
