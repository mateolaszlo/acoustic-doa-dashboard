import React from 'react';
import { AlertTriangle, RotateCcw, RefreshCw } from 'lucide-react';
import { formatClientError } from '../../services/error_messages.js';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  showDetails: boolean;
  rawStack: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      showDetails: false,
      rawStack: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      errorMessage: formatClientError(error, 'An unexpected interface error occurred.'),
      rawStack: error?.stack || error?.message || '',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      errorMessage: '',
      showDetails: false,
      rawStack: '',
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-radar-dark text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-rose-500/30 bg-slate-900/90 p-6 shadow-2xl space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Something went wrong in the dashboard</h1>
              <p className="mt-1 text-sm text-slate-300 leading-relaxed">
                {this.state.errorMessage || 'A display component encountered an unexpected error.'}
              </p>
            </div>
          </div>

          {this.state.rawStack && (
            <div>
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="text-xs font-medium text-slate-400 hover:text-slate-200 underline underline-offset-2"
              >
                {this.state.showDetails ? 'Hide technical details' : 'Show technical details'}
              </button>
              {this.state.showDetails && (
                <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] text-rose-300 whitespace-pre-wrap break-all">
                  {this.state.rawStack}
                </pre>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-100 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Try Again
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
