"use client";
import React, { useEffect } from "react";
import Image from "next/image";
import { getRoleLabel } from "@/lib/roles";

export default function Sidebar({
  navItems,
  activeTab,
  setActiveTab,
  isSidebarOpen,
  setIsSidebarOpen,
  currentUser,
  handleLogout,
}) {
  const displayName = currentUser?.displayName || "User IKMB";
  const roleLabel = getRoleLabel(currentUser?.role);
  const userInitials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };
    if (isSidebarOpen) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isSidebarOpen, setIsSidebarOpen]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isSidebarOpen && window.innerWidth < 768) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isSidebarOpen]);

  return (
    <>
      {/* Backdrop overlay for mobile */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 md:hidden animate-[fadeIn_0.2s_ease-out]"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 ease-out shadow-2xl md:shadow-none
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0
          sidebar-mobile-full md:w-64
          safe-area-top safe-area-bottom`}
      >
        {/* Header */}
        <div className="p-4 md:p-6 flex items-center justify-between border-b border-slate-100">
          <Image
            src="/logo-tvetmara.jpg"
            alt="TVETMARA"
            width={192}
            height={48}
            className="w-32 md:w-48 h-auto object-contain"
            priority
          />
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden text-slate-400 hover:text-slate-600 touch-target flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close menu"
          >
            <i className="ph-bold ph-x text-xl"></i>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto scroll-smooth-mobile">
          <p className="px-4 md:px-6 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-2">
            Menu Utama
          </p>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 md:px-6 py-3 md:py-3 text-sm font-medium transition-all duration-200 touch-target no-select
                ${
                  activeTab === item.id
                    ? "bg-blue-50 text-blue-600 border-l-4 border-blue-600"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 active:bg-slate-100"
                }`}
            >
              <i className={`ph ${item.icon} text-lg md:text-lg`}></i>
              <span className="text-responsive-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User Profile & Logout */}
        <div className="p-3 md:p-4 border-t border-slate-100 bg-slate-50/50 safe-area-bottom">
          <div className="flex items-center justify-between p-2 md:p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 md:gap-3 overflow-hidden flex-1">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-blue-600 flex justify-center items-center text-white font-bold text-xs md:text-sm shrink-0">
                {userInitials}
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <p className="text-xs md:text-sm font-bold text-slate-800 truncate">
                  {displayName}
                </p>
                <p className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase">
                  {roleLabel}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-lg touch-target flex items-center justify-center active:scale-95"
              aria-label="Logout"
            >
              <i className="ph-bold ph-sign-out text-lg md:text-xl"></i>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}