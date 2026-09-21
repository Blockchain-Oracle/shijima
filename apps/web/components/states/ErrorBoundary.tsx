'use client'

import type { Route } from 'next'
import { Component, type ReactNode } from 'react'
import { ErrorState } from './ErrorState'

interface ErrorBoundaryProps {
  children: ReactNode
  backHref?: Route
}

interface ErrorBoundaryState {
  error: Error | null
}

/** One broken panel stays one broken panel: the rest of the page keeps working. From Agari. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  override render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <ErrorState
        variant="boundary"
        diagnosis={{ kind: 'unknown', technical: error.message }}
        retry={() => this.setState({ error: null })}
        {...(this.props.backHref ? { backHref: this.props.backHref } : {})}
      />
    )
  }
}
