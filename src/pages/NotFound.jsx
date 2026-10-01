import { Link } from 'react-router-dom'

/** 404 page. */
export default function NotFound() {
  return (
    <main className="min-h-screen bg-paper flex flex-col items-center justify-center gap-4">
      <p className="label text-ink-2">404 — Page not found</p>
      <Link to="/" className="label text-accent underline underline-offset-4">
        Return to landing
      </Link>
    </main>
  )
}

