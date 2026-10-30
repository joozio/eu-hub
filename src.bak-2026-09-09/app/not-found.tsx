import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-eu-blue to-eu-blue-vivid flex items-center justify-center shadow-lg shadow-blue-500/20">
          <span className="text-3xl font-bold text-white">404</span>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Page not found</h2>
        <p className="text-sm text-slate-500 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-block bg-eu-blue text-white px-6 py-2.5 rounded-xl hover:bg-eu-blue-dark font-medium text-sm transition-all hover:shadow-lg"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
