import React, { useState, Suspense } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, Mail, Lock, Chrome, Globe, Shield, AlertCircle, ChevronRight } from 'lucide-react';
// Reuse the GlobeScene for consistency
const GlobeScene = React.lazy(() => import('./GlobeScene'));

export default function Auth() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: window.location.origin
                    }
                });
                if (error) throw error;
                setMessage({ type: 'success', text: 'Check your email for the confirmation link!' });
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin
                }
            });
            if (error) throw error;
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        }
    };

    return (
        <div className="relative w-full h-screen bg-black text-white overflow-hidden font-mono">
            {/* Background Globe */}
            <div className="absolute inset-0 opacity-40 pointer-events-none scale-110">
                <Suspense fallback={<div className="w-full h-full bg-black" />}>
                    <GlobeScene
                        markers={[]}
                        onMarkerClick={() => { }}
                        isPaused={false}
                    />
                </Suspense>
            </div>

            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/80 pointer-events-none"></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none"></div>

            {/* Auth Container */}
            <div className="absolute inset-0 flex items-center justify-center p-4 z-10">
                <div className="w-full max-w-md bg-black/60 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-700">

                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-blue-500/10 rounded-full border border-blue-500/30 relative">
                            <Globe size={48} className="text-blue-400 animate-pulse" />
                            <div className="absolute inset-0 border border-blue-400/20 rounded-full animate-ping opacity-50"></div>
                        </div>
                    </div>

                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold tracking-tighter mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-400">
                            GEMINI TERRA
                        </h1>
                        <p className="text-sm text-gray-400 uppercase tracking-[0.3em]">Planetary Interface System</p>
                    </div>

                    <div className="space-y-4">
                        {/* System Status Badge */}
                        <div className="bg-white/5 border border-white/5 p-4 rounded-lg text-xs text-gray-400 font-mono mb-6">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-green-400">
                                    <Shield size={12} />
                                    <span>SYSTEM SECURE</span>
                                </div>
                                <div className="flex items-center gap-1 text-blue-400">
                                    <AlertCircle size={12} />
                                    <span>AUTH REQUIRED</span>
                                </div>
                            </div>
                            <p>&gt; Initializing connection protocol...</p>
                            <p>&gt; Waiting for authorized personnel...</p>
                        </div>

                        <form onSubmit={handleAuth} className="space-y-4">
                            <div className="space-y-2">
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                                    <input
                                        type="email"
                                        placeholder="Email address"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full pl-10 pr-4 py-3 bg-black/50 border border-white/10 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500/50 outline-none transition-all text-white placeholder-gray-600 font-mono text-sm"
                                    />
                                </div>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                                    <input
                                        type="password"
                                        placeholder="Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full pl-10 pr-4 py-3 bg-black/50 border border-white/10 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500/50 outline-none transition-all text-white placeholder-gray-600 font-mono text-sm"
                                    />
                                </div>
                            </div>

                            {message && (
                                <div className={`p-3 rounded-lg text-xs font-mono ${message.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                                    &gt; {message.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="group relative w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm tracking-widest uppercase rounded-lg transition-all flex items-center justify-center gap-2 overflow-hidden shadow-lg shadow-blue-900/20"
                            >
                                {loading ? <Loader2 className="animate-spin" size={16} /> : (
                                    <>
                                        <span className="z-10">{isSignUp ? 'Initialize Account' : 'Authenticate'}</span>
                                        <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform z-10" />
                                    </>
                                )}
                                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                            </button>
                        </form>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/10"></div>
                            </div>
                            <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                                <span className="px-2 bg-[#0a0a0a] text-gray-500">Or Access Via</span>
                            </div>
                        </div>

                        <button
                            onClick={handleGoogleLogin}
                            className="w-full py-3 px-4 bg-white text-black font-bold text-sm tracking-wide uppercase rounded-lg hover:bg-gray-200 transition-all transform flex items-center justify-center gap-2"
                        >
                            <Chrome className="h-4 w-4" />
                            Google Access
                        </button>

                        <div className="text-center text-xs text-gray-500 mt-6 font-mono">
                            {isSignUp ? 'Already have credentials?' : "Need clearance?"}{' '}
                            <button
                                onClick={() => {
                                    setIsSignUp(!isSignUp);
                                    setMessage(null);
                                }}
                                className="text-blue-400 hover:text-blue-300 underline underline-offset-4 transition-colors"
                            >
                                {isSignUp ? 'Sign In' : 'Request Access'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-4 w-full text-center">
                <p className="text-[10px] text-gray-600 uppercase tracking-widest flex items-center justify-center gap-2">
                    <Lock size={10} />
                    Restricted Access // Auth Required
                </p>
            </div>
        </div>
    );
}
