import React, { useState, useCallback, useRef, useEffect, Suspense, useMemo } from 'react';
// Lazy load the heavy 3D component
const GlobeScene = React.lazy(() => import('./components/GlobeScene'));
import UIOverlay from './components/UIOverlay';
import { useNews } from './context/NewsContext';

import Auth from './components/Auth';
import TutorialOverlay, { TutorialStep } from './components/TutorialOverlay';
import ErrorBoundary from './components/ErrorBoundary';
import SupportChat from './components/SupportChat';

import { supabase } from './services/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { LocationMarker, SearchState, LocalPersona, ChatMessage, CameraControlRef, CrowdMember, Notification as AppNotification } from './types';
import { fetchLocationsFromQuery, fetchCrowd, connectWithCrowdMember, chatWithPersona, getPlaceFromCoordinates } from './services/geminiService';
import { subscribeToNotifications, createNotification, getUnreadCount } from './services/notificationService';

const App: React.FC = () => {
  // Auth State
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App Data State
  const [markers, setMarkers] = useState<LocationMarker[]>([]);
  const [userMarkers, setUserMarkers] = useState<LocationMarker[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<LocationMarker | null>(null);
  const [markerColor, setMarkerColor] = useState<[number, number, number]>([1, 0.5, 0.1]);

  // Crowd State
  const [crowd, setCrowd] = useState<LocalPersona[]>([]); // Changed type from Persona[] to LocalPersona[]
  const [isLoadingCrowd, setIsLoadingCrowd] = useState(false); // Renamed from isScanning

  // GDELT News State handled by Context
  const { newsEvents, isNewsFeedOpen, toggleNewsFeed } = useNews();

  // Patrol Logic - previously tied to NewsFeed, now purely visual or removed? 
  // User guide says "NewsFeed" is "Reels style". 
  // Let's remove App-side patrol for now as NewsFeed has its own scroll interaction.
  // But wait, "Auto Patrol" on the globe was a feature. 
  // If we want to keep "Patrol Mode" on the globe while the feed is open, we need to handle it.
  // However, with "Reels" overlay covering the screen, the globe is hidden!
  // So Patrol on Globe is useless if Feed is non-transparent full screen.
  // The Feed IS full screen (fixed inset-0 bg-black/90).
  // So we don't need globe patrol when feed is open.
  // We can remove patrol logic from App.

  // const [isPatrolMode, setIsPatrolMode] = useState(false); // Removing this


  const combinedMarkers = useMemo(() => {
    return [...markers, ...(isNewsFeedOpen ? newsEvents : [])];
  }, [markers, isNewsFeedOpen, newsEvents]);

  useEffect(() => {
    // Set Single Color for News Mode if active
    if (isNewsFeedOpen) {
      setMarkerColor([1, 0.8, 0]); // Golden Pulse
    }
  }, [isNewsFeedOpen]);


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

  // Notification State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPermissionCard, setShowPermissionCard] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Notification Handlers (Optimistic Updates)
  const handleMarkAsRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));

    // API call
    if (session?.user) {
      import('./services/notificationService').then(({ markAsRead }) => {
        markAsRead(session.user.id, id);
      });
    }
  }, [session]);

  const handleMarkAllAsRead = useCallback(async () => {
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);

    // API call
    if (session?.user) {
      import('./services/notificationService').then(({ markAllAsRead }) => {
        markAllAsRead(session.user.id);
      });
    }
  }, [session]);

  const handleDeleteNotification = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.filter(n => n.id !== id));
    // Recalculate unread count if needed, though usually we delete read ones
    // But if deleting unread, we should decrease count
    setNotifications(prev => {
      const target = prev.find(n => n.id === id);
      if (target && !target.read) {
        setUnreadCount(c => Math.max(0, c - 1));
      }
      return prev.filter(n => n.id !== id);
    });

    // API call
    if (session?.user) {
      import('./services/notificationService').then(({ deleteNotification }) => {
        deleteNotification(session.user.id, id);
      });
    }
  }, [session]);

  const handlePermissionGranted = useCallback(async (token: string) => {
    console.log("FCM Token granted:", token);
    setShowPermissionCard(false);
    // Here you would typically save the token to the user's profile in DB
    // Save FCM Token to DB
    import('./services/firebase').then(({ requestForToken }) => {
      requestForToken(session?.user?.id); // Passing ID saves it to Supabase
    });
    localStorage.setItem('mortals_fcm_granted', 'true');
  }, [session]);

  const handlePermissionDismiss = useCallback(() => {
    setShowPermissionCard(false);
    localStorage.setItem('mortals_fcm_dismissed', 'true');
  }, []);

  const initialTutorialSteps: TutorialStep[] = [
    {
      title: "Your World, Your Game",
      content: "Create your profile and start your journey. The real world is your playground.",
      position: "center"
    },
    {
      targetId: "search-bar",
      title: "Explore & Discover",
      content: "Navigate the globe. Search for cities, landmarks, or hidden gems to begin your adventure.",
      position: "bottom"
    },
    {
      targetId: "profile-btn",
      title: "Capture Reality",
      content: "Take photos, tag locations, and post your real-world explorations to your profile.",
      position: "left"
    },
    {
      targetId: "profile-btn",
      title: "Level Up",
      content: "Earn XP and badges for every new place you visit. Watch your Exploration Bar grow!",
      position: "left"
    },
    {
      targetId: "add-friends-btn",
      title: "Connect & Hangout",
      content: "Find others hanging out at your spots. Connect with people who share your favorite locations.",
      position: "left"
    },
    {
      targetId: "notifications-btn",
      title: "Live World Events",
      content: "Get real-time updates on events and places around you. Unlock unique badges for group hangouts!",
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

  const notificationInitRef = useRef(false);

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);

    // Auth check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);

      // Subscribe to notifications when user logs in
      if (session?.user) {
        const unsubscribe = subscribeToNotifications(session.user.id, (notifs) => {
          setNotifications(notifs);
          setUnreadCount(getUnreadCount(notifs));
        });

        // Initialize FCM and Welcome Logic ONLY ONCE
        if (!notificationInitRef.current) {
          notificationInitRef.current = true;

          // Check for permission card
          const hasGranted = localStorage.getItem('mortals_fcm_granted');
          const hasDismissed = localStorage.getItem('mortals_fcm_dismissed');
          if (!hasGranted && !hasDismissed && 'Notification' in window && Notification.permission === 'default') {
            setTimeout(() => setShowPermissionCard(true), 3000);
          }

          // Initialize FCM Listener
          import('./services/firebase').then(({ onMessageListener }) => {
            onMessageListener().then((payload: any) => {
              console.log('Foreground FCM Message:', payload);
            });
          });

          // Fetch user profile and handle Welcome/Login notification
          supabase
            .from('app_profiles_v2')
            .select('full_name, username')
            .eq('id', session.user.id)
            .single()
            .then(({ data: profile }) => {
              const rawName = profile?.full_name || profile?.username || session.user.email?.split('@')[0] || 'Commander';
              const firstName = rawName.split(' ')[0].charAt(0).toUpperCase() + rawName.split(' ')[0].slice(1).toLowerCase();

              const hasSeenWelcome = localStorage.getItem('mortals_welcome_notification');
              if (!hasSeenWelcome) {
                // Set flag IMMEDIATELY to prevent race conditions
                localStorage.setItem('mortals_welcome_notification', 'true');

                createNotification(session.user.id, 'WELCOME', {
                  userName: firstName
                });
              }
            });
        }

        // Fetch User Posts for "My World" View
        import('./services/socialService').then(({ socialService }) => {
          console.log("Fetching user posts for:", session.user.id);
          socialService.fetchPosts(session.user.id).then(posts => {
            console.log("Fetched user posts:", posts.length);
            const userLocations: LocationMarker[] = posts
              .filter(p => p.location_lat && p.location_lng)
              .map(p => ({
                id: `post-${p.id}`,
                name: p.location_name || 'Tagged Location',
                latitude: p.location_lat!,
                longitude: p.location_lng!,
                description: p.caption,
                type: 'Post',
                isUserPost: true,
                postImageUrl: p.image_url,
                postCaption: p.caption,
                country: p.country
              }));

            if (userLocations.length > 0) {
              console.log("Setting user markers:", userLocations);
              setUserMarkers(userLocations);
              setMarkers(userLocations);
              setMarkerColor([0.2, 0.8, 1]); // Cyan for User Data
            } else {
              console.log("No user posts found for profile.");
            }
          }).catch(err => console.error("Error fetching user posts:", err));
        });

        return () => unsubscribe();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // Note: We don't re-run the welcome logic here to avoid duplication on auth refresh
      // The initial session check handles the main login flow.

      if (session?.user) {
        const unsubscribe = subscribeToNotifications(session.user.id, (notifs) => {
          setNotifications(notifs);
          setUnreadCount(getUnreadCount(notifs));
        });
        return () => unsubscribe();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check for re-engagement opportunities on load
  useEffect(() => {
    if (session?.user) {
      import('./services/supportService').then(({ supportService }) => {
        // Request notification permission immediately
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }

        // Delay slightly to not compete with initial load
        setTimeout(() => {
          supportService.checkAndReengage(session.user.id);

          // Trigger AI Engagement Check (New Nudge Logic)
          import('./services/engagementService').then(({ engagementService }) => {
            engagementService.checkAndEngage(session.user.id);
          });

        }, 5000);
      });
    }
  }, [session]);



  useEffect(() => {
    // Check if initial tutorial has been seen
    const hasSeenInitial = localStorage.getItem('mortals_tutorial_initial_seen');
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
      localStorage.setItem('mortals_tutorial_initial_seen', 'true');
    } else if (tutorialPhase === 'post-search') {
      localStorage.setItem('mortals_tutorial_post_search_seen', 'true');
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

    // Disable News Feed on Search
    if (isNewsFeedOpen) toggleNewsFeed();

    try {
      const locations = await fetchLocationsFromQuery(query);

      if (locations.length > 0) {
        setMarkers(locations);

        // Auto-select and Fly to first result
        const firstMatch = locations[0];
        // Don't auto-select to avoid opening "Old UI" panel immediately
        // setSelectedMarker(firstMatch); 
        if (globeRef.current) {
          globeRef.current.flyTo(firstMatch.latitude, firstMatch.longitude);
        }

        // DeepSeek AI Color Analysis
        if (firstMatch.country) {
          import('./services/deepseekService').then(({ fetchCountryColor }) => {
            fetchCountryColor(firstMatch.country!).then(color => {
              setMarkerColor(color);
            });
          });
        } else {
          setMarkerColor([1, 0.5, 0.1]); // Reset to Orange
        }

        // Trigger Post-Search Tutorial if not seen
        const hasSeenPostSearch = localStorage.getItem('mortals_tutorial_post_search_seen');
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
    setMarkers(userMarkers); // Revert to user markers instead of empty
    setSearchState({ isLoading: false, error: null, query: '' });
    setSelectedMarker(null);
    setPersona(null);
    setSuggestions([]);
    setCrowd([]);
    setLastPersona(null);
    setLastChatHistory([]);
    setMarkerColor([0.2, 0.8, 1]); // Reset color
  }, [userMarkers]);

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

    // Don't fetch crowd for News Events
    if (marker.type === 'Event') return;

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
              markers={combinedMarkers}
              selectedMarker={selectedMarker}
              onMarkerClick={handleMarkerClick}
              isPaused={!!selectedMarker}
              markerColor={markerColor}
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
          userId={session?.user?.id}
          onSignOut={handleSignOut}
          onRestartTutorial={handleRestartTutorial}
          onResumeSession={handleResumeSession}
          onChatToggle={setIsChatOpen}

          notifications={notifications}
          unreadNotifications={unreadCount}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllAsRead={handleMarkAllAsRead}
          onDeleteNotification={handleDeleteNotification}
          showPermissionCard={showPermissionCard}
          onPermissionGranted={handlePermissionGranted}
          onPermissionDismiss={handlePermissionDismiss}

        />

        <TutorialOverlay
          isOpen={tutorialPhase !== 'none'}
          steps={tutorialPhase === 'initial' ? initialTutorialSteps : postSearchTutorialSteps}
          onComplete={handleTutorialComplete}
          onSkip={handleTutorialComplete}
        />

        {/* Universal Support Chat (Atlas AI) */}
        {session?.user && !isChatOpen && <SupportChat userId={session.user.id} />}

      </div>
    </ErrorBoundary>
  );
};

export default App;
