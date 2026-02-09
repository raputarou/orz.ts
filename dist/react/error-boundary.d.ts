/**
 * orz.ts Error Boundary
 *
 * React ErrorBoundary実装
 */
import React, { Component, type ReactNode, type ErrorInfo } from 'react';
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
export declare class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps);
    static getDerivedStateFromError(error: Error): ErrorBoundaryState;
    componentDidCatch(error: Error, errorInfo: ErrorInfo): void;
    componentDidUpdate(prevProps: ErrorBoundaryProps): void;
    reset: () => void;
    render(): ReactNode;
}
/**
 * ErrorBoundary HOC
 */
export declare function withErrorBoundary<P extends object>(WrappedComponent: React.ComponentType<P>, errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>): React.ComponentType<P>;
export interface UseErrorBoundaryResult {
    showBoundary: (error: Error) => void;
}
/**
 * プログラムからErrorBoundaryをトリガーするフック
 */
export declare function useErrorBoundary(): UseErrorBoundaryResult;
//# sourceMappingURL=error-boundary.d.ts.map