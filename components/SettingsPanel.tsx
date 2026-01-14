import React from 'react';
import { X, LogOut, HelpCircle, User as UserIcon, Trash2 } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import InterestManager from './InterestManager';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onSignOut: () => void;
    onRestartTutorial?: () => void;
    userEmail?: string;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
    isOpen,
    onClose,
    onSignOut,
    onRestartTutorial,
    userEmail
}) => {
    const handleDeleteAccount = async () => {
        if (!confirm('Are you sure you want to delete your account? This action is irreversible and will delete all your data.')) {
            return;
        }

        const confirmation = prompt('Type "DELETE" to confirm account deletion:');
        if (confirmation !== 'DELETE') {
            alert('Account deletion cancelled.');
            return;
        }

        try {
            const { error } = await supabase.rpc('delete_own_account');
            if (error) throw error;

            alert('Your account has been deleted.');
            onSignOut();
            onClose();
        } catch (error: any) {
            console.error('Error deleting account:', error);
            alert('Failed to delete account: ' + (error.message || 'Unknown error'));
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Settings Panel */}
            <div className="fixed top-1/2 md:right-24 right-4 -translate-y-1/2 w-[calc(100%-2rem)] md:w-80 max-w-sm bg-black/90 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl z-[60] animate-in slide-in-from-right-10 duration-300 pointer-events-auto">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-2">
                    {/* User Info */}
                    {userEmail && (
                        <div className="p-3 bg-white/5 rounded-lg border border-white/10 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                                    <UserIcon size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-400">Signed in as</p>
                                    <p className="text-sm text-white font-medium truncate">{userEmail}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Restart Tutorial */}
                    {onRestartTutorial && (
                        <button
                            onClick={() => {
                                onRestartTutorial();
                                onClose();
                            }}
                            className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-lg text-left transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/30 transition-colors">
                                    <HelpCircle size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white">Restart Tutorial</p>
                                    <p className="text-xs text-gray-400">Learn how to use Mortals</p>
                                </div>
                            </div>
                        </button>
                    )}

                    {/* Sign Out */}
                    <button
                        onClick={() => {
                            if (confirm('Are you sure you want to sign out?')) {
                                onSignOut();
                                onClose();
                            }
                        }}
                        className="w-full p-3 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-left transition-colors group border border-red-500/20"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 group-hover:bg-red-500/30 transition-colors">
                                <LogOut size={20} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-red-400">Sign Out</p>
                                <p className="text-xs text-gray-400">End your session</p>
                            </div>
                        </div>
                    </button>

                    {/* Interest Manager */}
                    <div className="bg-white/5 rounded-lg border border-white/10 p-3 mb-4">
                        <InterestManager userId={userEmail || 'anon'} />
                        {/* Note: ideally we pass userId. userEmail is passed, assuming we have ID available or can fetch. 
                            For now, assuming userEmail might be the ID or we need to pass ID from parent.
                            Wait, SettingsPanelProps receives userEmail. I should probably ensure I have userId.
                            If not available, I might need to fetch it or assume it's context.
                            
                            Let's check App.tsx to see what is passed to SettingsPanel.
                        */}
                    </div>

                    {/* Danger Zone */}
                    <div className="pt-4 mt-4 border-t border-white/10">
                        <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3 px-1">Danger Zone</p>

                        <button
                            onClick={handleDeleteAccount}
                            className="w-full p-3 bg-red-900/10 hover:bg-red-900/20 border border-red-500/20 rounded-lg text-left transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 group-hover:bg-red-500/20 transition-colors">
                                    <Trash2 size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-red-500">Delete Account</p>
                                    <p className="text-xs text-red-400/60">Permanently remove your data</p>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default SettingsPanel;
