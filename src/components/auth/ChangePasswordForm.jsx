"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { changePasswordAction } from "@/app/actions";
import { getClientUser } from "@/lib/client-auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full flex justify-center py-3 px-4 rounded-xl text-sm font-bold text-white transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] ${pending ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/25"}`}
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <i className="ph ph-spinner-gap animate-spin text-lg"></i>
          Mengemas Kini...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <i className="ph-bold ph-key text-lg"></i>
          Tukar Kata Laluan
        </span>
      )}
    </button>
  );
}

export default function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, null);
  const [user, setUser] = useState(null);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  useEffect(() => setUser(getClientUser()), []);

  const rules = [
    { ok: newPw.length >= 8, label: "Sekurang-kurangnya 8 aksara" },
    { ok: /[A-Za-z]/.test(newPw) && /[0-9]/.test(newPw), label: "Mengandungi huruf DAN nombor" },
    { ok: /[^A-Za-z0-9]/.test(newPw), label: "Simbol (!, @, #) — disyorkan" },
  ];
  const mismatch = confirmPw.length > 0 && newPw !== confirmPw;

  return (
    <div className="bg-slate-50 min-h-screen w-full flex items-center justify-center p-6 font-sans text-slate-900 relative overflow-hidden">
      {/* Decorative orbs */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500 rounded-full blur-3xl opacity-20 animate-[floatSoft_6s_ease-in-out_infinite]"></div>
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500 rounded-full blur-3xl opacity-20 animate-[floatSoft_8s_ease-in-out_infinite_1s]"></div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8 space-y-6 animate-[scaleIn_0.3s_ease-out] relative z-10">
        <div className="text-center animate-[slideUp_0.4s_ease-out_0.1s] anim-fill">
          <div className="w-14 h-14 mx-auto bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 animate-[floatSoft_3s_ease-in-out_infinite]">
            <i className="ph-fill ph-lock-key-open text-2xl"></i>
          </div>
          <h1 className="text-2xl font-bold">Tukar Kata Laluan</h1>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Demi keselamatan akaun anda, sila cipta kata laluan baharu
            sebelum meneruskan penggunaan dashboard.
          </p>
          {user?.email && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-mono bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full">
              <i className="ph-fill ph-user-circle text-blue-500"></i>
              {user.email}
            </p>
          )}
        </div>

        <form action={formAction} className="space-y-5">
          <div className="space-y-2 animate-[slideUp_0.4s_ease-out_0.2s] anim-fill">
            <label htmlFor="currentPassword" className="text-sm font-semibold text-slate-700">
              Kata Laluan Semasa
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="ph ph-key text-slate-400 text-lg"></i>
              </div>
              <input
                id="currentPassword"
                type="password"
                name="currentPassword"
                required
                className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200"
              />
            </div>
          </div>

          <div className="space-y-2 animate-[slideUp_0.4s_ease-out_0.3s] anim-fill">
            <label htmlFor="newPassword" className="text-sm font-semibold text-slate-700">
              Kata Laluan Baharu
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="ph ph-lock-key text-slate-400 text-lg"></i>
              </div>
              <input
                id="newPassword"
                type="password"
                name="newPassword"
                required
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200"
              />
            </div>
            <ul className="space-y-1 pt-1">
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

          <div className="space-y-2 animate-[slideUp_0.4s_ease-out_0.4s] anim-fill">
            <label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-700">
              Sahkan Kata Laluan Baharu
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="ph ph-shield-check text-slate-400 text-lg"></i>
              </div>
              <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                required
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className={`block w-full pl-10 pr-3 py-3 border rounded-xl focus:ring-2 outline-none transition-all duration-200 ${mismatch ? "border-red-400 focus:ring-red-500/20 focus:border-red-500" : "border-slate-200 focus:ring-blue-500/20 focus:border-blue-500"}`}
              />
            </div>
            {mismatch && (
              <p className="text-[11px] text-red-500 font-medium animate-[fadeIn_0.2s_ease-out]">
                Kata laluan tidak sepadan.
              </p>
            )}
          </div>

          <div className="animate-[slideUp_0.4s_ease-out_0.5s] anim-fill">
            <SubmitButton />
          </div>

          {state?.error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 animate-[scaleIn_0.3s_ease-out]">
              {state.error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}