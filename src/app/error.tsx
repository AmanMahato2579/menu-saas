"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-gray-50">
      <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl p-7 text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <h1 className="text-xl font-bold text-gray-900">Something went wrong</h1>
        <p className="text-gray-500 mt-2 text-sm">
          {error.message || "An unexpected error occurred."}
        </p>
        {error.digest && (
          <p className="text-gray-400 text-xs mt-2">Error ID: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="mt-4 w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
