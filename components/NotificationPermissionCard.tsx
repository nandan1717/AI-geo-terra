import React, { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { requestForToken } from '../services/firebase';

interface NotificationPermissionCardProps {
    onPermissionGranted: (token: string) => void;
    onDismiss: () => void;
}

const NotificationPermissionCard: React.FC<NotificationPermissionCardProps> = ({ onPermissionGranted, onDismiss }) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleAllow = async () => {
        setIsLoading(true);
        try {
            const token = await requestForToken();
            if (token) {
                onPermissionGranted(token);
            } else {
                // Permission denied or error
                onDismiss();
            }
        } catch (error) {
            console.error("Error requesting permission:", error);
            onDismiss();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="absolute top-20 right-4 z-50 w-80 bg-black/80 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-5 shadow-[0_0_30px_rgba(59,130,246,0.2)] animate-in slide-in-from-right-10 duration-500 pointer-events-auto">
            <button
                onClick={onDismiss}
                className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
            >
                <X size={16} />
            </button>

            <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-3 relative">
                    <Bell size={24} className="text-blue-400" />
                    <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
                    <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full"></span>
                </div>

                <h3 className="text-white font-bold text-lg mb-1">Enable Notifications?</h3>
                <p className="text-sm text-gray-300 mb-4 leading-relaxed">
                    Get real-time updates when new locals are discovered or when friends connect.
                </p>

                <div className="flex gap-3 w-full">
                    <button
                        onClick={onDismiss}
                        className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm font-medium transition-colors"
                    >
                        Later
                    </button>
                    <button
                        onClick={handleAllow}
                        disabled={isLoading}
                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50"
                    >
                        {isLoading ? 'Allowing...' : 'Allow'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotificationPermissionCard;
