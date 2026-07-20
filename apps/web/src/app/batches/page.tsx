import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BatchTable } from "@/components/batches/batch-table";

export default function BatchesPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="min-w-0">
          <h1 className="page-title">Moderation Batches</h1>
          <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
            Scoped view of the pipeline&apos;s own prefixes (
            <code>images/**</code> and <code>moderation/**</code>). Ingest images,
            score them on-device, and route safe vs. flagged content.
          </p>
        </div>
        <Button asChild size="sm" className="h-8 shrink-0">
          <Link href="/batches/new">
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            New batch
          </Link>
        </Button>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <BatchTable />
      </div>
    </div>
  );
}
