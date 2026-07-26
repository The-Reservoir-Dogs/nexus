"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

// Edit-in-place now lives in the unified editor shell (left rail + manuscript +
// AI assistant panel). Redirect any old /edit links there.
export default function EditRedirect({ params }: { params: { id: string } }) {
  const router = useRouter();
  React.useEffect(() => {
    router.replace(`/episodes/${params.id}/editor?mode=edit`);
  }, [params.id, router]);
  return null;
}
