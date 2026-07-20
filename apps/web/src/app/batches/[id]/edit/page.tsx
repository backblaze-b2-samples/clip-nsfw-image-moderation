"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { BatchForm } from "@/components/batches/batch-form";
import { useBatch } from "@/lib/queries";

export default function EditBatchPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { data: batch, isLoading, error, refetch } = useBatch(id);

  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <Link
          href={id ? `/batches/${id}` : "/batches"}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to batch
        </Link>
        <h1 className="page-title mt-2">Edit Batch</h1>
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
          Rename the batch or change its safety threshold. A new threshold
          re-routes images on the next run.
        </p>
      </div>

      <div className="animate-fade-in-up stagger-2 max-w-3xl">
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : error ? (
          <ErrorState error={error} title="Couldn't load batch" onRetry={() => refetch()} />
        ) : batch ? (
          <BatchForm mode="edit" batch={batch} />
        ) : null}
      </div>
    </div>
  );
}
