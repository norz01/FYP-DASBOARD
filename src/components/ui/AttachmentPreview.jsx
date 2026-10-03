import { formatFileSize } from '@/lib/use-file-preview';

export default function AttachmentPreview({ file, previewUrl, onRemove }) {
  if (!file) return null;

  const isPdf = file.type === 'application/pdf';
  const isImage = file.type.startsWith('image/');

  return (
    <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden bg-slate-50 animate-[scaleIn_0.2s_ease-out]">
      <div className="flex items-center justify-between p-3 bg-white border-b border-slate-100">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 truncate flex-1 min-w-0">
          <i className={`ph-fill ${isPdf ? 'ph-file-pdf text-red-500' : 'ph-file-image text-blue-500'} text-lg flex-shrink-0`}></i>
          <span className="truncate">{file.name}</span>
          <span className="text-xs text-slate-400 flex-shrink-0">({formatFileSize(file.size)})</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-600 hover:underline font-medium touch-target flex items-center px-2 py-1"
            >
              Buka
            </a>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="text-slate-400 hover:text-red-500 transition p-2 touch-target rounded-lg hover:bg-red-50 active:scale-95"
            aria-label="Remove file"
          >
            <i className="ph-bold ph-x text-lg"></i>
          </button>
        </div>
      </div>
      {isImage && previewUrl && (
        <div className="p-3 flex justify-center bg-slate-100 max-h-48 sm:max-h-64 overflow-hidden">
          <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain rounded" />
        </div>
      )}
      {isPdf && previewUrl && (
        <div className="h-48 sm:h-64 bg-slate-200">
          <iframe src={previewUrl} className="w-full h-full" title="PDF Preview" />
        </div>
      )}
    </div>
  );
}