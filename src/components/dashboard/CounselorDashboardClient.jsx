import { useState, useEffect, useCallback } from "react";
import { PillTabs, EmptyState, SkeletonList, Badge, formatMsDate } from "../ui/dashboard-kit";
import AppointmentCalendar from "./AppointmentCalendar";

const INTERVENTION_LABELS = {
  kaunseling: "Kaunseling Kehadiran / Peribadi",
  klinik: "Klinik Akademik",
  softskills: "Latihan Soft Skills",
};

const STATUS_CONFIG = {
  pending: { label: "Menunggu", tone: "amber", icon: "ph-hourglass" },
  accepted: { label: "Diterima", tone: "blue", icon: "ph-check-circle" },
  scheduled: { label: "Dijadualkan", tone: "purple", icon: "ph-calendar-check" },
  completed: { label: "Selesai", tone: "green", icon: "ph-check-square" },
  rejected: { label: "Ditolak", tone: "rose", icon: "ph-x-circle" },
};

export default function CounselorDashboardClient({ currentUser }) {
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("calendar");
  const [selectedReport, setSelectedReport] = useState(null);
  const [modalAction, setModalAction] = useState(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const isAdmin = currentUser?.role === "admin";

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch("/api/reports");
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch (err) {
      console.error("Fetch reports error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const [sentReports, setSentReports] = useState([]);

  const fetchSentReports = useCallback(async () => {
    try {
      const res = await fetch("/api/student-reports");
      if (res.ok) setSentReports(await res.json());
    } catch (err) {
      console.error("Fetch sent reports error:", err);
    }
  }, []);

  useEffect(() => {
    fetchReports();
    fetchSentReports();
  }, [fetchReports, fetchSentReports]);

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAccept = async (report) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/reports/${report._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accepted" }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      showToast("success", "Rujukan diterima. Sila jadualkan temujanji.");
      fetchReports();
    } catch (err) {
      showToast("error", err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (report) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/reports/${report._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rejected" }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      showToast("success", "Rujukan ditolak.");
      fetchReports();
    } catch (err) {
      showToast("error", err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openScheduleModal = (report) => {
    setSelectedReport(report);
    setModalAction("schedule");
    setNotes("");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    setScheduleDate(tomorrow.toISOString().slice(0, 16));
  };

  const openCompleteModal = (report) => {
    setSelectedReport(report);
    setModalAction("complete");
    setNotes("");
  };

  const handleScheduleSubmit = async () => {
    if (!scheduleDate) {
      showToast("error", "Sila pilih tarikh temujanji.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/reports/${selectedReport._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scheduled", scheduledDate: scheduleDate, counselorNotes: notes }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      showToast("success", "Temujanji berjaya dijadualkan.");
      setSelectedReport(null);
      setModalAction(null);
      fetchReports();
    } catch (err) {
      showToast("error", err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/reports/${selectedReport._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "completed", counselorNotes: notes }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      showToast("success", "Rujukan ditandakan selesai.");
      setSelectedReport(null);
      setModalAction(null);
      fetchReports();
    } catch (err) {
      showToast("error", err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCalendarComplete = (report) => {
    openCompleteModal(report);
  };

  const handleDeleteSentReport = async (id) => {
    if (!window.confirm("Adakah anda pasti mahu memadam laporan ini?")) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/student-reports/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).message);
      showToast("success", "Laporan berjaya dipadam.");
      fetchSentReports();
    } catch (err) {
      showToast("error", err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredReports = reports.filter((r) => {
    if (activeTab === "pending") return r.status === "pending";
    if (activeTab === "scheduled") return r.status === "scheduled" || r.status === "accepted";
    if (activeTab === "completed") return r.status === "completed";
    if (activeTab === "all") return true;
    return true;
  });

  const tabCounts = {
    calendar: reports.filter((r) => r.status === "scheduled" || r.status === "accepted").length,
    pending: reports.filter((r) => r.status === "pending").length,
    scheduled: reports.filter((r) => r.status === "scheduled" || r.status === "accepted").length,
    completed: reports.filter((r) => r.status === "completed").length,
    all: reports.length,
  };

  const tabs = [
    { id: "calendar", label: "Kalendar", icon: "ph-calendar", count: tabCounts.calendar },
    { id: "pending", label: "Menunggu", icon: "ph-hourglass", count: tabCounts.pending },
    { id: "scheduled", label: "Dijadualkan", icon: "ph-calendar-check", count: tabCounts.scheduled },
    { id: "completed", label: "Selesai", icon: "ph-check-square", count: tabCounts.completed },
    { id: "sent-reports", label: "Dihantar", icon: "ph-paper-plane-tilt", count: sentReports.length },
    { id: "all", label: "Semua", icon: "ph-list", count: tabCounts.all },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[60] px-4 sm:px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-[fadeIn_0.3s_ease-out] ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            <i className={`ph-fill ${toast.type === "success" ? "ph-check-circle" : "ph-warning-circle"}`}></i>
            {toast.text}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <i className="ph-fill ph-heart-half text-purple-500"></i>
            Pengurusan Kaunseling
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isAdmin
              ? "Pantau semua rujukan intervensi pelajar."
              : "Urus rujukan dan temujanji kaunseling anda."}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <PillTabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />

      {isLoading ? (
        <SkeletonList rows={4} />
      ) : (
        <>
          {activeTab === "calendar" && (
            <AppointmentCalendar reports={reports} onComplete={handleCalendarComplete} />
          )}

          {activeTab !== "calendar" && (
            <div className="space-y-2 sm:space-y-3">
              {activeTab === "sent-reports" && (
                <div className="space-y-2 sm:space-y-3">
                  {sentReports.length === 0 ? (
                    <EmptyState icon="ph-paper-plane-tilt" title="Tiada Laporan Dihantar" message="Anda belum menghantar sebarang surat atau laporan kepada pelajar." />
                  ) : (
                    sentReports.map((report, index) => (
                      <div
                        key={report._id}
                        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 hover:shadow-md transition animate-[slideUp_0.3s_ease-out] anim-fill"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge tone="blue"><i className="ph-fill ph-file-text text-[10px]"></i> {report.reportType === 'full' ? 'Laporan Penuh' : report.reportType === 'letter' ? 'Surat' : 'Mesej'}</Badge>
                              <span className="text-[10px] text-slate-400">{formatMsDate(report.createdAt, true)}</span>
                            </div>
                            <h4 className="font-bold text-slate-800 text-sm sm:text-base">{report.title}</h4>
                            <p className="text-xs text-slate-500 mt-0.5">Kepada: {report.studentName} ({report.course})</p>
                            {report.message && <p className="text-xs text-slate-600 mt-2 italic line-clamp-2">&ldquo;{report.message}&rdquo;</p>}
                            {report.filePath && (
                              <a href={report.filePath} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:underline touch-target py-1">
                                <i className="ph ph-paperclip"></i> Lihat Lampiran PDF
                              </a>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteSentReport(report._id)}
                            disabled={isSubmitting}
                            className="text-slate-400 hover:text-red-500 transition p-2 rounded-lg hover:bg-red-50 touch-target active:scale-95"
                            title="Padam Laporan"
                          >
                            <i className="ph-bold ph-trash text-lg"></i>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              {activeTab !== "sent-reports" && (
                <>
                  {filteredReports.length === 0 ? (
                    <EmptyState
                      icon="ph-clipboard-text"
                      title="Tiada Rujukan"
                      message="Tiada rujukan untuk kategori ini pada masa ini."
                    />
                  ) : (
                    filteredReports.map((report, index) => {
                      const statusCfg = STATUS_CONFIG[report.status] || STATUS_CONFIG.pending;
                      return (
                        <div
                          key={report._id}
                          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 hover:shadow-md transition animate-[slideUp_0.3s_ease-out] anim-fill"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <div className="flex flex-col gap-3">
                            {/* Left: Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <Badge tone={statusCfg.tone}>
                                  <i className={`ph-fill ${statusCfg.icon} text-[10px]`}></i>
                                  {statusCfg.label}
                                </Badge>
                                {report.priority === "urgent" && (
                                  <Badge tone="rose">
                                    <i className="ph-fill ph-warning text-[10px]"></i>
                                    SEGERA
                                  </Badge>
                                )}
                                <Badge tone="purple">
                                  {INTERVENTION_LABELS[report.interventionType] || report.interventionType}
                                </Badge>
                              </div>

                              <h4 className="font-bold text-slate-800 text-sm sm:text-base">{report.studentName}</h4>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {report.course} • CGPA: {report.cgpa || "-"} • Kehadiran: {report.attendance || "-"}%
                              </p>

                              <div className="mt-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Sebab Rujukan</p>
                                <p className="text-xs sm:text-sm text-slate-700">{report.reason}</p>
                              </div>

                              <div className="flex items-center gap-3 sm:gap-4 mt-3 text-[10px] sm:text-xs text-slate-400 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <i className="ph ph-user"></i>
                                  {report.adminEmail}
                                </span>
                                {report.scheduledDate && (
                                  <span className="flex items-center gap-1">
                                    <i className="ph ph-calendar"></i>
                                    {formatMsDate(report.scheduledDate, true)}
                                  </span>
                                )}
                              </div>

                              {report.counselorNotes && (
                                <div className="mt-3 bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                                  <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Nota Kaunselor</p>
                                  <p className="text-xs sm:text-sm text-emerald-800">{report.counselorNotes}</p>
                                </div>
                              )}

                              {report.filePath && (
                                <a
                                  href={report.filePath}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 mt-3 text-xs text-blue-600 hover:underline touch-target py-1"
                                >
                                  <i className="ph ph-paperclip"></i> Lihat Lampiran
                                </a>
                              )}
                            </div>

                            {/* Right: Actions - Stacked on mobile */}
                            <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                              {report.status === "pending" && (
                                <>
                                  <button
                                    onClick={() => handleAccept(report)}
                                    disabled={isSubmitting}
                                    className="flex-1 py-2.5 sm:py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 touch-target active:scale-95"
                                  >
                                    <i className="ph-bold ph-check"></i> Terima
                                  </button>
                                  <button
                                    onClick={() => handleReject(report)}
                                    disabled={isSubmitting}
                                    className="flex-1 py-2.5 sm:py-2 bg-white text-red-600 border border-red-200 hover:bg-red-50 disabled:bg-slate-100 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 touch-target active:scale-95"
                                  >
                                    <i className="ph-bold ph-x"></i> Tolak
                                  </button>
                                </>
                              )}

                              {report.status === "accepted" && (
                                <button
                                  onClick={() => openScheduleModal(report)}
                                  className="flex-1 py-2.5 sm:py-2 bg-purple-600 text-white hover:bg-purple-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 touch-target active:scale-95"
                                >
                                  <i className="ph-bold ph-calendar-plus"></i> Jadualkan
                                </button>
                              )}

                              {report.status === "scheduled" && (
                                <>
                                  <button
                                    onClick={() => openCompleteModal(report)}
                                    className="flex-1 py-2.5 sm:py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 touch-target active:scale-95"
                                  >
                                    <i className="ph-bold ph-check-circle"></i> Selesai
                                  </button>
                                  <button
                                    onClick={() => openScheduleModal(report)}
                                    className="flex-1 py-2.5 sm:py-2 bg-white text-purple-600 border border-purple-200 hover:bg-purple-50 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 touch-target active:scale-95"
                                  >
                                    <i className="ph-bold ph-calendar"></i> Ubah Tarikh
                                  </button>
                                </>
                              )}

                              {isAdmin && (report.status === "completed" || report.status === "rejected") && (
                                <button
                                  onClick={async () => {
                                    setIsSubmitting(true);
                                    try {
                                      const res = await fetch(`/api/reports/${report._id}`, {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ action: "pending" }),
                                      });
                                      if (!res.ok) throw new Error((await res.json()).message);
                                      showToast("success", "Rujukan ditetapkan semula ke Menunggu.");
                                      fetchReports();
                                    } catch (err) {
                                      showToast("error", err.message);
                                    } finally {
                                      setIsSubmitting(false);
                                    }
                                  }}
                                  disabled={isSubmitting}
                                  className="flex-1 py-2.5 sm:py-2 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 touch-target active:scale-95"
                                >
                                  <i className="ph-bold ph-arrow-counter-clockwise"></i> Set Semula
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* SCHEDULE MODAL */}
      {modalAction === "schedule" && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-2xl overflow-y-auto sm:max-w-md safe-area-top safe-area-bottom animate-[slideUp_0.3s_ease-out]">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Jadualkan Temujanji</h3>
                <p className="text-xs text-slate-500 mt-1 truncate">{selectedReport.studentName}</p>
              </div>
              <button
                onClick={() => { setModalAction(null); setSelectedReport(null); }}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition touch-target flex-shrink-0 ml-2"
                aria-label="Close"
              >
                <i className="ph-bold ph-x text-xl"></i>
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Tarikh & Masa</label>
                <input
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full border border-slate-300 p-3 sm:p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none touch-target"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Nota (Pilihan)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows="3"
                  placeholder="Nota tambahan untuk temujanji ini..."
                  className="w-full border border-slate-300 p-3 sm:p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2 sticky bottom-0 bg-white sm:static pb-safe sm:pb-0">
                <button
                  onClick={() => { setModalAction(null); setSelectedReport(null); }}
                  className="flex-1 py-3 sm:py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold text-sm transition touch-target active:scale-95"
                >
                  Batal
                </button>
                <button
                  onClick={handleScheduleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 py-3 sm:py-2.5 bg-purple-600 text-white hover:bg-purple-700 disabled:bg-slate-300 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 touch-target active:scale-95 shadow-lg shadow-purple-600/20"
                >
                  {isSubmitting ? (
                    <><i className="ph ph-spinner-gap animate-spin"></i> Menyimpan...</>
                  ) : (
                    <><i className="ph-bold ph-calendar-check"></i> Jadualkan</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETE MODAL */}
      {modalAction === "complete" && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-2xl overflow-y-auto sm:max-w-md safe-area-top safe-area-bottom animate-[slideUp_0.3s_ease-out]">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Tandakan Selesai</h3>
                <p className="text-xs text-slate-500 mt-1 truncate">{selectedReport.studentName}</p>
              </div>
              <button
                onClick={() => { setModalAction(null); setSelectedReport(null); }}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition touch-target flex-shrink-0 ml-2"
                aria-label="Close"
              >
                <i className="ph-bold ph-x text-xl"></i>
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Nota Kaunselor</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows="4"
                  placeholder="Ringkasan sesi kaunseling, cadangan susulan, dll..."
                  className="w-full border border-slate-300 p-3 sm:p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2 sticky bottom-0 bg-white sm:static pb-safe sm:pb-0">
                <button
                  onClick={() => { setModalAction(null); setSelectedReport(null); }}
                  className="flex-1 py-3 sm:py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold text-sm transition touch-target active:scale-95"
                >
                  Batal
                </button>
                <button
                  onClick={handleCompleteSubmit}
                  disabled={isSubmitting}
                  className="flex-1 py-3 sm:py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-300 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 touch-target active:scale-95 shadow-lg shadow-emerald-600/20"
                >
                  {isSubmitting ? (
                    <><i className="ph ph-spinner-gap animate-spin"></i> Menyimpan...</>
                  ) : (
                    <><i className="ph-bold ph-check-circle"></i> Selesai</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}