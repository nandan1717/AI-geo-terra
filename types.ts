
export interface LocationMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  description: string;
  type?: 'Country' | 'State' | 'City' | 'Place' | 'Business' | 'Landmark' | 'Post' | 'Event'; // Added 'Event'
  timezone?: string;
  country?: string;
  region?: string;
  googleMapsUri?: string;
  geojson?: any;

  // News Event Data
  sourceUrl?: string; // For linking to the news article
  publishedAt?: string; // ISO or GDELT date string
  category?: 'Environmental' | 'Development' | 'Conflict' | 'General' | string;
  vibe?: 'High Energy' | 'Chill' | 'Inspiration' | 'Intense' | 'Trending';
  sentiment?: number; // Normalized -10 to +10
  markerColor?: [number, number, number]; // RGB tuple [0-1, 0-1, 0-1] for Cobe or CSS

  // User Post Data
  isUserPost?: boolean;
  postImageUrl?: string;
  postVideoUrl?: string; // New: Support for video backgrounds
  postCaption?: string;
}

export interface SearchState {
  isLoading: boolean;
  error: string | null;
  query: string;
}

export interface CrowdMember {
  name: string;
  gender: string;
  occupation: string;
  age: number;
  lineage: string;
  mindset: string;
  currentActivity: string;
  mood: string;
  bio: string;
}

export interface LocalPersona extends CrowdMember {
  message: string;
  imageUrl: string;
  suggestedQuestions: string[];
}

export interface UserProfile {
  id: string;
  username?: string;
  full_name?: string;
  bio?: string;
  occupation?: string;
  location?: string;
  age?: number;
  avatar_url?: string;
  avatar_source?: 'upload' | 'library';
  is_private: boolean;
  is_verified_human: boolean;

  // Gamification
  xp: number;
  level: number;
  region_stats: Record<string, number>; // "Canada": 500
  visited_countries: string[];
  visited_continents: string[];
  visited_regions: string[];

  // Stats (Derived or Stored)
  explored_percent?: number;
  regions_count?: number; // Count of visited_regions
  places_count?: number;
  ai_locals_count?: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  sources?: { title: string; uri: string }[];
}

export interface ChatResponse {
  text: string;
  suggestions: string[];
  sources?: { title: string; uri: string }[];
}

export interface CameraControlRef {
  flyTo: (lat: number, lng: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
}

export type NotificationType =
  | 'FRIEND_REQUEST'
  | 'FRIEND_ACCEPTED'
  | 'LOGIN'
  | 'LOGOUT'
  | 'APP_TIP'
  | 'SYSTEM'
  | 'WELCOME';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

export interface NotificationData {
  friendRequest?: {
    requesterId: string;
    requesterName: string;
    requesterAvatar?: string;
  };
  friendAccepted?: {
    friendId: string;
    friendName: string;
    friendAvatar?: string;
  };
  appTip?: {
    feature: string;
    action?: string;
  };
  // Dynamic AI Engagement Fields
  feature?: string;
  systemMessage?: string;
  expiresAt?: Date;
  actionPath?: string;
  userName?: string;
  [key: string]: any;
}

// Story Bar Types
export interface StoryItem {
  id: string;
  type: 'video' | 'image';
  url: string;
  duration: number; // seconds
  takenAt: string; // ISO date
  caption?: string; // AI Generated Caption
}

export interface Story {
  id: string;
  user: {
    handle: string;
    name: string;
    avatarUrl: string;
    isAi: boolean;
  };
  items: StoryItem[];
  viewed: boolean;
  expiresAt: number; // Timestamp
}
