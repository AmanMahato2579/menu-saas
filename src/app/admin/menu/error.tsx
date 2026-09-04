"use client";

export default function MenuError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
      <p className="text-gray-500 text-sm mb-4 max-w-md">
        {error.message || "An unexpected error occurred while loading the menu."}
      </p>
      {error.digest && (
        <p className="text-gray-400 text-xs mb-4">Error ID: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium"
      >
        Try again
      </button>
    </div>
  );
}
