
export interface Persona {
    id: string;
    handle: string;
    name: string;
    avatarUrl: string;
    bio: string;
    vibe: 'adventure' | 'luxury' | 'urban' | 'nature' | 'foodie';
    topics: string[]; // Keywords for Pexels search
}

export const PERSONA_DATABASE: Persona[] = [
    {
        id: 'p1',
        handle: '@nomad_kate',
        name: 'Kate Walker',
        avatarUrl: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150',
        bio: 'Chasing sunsets & coffee ☕️',
        vibe: 'adventure',
        topics: ['hiking', 'mountain top', 'backpacking', 'sunrise']
    },
    {
        id: 'p2',
        handle: '@tokyo_drift',
        name: 'Kenji Sato',
        avatarUrl: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150',
        bio: 'Urban explorer. Tokyo based. 🌃',
        vibe: 'urban',
        topics: ['tokyo night', 'neon city', 'street food', 'subway']
    },
    {
        id: 'p3',
        handle: '@eco_sophia',
        name: 'Sophia Green',
        avatarUrl: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150',
        bio: 'Sustainable living 🌱',
        vibe: 'nature',
        topics: ['forest walk', 'plant care', 'waterfall', 'greenhouse']
    },
    {
        id: 'p4',
        handle: '@chef_marco',
        name: 'Marco Rossi',
        avatarUrl: 'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=150',
        bio: 'Taste the world 🍝',
        vibe: 'foodie',
        topics: ['cooking pasta', 'street market food', 'fancy dinner', 'wine tasting']
    },
    {
        id: 'p5',
        handle: '@lux_luna',
        name: 'Luna St. James',
        avatarUrl: 'https://images.pexels.com/photos/1382731/pexels-photo-1382731.jpeg?auto=compress&cs=tinysrgb&w=150',
        bio: 'Life in first class 🥂',
        vibe: 'luxury',
        topics: ['champagne', 'yacht', 'luxury hotel', 'poolside']
    },
    {
        id: 'p6',
        handle: '@adventure_alex',
        name: 'Alex Chen',
        avatarUrl: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=150',
        bio: 'Adrenaline junkie 🧗',
        vibe: 'adventure',
        topics: ['rock climbing', 'surfing', 'skateboarding', 'cliff jumping']
    },
    {
        id: 'p7',
        handle: '@art_is_life',
        name: 'Mia Wallace',
        avatarUrl: 'https://images.pexels.com/photos/3763188/pexels-photo-3763188.jpeg?auto=compress&cs=tinysrgb&w=150',
        bio: 'Gallery hopper 🎨',
        vibe: 'urban',
        topics: ['art gallery', 'museum', 'painting', 'street art']
    },
    {
        id: 'p8',
        handle: '@zen_master',
        name: 'David Kim',
        avatarUrl: 'https://images.pexels.com/photos/2589653/pexels-photo-2589653.jpeg?auto=compress&cs=tinysrgb&w=150',
        bio: 'Mindfulness everyday 🧘',
        vibe: 'nature',
        topics: ['meditation', 'yoga', 'sunrise ocean', 'tea ceremony']
    }
];
