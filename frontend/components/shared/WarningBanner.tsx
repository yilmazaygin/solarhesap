import { AlertTriangle, Info, Clock } from "lucide-react";

interface WarningBannerProps {
  type?: "warning" | "info" | "time";
  message: string;
  className?: string;
}

const ICONS = {
  warning: AlertTriangle,
  info: Info,
  time: Clock,
};

export default function WarningBanner({
  type = "warning",
  message,
  className = "",
}: WarningBannerProps) {
  const Icon = ICONS[type];
  const bannerClass = type === "info" || type === "time" ? "info-banner" : "warning-banner";

  return (
    <div className={`${bannerClass} ${className}`}>
      <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
      <p>{message}</p>
    </div>
  );
}
