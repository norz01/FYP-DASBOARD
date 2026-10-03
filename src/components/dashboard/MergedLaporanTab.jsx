import { useState, useEffect, useCallback } from "react";
import {
  PillTabs,
  Badge,
  SectionCard,
  EmptyState,
  SkeletonList,
  formatMsDate,
} from "../ui/dashboard-kit";
import StudentDetailModal from "../StudentDetailModal";

export function formatLaporanDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ms-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function normalizeLaporanItems(reports = [], appointments = []) {
  const items = [];

  for (const r of reports) {
    items.push({
      _id: r._id,
      itemType: "report",
      title: r.title || "Laporan",
      studentName: r.studentName,
      course: r.course,
      cgpa: r.cgpa,
      attendance: r.attendance,
      riskLevel: r.riskLevel,
      message: r.message,
      filePath: r.filePath,
      fileName: r.fileName,
      reportType: r.reportType,
      readByStudent: r.readByStudent,
      authorName: r.authorName || r.authorEmail,
      displayDate: r.createdAt,
      ploScores: r.ploScores || [],
      employability: r.employability,
    });
  }

  for (const a of appointments) {
    items.push({
      _id: a._id,
      itemType: "appointment",
      title: `Temujanji: ${a.interventionType || "Kaunseling"}`,
      studentName: a.studentName,
      course: a.course,
      cgpa: a.cgpa,
      attendance: a.attendance,
      riskLevel: a.riskLevel,
      reason: a.reason,
      interventionType: a.interventionType,
      priority: a.priority,
      status: a.status,
      scheduledDate: a.scheduledDate,
      counselorId: a.counselorId,
      counselorNotes: a.counselorNotes,
      filePath: a.filePath,
      displayDate: a.scheduledDate || a.createdAt,
    });
  }

  items.sort((a, b) => new Date(b.displayDate || 0) - new Date(a.displayDate || 0));

  return items;
}

const REPORT_TYPE_LABELS = {
  message: "Mesej",
  letter: "Surat",
  full: "Laporan Penuh",
};

const INTERVENTION_LABELS = {
  kaunseling: "Kaunseling",
  klinik: "Klinik Akademik",
  softskills: "Soft Skills",
};

export default function MergedLaporanTab({ user }) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedItem, setSelectedItem] = useState(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [reportsRes, appointmentsRes] = await Promise.all([
        fetch("/api/student-reports"),
        fetch("/api/reports/mine"),
      ]);

      const reports = reportsRes.ok ? await reportsRes.json() : [];
      const appointments = appointmentsRes.ok ? await appointmentsRes.json() : [];

      setItems(normalizeLaporanItems(reports, appointments));
    } catch (err) {
      console.error("Fetch laporan error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const handleOpenItem = async (item) => {
    setSelectedItem(item);

    if (item.itemType === "report" && !item.readByStudent) {
      try {
        const res = await fetch(`/api/student-reports/${item._id}`);
        if (res.ok) {
          setItems((prev) =>
            prev.map((i) =>
              i._id === item._id ? { ...i, readByStudent: true } : i
            )
          );
        }
      } catch (err) {
        console.error("Mark read error:", err);
      }
    }
  };

  const filteredItems = items.filter((item) => {
    if (activeFilter === "report") return item.itemType === "report";
    if (activeFilter === "appointment") return item.itemType === "appointment";
    return true;
  });

  const unreadCount = items.filter(
    (i) => i.itemType === "report" && !i.readByStudent
  ).length;

  const filters = [
    { id: "all", label: "Semua", icon: "ph-tray", count: items.length },
    {
      id: "report",
      label: "Laporan",
      icon: "ph-file-text",
      count: items.filter((i) => i.itemType === "report").length,
    },
    {
      id: "appointment",
      label: "Temujanji",
      icon: "ph-calendar-check",
      count: items.filter((i) => i.itemType === "appointment").length,
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <i className="ph-fill ph-tray text-blue-500"></i>
            Peti Masuk Laporan
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-[scaleIn_0.3s_ease-out]">
                {unreadCount} baharu
              </span>
            )}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Laporan prestasi, surat rasmi, dan temujanji kaunseling anda.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition touch-target active:scale-95 self-start sm:self-auto"
        >
          <i className="ph-bold ph-arrows-clockwise"></i>
          Muat Semula
        </button>
      </div>

      {/* Filters */}
      <PillTabs tabs={filters} activeTab={activeFilter} setActiveTab={setActiveFilter} />

      {isLoading ? (
        <SkeletonList rows={4} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon="ph-tray"
          title="Peti Masuk Kosong"
          message="Anda belum menerima sebarang laporan atau temujanji."
        />
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {filteredItems.map((item, index) => {
            const isReport = item.itemType === "report";
            const isUnread = isReport && !item.readByStudent;

            return (
              <button
                key={`${item.itemType}-${item._id}`}
                onClick={() => handleOpenItem(item)}
                className={`w-full text-left bg-white rounded-2xl border shadow-sm p-4 sm:p-5 hover:shadow-md transition touch-target active:scale-[0.98] animate-[slideUp_0.3s_ease-out] anim-fill ${
                  isUnread
                    ? "border-blue-300 bg-blue-50/30 ring-1 ring-blue-200"
                    : "border-slate-200"
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  {/* Icon */}
                  <div
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isReport
                        ? "bg-blue-100 text-blue-600"
                        : "bg-purple-100 text-purple-600"
                    }`}
                  >
                    <i
                      className={`ph-fill ${
                        isReport ? "ph-file-text" : "ph-calendar-check"
                      } text-lg sm:text-xl`}
                    ></i>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                        {item.title}
                      </h4>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                      )}
                    </div>

                    <p className="text-[10px] sm:text-xs text-slate-500 mb-2">
                      {isReport
                        ? `Daripada: ${item.authorName}`
                        : `${INTERVENTION_LABELS[item.interventionType] || item.interventionType} • ${item.counselorId || "Kaunselor"}`}
                    </p>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold border ${
                          isReport
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-purple-50 text-purple-700 border-purple-200"
                        }`}
                      >
                        <i className={`ph-fill ${isReport ? "ph-file-text" : "ph-calendar"} text-[8px] sm:text-[9px]`}></i>
                        {isReport
                          ? REPORT_TYPE_LABELS[item.reportType] || "Laporan"
                          : "Temujanji"}
                      </span>

                      {isReport && item.readByStudent && (
                        <Badge tone="green">
                          <i className="ph-fill ph-check-double text-[8px] sm:text-[9px]"></i>
                          Dibaca
                        </Badge>
                      )}

                      {!isReport && item.priority === "urgent" && (
                        <Badge tone="rose">
                          <i className="ph-fill ph-warning text-[8px] sm:text-[9px]"></i>
                          Segera
                        </Badge>
                      )}

                      <span className="text-[9px] sm:text-[10px] text-slate-400 flex items-center gap-1">
                        <i className="ph ph-clock"></i>
                        {formatLaporanDate(item.displayDate)}
                      </span>
                    </div>

                    {/* Preview text */}
                    {isReport && item.message && (
                      <p className="text-[10px] sm:text-xs text-slate-500 mt-2 line-clamp-2 italic">
                        &ldquo;{item.message}&rdquo;
                      </p>
                    )}
                    {!isReport && item.reason && (
                      <p className="text-[10px] sm:text-xs text-slate-500 mt-2 line-clamp-2 italic">
                        &ldquo;{item.reason}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Arrow */}
                  <i className="ph-bold ph-caret-right text-slate-300 mt-1 flex-shrink-0"></i>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <StudentDetailModal
          kind={selectedItem.itemType}
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}