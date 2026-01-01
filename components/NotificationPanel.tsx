import React, { useEffect, useState } from 'react';
import { X, Bell, Check, Trash2, UserPlus, LogIn, LogOut, Lightbulb, AlertCircle, Sparkles } from 'lucide-react';
import { Notification, NotificationType } from '../types';

interface NotificationPanelProps {
    isOpen: boolean;
    onClose: () => void;
    notifications: Notification[];
    userId: string;
    onMarkAsRead: (id: string) => void;
    onMarkAllAsRead: () => void;
    onDelete: (id: string) => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({
    isOpen,
    onClose,
    notifications,
    userId,
    onMarkAsRead,
    onMarkAllAsRead,
    onDelete
}) => {
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsAnimating(true);
        }
    }, [isOpen]);

    const handleClose = () => {
        setIsAnimating(false);
        setTimeout(onClose, 300);
    };

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.read) {
            onMarkAsRead(notification.id);
        }
    };

    const handleDelete = (e: React.MouseEvent, notificationId: string) => {
        e.stopPropagation();
        onDelete(notificationId);
    };

    const getNotificationIcon = (type: NotificationType) => {
        switch (type) {
            case 'FRIEND_REQUEST':
                return <UserPlus size={20} className="text-blue-400" />;
            case 'FRIEND_ACCEPTED':
                return <UserPlus size={20} className="text-green-400" />;
            case 'LOGIN':
                return <LogIn size={20} className="text-cyan-400" />;
            case 'LOGOUT':
                return <LogOut size={20} className="text-orange-400" />;
            case 'APP_TIP':
                return <Lightbulb size={20} className="text-yellow-400" />;
            case 'WELCOME':
                return <Sparkles size={20} className="text-purple-400" />;
            case 'SYSTEM':
                return <AlertCircle size={20} className="text-gray-400" />;
            default:
                return <Bell size={20} className="text-white" />;
        }
    };

    const formatTimestamp = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    if (!isOpen && !isAnimating) return null;

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'
                    }`}
                onClick={handleClose}
            />

            {/* Panel */}
            <div
                className={`fixed inset-0 sm:top-4 sm:right-4 sm:bottom-4 sm:left-auto sm:w-[400px] bg-black/80 backdrop-blur-2xl border-l sm:border border-white/10 z-50 shadow-2xl transition-all duration-500 ease-out sm:rounded-3xl overflow-hidden flex flex-col pointer-events-auto ${isAnimating ? 'translate-x-0 opacity-100' : 'translate-x-full sm:translate-x-[120%] opacity-0'
                    }`}
            >
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between p-5 border-b border-white/5 bg-white/5 relative z-20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-white/10">
                            <Bell size={18} className="text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-wide">Notifications</h2>
                            {unreadCount > 0 && (
                                <p className="text-[11px] font-medium text-blue-400 uppercase tracking-wider">{unreadCount} New Updates</p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all cursor-pointer relative z-30"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Mark All as Read Button */}
                {unreadCount > 0 && (
                    <div className="flex-shrink-0 px-5 py-3 border-b border-white/5 bg-white/[0.02] relative z-20">
                        <button
                            onClick={() => {
                                console.log('Mark all read clicked');
                                onMarkAllAsRead();
                            }}
                            className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-2 transition-colors uppercase tracking-wider cursor-pointer relative z-30"
                        >
                            <Check size={14} />
                            Mark all as read
                        </button>
                    </div>
                )}

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 relative z-10">
                    {notifications.length === 0 ? (
                        // Empty State
                        <div className="flex flex-col items-center justify-center h-full text-center px-6">
                            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                <Bell size={32} className="text-white/20" />
                            </div>
                            <h3 className="text-lg font-semibold text-white/60 mb-2">No notifications</h3>
                            <p className="text-sm text-white/40">
                                You're all caught up! New notifications will appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    onClick={() => {
                                        console.log('Notification item clicked:', notification.id);
                                        handleNotificationClick(notification);
                                    }}
                                    className={`mb-2 p-4 rounded-2xl transition-all cursor-pointer group relative border border-transparent ${!notification.read
                                        ? 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20'
                                        : 'hover:bg-white/5 hover:border-white/10'
                                        }`}
                                >
                                    {/* Unread Indicator */}
                                    {!notification.read && (
                                        <div className="absolute right-4 top-4 w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)] animate-pulse" />
                                    )}

                                    <div className="flex gap-4">
                                        {/* Icon */}
                                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border border-white/10 ${!notification.read ? 'bg-blue-500/20' : 'bg-white/5'
                                            }`}>
                                            {getNotificationIcon(notification.type)}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 pt-0.5">
                                            <h4 className={`text-sm font-bold mb-1 leading-tight ${notification.read ? 'text-white/60' : 'text-white'
                                                }`}>
                                                {notification.title}
                                            </h4>
                                            <p className={`text-xs leading-relaxed mb-2 ${notification.read ? 'text-white/40' : 'text-white/70'
                                                }`}>
                                                {notification.message}
                                            </p>
                                            <p className="text-[10px] font-medium text-white/30 uppercase tracking-wider flex items-center gap-1">
                                                {formatTimestamp(notification.createdAt)}
                                            </p>
                                        </div>

                                        {/* Delete Button */}
                                        <button
                                            onClick={(e) => {
                                                console.log('Delete clicked for:', notification.id);
                                                handleDelete(e, notification.id);
                                            }}
                                            className="absolute bottom-3 right-3 w-7 h-7 rounded-full hover:bg-red-500/20 flex items-center justify-center text-white/20 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100 z-20 cursor-pointer"
                                            title="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Custom Scrollbar Styles */}
            <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
        </>
    );
};

export default NotificationPanel;
