import React from "react";
import { Badge, SkeletonList, formatMsDate } from "@/components/ui/dashboard-kit";

export default function JobCard({ job, isDynamic = false, delay = 0, onSearch, onDetails, detailsOpen = false, details, detailsLoading, detailsError, onRetryDetails, isSaved = false, onToggleSave, saveDisabled = false }) {
  if (isDynamic) {
    let applyLink = null;
    try {
      const url = new URL(job.applyLink);
      if (["http:", "https:"].includes(url.protocol)) applyLink = url.href;
    } catch {}
    return (
      <article className="flex flex-col p-5 bg-slate-900 rounded-2xl border border-slate-800 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group animate-[slideUp_0.4s_ease-out] anim-fill"
        style={{ animationDelay: `${delay}ms` }}>
        <div className="flex justify-between items-start gap-3 mb-3">
          <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg"><i className="ph-bold ph-briefcase text-xl" aria-hidden="true"></i></div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Badge tone="blue">{job.source || "JSearch"}</Badge>
            {onToggleSave && <button type="button" aria-label={`${isSaved ? "Disimpan" : "Simpan"} ${job.title}`} aria-pressed={isSaved} disabled={saveDisabled} onClick={() => onToggleSave(job)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-blue-200 rounded-xl border border-blue-400/40 hover:bg-blue-500/20 disabled:opacity-50 touch-target active:scale-95">
              <i className={`${isSaved ? "ph-fill" : "ph"} ph-bookmark-simple`} aria-hidden="true"></i>{isSaved ? "Disimpan" : "Simpan"}
            </button>}
          </div>
        </div>
        <h3 className="font-bold text-white mb-1 break-words">{job.title}</h3>
        <p className="text-sm text-slate-300 mb-3">{job.company}</p>
        <div className="space-y-2 text-xs text-slate-300 mb-4">
          <p><i className="ph ph-map-pin mr-1" aria-hidden="true"></i>{job.location}</p>
          <p><i className="ph ph-money mr-1" aria-hidden="true"></i>{job.salary}</p>
          {job.postedAt && <p>Disiarkan {formatMsDate(job.postedAt)}</p>}
        </div>
        {onDetails && <button type="button" aria-expanded={detailsOpen} onClick={() => onDetails(job)} className="mb-3 py-2 text-sm text-blue-300 rounded-xl border border-blue-500/30 hover:bg-blue-500/10 touch-target active:scale-95">{detailsOpen ? "Tutup Butiran" : "Lihat Butiran"} <span className="sr-only">untuk {job.title}</span></button>}
        {detailsOpen && <div className="mb-4 border-t border-slate-700 pt-4 animate-[fadeIn_0.3s_ease-out]" aria-live="polite" aria-busy={detailsLoading}>
          <h4 className="text-sm font-semibold text-white mb-2">Deskripsi Jawatan</h4>
          {detailsLoading ? <SkeletonList rows={3} /> : detailsError ? <div role="alert"><p className="text-sm text-amber-200">{detailsError}</p><button type="button" onClick={() => onRetryDetails(job)} className="mt-2 px-3 py-2 text-sm text-blue-200 rounded-xl border border-blue-500/30 touch-target active:scale-95">Cuba Lagi</button></div> : <p className="whitespace-pre-line break-words text-sm leading-relaxed text-slate-300">{details?.description || "Deskripsi tidak tersedia."}</p>}
        </div>}
        {applyLink ? (
          <a href={applyLink} target="_blank" rel="noopener noreferrer" className="mt-auto block text-center py-3 text-sm font-semibold text-blue-300 bg-blue-500/10 rounded-xl hover:bg-blue-600 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 transition-colors touch-target active:scale-95">
            Mohon Sekarang <i className="ph ph-arrow-square-out ml-1" aria-hidden="true"></i><span className="sr-only"> untuk {job.title} (tab baharu)</span>
          </a>
        ) : <p className="mt-auto text-sm text-slate-400">Pautan permohonan tidak tersedia.</p>}
      </article>
    );
  }
  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition group animate-[slideUp_0.4s_ease-out]">
      <div className="flex justify-between items-start mb-3 sm:mb-4">
        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl sm:text-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
          <i className={job.icon}></i>
        </div>
        <span className="bg-green-50 text-green-700 px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold border border-green-100 flex items-center gap-1">
          <i className="ph-fill ph-sparkle"></i> {job.match} Match
        </span>
      </div>
      <h3 className="font-bold text-base sm:text-lg text-slate-900">{job.title}</h3>
      <p className="text-slate-500 text-xs sm:text-sm mb-3 sm:mb-4">{job.company}</p>
      <button type="button" onClick={() => onSearch?.(job.title)} disabled={!onSearch} className="w-full py-3 sm:py-2.5 bg-slate-50 text-slate-600 hover:bg-blue-600 hover:text-white rounded-xl text-sm font-bold transition touch-target active:scale-95 shadow-sm hover:shadow-lg disabled:opacity-50">
        Cari Jawatan Ini
      </button>
    </div>
  );
}
