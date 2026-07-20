"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Play, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useDeleteBatch, useRunBatch } from "@/lib/queries";
import type { BatchDetail } from "@clip-nsfw-image-moderation/shared";

export function RunPanel({ batch }: { batch: BatchDetail }) {
  const router = useRouter();
  const runMutation = useRunBatch(batch.id);
  const deleteMutation = useDeleteBatch();

  const onRun = () => {
    runMutation.mutate(undefined, {
      onSuccess: (r) =>
        toast.success(
          `Scored ${r.scored} image(s): ${r.approved} approved, ${r.quarantined} quarantined`,
        ),
      onError: (err) => toast.error(err.message),
    });
  };

  const onDelete = () => {
    deleteMutation.mutate(batch.id, {
      onSuccess: (r) => {
        toast.success(`Batch deleted (${r.objects_removed} objects removed)`);
        router.push("/batches");
      },
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Actions</CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-3">
        <Button
          className="w-full"
          onClick={onRun}
          disabled={runMutation.isPending}
          aria-busy={runMutation.isPending}
        >
          {runMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Play className="h-4 w-4" aria-hidden />
          )}
          {runMutation.isPending
            ? "Scoring on-device…"
            : batch.status === "completed"
              ? "Re-run scoring"
              : "Run scoring"}
        </Button>
        {runMutation.isPending && (
          <p
            className="text-xs text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            Scoring on-device… the first run loads the model into memory
            (~30s), then scores each image. This can take 15–45s — hang tight.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Loads every image from B2, scores it with CLIP + the LAION classifier,
          then routes it to <code>approved/</code> or <code>quarantine/</code> and
          writes the audit log. Fully on-device — no external API.
        </p>

        <div className="flex gap-2 pt-1">
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/batches/${batch.id}/edit`}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="flex-1 text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this batch?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes only this batch&apos;s images and audit
                  logs (incoming, approved, quarantine, and logs prefixes for{" "}
                  <strong>{batch.name}</strong>). Other batches are untouched.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteMutation.isPending}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  disabled={deleteMutation.isPending}
                  className={buttonVariants({ variant: "destructive" })}
                >
                  {deleteMutation.isPending ? "Deleting…" : "Delete batch"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
