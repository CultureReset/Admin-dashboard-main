/**
 * Per-section error boundary.
 *
 * One section throwing must not blank the whole dashboard — the shell and the
 * sidebar stay usable and only the failed panel reports the problem.
 */

import { Component } from 'react';
import { Button, Card } from '../ui/primitives.jsx';

export class SectionBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the stack in the console for debugging; the UI stays calm.
    console.error(`[${this.props.moduleId}] section crashed`, error, info);
  }

  componentDidUpdate(prevProps) {
    // Clear the error when the user navigates to a different section.
    if (prevProps.moduleId !== this.props.moduleId && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <Card title={`${this.props.label || 'This section'} could not be displayed`}>
        <div className="stack">
          <p className="muted">{error.message || String(error)}</p>
          <p className="faint mono" style={{ whiteSpace: 'pre-wrap' }}>
            {(error.stack || '').split('\n').slice(0, 4).join('\n')}
          </p>
          <div>
            <Button variant="primary" onClick={() => this.setState({ error: null })}>
              Retry
            </Button>
          </div>
        </div>
      </Card>
    );
  }
}

export default SectionBoundary;
