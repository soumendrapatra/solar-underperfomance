import { Component } from 'react'
import { Button } from './Button.jsx'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('[Kiran ErrorBoundary] Uncaught runtime exception:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleCopyError = () => {
    const payload = {
      message: this.state.error?.message || 'Unknown error',
      stack: this.state.error?.stack || '',
      componentStack: this.state.errorInfo?.componentStack || '',
      pathname: typeof window !== 'undefined' ? window.location.pathname : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timestamp: new Date().toISOString(),
    }

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2500)
    }
  }

  render() {
    if (this.state.hasError) {
      const componentStackLines = this.state.errorInfo?.componentStack
        ? this.state.errorInfo.componentStack
            .trim()
            .split('\n')
            .slice(0, 6)
            .join('\n')
        : null

      return (
        <div className="min-h-[420px] p-8 flex flex-col items-center justify-center text-center space-y-4 border border-fault/40 bg-paper m-4">
          <span className="font-mono text-xs uppercase tracking-wider text-fault font-semibold">
            CRUCIBLE RUNTIME EXCEPTION
          </span>
          <h2 className="font-display text-2xl text-ink font-normal">
            An engine error occurred on this screen
          </h2>
          <p className="font-mono text-xs text-fault font-medium max-w-xl bg-paper-2 p-3 border border-line">
            {this.state.error?.name || 'Error'}: {this.state.error?.message || 'Unexpected state condition encountered.'}
          </p>

          {componentStackLines && (
            <div className="w-full max-w-xl text-left space-y-1">
              <span className="label text-[10px] text-ink-2">COMPONENT STACK (FIRST 6 FRAMES)</span>
              <pre className="font-mono text-[11px] text-ink-2 bg-paper-2 p-3 border border-line whitespace-pre-wrap break-all overflow-x-auto leading-relaxed">
                {componentStackLines}
              </pre>
            </div>
          )}

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={this.handleCopyError}
            >
              {this.state.copied ? 'Copied to Clipboard' : 'Copy Error Payload'}
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={this.handleReload}
            >
              Reload Engine Workspace
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
