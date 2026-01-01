import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Star, Loader2, LifeBuoy } from 'lucide-react';
import { supportService, SupportMessage } from '../services/supportService';

interface SupportChatProps {
    userId: string;
}

const SupportChat: React.FC<SupportChatProps> = ({ userId }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<SupportMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const [rating, setRating] = useState(0);
    const [feedbackText, setFeedbackText] = useState('');

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && !sessionId) {
            initializeSession();
        }
    }, [isOpen]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const initializeSession = async () => {
        setIsLoading(true);
        try {
            const session = await supportService.createSession(userId);
            setSessionId(session.id);
            // Add initial greeting
            setMessages([{
                id: 'init',
                role: 'assistant',
                content: "Hello! I'm Atlas, your support specialist. How can I assist you with your exploration today?",
                createdAt: new Date()
            }]);
        } catch (error) {
            console.error("Failed to init support session", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async () => {
        if (!inputValue.trim() || !sessionId) return;

        const userMsg: SupportMessage = {
            id: `temp-${Date.now()}`,
            role: 'user',
            content: inputValue,
            createdAt: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsLoading(true);

        try {
            const aiMsg = await supportService.sendMessage(sessionId, userId, userMsg.content);
            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            console.error("Failed to send message", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmitFeedback = async () => {
        if (!sessionId) return;
        try {
            await supportService.submitFeedback(sessionId, userId, rating, feedbackText);
            setIsOpen(false);
            setSessionId(null);
            setMessages([]);
            setRating(0);
            setFeedbackText('');
            setShowFeedback(false);
        } catch (error) {
            console.error("Failed to submit feedback", error);
        }
    };

    return (
        <>
            {/* Floating Action Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-50 p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95 group"
                >
                    <LifeBuoy size={24} className="group-hover:rotate-12 transition-transform" />
                    <span className="absolute -top-2 -right-2 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
                    <span className="absolute -top-2 -right-2 w-3 h-3 bg-red-500 rounded-full"></span>
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 w-full h-full sm:w-96 sm:h-[500px] bg-black/90 backdrop-blur-xl border-none sm:border border-white/10 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">

                    {/* Header */}
                    <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <div>
                                <h3 className="font-bold text-white text-sm">Atlas Support</h3>
                                <p className="text-xs text-blue-400">AI Specialist // Online</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    if (!showFeedback) {
                                        setShowFeedback(true);
                                    } else {
                                        setIsOpen(false);
                                    }
                                }}
                                className="text-gray-400 hover:text-white transition-colors p-2"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    {!showFeedback ? (
                        <>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                {messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.role === 'user'
                                                ? 'bg-blue-600 text-white rounded-tr-none'
                                                : 'bg-white/10 text-gray-200 rounded-tl-none'
                                                }`}
                                        >
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-white/10 p-3 rounded-2xl rounded-tl-none">
                                            <Loader2 size={16} className="animate-spin text-gray-400" />
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="p-4 border-t border-white/10 bg-black/50">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                        placeholder="Type your issue..."
                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={!inputValue.trim() || isLoading}
                                        className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
                            <h3 className="text-xl font-bold text-white mb-2">Session Complete</h3>
                            <p className="text-sm text-gray-400 mb-8">How would you rate your experience with Mortals?</p>

                            <div className="flex gap-2 mb-8">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        onClick={() => setRating(star)}
                                        className={`transition-all hover:scale-110 ${rating >= star ? 'text-yellow-400' : 'text-gray-600'}`}
                                    >
                                        <Star size={32} fill={rating >= star ? "currentColor" : "none"} />
                                    </button>
                                ))}
                            </div>

                            <textarea
                                value={feedbackText}
                                onChange={(e) => setFeedbackText(e.target.value)}
                                placeholder="Any additional feedback? (Optional)"
                                className="w-full h-24 bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white mb-4 focus:outline-none focus:border-blue-500/50 resize-none"
                            />

                            <button
                                onClick={handleSubmitFeedback}
                                disabled={rating === 0}
                                className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Submit Feedback
                            </button>

                            <button
                                onClick={() => setShowFeedback(false)}
                                className="mt-4 text-xs text-gray-500 hover:text-white transition-colors"
                            >
                                Return to Chat
                            </button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default SupportChat;
