import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';
import { locationService, LocationResult } from '../services/locationService';

interface LocationInputProps {
    value: string;
    onLocationSelect: (location: { name: string, lat: number, lng: number }) => void;
    placeholder?: string;
    className?: string;
}

const LocationInput: React.FC<LocationInputProps> = ({ value, onLocationSelect, placeholder = "Search location...", className = "" }) => {
    const [query, setQuery] = useState(value);
    const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Update internal state if external value changes (e.g. initial load)
    useEffect(() => {
        setQuery(value);
    }, [value]);

    // Close suggestions when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length >= 3 && showSuggestions) {
                setLoading(true);
                const results = await locationService.searchPlaces(query);
                setSuggestions(results);
                setLoading(false);
            } else {
                setSuggestions([]);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [query, showSuggestions]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
        setShowSuggestions(true);
    };

    const handleSelect = (place: LocationResult) => {
        setQuery(place.place_name);
        setShowSuggestions(false);
        onLocationSelect({
            name: place.place_name,
            lat: place.center[1], // Mapbox returns [lng, lat]
            lng: place.center[0]
        });
    };

    const handleCurrentLocation = () => {
        if (navigator.geolocation) {
            setLoading(true);
            navigator.geolocation.getCurrentPosition(async (pos) => {
                const name = await locationService.reverseGeocode(pos.coords.latitude, pos.coords.longitude);
                setQuery(name);
                onLocationSelect({
                    name: name,
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude
                });
                setLoading(false);
            }, (err) => {
                console.error(err);
                setLoading(false);
                alert("Could not get location.");
            });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && suggestions.length > 0) {
            handleSelect(suggestions[0]);
        }
    };

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            <div className="flex items-center bg-white/5 border border-white/10 rounded-lg focus-within:border-blue-500 transition-colors pr-2">
                <input
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="flex-1 bg-transparent border-none outline-none text-white text-sm px-3 py-2 placeholder-gray-500 min-w-0"
                    onFocus={() => setShowSuggestions(true)}
                />
                <div className="flex items-center gap-1 flex-shrink-0">
                    {query && (
                        <button onClick={() => { setQuery(''); setSuggestions([]); }} className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                            <X size={14} />
                        </button>
                    )}
                    <button
                        onClick={handleCurrentLocation}
                        disabled={loading}
                        className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-full transition-colors"
                        title="Use current location"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                    </button>
                </div>
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                    {suggestions.map((place) => (
                        <button
                            key={place.id}
                            onClick={() => handleSelect(place)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors border-b border-white/5 last:border-0"
                        >
                            <div className="font-medium text-white">{place.name}</div>
                            <div className="text-xs text-gray-500 truncate">{place.place_name}</div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LocationInput;
