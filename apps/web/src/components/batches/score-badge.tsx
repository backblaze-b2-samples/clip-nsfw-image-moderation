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

export function StatusBadge({ status }: { status: string }) {
  if (status === "completed") {
    return <Badge variant="secondary">completed</Badge>;
  }
  return <Badge variant="outline">pending</Badge>;
}
