import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  onReset: () => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in stage render:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="space-y-4 rounded-lg border border-red-200 bg-red-50 p-6 text-sm">
        <p className="font-medium text-red-700">Something went wrong rendering this step.</p>
        <p className="text-red-600">{error.message}</p>
        <Button
          variant="secondary"
          onClick={() => {
            this.setState({ error: null });
            this.props.onReset();
          }}
        >
          Start over
        </Button>
      </div>
    );
  }
}
