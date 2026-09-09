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

  // 🐛 FIX 1: Close modal when the 'Escape' key is pressed
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };
    
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }
    
    // Cleanup event listener when modal closes or component unmounts
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // 🐛 FIX 2: Close modal when clicking the darkened backdrop (outside the modal content)
  const handleBackdropClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-[100] flex justify-center items-center p-4"
      onClick={handleBackdropClick}
    >
      <div ref={modalRef} className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 relative">
        <h3 className="text-xl font-bold mb-4">
          {editingStudent ? "Kemaskini Pelajar" : "Tambah Pelajar Baharu"}
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500">ID Pelajar</label>
            <input name="ID_Pelajar" value={formData.ID_Pelajar} onChange={handleInputChange} className="border p-2 rounded-lg" required disabled={!!editingStudent} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500">Nama Pelajar</label>
            <input name="Nama" value={formData.Nama} onChange={handleInputChange} className="border p-2 rounded-lg" required />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500">CGPA</label>
            <input name="CGPA" value={formData.CGPA} onChange={handleInputChange} className="border p-2 rounded-lg" required />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500">Kehadiran (%)</label>
            <input name="Kehadiran_Pct" value={formData.Kehadiran_Pct} onChange={handleInputChange} className="border p-2 rounded-lg" required />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500">Sijil Profesional</label>
            <select name="Sijil_Profesional" value={formData.Sijil_Profesional} onChange={handleInputChange} className="border p-2 rounded-lg">
              <option value="Tiada">Tiada</option>
              <option value="CompTIA">CompTIA</option>
              <option value="Cisco CCNA">Cisco CCNA</option>
              <option value="AWS Cloud">AWS Cloud</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500">Kursus</label>
            <select name="Kursus" value={formData.Kursus} onChange={handleInputChange} className="border p-2 rounded-lg">
              <option value="ITW">ITW - Kimpalan</option>
              <option value="DGA">DGA - Teknologi Automotif</option>
              <option value="DFK">DFK - Cloud Computing</option>
              <option value="PPU">PPU - Penyamanan Udara</option>
              <option value="SLR">SLR - Lukisan Mekanikal</option>
              <option value="DCG">DCG - Elektrik (PW4)</option>
              <option value="SED">Sijil Elektrik Domestik</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <label className="text-xs font-bold text-slate-500">Status Pelajar</label>
            <select name="Status_Pelajar" value={formData.Status_Pelajar} onChange={handleInputChange} className="border p-2 rounded-lg">
              <option value="Bermasalah">Bermasalah</option>
              <option value="Sederhana">Sederhana</option>
              <option value="Cemerlang">Cemerlang</option>
            </select>
          </div>
          <div className="col-span-2 flex justify-end gap-3 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">Batal</button>
            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  );
}