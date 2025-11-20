
export interface LocationMarker {
  name: string;
  latitude: number;
  longitude: number;
  description: string;
  region?: string;
  country?: string;
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
}
