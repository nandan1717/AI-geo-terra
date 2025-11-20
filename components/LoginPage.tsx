import React, { useState, useEffect } from 'react';
import GlobeScene from './GlobeScene';
import { Shield, Globe, ChevronRight, Loader2, Lock, AlertCircle } from 'lucide-react';
import { signInWithGoogle, isMockMode } from '../services/firebaseConfig';
import { User } from 'firebase/auth';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
      setIsDemo(isMockMode());
  }, []);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      if (user) {
          onLoginSuccess(user);
      }
    } catch (err: any) {
      setError("Authentication sequence failed. Verify network uplink.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full h-screen bg-black text-white overflow-hidden font-mono">
      
      {/* Background Globe (Interaction disabled) */}
      <div className="absolute inset-0 opacity-40 pointer-events-none scale-110">
         <GlobeScene 
            markers={[]} 
            onMarkerClick={() => {}} 
            isPaused={false}
            // We pass a dummy ref or null since we don't control camera here
         />
      </div>

      {/* Overlay Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/80 pointer-events-none"></div>
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none"></div>

      {/* Login Container */}
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
                <div className="bg-white/5 border border-white/5 p-4 rounded-lg text-xs text-gray-400 font-mono">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-green-400">
                            <Shield size={12} />
                            <span>SYSTEM SECURE</span>
                        </div>
                        {isDemo && (
                            <div className="flex items-center gap-1 text-yellow-500">
                                <AlertCircle size={12} />
                                <span>SIMULATION MODE</span>
                            </div>
                        )}
                    </div>
                    <p>> Initializing connection protocol...</p>
                    {isDemo ? (
                        <p className="text-blue-300">> Bypass active: Using simulation credentials.</p>
                    ) : (
                        <p>> Waiting for authorized personnel...</p>
                    )}
                </div>

                <button 
                    onClick={handleLogin}
                    disabled={isLoading}
                    className="group relative w-full py-4 bg-white text-black font-bold text-sm tracking-widest uppercase rounded-lg hover:bg-blue-50 transition-all flex items-center justify-center gap-3 overflow-hidden"
                >
                    {isLoading ? (
                        <Loader2 className="animate-spin" />
                    ) : (
                        <>
                            <span className="z-10">{isDemo ? "Enter Simulation" : "Authenticate with Google"}</span>
                            <ChevronRight className="group-hover:translate-x-1 transition-transform z-10" />
                        </>
                    )}
                    <div className="absolute inset-0 bg-blue-400/0 group-hover:bg-blue-400/10 transition-colors"></div>
                </button>
                
                {error && (
                    <div className="text-red-400 text-xs text-center mt-4 bg-red-900/20 p-2 rounded border border-red-500/20">
                        {error}
                    </div>
                )}
            </div>

            <div className="mt-8 text-center">
                <p className="text-[10px] text-gray-600 uppercase tracking-widest flex items-center justify-center gap-2">
                    <Lock size={10} />
                    Restricted Access // Auth Required
                </p>
            </div>

         </div>
      </div>

    </div>
  );
};

export default LoginPage;