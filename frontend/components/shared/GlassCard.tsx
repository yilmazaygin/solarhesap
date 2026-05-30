import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  id?: string;
  hoverable?: boolean;
}

export default function GlassCard({
  children,
  className = "",
  id,
  hoverable = true,
}: GlassCardProps) {
  return (
    <div
      id={id}
      className={`glass-card ${hoverable ? "" : "hover:border-white/[0.06] hover:shadow-glass"} ${className}`}
    >
      {children}
    </div>
  );
}
