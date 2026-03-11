import { Badge } from "@/components/ui";
import { ShieldCheck, ShieldAlert, Clock, ShieldX } from "lucide-react";
import type { KYCStatus } from "@/hooks/useKYC";

const config: Record<
  KYCStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  unverified: {
    label: "Identity Unverified",
    icon: ShieldAlert,
    className:
      "border-muted/50 text-muted-foreground bg-muted/20",
  },
  pending: {
    label: "KYC Pending",
    icon: Clock,
    className:
      "border-amber-500/40 text-amber-400 bg-amber-500/10",
  },
  approved: {
    label: "KYC Verified",
    icon: ShieldCheck,
    className:
      "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
  },
  rejected: {
    label: "KYC Rejected",
    icon: ShieldX,
    className:
      "border-destructive/40 text-destructive bg-destructive/10",
  },
};

const KYCStatusBadge = ({
  status,
  size = "default",
}: {
  status: KYCStatus;
  size?: "sm" | "default";
}) => {
  const { label, icon: Icon, className } = config[status];
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <Badge
      variant="outline"
      className={`border gap-1 ${textSize} ${className}`}
    >
      <Icon className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {label}
    </Badge>
  );
};

export default KYCStatusBadge;
