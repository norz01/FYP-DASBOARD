"use client";

import { useState } from "react";

export default function ForgotPasswordModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1);
  const [idPelajar, setIdPelajar] = useState("");
  const [noKP, setNoKP] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const resetState = () => {
    setStep(1);
    setIdPelajar("");
    setNoKP("");
    setNewPassword("");
    setConfirmPassword("");
    setResetToken(null);
    setError(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idPelajar: idPelajar.trim(), noKP: noKP.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Pengesahan gagal.");
      setResetToken(data.resetToken);
      setError(null);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Pengesahan kata laluan tidak sepadan.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/complete-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Gagal menukar kata laluan.");
      resetState();
      onClose();
      // Parent login form will show the success state via its own error box? No —
      // simplest: alert-free inline confirmation handled by parent is overkill;
      // we close and let the user log in with the new password.
      window.setTimeout(() => {
        // gentle nudge: focus the password field on the login form
        document.getElementById("password")?.focus();
      }, 100);
    } catch (err) {
      setError(err.message);
      if (/token/i.test(err.message)) {
        // token dead/consumed -> restart verification
        setStep(1);
        setResetToken(null);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const rules = [
    { ok: newPassword.length >= 8, label: "Sekurang-kurangnya 8 aksara" },
    { ok: /[A-Za-z]/.test(newPassword) && /[0-9]/.test(newPassword), label: "Mengandungi huruf DAN nombor" },
  ];

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
      onClick={handleClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-xl p-8 space-y-5 animate-[slideUp_0.3s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="w-12 h-12 mx-auto bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-3 animate-[floatSoft_3s_ease-in-out_infinite]">
            <i className="ph-fill ph-key-hole text-2xl"></i>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {step === 1 ? "Pulihkan Akaun Anda" : "Cipta Kata Laluan Baharu"}
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            {step === 1
              ? "Sahkan identiti anda menggunakan No. Pendaftaran dan No. KP seperti dalam rekod akademik."
              : "Identiti disahkan. Kata laluan baharu mesti mematuhi dasar keselamatan."}
          </p>
        </div>

        {step === 1 && (
          <form onSubmit={handleVerify} className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
            <div>
              <label className="text-sm font-semibold text-slate-700">No. Pendaftaran</label>
              <input
                type="text"
                required
                value={idPelajar}
                onChange={(e) => setIdPelajar(e.target.value)}
                placeholder="cth: 333571247823"
                className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">No. KP</label>
              <input
                type="text"
                required
                value={noKP}
                onChange={(e) => setNoKP(e.target.value)}
                placeholder="cth: 051209-11-0543"
                className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200"
              />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Akaun staff (admin / kaunselor)? Sila hubungi penyelaras sistem untuk
              penetapan semula kata laluan.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition active:scale-95"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition active:scale-95 flex items-center justify-center gap-2 ${isSubmitting ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
              >
                {isSubmitting ? <i className="ph ph-spinner-gap animate-spin"></i> : null}
                Sahkan
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleReset} className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
            <div>
              <label className="text-sm font-semibold text-slate-700">Kata Laluan Baharu</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200"
              />
              <ul className="space-y-1 pt-2">
                {rules.map((r) => (
                  <li
                    key={r.label}
                    className={`flex items-center gap-1.5 text-[11px] transition-colors duration-200 ${r.ok ? "text-emerald-600" : "text-slate-400"}`}
                  >
                    <i className={`ph-fill ${r.ok ? "ph-check-circle" : "ph-circle"} text-sm`}></i>
                    {r.label}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Sahkan Kata Laluan</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`mt-1 w-full px-3 py-2.5 border rounded-xl text-sm focus:ring-2 outline-none transition-all duration-200 ${confirmPassword && confirmPassword !== newPassword ? "border-red-400 focus:ring-red-500/20" : "border-slate-200 focus:ring-blue-500/20 focus:border-blue-500"}`}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-2.5 rounded-xl text-sm font-bold text-white transition active:scale-95 flex items-center justify-center gap-2 ${isSubmitting ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/25"}`}
            >
              {isSubmitting ? <i className="ph ph-spinner-gap animate-spin"></i> : <i className="ph-bold ph-check-circle"></i>}
              Tukar Kata Laluan
            </button>
          </form>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 animate-[scaleIn_0.3s_ease-out]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
