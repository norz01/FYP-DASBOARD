"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "@/app/actions";

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
          Memproses...
        </span>
      ) : (
        "Log Masuk Dashboard"
      )}
    </button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useActionState(loginAction, null);

  return (
    <div className="bg-slate-50 h-screen w-full flex overflow-hidden font-sans text-slate-900">
      {/* ═══ BAHAGIAN KIRI — slides in from left ═══ */}
      <div className="hidden lg:flex w-1/2 bg-blue-600 relative items-center justify-center overflow-hidden animate-[slideInLeft_0.6s_ease-out] anim-fill">
        <img
          src="https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=2070&auto=format&fit=crop"
          className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay"
          alt="AI Background"
        />
        <div className="relative z-10 text-white p-12 max-w-lg">
          {/* Icon floats gently */}
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-6 animate-[floatSoft_3s_ease-in-out_infinite]">
            <i className="ph-bold ph-brain text-2xl"></i>
          </div>
          {/* Staggered text entrance */}
          <h1 className="text-4xl font-bold mb-4 leading-tight animate-[slideUp_0.5s_ease-out_0.2s] anim-fill">
            Revolusi Bakat TVET dengan Kuasa AI.
          </h1>
          <p className="text-blue-100 text-lg leading-relaxed animate-[slideUp_0.5s_ease-out_0.35s] anim-fill">
            Platform analitik termaju untuk memacu kebolehpasaran graduan
            TVETMARA Besut melalui data dan kecerdasan buatan.
          </p>
        </div>
        {/* Decorative orbs with soft pulse */}
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-50 animate-[floatSoft_6s_ease-in-out_infinite]"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500 rounded-full blur-3xl opacity-30 animate-[floatSoft_8s_ease-in-out_infinite_1s]"></div>
      </div>

      {/* ═══ BAHAGIAN KANAN — slides in from right ═══ */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white animate-[slideInRight_0.6s_ease-out] anim-fill">
        <div className="w-full max-w-md space-y-8">
          {/* Header block */}
          <div className="text-center lg:text-left animate-[slideUp_0.5s_ease-out_0.15s] anim-fill">
            <img
              src="/logo-tvetmara.jpg"
              alt="Logo IKMB"
              className="w-64 h-auto mb-8 mx-auto lg:mx-0 object-contain"
            />
            <h2 className="text-3xl font-bold text-slate-900">
              Selamat Kembali
            </h2>
            <p className="text-slate-500 mt-2">
              Sila log masuk untuk akses papan pemuka.
            </p>
            <p className="text-xs text-slate-400 mt-3 leading-relaxed">
              Akaun default: <strong>admin@ikmb.edu.my</strong> atau{" "}
              <strong>user@ikmb.edu.my</strong>. Semua kata laluan ialah{" "}
              <strong>password123</strong>.
            </p>
          </div>

          {/* Form with staggered fields */}
          <form action={formAction} className="space-y-6">
            <div className="space-y-2 animate-[slideUp_0.5s_ease-out_0.25s] anim-fill">
              <label
                htmlFor="email"
                className="text-sm font-semibold text-slate-700"
              >
                Emel Pengguna
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="ph ph-envelope text-slate-400 text-lg"></i>
                </div>
                <input
                  id="email"
                  type="email"
                  name="email"
                  required
                  defaultValue="admin@ikmb.edu.my"
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200"
                />
              </div>
            </div>

            <div className="space-y-2 animate-[slideUp_0.5s_ease-out_0.35s] anim-fill">
              <div className="flex justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-semibold text-slate-700"
                >
                  Kata Laluan
                </label>
                <a
                  href="#"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Lupa kata laluan?
                </a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="ph ph-lock-key text-slate-400 text-lg"></i>
                </div>
                <input
                  id="password"
                  type="password"
                  name="password"
                  required
                  defaultValue="password123"
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200"
                />
              </div>
            </div>

            <div className="animate-[slideUp_0.5s_ease-out_0.45s] anim-fill">
              <SubmitButton />
            </div>

            {/* Error box pops in */}
            {state?.error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 animate-[scaleIn_0.3s_ease-out]">
                {state.error}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
