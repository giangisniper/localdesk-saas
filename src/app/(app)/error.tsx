"use client";
import { Button, EmptyState } from "@/components/ui";
import { AlertTriangle } from "lucide-react";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <EmptyState icon={<AlertTriangle className="size-5" />} title="Something went wrong" description="We couldn't load this page. Try again, and if the problem persists contact support." action={<Button onClick={reset}>Try again</Button>} />;
}
