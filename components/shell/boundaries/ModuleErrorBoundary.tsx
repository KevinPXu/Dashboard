'use client';

import Link from 'next/link';
import { Component, type ReactNode } from 'react';

type Props = { moduleName: string; children: ReactNode };
type State = { error: Error | null };

export class ModuleErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.error(
      JSON.stringify({
        level: 'error',
        moduleId: this.props.moduleName,
        message: 'Module boundary caught error',
        err: { name: error.name, message: error.message, stack: error.stack },
      }),
    );
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium">{this.props.moduleName} is having problems.</p>
          <p className="mt-1 text-slate-600">
            The rest of the dashboard is still working.{' '}
            <Link href="/" className="underline">
              Back to home
            </Link>
            .
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
