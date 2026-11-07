export function LoadingSkeleton() {
  return (
    <div className="sm-kpi-grid" style={{ padding: "24px" }}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="sm-kpi-card" style={{ minHeight: "120px" }}>
          <div className="sm-kpi-label" style={{ height: "16px", background: "var(--sm-border)", borderRadius: "4px" }} />
          <div className="sm-kpi-value" style={{ height: "36px", background: "var(--sm-border)", borderRadius: "4px", marginTop: "8px" }} />
          <div className="sm-kpi-sub" style={{ height: "14px", background: "var(--sm-border)", borderRadius: "4px", marginTop: "6px" }} />
        </div>
      ))}
    </div>
  );
}