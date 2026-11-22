"use client";

// Root error boundary: only rendered when the root layout itself fails, so it
// must carry its own <html>/<body> and minimal styles (no app components).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ margin: 0, background: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              maxWidth: 360,
              width: "100%",
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
              padding: 28,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
            <h1 style={{ fontSize: 20, color: "#111827", margin: "0 0 8px" }}>
              Something went wrong
            </h1>
            <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 16 }}>
              {error.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={reset}
              style={{
                width: "100%",
                height: 48,
                background: "#f97316",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}