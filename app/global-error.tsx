"use client";

import Link from "next/link";

// Last resort when the root layout itself fails, so it can't rely on the
// layout's fonts, theme or components - plain markup and inline styles only.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "1rem",
        }}
      >
        <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>
          Something went wrong
        </h1>
        <p style={{ color: "#6b7280", maxWidth: "28rem" }}>
          VibeShopping hit an unexpected error. Please try again.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem" }}>
          <button
            onClick={() => reset()}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "none",
              background: "#111827",
              color: "white",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <Link
            href="/"
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "1px solid #d1d5db",
              color: "#111827",
              textDecoration: "none",
            }}
          >
            Back to home
          </Link>
        </div>
        {error.digest && (
          <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "1.5rem" }}>
            Reference: {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
