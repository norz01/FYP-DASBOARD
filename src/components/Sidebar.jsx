import React from "react";

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
  const roleLabel = currentUser?.role === "admin" ? "Penyelaras" : "Pelajar";
  const userInitials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200 flex flex-col transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} transition-transform duration-300 md:relative md:translate-x-0 shadow-2xl md:shadow-none`}
    >
      <div className="p-6 flex items-center justify-between border-b border-slate-100">
        <img
          src="/logo-tvetmara.jpg"
          alt="TVETMARA"
          className="w-48 h-auto object-contain"
        />
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="md:hidden text-slate-400 hover:text-slate-600"
        >
          <i className="ph-bold ph-x text-xl"></i>
        </button>
      </div>

      <nav className="flex-1 py-4 space-y-2 overflow-y-auto">
        <p className="px-6 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-2">
          Menu Utama
        </p>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id);
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-all ${activeTab === item.id ? "bg-blue-50 text-blue-600 border-l-4 border-blue-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
          >
            <i className={`ph ${item.icon} text-lg`}></i> {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex justify-center items-center text-white font-bold text-sm shrink-0">
              {userInitials}
            </div>
            <div className="flex flex-col">
              <p className="text-sm font-bold text-slate-800 truncate w-32">
                {displayName}
              </p>
              <p className="text-[10px] text-slate-500 font-bold uppercase">
                {roleLabel}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-red-600 transition p-2 hover:bg-red-50 rounded-lg"
          >
            <i className="ph-bold ph-sign-out text-xl"></i>
          </button>
        </div>
      </div>
    </aside>
  );
}
