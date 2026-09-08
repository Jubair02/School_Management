import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

/**
 * Subscribes to the viewport media query.
 *
 * useSyncExternalStore rather than useState + useEffect: the previous version
 * seeded state by calling setState inside the effect, which renders once with
 * the wrong value and then immediately again. Here the first render already
 * reads the real value, and the server snapshot returns false so SSR output
 * stays deterministic.
 */
function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches
}

function getServerSnapshot(): boolean {
  return false
}

export function useIsMobile(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
