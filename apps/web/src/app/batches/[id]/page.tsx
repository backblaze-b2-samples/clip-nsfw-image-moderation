"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { BatchDetailView } from "@/components/batches/batch-detail";
import { RunPanel } from "@/components/batches/run-panel";
import { useBatch } from "@/lib/queries";

export default function BatchDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { data: batch, isLoading, error, refetch } = useBatch(id);

  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <Link
          href="/batches"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          All batches
        </Link>
        <h1 className="page-title mt-2 truncate">{batch?.name ?? "Batch"}</h1>
        {batch && (
          <p className="mt-1.5 font-mono text-xs text-muted-foreground">{batch.id}</p>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error ? (
        <ErrorState error={error} title="Couldn't load batch" onRetry={() => refetch()} />
      ) : batch ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="animate-fade-in-up stagger-2 order-2 lg:order-1">
            <BatchDetailView batch={batch} />
          </div>
          <div className="animate-fade-in-up stagger-1 order-1 lg:order-2">
            <RunPanel batch={batch} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
