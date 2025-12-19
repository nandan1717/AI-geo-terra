
export interface LocationMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  description: string;
  type?: 'Country' | 'State' | 'City' | 'Place' | 'Business' | 'Landmark' | 'Post';
  timezone?: string;
  country?: string;
  region?: string;
  googleMapsUri?: string;
  geojson?: any;

  // User Post Data
  isUserPost?: boolean;
  postImageUrl?: string;
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
