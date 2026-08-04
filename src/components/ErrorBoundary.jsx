import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('MarkdownViewer render error:', error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-prose py-16 text-center">
          <p className="font-mono text-xs uppercase tracking-wide text-red-600 dark:text-red-400">
            Render failed
          </p>
          <p className="mt-3 text-ink dark:text-zinc-100">
            This file couldn't be displayed. It may contain a structure the
            renderer doesn't support.
          </p>
          <p className="mt-1 text-sm text-slate-650 dark:text-zinc-400">
            Try a different file, or check the raw source for unusual syntax.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
