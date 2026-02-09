/**
 * orz.ts Error Boundary
 * 
 * React ErrorBoundary実装
 */

import React, { Component, type ReactNode, type ErrorInfo } from 'react';

// ========================================
// Types
// ========================================

export interface ErrorBoundaryProps {
    /** 子要素 */
    children: ReactNode;
    /** エラー時に表示するフォールバックUI */
    fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
    /** エラー発生時のコールバック */
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    /** リセットキー（変更時にリセット） */
    resetKeys?: unknown[];
}

export interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

// ========================================
// Error Boundary Component
// ========================================

/**
 * ErrorBoundary コンポーネント
 * 
 * @example
 * ```tsx
 * <ErrorBoundary
 *   fallback={(error, reset) => (
 *     <div>
 *       <p>エラーが発生しました: {error.message}</p>
 *       <button onClick={reset}>再試行</button>
 *     </div>
 *   )}
 *   onError={(error) => console.error('Caught error:', error)}
 * >
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        this.props.onError?.(error, errorInfo);
    }

    componentDidUpdate(prevProps: ErrorBoundaryProps): void {
        if (this.state.hasError && this.props.resetKeys) {
            const hasChanged = this.props.resetKeys.some(
                (key, index) => key !== prevProps.resetKeys?.[index]
            );
            if (hasChanged) {
                this.reset();
            }
        }
    }

    reset = (): void => {
        this.setState({ hasError: false, error: null });
    };

    render(): ReactNode {
        if (this.state.hasError && this.state.error) {
            const { fallback } = this.props;

            if (typeof fallback === 'function') {
                return fallback(this.state.error, this.reset);
            }

            if (fallback) {
                return fallback;
            }

            // Default fallback
            return React.createElement('div', {
                style: {
                    padding: '20px',
                    backgroundColor: '#fee2e2',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    color: '#991b1b',
                }
            },
                React.createElement('h2', { style: { margin: '0 0 10px 0' } }, 'Something went wrong'),
                React.createElement('p', { style: { margin: '0 0 10px 0' } }, this.state.error.message),
                React.createElement('button', {
                    onClick: this.reset,
                    style: {
                        padding: '8px 16px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                    }
                }, 'Try again')
            );
        }

        return this.props.children;
    }
}

// ========================================
// HOC Version
// ========================================

/**
 * ErrorBoundary HOC
 */
export function withErrorBoundary<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.ComponentType<P> {
    const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

    const WithErrorBoundary = (props: P) => {
        return React.createElement(
            ErrorBoundary,
            { ...errorBoundaryProps, children: null },
            React.createElement(WrappedComponent, props)
        );
    };

    WithErrorBoundary.displayName = `WithErrorBoundary(${displayName})`;

    return WithErrorBoundary;
}

// ========================================
// useErrorBoundary Hook
// ========================================

export interface UseErrorBoundaryResult {
    showBoundary: (error: Error) => void;
}

/**
 * プログラムからErrorBoundaryをトリガーするフック
 */
export function useErrorBoundary(): UseErrorBoundaryResult {
    const [, setError] = React.useState<Error | null>(null);

    const showBoundary = React.useCallback((error: Error) => {
        setError(() => {
            throw error;
        });
    }, []);

    return { showBoundary };
}
