import Link from 'next/link'

export default function NotFound() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-ac-taupe text-ac-sand px-6 text-center">
            <h2 className="font-serif text-6xl md:text-9xl mb-4 text-ac-beige">404</h2>
            <p className="font-sans text-xl md:text-2xl mb-8 tracking-wide">
                Style not found. This page is out of fashion.
            </p>
            <Link
                href="/"
                className="px-8 py-3 bg-ac-beige text-ac-taupe font-sans uppercase tracking-widest text-sm font-semibold hover:bg-white transition-colors duration-300"
            >
                Return Home
            </Link>
        </div>
    )
}
