import React, { useState } from 'react';
import { ChevronRight, Globe, Users, MessageSquare, Radio, Map, Star } from 'lucide-react';

interface IntroCarouselProps {
    onComplete: () => void;
}

const slides = [
    {
        id: 1,
        title: "Explore the World",
        description: "Navigate a high-fidelity 3D globe to discover cities, landscapes, and hidden gems across the planet.",
        icon: <Globe size={64} className="text-blue-400" />,
        bgGradient: "from-blue-900/40 to-black"
    },
    {
        id: 2,
        title: "Connect with Locals",
        description: "Meet AI-powered personas representing the local population of any region you visit.",
        icon: <Users size={64} className="text-green-400" />,
        bgGradient: "from-green-900/40 to-black"
    },
    {
        id: 3,
        title: "Real-time Intelligence",
        description: "Access live weather data, local time, and environmental conditions for any coordinate.",
        icon: <Radio size={64} className="text-purple-400" />,
        bgGradient: "from-purple-900/40 to-black"
    },
    {
        id: 4,
        title: "Dynamic Conversations",
        description: "Engage in meaningful dialogue with locals to learn about their culture, daily life, and stories.",
        icon: <MessageSquare size={64} className="text-yellow-400" />,
        bgGradient: "from-yellow-900/40 to-black"
    },
    {
        id: 5,
        title: "Mission Control",
        description: "Complete objectives and missions to uncover the secrets of the simulation.",
        icon: <Map size={64} className="text-red-400" />,
        bgGradient: "from-red-900/40 to-black"
    },
    {
        id: 6,
        title: "Begin Your Journey",
        description: "Initialize your commander profile and start your exploration of Earth.",
        icon: <Star size={64} className="text-cyan-400" />,
        bgGradient: "from-cyan-900/40 to-black"
    }
];

const IntroCarousel: React.FC<IntroCarouselProps> = ({ onComplete }) => {
    const [currentSlide, setCurrentSlide] = useState(0);

    const nextSlide = () => {
        if (currentSlide < slides.length - 1) {
            setCurrentSlide(prev => prev + 1);
        } else {
            onComplete();
        }
    };

    const skip = () => {
        onComplete();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black text-white overflow-hidden">
            {/* Background Effects */}
            <div className={`absolute inset-0 bg-gradient-to-b ${slides[currentSlide].bgGradient} transition-colors duration-700 ease-in-out`}></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>

            <div className="relative z-10 w-full max-w-md p-8 flex flex-col items-center text-center h-full justify-center">

                {/* Content Area */}
                <div className="flex-1 flex flex-col items-center justify-center w-full">
                    <div className="mb-12 p-8 bg-white/5 rounded-full border border-white/10 backdrop-blur-sm shadow-2xl animate-in zoom-in duration-500 key={currentSlide}">
                        {slides[currentSlide].icon}
                    </div>

                    <h2 className="text-3xl font-bold mb-4 tracking-tight animate-in slide-in-from-bottom-4 duration-500 key={currentSlide}-title">
                        {slides[currentSlide].title}
                    </h2>

                    <p className="text-gray-400 text-lg leading-relaxed max-w-xs animate-in slide-in-from-bottom-8 duration-500 delay-100 key={currentSlide}-desc">
                        {slides[currentSlide].description}
                    </p>
                </div>

                {/* Navigation */}
                <div className="w-full mt-auto pt-8">
                    {/* Dots */}
                    <div className="flex justify-center gap-2 mb-8">
                        {slides.map((_, index) => (
                            <div
                                key={index}
                                className={`h-1.5 rounded-full transition-all duration-300 ${index === currentSlide ? 'w-8 bg-white' : 'w-2 bg-white/20'
                                    }`}
                            />
                        ))}
                    </div>

                    {/* Buttons */}
                    <div className="space-y-4">
                        <button
                            onClick={nextSlide}
                            className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-100 transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                            <span>{currentSlide === slides.length - 1 ? "Get Started" : "Next"}</span>
                            <ChevronRight size={20} />
                        </button>

                        {currentSlide < slides.length - 1 && (
                            <button
                                onClick={skip}
                                className="w-full py-3 text-gray-500 font-medium hover:text-white transition-colors text-sm"
                            >
                                Skip Intro
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IntroCarousel;
