"use client";
import React, { useEffect, useRef } from "react";

export default function StudentModal({
  isOpen,
  onClose,
  editingStudent,
  formData,
  handleInputChange,
  handleSubmit,
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleBackdropClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center items-center p-0 sm:p-4 animate-[fadeIn_0.2s_ease-out]"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl overflow-y-auto scroll-smooth-mobile safe-area-top safe-area-bottom sm:max-w-2xl animate-[slideUp_0.3s_ease-out]"
      >
        {/* Header - Sticky on mobile */}
        <div className="sticky top-0 bg-white z-10 p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg sm:text-xl font-bold text-slate-900">
            {editingStudent ? "Kemaskini Pelajar" : "Tambah Pelajar Baharu"}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 touch-target flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <i className="ph-bold ph-x text-xl"></i>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500">ID Pelajar</label>
              <input
                name="ID_Pelajar"
                value={formData.ID_Pelajar}
                onChange={handleInputChange}
                className="border border-slate-300 p-3 sm:p-2 rounded-xl touch-target focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                required
                disabled={!!editingStudent}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500">Nama Pelajar</label>
              <input
                name="Nama"
                value={formData.Nama}
                onChange={handleInputChange}
                className="border border-slate-300 p-3 sm:p-2 rounded-xl touch-target focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500">CGPA</label>
              <input
                name="CGPA"
                value={formData.CGPA}
                onChange={handleInputChange}
                className="border border-slate-300 p-3 sm:p-2 rounded-xl touch-target focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500">Kehadiran (%)</label>
              <input
                name="Kehadiran_Pct"
                value={formData.Kehadiran_Pct}
                onChange={handleInputChange}
                className="border border-slate-300 p-3 sm:p-2 rounded-xl touch-target focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500">Sijil Profesional</label>
              <select
                name="Sijil_Profesional"
                value={formData.Sijil_Profesional}
                onChange={handleInputChange}
                className="border border-slate-300 p-3 sm:p-2 rounded-xl touch-target focus:ring-2 focus:ring-blue-500 outline-none transition-shadow bg-white"
              >
                <option value="Tiada">Tiada</option>
                <option value="CompTIA">CompTIA</option>
                <option value="Cisco CCNA">Cisco CCNA</option>
                <option value="AWS Cloud">AWS Cloud</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500">Kursus</label>
              <select
                name="Kursus"
                value={formData.Kursus}
                onChange={handleInputChange}
                className="border border-slate-300 p-3 sm:p-2 rounded-xl touch-target focus:ring-2 focus:ring-blue-500 outline-none transition-shadow bg-white"
              >
                <option value="ITW">ITW - Kimpalan</option>
                <option value="DGA">DGA - Teknologi Automotif</option>
                <option value="DFK">DFK - Cloud Computing</option>
                <option value="PPU">PPU - Penyamanan Udara</option>
                <option value="SLR">SLR - Lukisan Mekanikal</option>
                <option value="DCG">DCG - Elektrik (PW4)</option>
                <option value="SED">Sijil Elektrik Domestik</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-bold text-slate-500">Status Pelajar</label>
              <select
                name="Status_Pelajar"
                value={formData.Status_Pelajar}
                onChange={handleInputChange}
                className="border border-slate-300 p-3 sm:p-2 rounded-xl touch-target focus:ring-2 focus:ring-blue-500 outline-none transition-shadow bg-white"
              >
                <option value="Bermasalah">Bermasalah</option>
                <option value="Sederhana">Sederhana</option>
                <option value="Cemerlang">Cemerlang</option>
              </select>
            </div>
          </div>

          {/* Action Buttons - Sticky on mobile */}
          <div className="flex gap-3 pt-4 border-t border-slate-100 sm:border-t-0 sm:pt-0 sm:mt-4 sticky bottom-0 bg-white sm:static pb-safe sm:pb-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 sm:py-2 text-slate-700 hover:bg-slate-100 rounded-xl font-medium touch-target transition-colors active:scale-95"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white px-6 py-3 sm:py-2 rounded-xl hover:bg-blue-700 font-medium touch-target transition-all active:scale-95 shadow-lg shadow-blue-600/20"
            >
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}