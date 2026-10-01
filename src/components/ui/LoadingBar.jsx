/** Global top-of-viewport loading bar shown while async chunks load. */
export function LoadingBar() {
  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      className="fixed top-0 left-0 right-0 z-50 h-[2px] bg-accent animate-pulse"
    />
  )
}

export default LoadingBar
