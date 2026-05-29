"use client";

// apps/web/src/app/auth/callback/page.tsx
import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function AuthCallbackInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      localStorage.setItem("token", token);
      document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 7}`;
    }

    // Next.js `basePath` is already applied to all <Link> and router.push() calls,
    // but localStorage returnUrl was stored as a bare path (e.g. "/projects/1").
    // window.location.replace uses the full URL, so we just use the stored path directly —
    // Next.js basePath is handled by the router, not needed here since we replace to the same origin.
    const returnUrl = localStorage.getItem("returnUrl") ?? "/";
    localStorage.removeItem("returnUrl");

    // Only allow same-origin relative paths to prevent open-redirect attacks.
    const safeUrl = returnUrl.startsWith("/") ? returnUrl : "/";
    window.location.replace(safeUrl);
  }, [searchParams]);

  return <p>Authenticating...</p>;
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <AuthCallbackInner />
    </Suspense>
  );
}