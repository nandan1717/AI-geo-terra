/**
 * Production-safe logging utility
 * Only logs debug info in development mode
 */

const isDev = import.meta.env.DEV;

export const logger = {
    /**
     * Debug logs - only shown in development
     */
    debug: (...args: unknown[]) => {
        if (isDev) {
            console.log('[DEBUG]', ...args);
        }
    },

    /**
     * Info logs - only shown in development
     */
    info: (...args: unknown[]) => {
        if (isDev) {
            console.info('[INFO]', ...args);
        }
    },

    /**
     * Warning logs - always shown
     */
    warn: (...args: unknown[]) => {
        console.warn('[WARN]', ...args);
    },

    /**
     * Error logs - always shown
     */
    error: (...args: unknown[]) => {
        console.error('[ERROR]', ...args);
    },

    /**
     * Performance timing - only in development
     */
    time: (label: string) => {
        if (isDev) {
            console.time(label);
        }
    },

    timeEnd: (label: string) => {
        if (isDev) {
            console.timeEnd(label);
        }
    },
};

export default logger;
