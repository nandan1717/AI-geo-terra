
export interface LocationMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  description: string;
  type?: 'Country' | 'State' | 'City' | 'Place' | 'Business' | 'Landmark';
  timezone?: string; // e.g., "Europe/London" or "UTC+1"
  country?: string;
  region?: string;
  googleMapsUri?: string;
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
  suggestedQuestions: string[]; // Initial context-aware questions
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

// Camera types for controlling the globe view
export interface CameraControlRef {
  flyTo: (lat: number, lng: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
}
