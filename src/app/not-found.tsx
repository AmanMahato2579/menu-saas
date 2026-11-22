import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-gray-50">
      <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl p-7 text-center">
        <div className="text-4xl mb-3">🔍</div>
        <h1 className="text-xl font-bold text-gray-900">Page not found</h1>
        <p className="text-gray-500 mt-2 text-sm">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex w-full h-12 items-center justify-center rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}