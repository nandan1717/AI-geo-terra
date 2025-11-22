import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Target, SkipForward } from 'lucide-react';

export interface TutorialStep {
    targetId?: string;
    title: string;
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface TutorialOverlayProps {
    steps: TutorialStep[];
    onComplete: () => void;
    onSkip: () => void;
    isOpen: boolean;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ steps, onComplete, onSkip, isOpen }) => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});

    useEffect(() => {
        if (isOpen) {
            if (currentStepIndex >= steps.length) {
                setCurrentStepIndex(0);
            }
            updateTargetRect();
        }
    }, [currentStepIndex, isOpen, steps]);

    const updateTargetRect = () => {
        const step = steps[currentStepIndex];
        if (step?.targetId) {
            const element = document.getElementById(step.targetId);
            if (element) {
                const rect = element.getBoundingClientRect();
                setTargetRect(rect);
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                setTargetRect(null);
            }
        } else {
            setTargetRect(null);
        }
    };

    useEffect(() => {
        const handleResize = () => updateTargetRect();
        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', handleResize, true);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', handleResize, true);
        };
    }, [isOpen, currentStepIndex, steps]);

    // Calculate position with boundary checking
    useLayoutEffect(() => {
        if (!containerRef.current) return;

        const currentStep = steps[currentStepIndex];
        const tooltipRect = containerRef.current.getBoundingClientRect();
        const padding = 16; // Padding from screen edges
        const gap = 20; // Gap from target

        let top = 0;
        let left = 0;

        if (!targetRect || !currentStep.targetId) {
            // Center positioning
            top = window.innerHeight / 2 - tooltipRect.height / 2;
            left = window.innerWidth / 2 - tooltipRect.width / 2;
        } else {
            const position = currentStep.position || 'bottom';

            switch (position) {
                case 'top':
                    top = targetRect.top - tooltipRect.height - gap;
                    left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
                    break;
                case 'bottom':
                    top = targetRect.bottom + gap;
                    left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
                    break;
                case 'left':
                    top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
                    left = targetRect.left - tooltipRect.width - gap;
                    break;
                case 'right':
                    top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
                    left = targetRect.right + gap;
                    break;
                case 'center':
                default:
                    top = window.innerHeight / 2 - tooltipRect.height / 2;
                    left = window.innerWidth / 2 - tooltipRect.width / 2;
                    break;
            }

            // Boundary Checking & Flipping (Simple Clamp for now)
            // Clamp Left/Right
            if (left < padding) left = padding;
            if (left + tooltipRect.width > window.innerWidth - padding) {
                left = window.innerWidth - tooltipRect.width - padding;
            }

            // Clamp Top/Bottom
            if (top < padding) top = padding;
            if (top + tooltipRect.height > window.innerHeight - padding) {
                top = window.innerHeight - tooltipRect.height - padding;
            }
        }

        setTooltipStyle({
            top: `${top}px`,
            left: `${left}px`,
            position: 'fixed',
            opacity: 1,
            transform: 'none' // Reset transform since we calculate exact top/left
        });

    }, [targetRect, currentStepIndex, steps]);


    if (!isOpen || steps.length === 0) return null;

    const currentStep = steps[currentStepIndex];
    const isLastStep = currentStepIndex === steps.length - 1;

    const handleNext = () => {
        if (isLastStep) {
            onComplete();
        } else {
            setCurrentStepIndex(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(prev => prev - 1);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] pointer-events-auto font-sans">
            {/* SVG Backdrop - No Blur, Dark Overlay with Hole */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none transition-all duration-500 ease-in-out">
                <defs>
                    <mask id="spotlight-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        {targetRect && (
                            <rect
                                x={targetRect.left - 8}
                                y={targetRect.top - 8}
                                width={targetRect.width + 16}
                                height={targetRect.height + 16}
                                rx="12"
                                fill="black"
                            />
                        )}
                    </mask>
                </defs>
                {/* Dark overlay using the mask */}
                <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.7)" mask="url(#spotlight-mask)" />

                {/* Target Highlight Border */}
                {targetRect && (
                    <rect
                        x={targetRect.left - 8}
                        y={targetRect.top - 8}
                        width={targetRect.width + 16}
                        height={targetRect.height + 16}
                        rx="12"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2"
                        className="animate-pulse"
                    />
                )}
            </svg>

            {/* Tooltip Card */}
            <div
                ref={containerRef}
                className="absolute w-[90vw] max-w-sm bg-black/40 backdrop-blur-xl border border-blue-500/50 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col transition-all duration-300 ease-out overflow-hidden"
                style={{ ...tooltipStyle, opacity: tooltipStyle.opacity || 0 }} // Start invisible until layout effect runs
            >
                {/* Glass Shine Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>

                <div className="p-6 relative z-10">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold shadow-lg shadow-blue-600/50">
                                {currentStepIndex + 1}
                            </span>
                            <h3 className="text-lg font-bold text-white tracking-tight">{currentStep.title}</h3>
                        </div>
                        <button onClick={onSkip} className="text-white/50 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-full">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="text-gray-200 text-sm leading-relaxed mb-6 font-medium">
                        {currentStep.content}
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex gap-1">
                            {steps.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === currentStepIndex ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'bg-white/20'}`}
                                />
                            ))}
                        </div>

                        <div className="flex gap-2">
                            {currentStepIndex > 0 && (
                                <button
                                    onClick={handlePrev}
                                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-colors"
                                >
                                    Back
                                </button>
                            )}
                            <button
                                onClick={handleNext}
                                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center gap-1.5 group"
                            >
                                {isLastStep ? 'Finish' : 'Next'}
                                {!isLastStep && <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TutorialOverlay;
