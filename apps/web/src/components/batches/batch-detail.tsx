"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { usePreviewUrl } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import type { BatchDetail, BatchImage } from "@clip-nsfw-image-moderation/shared";
import { ScoreBadge, StatusBadge, VerdictBadge } from "./score-badge";

function Thumb({ image }: { image: BatchImage }) {
  const { data } = usePreviewUrl(image.key, true);
  const ring =
    image.verdict === "quarantine"
      ? "ring-2 ring-destructive"
      : image.verdict === "approved"
        ? "ring-2 ring-[var(--success)]"
        : "ring-1 ring-border";
  return (
    <div className={`relative h-12 w-12 overflow-hidden rounded-md bg-muted ${ring}`}>
      {data?.url ? (
        <Image
          src={data.url}
          alt={image.filename}
          fill
          sizes="48px"
          className="object-cover"
          unoptimized
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <ImageIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="stat-value mt-1 text-xl">{value}</p>
    </div>
  );
}

export function BatchDetailView({ batch }: { batch: BatchDetail }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b border-border py-4 px-5 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="card-title">Summary</CardTitle>
          <StatusBadge status={batch.status} />
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Images" value={batch.image_count} />
            <StatCard label="Threshold" value={batch.threshold.toFixed(2)} />
            <StatCard label="Approved" value={batch.approved_count} />
            <StatCard label="Quarantined" value={batch.quarantined_count} />
            <StatCard
              label="Last run"
              value={batch.last_run_at ? formatDate(batch.last_run_at) : "—"}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border py-4 px-5">
          <CardTitle className="card-title">Images &amp; scores</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {batch.images.length === 0 ? (
            <EmptyState
              icon={ImageIcon}
              title="No images in this batch"
              description="This batch has no ingested images."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-16 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Preview
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Filename
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Score
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Verdict
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batch.images.map((img) => (
                  <TableRow key={img.key} className="table-row-hover">
                    <TableCell>
                      <Thumb image={img} />
                    </TableCell>
                    <TableCell className="font-medium">
                      <span className="truncate block max-w-xs">{img.filename}</span>
                    </TableCell>
                    <TableCell>
                      <ScoreBadge score={img.score} />
                    </TableCell>
                    <TableCell>
                      <VerdictBadge verdict={img.verdict} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
