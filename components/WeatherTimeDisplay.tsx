import React, { useState, useEffect } from 'react';

interface WeatherTimeDisplayProps {
    timezone?: string;
}

export const WeatherTimeDisplay: React.FC<WeatherTimeDisplayProps> = ({ timezone }) => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (date: Date) => {
        try {
            return date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone: timezone
            });
        } catch (e) {
            // Fallback if timezone is invalid
            return date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        }
    };

    const formatDate = (date: Date) => {
        try {
            return date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                timeZone: timezone
            });
        } catch (e) {
            return date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
        }
    };

    return (
        <div className="pointer-events-auto">
            <div className="bg-black/60 backdrop-blur-xl border border-white/20 rounded-full py-2 px-5 flex items-center gap-3 shadow-lg hover:bg-black/70 transition-colors group">
                <div className="flex flex-col items-end">
                    <div className="text-lg md:text-xl font-bold text-white font-mono tracking-wider leading-none">
                        {formatTime(time)}
                    </div>
                    <div className="text-[10px] text-gray-400 font-medium uppercase tracking-widest leading-none mt-1">
                        {formatDate(time)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WeatherTimeDisplay;
