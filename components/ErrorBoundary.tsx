import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    // Explicitly define props to satisfy strict linter
    public readonly props: Props;

    constructor(props: Props) {
        super(props);
        this.props = props;
    }

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="w-full h-screen bg-black flex flex-col items-center justify-center text-white p-4">
                    <div className="bg-red-900/20 border border-red-500/50 rounded-2xl p-8 max-w-md w-full text-center backdrop-blur-xl">
                        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
                        <h1 className="text-2xl font-bold mb-2">System Critical Failure</h1>
                        <p className="text-gray-400 mb-6">
                            The interface has encountered an unexpected anomaly.
                            <br />
                            <span className="text-xs font-mono text-red-400 mt-2 block">
                                {this.state.error?.message}
                            </span>
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 mx-auto w-full"
                        >
                            <RefreshCw size={18} />
                            Reboot System
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
