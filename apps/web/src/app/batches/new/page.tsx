import { BatchForm } from "@/components/batches/batch-form";

export default function NewBatchPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">New Batch</h1>
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground text-pretty">
          Name the batch, pick a safety threshold, and add the images to moderate.
          Images are ingested to B2 and scored on-device when you run the batch.
        </p>
      </div>
      <div className="animate-fade-in-up stagger-2 max-w-3xl">
        <BatchForm mode="create" />
      </div>
    </div>
  );
}
