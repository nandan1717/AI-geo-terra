
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

export interface TutorialStep {
    targetId?: string;
    title: string;
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
    icon?: React.ReactNode;
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
    const [isAnimating, setIsAnimating] = useState(false);
    const [arrowPosition, setArrowPosition] = useState<React.CSSProperties>({});

    useEffect(() => {
        if (isOpen) {
            if (currentStepIndex >= steps.length) {
                setCurrentStepIndex(0);
            }
            setIsAnimating(true);
            setTimeout(() => setIsAnimating(false), 300);
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

    // Enhanced Positioning Logic to Prevent Overlap
    useLayoutEffect(() => {
        if (!containerRef.current) return;

        const currentStep = steps[currentStepIndex];
        const tooltip = containerRef.current;
        const tooltipRect = tooltip.getBoundingClientRect();

        // Gap between target/cursor and tooltip
        const gap = 16;
        const padding = 16; // Screen edge padding

        let top = 0;
        let left = 0;
        let placement = currentStep.position || 'bottom';

        if (!targetRect || !currentStep.targetId) {
            // Center Screen
            top = window.innerHeight / 2 - tooltipRect.height / 2;
            left = window.innerWidth / 2 - tooltipRect.width / 2;
        } else {
            // Try preferred position first
            const positions = {
                top: {
                    top: targetRect.top - tooltipRect.height - gap,
                    left: targetRect.left + (targetRect.width - tooltipRect.width) / 2
                },
                bottom: {
                    top: targetRect.bottom + gap,
                    left: targetRect.left + (targetRect.width - tooltipRect.width) / 2
                },
                left: {
                    top: targetRect.top + (targetRect.height - tooltipRect.height) / 2,
                    left: targetRect.left - tooltipRect.width - gap
                },
                right: {
                    top: targetRect.top + (targetRect.height - tooltipRect.height) / 2,
                    left: targetRect.right + gap
                }
            };

            // Basic Flip Logic if out of bounds (simplified)
            // If preferred position causes overlap or goes off screen, flip it.
            // For now, let's just use the requested position but clamp it to screen
            // AND ensure we don't clamp it ONTO the target.

            let pos = positions[placement as keyof typeof positions] || positions.bottom;

            // Screen Boundary Check
            if (pos.left < padding) pos.left = padding;
            if (pos.left + tooltipRect.width > window.innerWidth - padding) {
                pos.left = window.innerWidth - tooltipRect.width - padding;
            }
            if (pos.top < padding) pos.top = padding;
            if (pos.top + tooltipRect.height > window.innerHeight - padding) {
                pos.top = window.innerHeight - tooltipRect.height - padding;
            }

            // CRITICAL: Overlap Prevention
            // If after clamping we are overlapping the target, we must move it.
            // This usually happens on mobile where "left" clamp pushes it right onto the element.
            // In that case, we switch to Top/Bottom.

            const isOverlapping = !(
                pos.left > targetRect.right ||
                pos.left + tooltipRect.width < targetRect.left ||
                pos.top > targetRect.bottom ||
                pos.top + tooltipRect.height < targetRect.top
            );

            if (isOverlapping) {
                // If horizontal overlap, try pushing top/bottom
                if (placement === 'left' || placement === 'right') {
                    // Try bottom first
                    if (targetRect.bottom + tooltipRect.height + gap < window.innerHeight) {
                        pos.top = targetRect.bottom + gap;
                        // Center horizontally
                        pos.left = window.innerWidth / 2 - tooltipRect.width / 2;
                    } else {
                        // Go top
                        pos.top = targetRect.top - tooltipRect.height - gap;
                        pos.left = window.innerWidth / 2 - tooltipRect.width / 2;
                    }
                }
            }

            top = pos.top;
            left = pos.left;
        }

        setTooltipStyle({
            top: `${top}px`,
            left: `${left}px`,
            position: 'fixed',
            opacity: 1,
            transform: 'none'
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
            {/* 1. No Backdrop - App is fully visible as requested */}

            {/* 2. Target Highlight (Focused Ring Glow) */}
            {targetRect && (
                <div
                    className="absolute pointer-events-none transition-all duration-500 ease-out rounded-xl"
                    style={{
                        top: targetRect.top - 6,
                        left: targetRect.left - 6,
                        width: targetRect.width + 12,
                        height: targetRect.height + 12,
                        // Blue focus ring with subtle outer glow - no screen dimming
                        boxShadow: '0 0 0 2px rgba(96, 165, 250, 0.8), 0 0 20px rgba(96, 165, 250, 0.4)',
                        border: '1px solid rgba(255,255,255,0.2)'
                    }}
                />
            )}

            {/* 3. Dark Glass Card */}
            <div
                ref={containerRef}
                className={`absolute w-[90vw] max-w-[340px] flex flex-col transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) ${isAnimating ? 'opacity-0 scale-95 translate-y-2' : 'opacity-100 scale-100 translate-y-0'}`}
                style={{ ...tooltipStyle }}
            >
                <div className="bg-black/40 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden relative">
                    {/* Inner Gradient Shine */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>

                    {/* Content */}
                    <div className="p-6 md:p-8 relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <span className="text-xs font-bold tracking-wider text-white/40 uppercase">
                                {currentStepIndex + 1} / {steps.length}
                            </span>
                            <button
                                onClick={onSkip}
                                className="text-white/40 hover:text-white transition-colors p-1 -mr-2 -mt-2"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <h3 className="text-xl font-bold mb-3 tracking-tight text-white leading-snug">
                            {currentStep.title}
                        </h3>

                        <p className="text-gray-300 font-medium leading-relaxed text-[15px]">
                            {currentStep.content}
                        </p>
                    </div>

                    {/* Footer Nav */}
                    <div className="px-6 pb-6 md:px-8 md:pb-8 flex items-center justify-between mt-2 relative z-10">
                        {/* Progress Bar */}
                        <div className="flex gap-1.5 bg-white/5 p-1 rounded-full border border-white/5">
                            {steps.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === currentStepIndex ? 'bg-blue-400 scale-125 shadow-[0_0_8px_rgba(96,165,250,0.5)]' : 'bg-white/20'
                                        }`}
                                />
                            ))}
                        </div>

                        <div className="flex gap-3">
                            {currentStepIndex > 0 && (
                                <button
                                    onClick={handlePrev}
                                    className="w-10 h-10 rounded-full flex items-center justify-center border border-white/10 text-white hover:bg-white/10 transition-all active:scale-95"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                            )}
                            <button
                                onClick={handleNext}
                                className={`h-10 px-5 rounded-full flex items-center gap-2 font-bold text-sm transition-all active:scale-95 shadow-lg ${isLastStep
                                    ? 'bg-blue-500 hover:bg-blue-400 text-white shadow-blue-500/20'
                                    : 'bg-white text-black hover:bg-gray-200 shadow-white/10'
                                    }`}
                            >
                                {isLastStep ? "Let's Go" : 'Next'}
                                {!isLastStep && <ChevronRight size={16} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TutorialOverlay;
