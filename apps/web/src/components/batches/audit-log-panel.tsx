"use client";

import { Download, FileText, ScrollText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { ApiError, getDownloadUrl } from "@/lib/api-client";
import { useBatchLogs } from "@/lib/queries";
import type { BatchDetail, FileMetadata } from "@clip-nsfw-image-moderation/shared";

// Compact, human-readable view of the audit artifacts a run writes to
// `moderation/logs/<batch-id>/` (results.jsonl, summary.csv, manifest.json).
// It reuses the existing prefix-scoped file listing + presigned download path
// so an operator can reach a batch's logs without hunting through the raw
// full-bucket explorer.
export function AuditLogPanel({ batch }: { batch: BatchDetail }) {
  const hasRun = batch.status === "completed" || batch.last_run_at !== null;
  const { data: logs = [], isLoading, error, refetch } = useBatchLogs(
    batch.id,
    hasRun,
  );

  const onDownload = async (file: FileMetadata) => {
    try {
      const { url } = await getDownloadUrl(file.key);
      window.open(url, "_blank");
    } catch (err) {
      const detail =
        err instanceof ApiError ? err.message : "Failed to get download URL";
      toast.error(detail);
    }
  };

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-muted-foreground" aria-hidden />
          Audit log
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {!hasRun ? (
          <p className="text-sm text-muted-foreground">
            Run this batch to generate its audit log — per-image{" "}
            <code>results.jsonl</code> and a batch <code>summary.csv</code>{" "}
            written to <code>moderation/logs/{batch.id}/</code>.
          </p>
        ) : isLoading ? (
          <div className="space-y-2" role="status" aria-busy aria-live="polite">
            <p className="sr-only">Loading audit log…</p>
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : error ? (
          <ErrorState
            error={error}
            title="Couldn't load audit log"
            onRetry={() => refetch()}
          />
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No audit files found yet under{" "}
            <code>moderation/logs/{batch.id}/</code>.
          </p>
        ) : (
          <ul className="space-y-1.5" aria-label="Audit log files">
            {logs.map((file) => (
              <li
                key={file.key}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5 text-sm"
              >
                <FileText
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span
                  className="min-w-0 flex-1 truncate font-medium"
                  title={file.key}
                >
                  {file.filename}
                </span>
                <span className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:inline">
                  {file.size_human}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 text-xs"
                  onClick={() => onDownload(file)}
                  aria-label={`Download ${file.filename}`}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Download
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
