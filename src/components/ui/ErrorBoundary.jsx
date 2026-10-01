import { Component } from 'react'
import { Button } from './Button.jsx'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Kiran ErrorBoundary] Uncaught runtime exception:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[380px] p-8 flex flex-col items-center justify-center text-center space-y-4 border border-fault/30 bg-paper m-4">
          <span className="font-mono text-xs uppercase tracking-wider text-fault font-semibold">
            CRUCIBLE RUNTIME EXCEPTION
          </span>
          <h2 className="font-display text-2xl text-ink font-normal">
            An engine error occurred on this screen
          </h2>
          <p className="font-mono text-xs text-ink-2 max-w-md bg-paper-2 p-3 border border-line">
            {this.state.error?.message || 'Unexpected state condition encountered.'}
          </p>
          <div className="pt-2">
            <Button variant="primary" size="md" onClick={this.handleReload}>
              Reload Engine Workspace
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
