import React from 'react';
import { User, UserPlus, Bell, Settings, MessageCircle, Globe, PlusSquare } from 'lucide-react';

interface SidebarProps {
    onProfileClick: () => void;
    onChatsClick?: () => void;
    onRealFriendsClick?: () => void;
    onNotificationsClick?: () => void;
    onNewsClick?: () => void;
    onPostClick?: () => void;
    onSettingsClick?: () => void; // Added Settings Handler
    unreadNotifications?: number;
    profileId?: string;
    chatsId?: string;
    addFriendsId?: string;
    notificationsId?: string;
    userImage?: string;
}

const Sidebar: React.FC<SidebarProps> = ({
    onProfileClick,
    onChatsClick,
    onRealFriendsClick,
    onNotificationsClick,
    onNewsClick,
    onPostClick,
    onSettingsClick, // Destructure
    unreadNotifications = 0,
    profileId,
    chatsId,
    addFriendsId,
    notificationsId,
    userImage
}) => {
    return (
        <div className="absolute top-1/2 right-4 -translate-y-1/2 z-[60] pointer-events-auto flex flex-col gap-2">
            <div className="bg-black/60 backdrop-blur-xl border border-white/20 rounded-full p-2 flex flex-col gap-4 shadow-2xl">

                {/* 1. Profile */}
                <button
                    id={profileId}
                    onClick={onProfileClick}
                    className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white transition-all active:scale-95 group relative"
                    title="Profile"
                >
                    {userImage ? (
                        <div className="w-6 h-6 rounded-full overflow-hidden ring-1 ring-white/30">
                            <img src={userImage} alt="Profile" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <User size={20} />
                    )}
                    <span className="absolute right-full mr-3 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        Profile
                    </span>
                </button>

                {/* 2. Chats (AI) */}
                <button
                    id={chatsId}
                    onClick={onChatsClick}
                    className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white transition-all active:scale-95 group relative"
                    title="AI Chats"
                >
                    <MessageCircle size={20} />
                    <span className="absolute right-full mr-3 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        Chats
                    </span>
                </button>

                {/* 3. Add Friends (Real Users) */}
                <button
                    id={addFriendsId}
                    onClick={onRealFriendsClick}
                    className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white transition-all active:scale-95 group relative"
                    title="Add Friends"
                >
                    <UserPlus size={20} />
                    <span className="absolute right-full mr-3 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        Add Friends
                    </span>
                </button>

                {/* 4. Notifications */}
                <button
                    id={notificationsId}
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

                {/* 5. Post (Moved Up) */}
                <button
                    onClick={onPostClick}
                    className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-blue-400 transition-all active:scale-95 group relative animate-in zoom-in"
                    title="New Post"
                >
                    <PlusSquare size={20} />
                    <span className="absolute right-full mr-3 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        New Post
                    </span>
                </button>

                {/* 6. Settings (Moved Here from UIOverlay) */}
                <button
                    onClick={onSettingsClick}
                    className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-400 transition-all active:scale-95 group relative"
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
