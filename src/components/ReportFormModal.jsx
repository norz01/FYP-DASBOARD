import { useState, useEffect } from 'react';
import { useFilePreview } from '@/lib/use-file-preview';
import AttachmentPreview from './ui/AttachmentPreview';

export default function ReportFormModal({ isOpen, onClose, student, interventionType }) {
  const [reason, setReason] = useState('');
  const [priority, setPriority] = useState('normal');
  const [scheduledDate, setScheduledDate] = useState('');
  const [counselorId, setCounselorId] = useState('');
  const [counselors, setCounselors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const { file, previewUrl, error: fileError, selectFile, clear: clearFile } = useFilePreview();

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll
      document.body.style.overflow = 'hidden';

      fetch('/api/auth/users')
        .then(res => res.json())
        .then(users => {
          const cList = users.filter(u => u.role === 'counselor');
          setCounselors(cList);
          if (cList.length > 0) setCounselorId(cList[0].email);
        })
        .catch(err => console.error('Fetch counselors error:', err));

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      setScheduledDate(tomorrow.toISOString().slice(0, 16));
    } else {
      document.body.style.overflow = '';
      setReason('');
      setPriority('normal');
      clearFile();
      setToast(null);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, clearFile]);

  if (!isOpen || !student) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setToast({ type: 'error', text: 'Sila isi sebab rujukan.' });
      return;
    }

    setIsSubmitting(true);
    setToast(null);

    const formData = new FormData();
    formData.append('studentId', student.id);
    formData.append('studentName', student.nama);
    formData.append('course', student.kursus);
    formData.append('cgpa', student.cgpa);
    formData.append('attendance', student.attendance);
    formData.append('riskLevel', student.dropoutRisk);
    formData.append('interventionType', interventionType);
    formData.append('reason', reason);
    formData.append('priority', priority);
    formData.append('scheduledDate', scheduledDate);
    formData.append('counselorId', counselorId);
    if (file) formData.append('file', file);

    try {
      const res = await fetch('/api/reports', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menghantar rujukan.');

      setToast({ type: 'success', text: 'Rujukan berjaya dihantar kepada kaunselor!' });
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setToast({ type: 'error', text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const interventionLabels = {
    kaunseling: 'Kaunseling Kehadiran / Peribadi',
    klinik: 'Klinik Akademik',
    softskills: 'Latihan Soft Skills',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-2xl overflow-y-auto scroll-smooth-mobile sm:max-w-lg safe-area-top safe-area-bottom animate-[slideUp_0.3s_ease-out]">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">Rujuk ke Kaunselor</h3>
            <p className="text-xs text-slate-500 mt-1 truncate">
              <span className="font-medium">{student.nama}</span> • {interventionLabels[interventionType] || interventionType}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition touch-target flex-shrink-0 ml-2"
            aria-label="Close"
          >
            <i className="ph-bold ph-x text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {toast && (
            <div className={`p-3 rounded-xl text-sm font-medium animate-[scaleIn_0.2s_ease-out] ${toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {toast.text}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Kaunselor Bertugas</label>
            <select
              value={counselorId}
              onChange={(e) => setCounselorId(e.target.value)}
              className="w-full border border-slate-300 p-3 sm:p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none touch-target bg-white"
              required
            >
              {counselors.length === 0 && <option value="">Tiada kaunselor ditemui</option>}
              {counselors.map(c => (
                <option key={c.email} value={c.email}>{c.displayName || c.email}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Tarikh & Masa</label>
              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full border border-slate-300 p-3 sm:p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none touch-target"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Keutamaan</label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setPriority('normal')}
                  className={`flex-1 py-3 sm:py-2 rounded-xl text-xs font-bold border transition touch-target active:scale-95 ${priority === 'normal' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setPriority('urgent')}
                  className={`flex-1 py-3 sm:py-2 rounded-xl text-xs font-bold border transition touch-target active:scale-95 ${priority === 'urgent' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  Segera
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Sebab Rujukan / Nota</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows="4"
              placeholder="cth: Pelajar tidak hadir 3 minggu berturut-turut tanpa sebab..."
              className="w-full border border-slate-300 p-3 sm:p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Lampiran Sokongan (PDF/Image, Max 5MB)</label>
            {!file ? (
              <label className="w-full flex flex-col items-center justify-center h-24 sm:h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition touch-target active:scale-[0.98]">
                <i className="ph-fill ph-upload-simple text-2xl text-slate-400"></i>
                <span className="text-xs text-slate-500 mt-1">Klik untuk memilih fail</span>
                <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => selectFile(e.target.files[0])} className="hidden" />
              </label>
            ) : (
              <AttachmentPreview file={file} previewUrl={previewUrl} onRemove={clearFile} />
            )}
            {fileError && <p className="text-xs text-red-500 mt-1">{fileError}</p>}
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100 sm:border-t-0 sm:pt-0 sticky bottom-0 bg-white sm:static pb-safe sm:pb-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 sm:py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold text-sm transition touch-target active:scale-95"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || counselors.length === 0}
              className="flex-1 py-3 sm:py-2.5 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 touch-target active:scale-95 shadow-lg shadow-blue-600/20 disabled:shadow-none"
            >
              {isSubmitting ? (
                <><i className="ph ph-spinner-gap animate-spin"></i> Menghantar...</>
              ) : (
                <><i className="ph-bold ph-paper-plane-tilt"></i> Hantar Rujukan</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}