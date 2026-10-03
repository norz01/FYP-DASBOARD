import { formatMsDate } from './ui/dashboard-kit';

export default function StudentDetailModal({ kind, appointment, report, item, onClose, onDownload, onPrint, onShare }) {
  const resolvedKind = item?.itemType || kind;
  const data = appointment || report || item;

  if (!data) return null;

  const isAppointment = resolvedKind === 'appointment';
  const isReport = resolvedKind === 'report';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-2xl overflow-y-auto scroll-smooth-mobile sm:max-w-2xl safe-area-top safe-area-bottom animate-[slideUp_0.3s_ease-out]">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isAppointment ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
              <i className={`ph-fill ${isAppointment ? 'ph-calendar-check' : 'ph-file-text'} text-xl`}></i>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">{isAppointment ? 'Butiran Temujanji' : 'Butiran Laporan'}</h3>
              <p className="text-xs text-slate-500 truncate">{isAppointment ? data.interventionType : data.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition touch-target flex-shrink-0 ml-2"
            aria-label="Close"
          >
            <i className="ph-bold ph-x text-xl"></i>
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Pelajar</p>
              <p className="text-xs sm:text-sm font-medium text-slate-800 mt-1">{data.studentName}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Kursus</p>
              <p className="text-xs sm:text-sm font-medium text-slate-800 mt-1">{data.course || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">CGPA</p>
              <p className="text-xs sm:text-sm font-medium text-slate-800 mt-1">{data.cgpa || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Kehadiran</p>
              <p className="text-xs sm:text-sm font-medium text-slate-800 mt-1">{data.attendance || '-'}%</p>
            </div>
          </div>

          {isAppointment && (
            <>
              <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-purple-800 uppercase">Tarikh Temujanji</p>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${data.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}>
                    {data.priority === 'urgent' ? 'SEGERA' : 'NORMAL'}
                  </span>
                </div>
                <p className="text-base sm:text-lg font-bold text-purple-900">{formatMsDate(data.scheduledDate, true)}</p>
                <p className="text-xs text-purple-700 mt-1">Kaunselor: {data.counselorId || 'Belum ditetapkan'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Sebab Rujukan</p>
                <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">{data.reason}</p>
              </div>
              {data.counselorNotes && (
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Nota Kaunselor</p>
                  <p className="text-sm text-slate-700 bg-emerald-50 p-3 rounded-xl border border-emerald-100">{data.counselorNotes}</p>
                </div>
              )}
            </>
          )}

          {isReport && (
            <>
              <div>
                <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Mesej / Kandungan</p>
                <div className="text-sm text-slate-700 bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100 whitespace-pre-wrap">
                  {data.message || <span className="italic text-slate-400">Tiada mesej teks. Sila rujuk lampiran PDF.</span>}
                </div>
              </div>
              {data.filePath && (
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Lampiran Rasmi</p>
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <iframe src={data.filePath} className="w-full h-64 sm:h-96" title="PDF Laporan" />
                  </div>
                </div>
              )}
            </>
          )}

          {data.filePath && (
            <div className="flex gap-2 flex-wrap sticky bottom-0 bg-white pt-4 sm:pt-0 sm:static pb-safe sm:pb-0">
              <a
                href={data.filePath}
                download
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 sm:py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-100 transition touch-target active:scale-95"
              >
                <i className="ph-bold ph-download-simple"></i> Muat Turun
              </a>
              <button
                onClick={() => window.open(data.filePath, '_blank')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 sm:py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition touch-target active:scale-95"
              >
                <i className="ph-bold ph-printer"></i> Cetak
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}