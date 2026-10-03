import { useState, useEffect } from 'react';

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function useFilePreview({ acceptTypes = ['pdf', 'jpeg', 'png', 'jpg'], maxBytes = MAX_ATTACHMENT_BYTES } = {}) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [file]);

  const selectFile = (selectedFile) => {
    setError(null);
    if (!selectedFile) {
      setFile(null);
      return;
    }

    if (selectedFile.size > maxBytes) {
      setError(`Fail terlalu besar. Maksimum ${formatFileSize(maxBytes)}.`);
      setFile(null);
      return;
    }

    const ext = selectedFile.name.split('.').pop().toLowerCase();
    const mime = selectedFile.type.split('/')[1];
    
    const isValidExt = acceptTypes.some(type => ext.includes(type) || mime.includes(type));
    if (!isValidExt) {
      setError(`Jenis fail tidak disokong. Terima: ${acceptTypes.join(', ')}.`);
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const clear = () => {
    setFile(null);
    setError(null);
  };

  return { file, previewUrl, error, selectFile, clear };
}