import type { ReactNode } from "react";

export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="sm-section-card">
      <div className="sm-section-header">
        <div>
          <p className="sm-section-title">{title}</p>
          <p className="sm-section-subtitle">{subtitle}</p>
        </div>
      </div>
      <div className="sm-section-content">{children}</div>
    </div>
  );
}