import { useState, useMemo, useEffect } from "react";

const DAY_NAMES = ["Isn", "Sel", "Rab", "Kha", "Jum", "Sab", "Ahd"];
const DAY_NAMES_FULL = ["Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu", "Ahad"];
const MONTH_NAMES = [
  "Januari", "Februari", "Mac", "April", "Mei", "Jun",
  "Julai", "Ogos", "September", "Oktober", "November", "Disember",
];

const INTERVENTION_LABELS = {
  kaunseling: "Kaunseling",
  klinik: "Klinik Akademik",
  softskills: "Soft Skills",
};

function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function AppointmentCalendar({ reports, onComplete }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const scheduledReports = useMemo(
    () =>
      (reports || []).filter(
        (r) =>
          r.scheduledDate &&
          (r.status === "scheduled" || r.status === "accepted")
      ),
    [reports]
  );

  const byDay = useMemo(() => {
    const map = {};
    for (const r of scheduledReports) {
      const d = new Date(r.scheduledDate);
      const key = dayKey(d);
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return map;
  }, [scheduledReports]);

  const calendarCells = useMemo(() => {
    const { year, month } = currentMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();

    let startDow = firstDay.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1;

    const cells = [];
    for (let i = 0; i < startDow; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      cells.push(new Date(year, month, d));
    }
    return cells;
  }, [currentMonth]);

  const todayKey = dayKey(new Date());

  const prevMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { ...prev, month: prev.month - 1 };
    });
    setSelectedDay(null);
  };

  const nextMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { ...prev, month: prev.month + 1 };
    });
    setSelectedDay(null);
  };

  const selectedDayReports = selectedDay ? byDay[selectedDay] || [] : [];

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("ms-MY", { hour: "2-digit", minute: "2-digit" });
  };

  const handleDayClick = (key) => {
    if (isMobile && selectedDay === key) {
      setSelectedDay(null);
    } else {
      setSelectedDay(key);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
      {/* Calendar Grid */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-3 sm:p-5">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-3 sm:mb-5">
          <button
            onClick={prevMonth}
            className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition touch-target active:scale-95"
            aria-label="Previous month"
          >
            <i className="ph-bold ph-caret-left"></i>
          </button>
          <h3 className="font-bold text-slate-800 text-base sm:text-lg">
            {MONTH_NAMES[currentMonth.month]} {currentMonth.year}
          </h3>
          <button
            onClick={nextMonth}
            className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition touch-target active:scale-95"
            aria-label="Next month"
          >
            <i className="ph-bold ph-caret-right"></i>
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1 sm:mb-2">
          {DAY_NAMES.map((name, idx) => (
            <div
              key={name}
              className="text-center text-[10px] sm:text-[10px] font-bold text-slate-400 uppercase py-1 sm:py-1"
            >
              {name}
            </div>
          ))}
        </div>

        {/* Calendar Cells */}
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {calendarCells.map((cell, i) => {
            if (!cell) {
              return <div key={`empty-${i}`} className="h-12 sm:h-16 rounded-lg" />;
            }

            const key = dayKey(cell);
            const dayReports = byDay[key] || [];
            const isToday = key === todayKey;
            const isSelected = key === selectedDay;
            const hasUrgent = dayReports.some((r) => r.priority === "urgent");

            return (
              <button
                key={key}
                onClick={() => handleDayClick(key)}
                className={`h-12 sm:h-16 rounded-lg border p-1 sm:p-1.5 text-left transition flex flex-col touch-target active:scale-95 ${
                  isSelected
                    ? "bg-blue-50 border-blue-400 ring-1 sm:ring-2 ring-blue-300"
                    : isToday
                    ? "bg-blue-50/50 border-blue-200"
                    : "border-slate-100 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`text-[10px] sm:text-xs font-bold ${
                    isToday ? "text-blue-600" : "text-slate-700"
                  }`}
                >
                  {cell.getDate()}
                </span>
                {dayReports.length > 0 && (
                  <div className="mt-0.5 sm:mt-1 space-y-0.5 flex-1 overflow-hidden">
                    {dayReports.slice(0, isMobile ? 1 : 2).map((r, idx) => (
                      <div
                        key={idx}
                        className={`text-[8px] sm:text-[9px] leading-tight px-0.5 sm:px-1 py-0.5 rounded truncate font-medium ${
                          r.priority === "urgent"
                            ? "bg-red-100 text-red-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {isMobile ? '•' : (INTERVENTION_LABELS[r.interventionType] || r.interventionType)}
                      </div>
                    ))}
                    {dayReports.length > (isMobile ? 1 : 2) && !isMobile && (
                      <span className="text-[9px] text-slate-400 font-medium pl-1">
                        +{dayReports.length - 2} lagi
                      </span>
                    )}
                    {hasUrgent && (
                      <span className="inline-block w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-red-500 mt-0.5" />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Side Panel (Desktop) / Bottom Sheet (Mobile) */}
      {isMobile ? (
        // Mobile Bottom Sheet
        selectedDay && (
          <div className="fixed inset-x-0 bottom-0 z-40 bg-white rounded-t-2xl shadow-2xl max-h-[70vh] overflow-y-auto animate-[slideUp_0.3s_ease-out] safe-area-bottom">
            <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between">
              <h4 className="font-bold text-slate-800 flex items-center gap-2">
                <i className="ph-fill ph-calendar-check text-purple-500"></i>
                {new Date(selectedDay).toLocaleDateString("ms-MY", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                })}
              </h4>
              <button
                onClick={() => setSelectedDay(null)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition touch-target"
                aria-label="Close"
              >
                <i className="ph-bold ph-x text-xl"></i>
              </button>
            </div>
            <div className="p-4 space-y-3">
              {selectedDayReports.length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-8">Tiada temujanji pada hari ini.</p>
              ) : (
                selectedDayReports.map((r) => (
                  <div
                    key={r._id}
                    className="border border-slate-100 rounded-xl p-3 hover:shadow-sm transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{r.studentName}</p>
                        <p className="text-xs text-slate-500">{r.course}</p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0 ml-2 ${
                          r.priority === "urgent"
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {r.priority === "urgent" ? "SEGERA" : "NORMAL"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                      <span className="flex items-center gap-1">
                        <i className="ph ph-clock"></i>
                        {formatTime(r.scheduledDate)}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="ph ph-tag"></i>
                        {INTERVENTION_LABELS[r.interventionType] || r.interventionType}
                      </span>
                    </div>

                    {r.filePath && (
                      <a
                        href={r.filePath}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1 mb-2"
                      >
                        <i className="ph ph-paperclip"></i> Lampiran
                      </a>
                    )}

                    {r.status === "scheduled" && onComplete && (
                      <button
                        onClick={() => onComplete(r)}
                        className="w-full mt-1 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 touch-target active:scale-95"
                      >
                        <i className="ph-bold ph-check-circle"></i> Tandakan Selesai
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )
      ) : (
        // Desktop Side Panel
        <div className="space-y-4">
          {selectedDay ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 animate-[fadeIn_0.3s_ease-out]">
              <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <i className="ph-fill ph-calendar-check text-purple-500"></i>
                {new Date(selectedDay).toLocaleDateString("ms-MY", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </h4>

              {selectedDayReports.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Tiada temujanji pada hari ini.</p>
              ) : (
                <div className="space-y-3">
                  {selectedDayReports.map((r) => (
                    <div
                      key={r._id}
                      className="border border-slate-100 rounded-xl p-3 hover:shadow-sm transition"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{r.studentName}</p>
                          <p className="text-xs text-slate-500">{r.course}</p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            r.priority === "urgent"
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {r.priority === "urgent" ? "SEGERA" : "NORMAL"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                        <span className="flex items-center gap-1">
                          <i className="ph ph-clock"></i>
                          {formatTime(r.scheduledDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <i className="ph ph-tag"></i>
                          {INTERVENTION_LABELS[r.interventionType] || r.interventionType}
                        </span>
                      </div>

                      {r.filePath && (
                        <a
                          href={r.filePath}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1 mb-2"
                        >
                          <i className="ph ph-paperclip"></i> Lampiran
                        </a>
                      )}

                      {r.status === "scheduled" && onComplete && (
                        <button
                          onClick={() => onComplete(r)}
                          className="w-full mt-1 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <i className="ph-bold ph-check-circle"></i> Tandakan Selesai
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <i className="ph ph-calendar-blank text-4xl text-slate-300 mb-3"></i>
                <p className="text-sm text-slate-500">Pilih hari pada kalendar untuk melihat butiran temujanji.</p>
              </div>
            </div>
          )}

          {/* Upcoming Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h4 className="font-bold text-slate-800 mb-3 text-sm">
              <i className="ph-fill ph-list-checks text-blue-500 mr-2"></i>
              Temujanji Akan Datang
            </h4>
            {scheduledReports.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Tiada temujanji dijadualkan.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto scroll-smooth-mobile">
                {scheduledReports
                  .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))
                  .map((r) => (
                    <div
                      key={r._id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition cursor-pointer touch-target"
                      onClick={() => setSelectedDay(dayKey(new Date(r.scheduledDate)))}
                    >
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          r.priority === "urgent" ? "bg-red-500" : "bg-purple-400"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">{r.studentName}</p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(r.scheduledDate).toLocaleDateString("ms-MY", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}