import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';
import { locationService, LocationResult } from '../services/locationService';

interface LocationInputProps {
    value: string;
    onLocationSelect: (location: { name: string, lat: number, lng: number, country?: string, region?: string, continent?: string }) => void;
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
            lng: place.center[0],
            country: place.country,
            region: place.region,
            continent: place.continent
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
        <div className={`relative group ${className}`} ref={wrapperRef}>
            <div className="flex items-center bg-black/40 border border-white/10 rounded-xl focus-within:border-blue-500/50 focus-within:bg-black/60 focus-within:shadow-[0_0_15px_rgba(59,130,246,0.1)] transition-all duration-300 pr-1 overflow-hidden backdrop-blur-sm">
                <div className="pl-3 text-gray-400">
                    <MapPin size={14} className="opacity-70" />
                </div>
                <input
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="flex-1 bg-transparent border-none outline-none text-white text-xs sm:text-sm px-2 py-2.5 placeholder-gray-500/70 min-w-0"
                    onFocus={() => setShowSuggestions(true)}
                />
                <div className="flex items-center gap-1 flex-shrink-0 mr-1">
                    {query && (
                        <button onClick={() => { setQuery(''); setSuggestions([]); }} className="p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                            <X size={14} />
                        </button>
                    )}
                    <button
                        onClick={handleCurrentLocation}
                        disabled={loading}
                        className="p-1.5 text-blue-400/80 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                        title="Use current location"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                    </button>
                </div>
            </div>

            {/* Dropdown Results */}
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-[100] left-0 right-0 top-full mt-2 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto backdrop-blur-xl ring-1 ring-white/5 animate-in fade-in slide-in-from-top-1 duration-200 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                    <div className="px-3 py-2 text-[10px] uppercase font-bold text-gray-500 tracking-wider bg-white/5 border-b border-white/5">
                        Suggested Locations
                    </div>
                    {suggestions.map((place) => (
                        <button
                            key={place.id}
                            onClick={() => handleSelect(place)}
                            className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-blue-600/10 hover:text-white transition-colors border-b border-white/5 last:border-0 group flex flex-col gap-0.5"
                        >
                            <div className="font-medium text-white group-hover:text-blue-400 transition-colors flex items-center gap-2">
                                <MapPin size={12} className="opacity-50" />
                                {place.name}
                            </div>
                            <div className="text-[10px] text-gray-500 truncate pl-5 opacity-70 group-hover:opacity-100 transition-opacity">
                                {place.place_name}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LocationInput;
