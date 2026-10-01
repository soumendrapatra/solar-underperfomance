import { useEffect, useRef } from 'react'

/**
 * Initializes Lenis smooth scroll on mount and destroys it on unmount.
 * Only used on the landing page — the app shell uses native scroll.
 *
 * Respects prefers-reduced-motion: if the user prefers reduced motion,
 * Lenis is not initialized and the page falls back to native scroll.
 */
export function useLenis() {
  const lenisRef = useRef(null)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    let lenis
    let raf

    async function init() {
      const { default: Lenis } = await import('lenis')
      lenis = new Lenis({ lerp: 0.08, smooth: true })
      lenisRef.current = lenis

      function loop(time) {
        lenis.raf(time)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    }

    init()

    return () => {
      cancelAnimationFrame(raf)
      lenisRef.current?.destroy()
    }
  }, [])

  return lenisRef
}

