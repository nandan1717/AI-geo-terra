import React, { useState } from 'react';
import { Key, ArrowRight, Globe, ShieldCheck } from 'lucide-react';

interface ApiKeyInputProps {
    onSubmit: (key: string) => void;
}

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ onSubmit }) => {
    const [key, setKey] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!key.trim()) {
            setError("API Key signature required.");
            return;
        }
        if (!key.startsWith("AIza")) {
            // Basic heuristic check, not blocking but warning
            // We allow it but maybe show a warning? No, let's just accept it.
        }
        onSubmit(key.trim());
    };

    return (
        <div className="relative w-full h-screen bg-black text-white overflow-hidden font-mono flex items-center justify-center">
            {/* Background Ambience */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-black via-blue-950/20 to-black pointer-events-none"></div>

            <div className="w-full max-w-md bg-black/80 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-2xl z-10 animate-in zoom-in-95 duration-500">
                <div className="flex justify-center mb-6">
                    <div className="p-4 bg-white/5 rounded-full border border-white/10 shadow-inner">
                        <Key size={32} className="text-yellow-400" />
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-center mb-2 text-white">Security Clearance</h2>
                <p className="text-center text-gray-400 text-xs mb-8 leading-relaxed">
                    To access the Mortals planetary interface, a valid <span className="text-blue-400 font-bold">Gemini API Key</span> is required. This key connects your terminal to the neural network.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Enter API Key</label>
                        <div className="relative group">
                            <input
                                type="password"
                                value={key}
                                onChange={(e) => { setKey(e.target.value); setError(''); }}
                                className="w-full bg-[#111] border border-white/20 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/20 transition-all"
                                placeholder="AIza..."
                            />
                            <div className="absolute right-3 top-3.5 text-gray-600 group-focus-within:text-yellow-400/50">
                                <ShieldCheck size={18} />
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-400 text-xs bg-red-900/20 p-2 rounded border border-red-500/20">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full py-3.5 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2"
                    >
                        <span>Initialize System</span>
                        <ArrowRight size={16} />
                    </button>
                </form>

                <div className="mt-8 text-center border-t border-white/5 pt-6">
                    <p className="text-xs text-gray-500 mb-2">Don't have a key?</p>
                    <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs font-bold transition-colors border-b border-blue-400/30 pb-0.5 hover:border-blue-300"
                    >
                        <Globe size={12} />
                        Generate Key at Google AI Studio
                    </a>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyInput;