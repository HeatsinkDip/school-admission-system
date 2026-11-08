import React from 'react';
import { STRINGS } from './strings';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container" role="alert" data-testid="error-boundary">
          <div className="card error-card">
            <h2>{STRINGS.errorBoundaryTitle}</h2>
            <p>{STRINGS.errorBoundaryMessage}</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => this.setState({ hasError: false })}
            >
              {STRINGS.errorBoundaryReload}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

