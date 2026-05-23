'use client';

import { Component, type ReactNode } from 'react';

type Props = { widgetName: string; children: ReactNode };
type State = { error: Error | null };

export class WidgetErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'Widget boundary caught error',
        widget: this.props.widgetName,
        err: { name: error.name, message: error.message },
      }),
    );
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          {this.props.widgetName} unavailable
        </div>
      );
    }
    return this.props.children;
  }
}
