import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Verdict } from "@clip-nsfw-image-moderation/shared";

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return <span className="font-mono text-xs text-muted-foreground">—</span>;
  }
  return (
    <span className="font-mono text-xs tabular-nums">{score.toFixed(3)}</span>
  );
}

export function VerdictBadge({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        unscored
      </Badge>
    );
  }
  if (verdict === "quarantine") {
    return <Badge variant="destructive">quarantine</Badge>;
  }
  return (
    <Badge className="bg-[var(--success)] text-white hover:bg-[var(--success)]">
      approved
    </Badge>
  );
}

export function StatusBadge({
  status,
  running = false,
}: {
  status: string;
  running?: boolean;
}) {
  // `running` is derived from the live run mutation, not a backend status —
  // it reflects an in-flight on-device scoring pass while `status` is still
  // whatever the last persisted run left behind.
  if (running) {
    return (
      <Badge variant="outline" className="gap-1" aria-live="polite">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        running
      </Badge>
    );
  }
  if (status === "completed") {
    return <Badge variant="secondary">completed</Badge>;
  }
  return <Badge variant="outline">pending</Badge>;
}
