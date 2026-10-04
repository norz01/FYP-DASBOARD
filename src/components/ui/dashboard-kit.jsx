export function formatMsDate(value, withTime = false) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  const opts = { day: "2-digit", month: "short", year: "numeric" };
  if (withTime) opts.hour = "2-digit";
  if (withTime) opts.minute = "2-digit";
  return d.toLocaleString("ms-MY", opts);
}

const toneClasses = {
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
};

export function Badge({ tone = "slate", children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border animate-[scaleIn_0.25s_ease-out] ${toneClasses[tone] || toneClasses.slate} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatCard({ icon, label, value, tone = "blue", delay = 0 }) {
  const bg =
    tone === "blue"
      ? "bg-blue-50 text-blue-600"
      : tone === "green"
        ? "bg-emerald-50 text-emerald-600"
        : "bg-slate-100 text-slate-600";
  return (
    <div
      className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 animate-[slideUp_0.4s_ease-out] anim-fill"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center transition-transform duration-300 hover:scale-110`}
      >
        <i className={`ph-fill ${icon} text-xl`}></i>
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

export function SectionCard({
  icon,
  title,
  subtitle,
  actions,
  children,
  className = "",
  delay = 0,
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-[slideUp_0.4s_ease-out] anim-fill ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon && <i className={`ph-fill ${icon} text-xl text-blue-600`}></i>}
          <div>
            <h3 className="font-bold text-slate-800">{title}</h3>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function PillTabs({ tabs, activeTab, setActiveTab }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap animate-[slideUp_0.3s_ease-out] anim-fill transition-all duration-200 active:scale-95 ${
            activeTab === tab.id
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:shadow-sm"
          }`}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          {tab.icon && <i className={`ph-fill ${tab.icon}`}></i>}
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-colors duration-200 ${
                activeTab === tab.id
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon = "ph-empty", title, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center animate-[fadeIn_0.4s_ease-out]">
      <i
        className={`ph ${icon} text-5xl text-slate-300 mb-3 animate-[floatSoft_3s_ease-in-out_infinite]`}
      ></i>
      <h4 className="font-bold text-slate-700 mb-1">{title}</h4>
      <p className="text-sm text-slate-500 max-w-sm">{message}</p>
    </div>
  );
}

export function SkeletonList({ rows = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-16 skeleton-shimmer rounded-xl animate-[slideUp_0.3s_ease-out] anim-fill"
          style={{ animationDelay: `${i * 80}ms` }}
        ></div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// RISK CLASSIFICATION (Tinggi / Sederhana / Rendah)
// ═══════════════════════════════════════════════════════
export function getRiskMeta(risk) {
  if (risk === "Tinggi" || risk === "Bermasalah")
    return {
      level: "Tinggi",
      label: "Risiko Tinggi",
      badge: "bg-red-100 text-red-700 border-red-200",
      dot: "bg-red-500",
      icon: "ph-warning-octagon",
    };
  if (risk === "Sederhana")
    return {
      level: "Sederhana",
      label: "Risiko Sederhana",
      badge: "bg-amber-100 text-amber-700 border-amber-200",
      dot: "bg-amber-500",
      icon: "ph-clock",
    };
  return {
    level: "Rendah",
    label: "Risiko Rendah",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    icon: "ph-check-circle",
  };
}

export function RiskBadge({ risk, showLabel = true, className = "" }) {
  const meta = getRiskMeta(risk);
  return (
    <span
      title={`Kategori risiko: ${meta.level}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border animate-[scaleIn_0.25s_ease-out] ${meta.badge} ${className}`}
    >
      <i className={`ph-fill ${meta.icon} text-[10px]`}></i>
      {showLabel ? meta.label : meta.level}
    </span>
  );
}
