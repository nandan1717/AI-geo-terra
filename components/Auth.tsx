import React, { useState, Suspense, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, Mail, Lock, Chrome, Globe, ChevronRight, ArrowRight } from 'lucide-react';
import IntroCarousel from './IntroCarousel';

// Reuse the GlobeScene for consistency
const GlobeScene = React.lazy(() => import('./GlobeScene'));

type AuthView = 'signin' | 'signup' | 'forgot_password';

export default function Auth() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState(''); // New state
    const [view, setView] = useState<AuthView>('signin');
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
    const [showIntro, setShowIntro] = useState(true);

    useEffect(() => {
        const hasSeenIntro = localStorage.getItem('mortals_intro_seen');
        if (hasSeenIntro) {
            setShowIntro(false);
        }
    }, []);

    const handleIntroComplete = () => {
        localStorage.setItem('mortals_intro_seen', 'true');
        setShowIntro(false);
    };

    // Check for OAuth errors in URL (Hash or Query)
    useEffect(() => {
        // Parse Hash Params
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        let errorDescription = hashParams.get('error_description');
        let error = hashParams.get('error');

        // Parse Query Params (Fallback)
        if (!error && !errorDescription) {
            const searchParams = new URLSearchParams(window.location.search);
            errorDescription = searchParams.get('error_description');
            error = searchParams.get('error');
        }

        console.log("Debug: Checking for Auth Errors", {
            hash: window.location.hash,
            search: window.location.search,
            error,
            errorDescription
        });

        if (error || errorDescription) {
            const finalMessage = errorDescription || error || 'Authentication failed';
            console.error("Auth Error Detected:", finalMessage);
            setMessage({
                type: 'error',
                text: finalMessage.replace(/\+/g, ' ')
            });
            // Clear URL to prevent dirty state
            window.history.replaceState(null, '', window.location.pathname);
        }
    }, []);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (view === 'signup') {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: window.location.origin,
                        data: {
                            username: username // Save username to metadata initially
                        }
                    }
                });
                if (error) throw error;
                setMessage({ type: 'success', text: 'Check your email for the confirmation link!' });
            } else if (view === 'signin') {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            } else if (view === 'forgot_password') {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/update-password`,
                });
                if (error) throw error;
                setMessage({ type: 'success', text: 'Password reset link sent to your email.' });
            }
        } catch (error: any) {
            console.error('Auth Error:', error);
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async (e?: React.MouseEvent) => {
        if (e) e.preventDefault();
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/`
                }
            });
            if (error) throw error;
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        }
    };

    if (showIntro) {
        return <IntroCarousel onComplete={handleIntroComplete} />;
    }

    return (
        <div className="relative w-full h-screen bg-black text-white overflow-hidden font-sans">
            {/* Background Globe */}
            <div className="absolute inset-0 opacity-30 pointer-events-none scale-110">
                <Suspense fallback={<div className="w-full h-full bg-black" />}>
                    <GlobeScene
                        markers={[]}
                        onMarkerClick={() => { }}
                        isPaused={false}
                    />
                </Suspense>
            </div>

            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/80 pointer-events-none"></div>

            {/* Auth Container */}
            <div className="absolute inset-0 flex items-center justify-center p-4 z-10">
                <div className="w-full max-w-md bg-black/40 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-500">

                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center p-3 bg-white/5 rounded-2xl mb-4 ring-1 ring-white/10">
                            <Globe size={32} className="text-white" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight mb-2 text-white">
                            {view === 'signin' && 'Welcome Back'}
                            {view === 'signup' && 'Create Account'}
                            {view === 'forgot_password' && 'Reset Password'}
                        </h1>
                        <p className="text-gray-400 text-sm">
                            {view === 'signin' && 'Enter your credentials to access the simulation.'}
                            {view === 'signup' && 'Join the network and start your journey.'}
                            {view === 'forgot_password' && 'Enter your email to receive reset instructions.'}
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleAuth} className="space-y-4">
                        <div className="space-y-3">
                            <div className="relative group">
                                <Mail className="absolute left-4 top-3.5 h-5 w-5 text-gray-500 group-focus-within:text-white transition-colors" />
                                <input
                                    type="email"
                                    placeholder="Email address"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all text-white placeholder-gray-500 text-sm"
                                />
                            </div>

                            {/* Username Field (Signup Only) */}
                            {view === 'signup' && (
                                <div className="relative group">
                                    <div className="absolute left-4 top-3.5 flex items-center justify-center w-5 text-gray-500 group-focus-within:text-white transition-colors text-sm font-bold">@</div>
                                    <input
                                        type="text"
                                        placeholder="username (a-z, 0-9, *)"
                                        value={username}
                                        onChange={(e) => {
                                            // Enforce format: lowercase, a-z, 0-9, *
                                            const val = e.target.value.toLowerCase().replace(/[^a-z0-9*]/g, '');
                                            setUsername(val);
                                        }}
                                        required
                                        className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all text-white placeholder-gray-500 text-sm"
                                    />
                                </div>
                            )}

                            {view !== 'forgot_password' && (
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-3.5 h-5 w-5 text-gray-500 group-focus-within:text-white transition-colors" />
                                    <input
                                        type="password"
                                        placeholder="Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all text-white placeholder-gray-500 text-sm"
                                    />
                                </div>
                            )}
                        </div>

                        {view === 'signin' && (
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setView('forgot_password');
                                        setMessage(null);
                                    }}
                                    className="text-xs text-gray-400 hover:text-white transition-colors"
                                >
                                    Forgot password?
                                </button>
                            </div>
                        )}

                        {message && (
                            <div className={`p-3 rounded-lg text-xs ${message.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                                {message.text}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-white text-black font-bold text-sm rounded-xl hover:bg-gray-100 transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : (
                                <>
                                    <span>
                                        {view === 'signin' && 'Sign In'}
                                        {view === 'signup' && 'Create Account'}
                                        {view === 'forgot_password' && 'Send Reset Link'}
                                    </span>
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    {view !== 'forgot_password' && (
                        <>
                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-white/10"></div>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase tracking-wider">
                                    <span className="px-2 bg-black text-gray-500">Or continue with</span>
                                </div>
                            </div>

                            <button
                                onClick={handleGoogleLogin}
                                className="w-full py-3.5 bg-white/5 border border-white/10 text-white font-medium text-sm rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                            >
                                <Chrome className="h-5 w-5" />
                                Google
                            </button>
                        </>
                    )}

                    <div className="text-center text-sm text-gray-500 mt-8">
                        {view === 'signin' && (
                            <>
                                New here?{' '}
                                <button
                                    onClick={() => {
                                        setView('signup');
                                        setMessage(null);
                                    }}
                                    className="text-white hover:underline transition-colors font-medium"
                                >
                                    Create an account
                                </button>
                            </>
                        )}
                        {view === 'signup' && (
                            <>
                                Already have an account?{' '}
                                <button
                                    onClick={() => {
                                        setView('signin');
                                        setMessage(null);
                                    }}
                                    className="text-white hover:underline transition-colors font-medium"
                                >
                                    Sign in
                                </button>
                            </>
                        )}
                        {view === 'forgot_password' && (
                            <button
                                onClick={() => {
                                    setView('signin');
                                    setMessage(null);
                                }}
                                className="text-white hover:underline transition-colors font-medium flex items-center justify-center gap-2 w-full"
                            >
                                Back to Sign In
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
