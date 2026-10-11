"use client";

import type { AssignmentType } from "@/lib/types";
import { typeMeta } from "@/lib/ui";

export function TypeChip({ type, compact = false, className = "" }: { type: AssignmentType; compact?: boolean; className?: string }) {
  const meta = typeMeta(type);
  const Icon = meta.icon;
  return (
    <span className={`type-chip ${meta.chip} ${className}`} title={meta.label}>
      <Icon size={12} strokeWidth={2.5} />
      {compact ? null : meta.label}
    </span>
  );
}
