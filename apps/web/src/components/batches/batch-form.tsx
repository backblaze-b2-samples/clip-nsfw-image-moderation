"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import type { FileRejection } from "react-dropzone";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Dropzone } from "@/components/upload/dropzone";
import { createBatch } from "@/lib/api-client";
import { useUpdateBatch } from "@/lib/queries";
import { humanizeBytes } from "@/lib/utils";
import {
  DEFAULT_PRESET,
  THRESHOLD_PRESETS,
  presetToScore,
  scoreToPreset,
  type ThresholdPreset,
} from "@/lib/thresholds";
import type { BatchSummary } from "@clip-nsfw-image-moderation/shared";

const schema = z.object({
  name: z
    .string()
    .min(2, "Batch name must be at least 2 characters")
    .max(80, "Batch name must be 80 characters or fewer"),
  threshold: z.enum(["strict", "balanced", "lenient"]),
});
type FormValues = z.infer<typeof schema>;

type Props =
  | { mode: "create" }
  | { mode: "edit"; batch: BatchSummary };

export function BatchForm(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const updateMutation = useUpdateBatch(isEdit ? props.batch.id : "");

  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: isEdit
      ? { name: props.batch.name, threshold: scoreToPreset(props.batch.threshold) }
      : { name: "", threshold: DEFAULT_PRESET },
  });

  const onFilesSelected = (accepted: File[]) =>
    setFiles((prev) => [...prev, ...accepted]);
  const onFilesRejected = (rejections: FileRejection[]) => {
    for (const r of rejections) toast.error(`${r.file.name}: not a supported image`);
  };
  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const onSubmit = async (values: FormValues) => {
    const threshold = presetToScore(values.threshold as ThresholdPreset);
    if (isEdit) {
      updateMutation.mutate(
        { name: values.name, threshold },
        {
          onSuccess: () => {
            toast.success("Batch updated");
            router.push(`/batches/${props.batch.id}`);
          },
          onError: (err) => toast.error(err.message),
        },
      );
      return;
    }
    if (files.length === 0) {
      toast.error("Add at least one image to the batch");
      return;
    }
    setSubmitting(true);
    try {
      const result = await createBatch(values.name, threshold, files);
      toast.success(`Batch "${result.name}" created with ${result.image_count} image(s)`);
      router.push(`/batches/${result.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create batch");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">
              {isEdit ? "Edit batch" : "Batch details"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Batch name</FormLabel>
                  <FormControl>
                    <Input placeholder="ugc-batch-2026-07-20" {...field} />
                  </FormControl>
                  <FormDescription>
                    A label you&apos;ll recognize in the batches list and audit logs.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="threshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Safety threshold</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-72">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {THRESHOLD_PRESETS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    An image is quarantined when its NSFW score (0–1, 1 = NSFW) is{" "}
                    <strong>≥ the threshold</strong>, so a lower threshold quarantines
                    more aggressively. <strong>Balanced (0.70)</strong> is the safe
                    default for a first run.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {!isEdit && (
          <Card>
            <CardHeader className="border-b border-border py-4 px-5">
              <CardTitle className="card-title">Images</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <Dropzone
                onFilesSelected={onFilesSelected}
                onFilesRejected={onFilesRejected}
              />
              {files.length > 0 && (
                <ul className="space-y-1.5" aria-label="Selected images">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <span className="truncate">{f.name}</span>
                      <span className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">
                          {humanizeBytes(f.size)}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${f.name}`}
                          onClick={() => removeFile(i)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">
                {files.length} image(s) staged. They&apos;ll be ingested to{" "}
                <code>images/incoming/&lt;batch-id&gt;/</code> on create.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || updateMutation.isPending}>
            {isEdit
              ? updateMutation.isPending
                ? "Saving..."
                : "Save changes"
              : submitting
                ? "Creating..."
                : "Create batch"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
