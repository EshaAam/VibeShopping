"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";

// Shown when a page throws on the server or in the browser. Without it Next
// renders a bare "Application error" screen. `digest` identifies the matching
// entry in the server logs without leaking the error details to the visitor.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <Image
        src="/images/logo.png"
        width={48}
        height={48}
        alt={`${APP_NAME} logo`}
        priority={true}
      />
      <h1 className="text-3xl font-bold mt-6 mb-2">Something went wrong</h1>
      <p className="text-muted-foreground max-w-md">
        We couldn&apos;t load this page. Please try again — if it keeps
        happening, come back in a few minutes.
      </p>
      <div className="flex gap-2 mt-6">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
      {error.digest && (
        <p className="text-xs text-muted-foreground mt-6">
          Reference: {error.digest}
        </p>
      )}
    </div>
  );
}
