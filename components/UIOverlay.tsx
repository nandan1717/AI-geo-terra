
import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, Loader2, MapPin, X, Users, Send, Radio, Activity, Crosshair, Navigation, History, ChevronLeft, AlertCircle as AlertIcon, Sparkles
} from 'lucide-react';
import { LocationMarker, SearchState, LocalPersona, ChatMessage, CrowdMember } from '../types';

interface UIOverlayProps {
  onSearch: (query: string) => void;
  onClearResults: () => void;
  searchState: SearchState;
  
  markers: LocationMarker[];
  selectedMarker: LocationMarker | null;
  onSelectMarker: (marker: LocationMarker) => void;
  onCloseMarker: () => void;
  
  onUseCurrentLocation: () => void;
  
  onScanCrowd: (marker: LocationMarker) => void;
  isScanning: boolean;
  crowd: CrowdMember[];
  onSelectMember: (member: CrowdMember) => void;
  
  persona: LocalPersona | null;
  isSummoning: boolean;
  onClosePersona: () => void;
  chatHistory: ChatMessage[];
  onSendMessage: (text: string) => void;
  isChatLoading: boolean;
  suggestions?: string[];
}

const UIOverlay: React.FC<UIOverlayProps> = ({ 
    onSearch, 
    onClearResults,
    searchState, 
    markers,
    selectedMarker,
    onSelectMarker,
    onCloseMarker,
    onUseCurrentLocation,
    
    onScanCrowd,
    isScanning,
    crowd,
    onSelectMember,

    persona,
    isSummoning,
    onClosePersona,
    chatHistory,
    onSendMessage,
    isChatLoading,
    suggestions = [],
}) => {
  const [inputValue, setInputValue] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, persona, suggestions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSearch(inputValue);
      if (isMobile) inputRef.current?.blur();
    }
  };

  const handleClearSearch = () => {
      setInputValue('');
      onClearResults();
  }

  const handleChatSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (chatInput.trim() && !isChatLoading) {
          onSendMessage(chatInput);
          setChatInput('');
      }
  }

  const handleSuggestionClick = (suggestion: string) => {
      if (!isChatLoading) {
          onSendMessage(suggestion);
      }
  };

  const suggestionsList = [
    "Tokyo", "Paris", "New York", "Cairo", "Rio de Janeiro", "Sydney"
  ];

  const showSearch = !persona;
  const showResultsList = !persona && markers.length > 0 && !selectedMarker;
  const showMarkerSheet = selectedMarker && !persona && crowd.length === 0;
  const showCrowdSelection = crowd.length > 0 && !persona;
  const showChat = !!persona;

  return (
    <div className="absolute inset-0 pointer-events-none font-sans text-white flex flex-col">
      
      {/* --- 1. TOP NAVIGATION --- */}
      {showSearch && (
        <div className="absolute top-0 left-0 w-full z-30 p-4 pt-12 md:pt-6 flex flex-col gap-3 transition-all duration-300">
             
             <div className="flex items-start gap-3 w-full max-w-5xl mx-auto md:mx-0">
                 <div className="pointer-events-auto flex-1 md:max-w-[28rem] shadow-2xl relative">
                    <form onSubmit={handleSubmit} className="relative group">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-xl rounded-full border border-white/20 transition-all group-focus-within:bg-black/80 group-focus-within:border-blue-500/50 shadow-lg group-focus-within:shadow-blue-500/20"></div>
                        <div className="relative flex items-center px-4 py-3.5 gap-3">
                            <Search size={18} className="text-gray-400 group-focus-within:text-blue-400 shrink-0 transition-colors" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="Search planet..."
                                className="flex-1 bg-transparent border-none outline-none text-base text-white placeholder-gray-500 w-full font-medium"
                                style={{ fontSize: '16px' }}
                            />
                            {searchState.isLoading ? (
                                <Loader2 size={18} className="animate-spin text-blue-400 shrink-0" />
                            ) : (
                                inputValue && (
                                    <button 
                                        type="button" 
                                        onClick={handleClearSearch}
                                        className="text-gray-500 hover:text-white p-1"
                                    >
                                        <X size={16} />
                                    </button>
                                )
                            )}
                        </div>
                    </form>

                    {/* Error Toast */}
                    {searchState.error && (
                        <div className="absolute top-full left-0 mt-2 w-full bg-red-500/90 backdrop-blur-md border border-red-400/50 text-white text-xs px-4 py-3 rounded-xl animate-in fade-in slide-in-from-top-2 shadow-lg z-20">
                            <div className="flex items-center gap-2">
                                <AlertIcon className="w-4 h-4 shrink-0" />
                                <span>{searchState.error}</span>
                            </div>
                        </div>
                    )}

                    {!selectedMarker && markers.length === 0 && !searchState.error && (
                         <div className="absolute top-full left-0 mt-3 w-full overflow-x-auto scrollbar-hide pointer-events-auto">
                             <div className="flex gap-2 pb-2">
                                {suggestionsList.map(s => (
                                    <button 
                                        key={s}
                                        onClick={() => { setInputValue(s); onSearch(s); }}
                                        className="flex-shrink-0 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-xs font-medium text-gray-300 hover:bg-white/20 hover:text-white hover:border-white/40 transition-all whitespace-nowrap"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                 </div>
             </div>
        </div>
      )}

      {/* --- 2. GPS FAB --- */}
      {showSearch && !showCrowdSelection && (
          <div className="absolute bottom-24 right-4 md:bottom-8 md:right-8 z-20 pointer-events-auto flex flex-col gap-3">
            <button 
                onClick={onUseCurrentLocation}
                className="w-12 h-12 md:w-14 md:h-14 bg-black/60 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-blue-600 hover:border-blue-400 transition-all active:scale-90"
                title="Locate Me"
            >
                <Crosshair size={isMobile ? 20 : 24} />
            </button>
          </div>
      )}

      {/* --- 3. RESULTS --- */}
      {showResultsList && (
          <div className="absolute bottom-0 left-0 w-full md:top-28 md:bottom-auto md:left-4 md:w-[26rem] z-20 pointer-events-auto animate-in slide-in-from-bottom-10 md:slide-in-from-left-10 duration-500">
              <div className="md:hidden absolute -top-20 inset-x-0 h-20 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
              <div className="bg-[#0f0f0f] md:bg-black/60 backdrop-blur-xl border-t md:border border-white/10 rounded-t-2xl md:rounded-2xl overflow-hidden shadow-2xl max-h-[60vh] md:max-h-[70vh] flex flex-col">
                  <div className="md:hidden w-full flex justify-center pt-3 pb-1">
                      <div className="w-12 h-1.5 bg-white/20 rounded-full"></div>
                  </div>
                  <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
                      <h3 className="text-xs font-mono uppercase tracking-widest text-blue-400 flex items-center gap-2">
                          <Navigation size={12} />
                          {markers.length > 1 ? 'Detected Sectors' : 'Target Acquired'}
                      </h3>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">{markers.length} Found</span>
                        <button onClick={onClearResults} className="text-gray-500 hover:text-white transition-colors">
                            <X size={14} />
                        </button>
                      </div>
                  </div>
                  <div className="overflow-y-auto scrollbar-hide p-2 space-y-1 pb-8 md:pb-2">
                      {markers.map((marker, idx) => (
                          <button 
                              key={idx}
                              onClick={() => onSelectMarker(marker)}
                              className="w-full text-left p-4 rounded-xl hover:bg-white/10 transition-all active:scale-[0.98] border border-transparent hover:border-white/5 group"
                          >
                              <div className="flex items-start justify-between mb-1">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-white text-sm">{marker.name}</span>
                                    {(marker.region || marker.country) && (
                                        <span className="text-xs text-blue-300 mt-0.5">
                                            {marker.region}{marker.region && marker.country ? ', ' : ''}{marker.country}
                                        </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-mono text-gray-600 group-hover:text-gray-400 transition-colors">
                                      {marker.latitude.toFixed(2)},{marker.longitude.toFixed(2)}
                                  </span>
                              </div>
                              <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mt-1">{marker.description}</p>
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* --- 4. MARKER DETAILS --- */}
      {showMarkerSheet && (
        <div className="absolute bottom-0 left-0 w-full md:bottom-8 md:right-8 md:left-auto md:w-[24rem] z-20 pointer-events-auto animate-in slide-in-from-bottom-full duration-500 ease-out">
            <div className="bg-[#0a0a0a] md:bg-black/80 backdrop-blur-2xl rounded-t-3xl md:rounded-3xl border-t md:border border-white/10 shadow-2xl overflow-hidden">
                <div className="relative h-32 md:h-40 bg-gradient-to-br from-slate-900 via-blue-950 to-black p-6 flex flex-col justify-end">
                    <button 
                        onClick={onCloseMarker}
                        className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-white/10 rounded-full text-white/70 transition-colors backdrop-blur-md"
                    >
                        <X size={20} />
                    </button>
                    <div className="flex items-center gap-2 text-blue-300 text-[10px] font-mono uppercase tracking-wider mb-1">
                        <MapPin size={12} />
                        <span>
                            {selectedMarker.region ? `${selectedMarker.region}, ` : ''}
                            {selectedMarker.country || 'Sector Locked'}
                        </span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight shadow-black drop-shadow-md pr-8">
                        {selectedMarker.name}
                    </h2>
                </div>
                <div className="p-6 pt-4 space-y-6 pb-10 md:pb-6">
                    <p className="text-sm text-gray-300 leading-relaxed">
                        {selectedMarker.description}
                    </p>
                    <div className="flex gap-3">
                        <a 
                           href={selectedMarker.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedMarker.name} ${selectedMarker.region || ''} ${selectedMarker.country || ''}`)}`}
                           target="_blank"
                           rel="noreferrer"
                           className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold text-sm transition-colors border border-white/10 flex items-center justify-center gap-2"
                        >
                            <MapPin size={16} className="text-gray-400" />
                            Maps
                        </a>
                        <button 
                            onClick={() => onScanCrowd(selectedMarker)}
                            disabled={isScanning}
                            className="flex-[2] py-3.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
                        >
                            {isScanning ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    <span>Scanning...</span>
                                </>
                            ) : (
                                <>
                                    <Users size={18} />
                                    <span>Scan For Locals</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- 5. CROWD --- */}
      {showCrowdSelection && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex flex-col md:items-center md:justify-center pointer-events-auto animate-in fade-in duration-300">
             <div className="w-full md:max-w-5xl flex-shrink-0 p-6 pt-12 md:pt-6 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent md:bg-none">
                 <div className="flex items-center gap-3">
                    <button onClick={() => onSelectMarker(selectedMarker!)} className="md:hidden p-2 -ml-2 text-gray-400">
                        <ChevronLeft />
                    </button>
                    <div>
                        <h2 className="text-xl md:text-3xl font-light text-white flex items-center gap-2 md:gap-3">
                            <Radio className="text-red-500 animate-pulse w-5 h-5 md:w-6 md:h-6" />
                            <span>Lifeforms Detected</span>
                        </h2>
                        <p className="text-xs text-gray-500 font-mono mt-1 hidden md:block">Select a consciousness to intercept</p>
                    </div>
                 </div>
                 <button 
                    onClick={onCloseMarker}
                    className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm backdrop-blur-md border border-white/10"
                 >
                     Abort
                 </button>
             </div>
             <div className="flex-1 w-full md:max-w-5xl overflow-y-auto scrollbar-hide p-4 md:p-0 pb-20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {crowd.map((member, idx) => (
                        <div 
                            key={idx}
                            onClick={() => !isSummoning && onSelectMember(member)}
                            className="group relative bg-[#111] md:bg-black/40 border border-white/10 hover:border-blue-500/50 rounded-2xl p-5 cursor-pointer transition-all active:scale-[0.98] hover:-translate-y-1 shadow-xl"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="text-lg font-bold text-white">{member.name}</h3>
                                    <p className="text-blue-300 text-xs font-mono uppercase tracking-wider mt-0.5">
                                        {member.age} • {member.occupation}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <div className="text-[10px] font-mono text-emerald-400 bg-emerald-900/20 px-1.5 py-0.5 rounded border border-emerald-500/20">Active</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-gray-400 mb-3 bg-white/5 p-2 rounded-lg">
                                <History size={12} className="shrink-0" />
                                <span className="truncate">{member.lineage}</span>
                            </div>
                            <p className="text-sm text-gray-300 leading-relaxed mb-4 line-clamp-3">"{member.bio}"</p>
                            <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                    <Activity size={12} />
                                    <span>{member.currentActivity}</span>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                    {isSummoning ? <Loader2 className="animate-spin" size={14} /> : <Radio size={14} />}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
             </div>
        </div>
      )}

      {/* --- 6. CHAT INTERFACE --- */}
      {showChat && (
          <div className="absolute inset-0 z-50 bg-[#000000] md:bg-black/50 backdrop-blur-xl flex items-center justify-center pointer-events-auto animate-in zoom-in-95 duration-300">
              <div className="w-full h-full md:w-[32rem] md:h-[45rem] bg-[#0a0a0a] md:bg-black/80 md:border border-white/10 md:rounded-3xl flex flex-col shadow-2xl overflow-hidden relative">
                  
                  {/* Header */}
                  <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40 shrink-0 z-10">
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-blue-500/50 relative bg-gray-800">
                             <img src={persona.imageUrl} alt={persona.name} className="w-full h-full object-cover" />
                             <div className="absolute inset-0 bg-gradient-to-t from-blue-500/30 to-transparent opacity-50"></div>
                          </div>
                          <div>
                              <h3 className="font-bold text-white flex items-center gap-2">
                                  {persona.name}
                                  <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
                              </h3>
                              <div className="flex flex-col">
                                <p className="text-xs text-blue-300 uppercase tracking-wider">{persona.occupation}</p>
                                <p className="text-[10px] text-gray-600 mt-0.5">AI Character • Live Data Grounding</p>
                              </div>
                          </div>
                      </div>
                      <button 
                        onClick={onClosePersona}
                        className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                      >
                          <X size={20} />
                      </button>
                  </div>
                  
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-black/20 to-transparent">
                      {chatHistory.map((msg, idx) => {
                          const isUser = msg.role === 'user';
                          return (
                            <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] md:max-w-[80%] p-3.5 md:p-4 rounded-2xl text-sm leading-relaxed relative group ${
                                    isUser 
                                    ? 'bg-blue-600 text-white rounded-tr-none' 
                                    : 'bg-[#1a1a1a] border border-white/10 text-gray-200 rounded-tl-none'
                                }`}>
                                    {msg.text}
                                    
                                    {/* Citations/Sources */}
                                    {!isUser && msg.sources && msg.sources.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase">Sources</div>
                                            {msg.sources.map((source, i) => (
                                                <a 
                                                    key={i} 
                                                    href={source.uri} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="block text-[10px] text-blue-400 truncate hover:underline flex items-center gap-1"
                                                >
                                                    <Sparkles size={8} />
                                                    {source.title || source.uri}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                          )
                      })}
                      {isChatLoading && (
                          <div className="flex justify-start">
                              <div className="bg-[#1a1a1a] border border-white/10 px-4 py-3 rounded-2xl rounded-tl-none flex flex-col gap-2">
                                  <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce delay-75"></div>
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce delay-150"></div>
                                  </div>
                                  <span className="text-[10px] text-gray-500 font-mono animate-pulse">Consulting the spirits... (~5s)</span>
                              </div>
                          </div>
                      )}
                      <div ref={chatEndRef} />
                  </div>

                  {/* Footer */}
                  <div className="p-3 md:p-4 border-t border-white/10 bg-black/40 shrink-0">
                      {suggestions && suggestions.length > 0 && (
                          <div className="relative">
                            <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3 pb-1 mask-image-r">
                                {suggestions.map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSuggestionClick(s)}
                                        disabled={isChatLoading}
                                        className="whitespace-nowrap px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-blue-300 transition-colors disabled:opacity-50 shrink-0"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                            <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black/60 to-transparent pointer-events-none md:hidden"></div>
                          </div>
                      )}

                      <form onSubmit={handleChatSubmit} className="flex gap-2 items-center">
                          <input 
                              type="text" 
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              placeholder="Type a message..."
                              className="flex-1 bg-[#111] border border-white/10 rounded-full px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors placeholder-gray-600"
                              disabled={isChatLoading}
                              style={{ fontSize: '16px' }}
                          />
                          <button 
                            type="submit"
                            disabled={!chatInput.trim() || isChatLoading}
                            className="w-11 h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center disabled:opacity-50 disabled:bg-gray-800 transition-all shrink-0"
                          >
                              <Send size={18} />
                          </button>
                      </form>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default UIOverlay;
