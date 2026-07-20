"use client";

import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useBatches } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/batches/score-badge";

export function RecentBatchesTable() {
  const { data: batches = [], isLoading, error, refetch } = useBatches();
  const recent = batches.slice(0, 8);

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Recent Batches</CardTitle>
        <CardAction className="self-center">
          <Link
            href="/batches"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : recent.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No batches yet"
            description="Create a batch to start moderating images."
          />
        ) : (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[38%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Name
                </TableHead>
                <TableHead className="w-[18%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="w-[14%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Images
                </TableHead>
                <TableHead className="w-[30%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Created
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((b) => (
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
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {formatDate(b.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
