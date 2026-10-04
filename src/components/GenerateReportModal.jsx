import { useState, useEffect, useRef } from 'react';
import { useFilePreview } from '@/lib/use-file-preview';
import AttachmentPreview from './ui/AttachmentPreview';

export default function GenerateReportModal({ isOpen, onClose, student, skillGap }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const { file, previewUrl, error: fileError, selectFile, clear: clearFile } = useFilePreview({ acceptTypes: ['pdf'] });

  // Track open->closed transition, reset only once on open
  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    // Only run initialization when modal transitions closed -> open
    if (isOpen && !prevIsOpenRef.current) {
      document.body.style.overflow = 'hidden';
      setTitle(student ? `Laporan Prestasi & Intervensi: ${student.nama}` : '');
      setMessage('');
      clearFile();
      setToast(null);
    }
    // Clean up when transitions open -> closed
    else if (!isOpen && prevIsOpenRef.current) {
      document.body.style.overflow = '';
    }

    // Update ref for next render
    prevIsOpenRef.current = isOpen;
  }, [isOpen, student, clearFile]);

  if (!isOpen || !student) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setToast({ type: 'error', text: 'Sila isi tajuk laporan.' });
      return;
    }
    if (!message.trim() && !file) {
      setToast({ type: 'error', text: 'Sila isi mesej atau lampirkan fail PDF.' });
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
    formData.append('semester', student.semester);
    formData.append('title', title);
    formData.append('message', message);

    if (skillGap?.chart?.labels) {
      const ploScores = skillGap.chart.labels.map((label, i) => ({
        label,
        value: skillGap.chart.current[i] || 0
      }));
      formData.append('ploScores', JSON.stringify(ploScores));
    }

    const employability = Math.min(100, Math.round((parseFloat(student.cgpa || 0) / 4) * 40 + parseFloat(student.attendance || 0) * 0.6));
    formData.append('employability', employability);

    if (file) formData.append('file', file);

    try {
      const res = await fetch('/api/student-reports', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menjana laporan.');

      setToast({ type: 'success', text: 'Laporan berjaya dihantar ke inbox pelajar!' });
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setToast({ type: 'error', text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-2xl overflow-y-auto scroll-smooth-mobile sm:max-w-lg safe-area-top safe-area-bottom animate-[slideUp_0.3s_ease-out]">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">Jana Laporan / Surat</h3>
            <p className="text-xs text-slate-500 mt-1 truncate">Untuk: <span className="font-medium">{student.nama}</span></p>
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
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Tajuk Laporan</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-slate-300 p-3 sm:p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none touch-target"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Mesej / Kandungan Surat</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows="5"
              placeholder="Tulis nasihat, amaran, atau pujian kepada pelajar di sini..."
              className="w-full border border-slate-300 p-3 sm:p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Lampiran PDF Rasmi (Pilihan)</label>
            {!file ? (
              <label className="w-full flex flex-col items-center justify-center h-24 sm:h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition touch-target active:scale-[0.98]">
                <i className="ph-fill ph-file-pdf text-2xl text-slate-400"></i>
                <span className="text-xs text-slate-500 mt-1">Lampirkan surat rasmi (PDF sahaja)</span>
                <input type="file" accept=".pdf" onChange={(e) => selectFile(e.target.files[0])} className="hidden" />
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
              disabled={isSubmitting}
              className="flex-1 py-3 sm:py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-300 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 touch-target active:scale-95 shadow-lg shadow-emerald-600/20 disabled:shadow-none"
            >
              {isSubmitting ? (
                <><i className="ph ph-spinner-gap animate-spin"></i> Menghantar...</>
              ) : (
                <><i className="ph-bold ph-paper-plane-tilt"></i> Hantar ke Pelajar</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}