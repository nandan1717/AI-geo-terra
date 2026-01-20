import React, { useState, useCallback, useRef, useEffect, Suspense, useMemo } from 'react';
// Lazy load the heavy 3D component
const GlobeScene = React.lazy(() => import('./components/GlobeScene'));
import UIOverlay from './components/UIOverlay';
import CreatePostModal from './components/CreatePostModal';
import { useNews } from './context/NewsContext';

import Auth from './components/Auth';
import TutorialOverlay, { TutorialStep } from './components/TutorialOverlay';
import ErrorBoundary from './components/ErrorBoundary';
import SupportChat from './components/SupportChat';
import { StoryBar } from './components/StoryBar';

import { supabase } from './services/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { LocationMarker, SearchState, LocalPersona, ChatMessage, CameraControlRef, CrowdMember, Notification as AppNotification } from './types';
import { fetchCrowd, connectWithCrowdMember, chatWithPersona } from './services/geminiService';
import { universalSearchService } from './services/universalSearchService';
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
  const { newsEvents, isNewsFeedOpen, toggleNewsFeed, loadMore, setFocusedEventId } = useNews();




  const combinedMarkers = useMemo(() => {
    // Always show news events on the globe now
    return [...markers, ...newsEvents];
  }, [markers, newsEvents]);

  useEffect(() => {
    // Set Single Color for News Mode if active
    if (isNewsFeedOpen) {
      setMarkerColor([1, 0.8, 0]); // Golden Pulse
    }
  }, [isNewsFeedOpen]);


  // Persona/Chat State
  const [persona, setPersona] = useState<LocalPersona | null>(null); // Changed type from Persona to LocalPersona

  const [lastChatHistory, setLastChatHistory] = useState<ChatMessage[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isSummoning, setIsSummoning] = useState(false); // Restored isSummoning state
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Auto-resume rotation when News Feed closes
  useEffect(() => {
    if (!isNewsFeedOpen && selectedMarker && (selectedMarker.type === 'Event' || (selectedMarker.type === 'Post' && !selectedMarker.isUserPost))) {
      setSelectedMarker(null);
    }
  }, [isNewsFeedOpen]);

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
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false); // New state to track search bar interaction
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Profile State
  const [userProfileImage, setUserProfileImage] = useState<string | undefined>(undefined);

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
      title: "Welcome to Mortals",
      content: "Experience the world in real-time. Connect, share, and discover what's happening right now.",
      position: "center"
    },
    {
      targetId: "search-bar",
      title: "Search Anywhere",
      content: "Find cities, hangouts, or trending events. See what the community is up to worldwide.",
      position: "bottom"
    },
    {
      targetId: "story-bar-container",
      title: "The Pulse",
      content: "Watch live stories from locals and travelers. See the world through their eyes.",
      position: "top"
    },
    {
      targetId: "global-intel-btn",
      title: "Live Map",
      content: "Toggle live activity to see where people are gathering and what's trending.",
      position: "bottom"
    },
    {
      targetId: "create-post-btn",
      title: "Share Your World",
      content: "Post what's happening around you and let the world see it.",
      position: "left"
    },
    {
      targetId: "step-3-profile",
      title: "Your Identity",
      content: "Curate your profile, track your footprint, and build your travel legacy.",
      position: "left"
    },
    {
      targetId: "step-4-add-friends",
      title: "Community",
      content: "Connect with locals and travelers sharing your vibe.",
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

  ];

  const notificationInitRef = useRef(false);

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);

    // Auth check
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("Session Error:", error);
        // Alerting to ensure visibility
        alert(`Authentication Error: ${error.message}`);
      }
      setSession(session);
      setAuthLoading(false);

      // Subscribe to notifications when user logs in
      if (session?.user) {
        // Set current user for recommendation service (data isolation)
        import('./services/recommendationService').then(({ recommendationService }) => {
          recommendationService.setCurrentUser(session.user.id);
          recommendationService.syncProfile(); // Sync from DB
        });

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

          // Initialize FCM Listener for foreground messages
          import('./services/firebase').then(({ onMessageListener }) => {
            const setupListener = () => {
              onMessageListener().then((payload: any) => {
                console.log('Foreground FCM Message:', payload);

                // Create an in-app notification from the FCM payload
                if (payload?.notification || payload?.data) {
                  const title = payload.notification?.title || payload.data?.title || 'New Update';
                  const body = payload.notification?.body || payload.data?.body || '';

                  // DEEP LINK HANDLING (New)
                  const deepLinkUrl = payload.data?.url;
                  const eventId = payload.data?.eventId;

                  // Manual System Notification (Foreground)
                  if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification(title, {
                      body: body,
                      icon: '/pwa-icon.svg',
                      // @ts-ignore
                      image: payload.notification?.image || payload.data?.image
                    });
                  }

                  createNotification(session.user.id, 'FCM_MESSAGE', {
                    title,
                    body,
                    data: payload.data,
                    linkIndex: 0 // Just a flag
                  }, {
                    title,
                    body,
                    icon: 'bell',
                    // Only add action if we have a destination
                    action: (deepLinkUrl || eventId) ? {
                      label: 'View Story',
                      onClick: () => {
                        console.log("Notification Clicked:", deepLinkUrl, eventId);
                        if (deepLinkUrl) window.open(deepLinkUrl, '_blank');
                        // Ideally we would trigger the 'view-news-item' event here if we had the full event object
                        // For now, external link is safest fallback
                      }
                    } : undefined
                  });
                }

                // Re-subscribe for next message
                setupListener();
              });
            };
            setupListener();
          });

          // Fetch user profile and handle Welcome/Login notification
          supabase
            .from('app_profiles_v2')
            .select('full_name, username, avatar_url, location')
            .eq('id', session.user.id)
            .single()
            .then(({ data: profile }) => {
              const rawName = profile?.full_name || profile?.username || session.user.email?.split('@')[0] || 'Commander';
              const firstName = rawName.split(' ')[0].charAt(0).toUpperCase() + rawName.split(' ')[0].slice(1).toLowerCase();

              // Set Profile Image
              if (profile?.avatar_url) {
                setUserProfileImage(profile.avatar_url);
              } else {
                // Fallback to DiceBear
                setUserProfileImage(`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.username || session.user.id}`);
              }

              // SMART PERSONA SEEDING (New)
              // We use the user's location (or a default) to seed relevant local "friends"
              const userLocation = profile?.location || "San Francisco, CA"; // Default if missing
              import('./services/personaService').then(({ personaService }) => {
                personaService.ensureSmartPersonas(firstName, userLocation);
              });

              // DISABLED: Old in-app WELCOME notification
              // FCM push notifications are now the primary welcome channel
              /*
              const hasSeenWelcome = localStorage.getItem('mortals_welcome_notification');
              if (!hasSeenWelcome) {
                // Set flag IMMEDIATELY to prevent race conditions
                localStorage.setItem('mortals_welcome_notification', 'true');

                createNotification(session.user.id, 'WELCOME', {
                  userName: firstName
                });
              }
              */
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



  useEffect(() => {
    // Check if initial tutorial has been seen
    const hasSeenInitial = localStorage.getItem('mortals_tutorial_v2_seen');
    if (!hasSeenInitial && session) {
      setTimeout(() => setTutorialPhase('initial'), 1000);
    }
  }, [session]);

  const handleSignOut = async () => {
    // Clear user-specific data before signing out
    import('./services/recommendationService').then(({ recommendationService }) => {
      recommendationService.clearCurrentUser();
    });
    await supabase.auth.signOut();
    setSession(null);
  };

  const handleTutorialComplete = () => {
    if (tutorialPhase === 'initial') {
      localStorage.setItem('mortals_tutorial_v2_seen', 'true');
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
    setLastChatHistory([]);

    // Disable News Feed on Search
    if (isNewsFeedOpen) toggleNewsFeed();

    // Clear existing markers immediately to prevent "flashing" old results/user location
    setMarkers([]);

    try {
      // UNIVERSAL SEARCH
      const { results, intent } = await universalSearchService.search(query);

      if (results.length > 0) {
        setMarkers(results);

        const firstMatch = results[0];
        // Fly to first news event location
        if (globeRef.current && firstMatch.latitude !== 0) {
          globeRef.current.flyTo(firstMatch.latitude, firstMatch.longitude);
        }
        setMarkerColor([1, 0.2, 0.2]); // Always Red for News

        // Trigger Post-Search Tutorial if not seen
        const hasSeenPostSearch = localStorage.getItem('mortals_tutorial_post_search_seen');
        if (!hasSeenPostSearch) {
          setTimeout(() => setTutorialPhase('post-search'), 500);
        }

      } else {
        setMarkers([]);
        setSearchState(prev => ({ ...prev, error: `No results found for "${query}"` }));
      }

    } catch (error: any) {
      console.warn("Search Error:", error);
      setSearchState(prev => ({ ...prev, error: error.message || "Search failed." }));
    } finally {
      setSearchState(prev => ({ ...prev, isLoading: false }));
    }
  }, [isNewsFeedOpen, toggleNewsFeed]);

  const handleClearResults = useCallback(() => {
    setMarkers(userMarkers); // Revert to user markers instead of empty
    setSearchState({ isLoading: false, error: null, query: '' });
    setSelectedMarker(null);
    setPersona(null);
    setSuggestions([]);
    setCrowd([]);

    setLastChatHistory([]);
    setMarkerColor([0.2, 0.8, 1]); // Reset color
  }, [userMarkers]);



  const handleCloseMarker = useCallback(() => {
    setSelectedMarker(null);
    setPersona(null);
    setSuggestions([]);
    setCrowd([]);
  }, []);

  const handleSelectMarker = useCallback(async (marker: LocationMarker) => {
    // Toggle Logic: If clicking the same marker, deselect it to resume rotation
    if (selectedMarker?.id === marker.id) {
      handleCloseMarker();
      if (isNewsFeedOpen) toggleNewsFeed();
      return;
    }

    // SPECIAL TYPES HANDLING
    if (marker.type === 'Event') {
      // Dispatch event to UIOverlay to handle Feed injection and opening
      window.dispatchEvent(new CustomEvent('geo-terra:view-news-item', { detail: { event: marker } }));
      // Highlight logic below
    }


    setSelectedMarker(marker);
    setPersona(null);
    setSuggestions([]);
    setCrowd([]);

    if (globeRef.current && marker.latitude !== 0) {
      globeRef.current.flyTo(marker.latitude, marker.longitude);
    }

    // Recommendation Engine: Track Click
    import('./services/recommendationService').then(({ recommendationService }) => {
      recommendationService.trackInteraction(marker, 'CLICK');
    });

    // Don't fetch crowd for News Events OR AI Feed Posts
    if (marker.type === 'Event' || (marker.type === 'Post' && !marker.isUserPost)) {
      // For AI Posts, we handle focus/open here. For Events, it's handled via dispatch above.
      if (marker.type !== 'Event') {
        setFocusedEventId(marker.id);
        if (!isNewsFeedOpen) toggleNewsFeed();
      }
      return;
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
  }, [searchState.query, selectedMarker, handleCloseMarker]);

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
    // Determine if it's a story chat
    const isStory = savedPersona.origin === 'story' || location.isStory;

    // Only show loading crowd/sector scan if it's a REAL map location
    if (!isStory) {
      setIsLoadingCrowd(true);
    }

    try {
      const { chatService } = await import('./services/chatService');
      const messages = await chatService.getSessionMessages(sessionId);

      // Restore State
      // Always set selectedMarker so chat context exists (handleSendMessage requires it)
      setSelectedMarker(location);

      // Only visually place it on the map/globe if it's NOT a story-based session
      // We check persona.origin because it persists in the JSON payload
      if (savedPersona.origin !== 'story') {
        setMarkers([location]);
        if (globeRef.current) {
          globeRef.current.flyTo(location.latitude, location.longitude);
        }
      }

      setPersona(savedPersona);
      setChatHistory(messages);
      setCurrentSessionId(sessionId);

    } catch (e) {
      console.error("Failed to resume session:", e);
    } finally {
      setIsLoadingCrowd(false);
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
              onLoadMore={loadMore}
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


          crowd={crowd}
          isLoadingCrowd={isLoadingCrowd}
          onCustomCrowdSearch={handleCustomCrowdSearch}
          onSelectMember={handleSelectMember}

          persona={persona}
          isSummoning={isSummoning}
          onClosePersona={handleClosePersona}

          timezone={selectedMarker?.timezone}
          chatHistory={chatHistory}
          onSendMessage={handleSendMessage}
          isChatLoading={isChatLoading}
          suggestions={suggestions}



          userEmail={session?.user?.email}
          userId={session?.user?.id}
          userImage={userProfileImage}
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
          onRequestNotifications={() => setShowPermissionCard(true)}
          onPostClick={() => setIsCreatePostOpen(true)}
          onSearchInteraction={setIsSearchActive}
          notificationPermission={notificationPermission}


        />

        <TutorialOverlay
          isOpen={tutorialPhase !== 'none'}
          steps={tutorialPhase === 'initial' ? initialTutorialSteps : postSearchTutorialSteps}
          onComplete={handleTutorialComplete}
          onSkip={handleTutorialComplete}
        />

        <CreatePostModal
          isOpen={isCreatePostOpen}
          onClose={() => setIsCreatePostOpen(false)}
          onPostCreated={() => {
            setIsCreatePostOpen(false);
            // Optionally refresh feed or markers here
            // For now just close
          }}
        />

        {/* Universal Support Chat (Atlas AI) */}
        {session?.user && !isChatOpen && !isNewsFeedOpen && <SupportChat userId={session.user.id} />}

        {/* AI Story Bar */}
        {!isNewsFeedOpen && !isChatOpen && !isSearchActive && <StoryBar />}

      </div>
    </ErrorBoundary>
  );
};

export default App;
