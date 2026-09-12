import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { jarvis } from './index';

interface Props {
  children: ReactNode;
  moduleName?: string;
  restaurantId?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const BaseComponent = (React.Component as any) as new (props: Props) => {
  props: Props;
  state: State;
  setState: (updater: Partial<State> | ((prevState: State) => Partial<State>)) => void;
  componentDidCatch?(error: Error, info: ErrorInfo): void;
};

export class JarvisErrorBoundary extends BaseComponent {
  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const rid = this.props.restaurantId || 'rbh-main-branch';
    const mod = (this.props.moduleName || 'UI') as any;

    jarvis.recordIncident({
      restaurantId: rid,
      module: mod,
      operation: 'renderComponent',
      errorCategory: 'UNKNOWN',
      rawError: error,
      context: {
        componentStack: errorInfo.componentStack?.slice(0, 300)
      },
      explicitSeverity: 'MEDIUM',
      recommendedAction: 'Inspect component render tree or refresh UI state.'
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-6 my-4 mx-auto max-w-lg bg-[#fdfbf7] border border-amber-300/80 rounded-2xl shadow-lg text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-base text-stone-900">
            Interface Component Recovered
          </h4>
          <p className="text-xs text-stone-600">
            A display issue occurred in {this.props.moduleName || 'the view'}. JARVIS has logged the diagnostic incident safely.
          </p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#5c1b1b] hover:bg-[#4a1515] text-white text-xs font-semibold shadow transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reload Component
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
