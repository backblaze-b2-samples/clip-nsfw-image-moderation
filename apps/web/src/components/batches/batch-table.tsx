"use client";

import Link from "next/link";
import { Layers } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useBatches } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "./score-badge";

export function BatchTable() {
  const { data: batches = [], isLoading, error, refetch } = useBatches();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <CardContent className="p-0">
          <ErrorState error={error} title="Couldn't load batches" onRetry={() => refetch()} />
        </CardContent>
      </Card>
    );
  }
  if (batches.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={Layers}
            title="No moderation batches yet"
            description="Create a batch to ingest images and score them on-device."
            action={
              <Button asChild size="sm">
                <Link href="/batches/new">New batch</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[30%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Name
              </TableHead>
              <TableHead className="w-[13%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="w-[10%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Images
              </TableHead>
              <TableHead className="w-[12%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Threshold
              </TableHead>
              <TableHead className="w-[17%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Routed
              </TableHead>
              <TableHead className="w-[18%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Created
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((b) => (
              <TableRow key={b.id} className="table-row-hover">
                <TableCell className="font-medium">
                  <Link href={`/batches/${b.id}`} className="hover:underline">
                    <span className="truncate block">{b.name}</span>
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge status={b.status} />
                </TableCell>
                <TableCell className="tabular-nums">{b.image_count}</TableCell>
                <TableCell className="font-mono text-xs tabular-nums">
                  {b.threshold.toFixed(2)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  <span className="text-[var(--success)]">{b.approved_count} ok</span>
                  {" · "}
                  <span className="text-destructive">{b.quarantined_count} quarantined</span>
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {formatDate(b.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
