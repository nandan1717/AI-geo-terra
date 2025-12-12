
import React from 'react';
import { ChevronLeft, MapPin } from 'lucide-react';

interface AILocal {
    persona_name: string;
    persona_occupation: string;
    persona_image_url: string;
    location_name: string;
    id?: string;
}

interface AILocalsListProps {
    locals: AILocal[];
    onClose: () => void;
}

const AILocalsList: React.FC<AILocalsListProps> = ({ locals, onClose }) => (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
        <div className="flex items-center gap-2 p-4 border-b border-white/10 shrink-0">
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors">
                <ChevronLeft size={24} />
            </button>
            <h2 className="text-lg font-bold text-white">My AI Connections</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {locals.map((local, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                    <img src={local.persona_image_url} alt={local.persona_name} className="w-10 h-10 rounded-full object-cover" />
                    <div>
                        <h3 className="font-bold text-white text-sm">{local.persona_name}</h3>
                        <p className="text-xs text-blue-300">{local.persona_occupation}</p>
                        <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                            <MapPin size={10} /> {local.location_name}
                        </p>
                    </div>
                </div>
            ))}
            {locals.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                    No AI locals met yet. Go explore!
                </div>
            )}
        </div>
    </div>
);

export default AILocalsList;
