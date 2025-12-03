import React from 'react';
import { User, UserPlus, Bell, Settings, MessageSquare } from 'lucide-react';

interface SidebarProps {
    onProfileClick: () => void;
    onAddFriendsClick?: () => void;
    onNotificationsClick?: () => void;
    onSettingsClick?: () => void;
    unreadNotifications?: number;
}

const Sidebar: React.FC<SidebarProps> = ({
    onProfileClick,
    onAddFriendsClick,
    onNotificationsClick,
    onSettingsClick,
    unreadNotifications = 0
}) => {
    return (
        <div className="absolute top-1/2 right-4 -translate-y-1/2 z-40 pointer-events-auto flex flex-col gap-2">
            <div className="bg-black/60 backdrop-blur-xl border border-white/20 rounded-full p-2 flex flex-col gap-4 shadow-2xl">

                <button
                    onClick={onProfileClick}
                    className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white transition-all active:scale-95 group relative"
                    title="Profile"
                >
                    <User size={20} />
                    <span className="absolute right-full mr-3 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        Profile
                    </span>
                </button>

                <button
                    onClick={onAddFriendsClick}
                    className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white transition-all active:scale-95 group relative"
                    title="Add Friends"
                >
                    <UserPlus size={20} />
                    <span className="absolute right-full mr-3 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        Add Friends
                    </span>
                </button>

                <button
                    onClick={onNotificationsClick}
                    className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white transition-all active:scale-95 group relative"
                    title="Notifications"
                >
                    <Bell size={20} />
                    {unreadNotifications > 0 && (
                        <div className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center animate-pulse">
                            <span className="text-white text-xs font-bold">
                                {unreadNotifications > 99 ? '99+' : unreadNotifications}
                            </span>
                        </div>
                    )}
                    <span className="absolute right-full mr-3 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        Notifications
                    </span>
                </button>

                <div className="h-[1px] bg-white/10 w-full mx-auto" />

                <button
                    onClick={onSettingsClick}
                    className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white transition-all active:scale-95 group relative"
                    title="Settings"
                >
                    <Settings size={20} />
                    <span className="absolute right-full mr-3 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        Settings
                    </span>
                </button>

            </div>
        </div>
    );
};

export default Sidebar;
