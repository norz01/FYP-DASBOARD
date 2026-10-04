"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { getClientUser, getClientToken } from "@/lib/client-auth";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import Sidebar from "../Sidebar";
import KpiCard from "../KpiCard";
import StudentModal from "../StudentModal";
import StudentListGrid from "../StudentListGrid";
import CounselorDashboardClient from "./CounselorDashboardClient";
import { RiskBadge, getRiskMeta } from "../ui/dashboard-kit";
import { calculateEmployability, calculateTopPerformerScore } from "@/lib/heuristics";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

export default function StaffDashboardClient() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [formData, setFormData] = useState({
    ID_Pelajar: "",
    Nama: "",
    Kehadiran_Pct: "",
    CGPA: "",
    Sijil_Profesional: "Tiada",
    PLO_1: "0",
    PLO_2: "0",
    PLO_3: "0",
    PLO_4: "0",
    PLO_5: "0",
    PLO_6: "0",
    PLO_7: "0",
    PLO_8: "0",
    PLO_9: "0",
    Kursus: "DFK",
    Status_Pelajar: "Sederhana",
  });

  // AI CHAT STATE
  const [aiStudentId, setAiStudentId] = useState("");
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const chatEndRef = useRef(null); // For auto-scrolling
// AI SELECTOR: search + risk category filter
  const [aiSearch, setAiSearch] = useState("");
  const [isAiDropdownOpen, setIsAiDropdownOpen] = useState(false);
  const [aiRiskFilter, setAiRiskFilter] = useState("Semua");
  const aiSelectorRef = useRef(null);

  const [mdbFile, setMdbFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const [mdbFiles, setMdbFiles] = useState([]);
  const [datasetName, setDatasetName] = useState("");
  const [processingId, setProcessingId] = useState(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const u = getClientUser();
    setUser(u);

    const t = getClientToken();

    if (t) {
      fetch("/api/students", { headers: { Authorization: `Bearer ${t}` } })
        .then((res) => res.json())
        .then((data) => setStudents(data))
        .catch((err) => console.error("Fetch students error:", err))
        .finally(() => setIsLoading(false));

      // MDB management is admin-only
      if (u?.role === "admin") {
        fetchMdbFiles(true);
      } else {
        setIsLoadingFiles(false);
      }
    } else {
      setIsLoading(false);
      setIsLoadingFiles(false);
    }
  }, []);

  // AUTO-SCROLL CHAT TO BOTTOM
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);
// Close student dropdown on outside click / Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (aiSelectorRef.current && !aiSelectorRef.current.contains(e.target)) {
        setIsAiDropdownOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") setIsAiDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const fetchMdbFiles = async (showLoader = false) => {
    const t = getClientToken();
    if (!t) return;
    if (showLoader) setIsLoadingFiles(true);
    try {
      const res = await fetch("/api/data/mdb-files", { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) setMdbFiles(await res.json());
    } catch (e) {
      console.error("Fetch MDB files error:", e);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Derived flag: is any ETL job running right now?
  const isAnyProcessing = mdbFiles.some((f) => f.status === "Processing") || processingId !== null;

  // 🔄 Live polling while processing
  useEffect(() => {
    if (!isAnyProcessing) return;
    const interval = setInterval(() => fetchMdbFiles(), 3000);
    return () => clearInterval(interval);
  }, [isAnyProcessing]);

  const handleProcessMdb = async (id) => {
    if (!window.confirm("Proses fail ini? Data pelajar dalam database akan dikemas kini berdasarkan fail ini.")) return;
    setProcessingId(id);
    setUploadMsg(null);
    const t = getClientToken();
    try {
      const res = await fetch(`/api/data/process-mdb/${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` }
      });
      const result = await res.json();
      if (res.ok) {
        setUploadMsg({ type: "success", text: result.message });
        fetchMdbFiles();
        // Refresh student list
        fetch("/api/students", { headers: { Authorization: `Bearer ${t}` } })
          .then(r => r.json()).then(setStudents);
      } else {
        setUploadMsg({ type: "error", text: result.message });
        fetchMdbFiles(); // Refresh to show 'Failed' status
      }
    } catch (error) {
      setUploadMsg({ type: "error", text: "Gagal menyambung ke pelayan." });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteMdb = async (id) => {
    if (!window.confirm("Padam fail ini dari pelayan? Rekod pelajar yang telah diproses TIDAK akan dipadam.")) return;
    setDeletingId(id);
    setUploadMsg(null);
    const t = getClientToken();
    try {
      const res = await fetch(`/api/data/mdb-files/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${t}` },
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok) {
        setUploadMsg({ type: "success", text: "Fail berjaya dipadam dari pelayan." });
        fetchMdbFiles();
      } else {
        setUploadMsg({ type: "error", text: result.message || "Gagal memadam fail." });
      }
    } catch (e) {
      setUploadMsg({ type: "error", text: "Gagal menyambung ke pelayan." });
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = async (e) => {
    e.preventDefault();
    await logoutAction();
  };

  const handleNavigate = (path) => router.push(path);

  const totalStudents = students.length;
  const highRiskStudents = students.filter(
    (s) =>
      s.dropoutRisk === "Tinggi" ||
      Number(s.attendance) < 80 ||
      Number(s.cgpa) < 2.0,
  );
  const highRiskCount = highRiskStudents.length;
const getEmployability = (s) => calculateEmployability(s.cgpa, s.attendance);
  const averageEmployability =
    totalStudents > 0
      ? (
          students.reduce((acc, s) => acc + getEmployability(s), 0) /
          totalStudents
        ).toFixed(1)
      : 0;
  const topPerformers = [...students]
    .sort((a, b) => Number(b.cgpa) - Number(a.cgpa))
    .slice(0, 5);

  const ploAverages = Array.from({ length: 9 }, (_, i) => {
    const total = students.reduce(
      (acc, s) => acc + Number(s[`plo${i + 1}`] || 0),
      0,
    );
    return totalStudents > 0 ? Math.round(total / totalStudents) : 0;
  });

  const ploChartData = {
    labels: [
      "PLO 1",
      "PLO 2",
      "PLO 3",
      "PLO 4",
      "PLO 5",
      "PLO 6",
      "PLO 7",
      "PLO 8",
      "PLO 9",
    ],
    datasets: [
      {
        label: "Purata Skor Institut (%)",
        data: ploAverages,
        backgroundColor: "#2563EB",
        borderRadius: 6,
      },
      {
        label: "Sasaran Institut (%)",
        data: Array(9).fill(80),
        backgroundColor: "#E5E7EB",
        borderRadius: 6,
      },
    ],
  };

  const skillsGapData = ploAverages.map((avg, i) => ({
    plo: `PLO ${i + 1}`,
    average: avg,
    target: 80,
    gap: Math.max(80 - avg, 0),
    status:
      avg >= 80 ? "Selamat" : avg >= 60 ? "Perlu Peningkatan" : "Kritikal",
  }));
  const pathwayMappings = {
    "PLO 1": "Kursus Komunikasi Efektif",
    "PLO 2": "Bengkel Pengaturcaraan",
    "PLO 3": "Latihan OSH",
    "PLO 4": "Pengurusan Projek",
    "PLO 5": "Inovasi Produk",
    "PLO 6": "Kerosakan Motor",
    "PLO 7": "Keusahawanan Digital",
    "PLO 8": "Etika & Kepimpinan",
    "PLO 9": "Integriti Profesional",
  };
  const recommendedPathways = skillsGapData
    .filter((s) => s.gap > 0)
    .sort((a, b) => b.gap - a.gap);

  const filteredStudents = students.filter((student) => {
    const query = searchTerm.toLowerCase();
    return (
      (student.nama || "").toLowerCase().includes(query) ||
      (student.id || "").toString().toLowerCase().includes(query) ||
      (student.kursus || "").toLowerCase().includes(query)
    );
  });

// ─── AI PREDICTION: searchable selector helpers ───
  const aiRiskCounts = students.reduce(
    (acc, s) => {
      const level = getRiskMeta(s.dropoutRisk).level;
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    },
    { Tinggi: 0, Sederhana: 0, Rendah: 0 },
  );

  const aiFilteredStudents = students.filter((s) => {
    const q = aiSearch.toLowerCase();
    const matchQuery =
      !q ||
      (s.nama || "").toLowerCase().includes(q) ||
      (s.id || "").toString().toLowerCase().includes(q) ||
      (s.kursus || "").toLowerCase().includes(q);
    const matchRisk =
      aiRiskFilter === "Semua" ||
      getRiskMeta(s.dropoutRisk).level === aiRiskFilter;
    return matchQuery && matchRisk;
  });

  const selectAiStudent = (id) => {
    setAiStudentId(id);
    setIsAiDropdownOpen(false);
    const s = students.find((x) => x.id === id);
    setAiSearch(s ? `${s.nama} (${s.id})` : "");
    setAiMessages(
      id && s
        ? [{ role: "model", welcome: true, text: `Salam! Profil **${s.nama}** (${s.kursus}) telah dimuatkan sebagai konteks. Sila ajukan soalan atau gunakan Soalan Pantas di bawah.` }]
        : [],
    );
  };

  const clearAiSelection = () => {
    setAiStudentId("");
    setAiSearch("");
    setAiMessages([]);
    setIsAiDropdownOpen(false);
  };

  const handleInputChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const openAddModal = () => {
    setEditingStudent(null);
    setFormData({
      ID_Pelajar: "",
      Nama: "",
      Kehadiran_Pct: "",
      CGPA: "",
      Sijil_Profesional: "Tiada",
      Kursus: "DFK",
      Status_Pelajar: "Sederhana",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (student) => {
    setEditingStudent(student.id);
    setFormData({
      ID_Pelajar: student.id,
      Nama: student.nama || "",
      Kehadiran_Pct: student.attendance,
      CGPA: student.cgpa,
      Sijil_Profesional: student.certification || "Tiada",
      Kursus: student.kursus || "DFK",
      Status_Pelajar:
        student.dropoutRisk === "Rendah"
          ? "Cemerlang"
          : student.dropoutRisk === "Tinggi"
          ? "Bermasalah"
          : "Sederhana",
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const t = getClientToken();
    if (!t) { router.push("/"); return; }
    const method = editingStudent ? "PUT" : "POST";
    const url = editingStudent
      ? `/api/students/${editingStudent}`
      : "/api/students";
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`,
      },
      body: JSON.stringify(formData),
    });
    if (response.ok) {
      setIsModalOpen(false);
      router.refresh();
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Padam data pelajar ini?")) {
      const t = getClientToken();
      if (!t) { router.push("/"); return; }
      const response = await fetch(`/api/students/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${t}` },
      });
      if (response.ok) setStudents(students.filter((s) => s.id !== id));
    }
  };

  const handleSendAiMessage = async (textToSend) => {
    const messageText = (textToSend || aiInput).trim();
    if (!messageText || !aiStudentId || isAiTyping) return;

    setAiMessages((prev) => [...prev, { role: "user", text: messageText }]);
    setAiInput("");
    setIsAiTyping(true);
    // Placeholder bubble that will "type itself"
    setAiMessages((prev) => [...prev, { role: "model", text: "", streaming: true }]);

    const updateLast = (updater) =>
      setAiMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = updater(copy[copy.length - 1]);
        return copy;
      });

    try {
      const token = getClientToken();
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentId: aiStudentId,
          userMessage: messageText,
          chatHistory: aiMessages.filter((m) => !m.streaming && !m.welcome),
        }),
      });

      const contentType = res.headers.get("content-type") || "";

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "AI tidak dapat menjawab.");
      }

      if (contentType.includes("application/json")) {
        // Non-stream fallback (e.g. older response shape)
        const data = await res.json();
        updateLast(() => ({ role: "model", text: data.reply || data.message || "" }));
      } else {
        // STREAM: read chunks as they arrive
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          const snapshot = acc;
          updateLast(() => ({ role: "model", text: snapshot, streaming: true }));
        }
        updateLast(() => ({
          role: "model",
          text: acc || "Maaf, tiada respons diterima. Sila cuba lagi.",
          streaming: false,
        }));
      }
    } catch (error) {
      updateLast((last) =>
        last && last.role === "model" && last.streaming
          ? { role: "model", text: `⚠️ Ralat: ${error.message || "Gagal menghubungi pelayan AI."}` }
          : last
      );
      // Safety net if placeholder was somehow removed
      setAiMessages((prev) =>
        prev[prev.length - 1]?.role === "model" && prev[prev.length - 1]?.text
          ? prev
          : [...prev, { role: "model", text: `⚠️ Ralat: ${error.message || "Gagal menghubungi pelayan AI."}` }]
      );
    } finally {
      setIsAiTyping(false);
    }
  };

  // Helper to render simple markdown (bold **text**, italic *text*, bullets) safely
  const renderAiText = (text) => {
    if (!text) return null;
    // Normalize bullet markers (-, *, •) into a clean bullet
    const normalized = text.replace(/^\s*[-*]\s+/gm, "• ");
    const parts = normalized.split(/(\*\*.*?\*\*|\*.*?\*)/g).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
        return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
        return <em key={i} className="italic">{part.slice(1, -1)}</em>;
      return <span key={i}>{part}</span>;
    });
    return <>{parts}</>;
  };

  const handleMdbUpload = async () => {
    if (!mdbFile || !datasetName.trim()) return;
    setIsUploading(true);
    setUploadMsg(null);
    try {
      const t = getClientToken();
      if (!t) { router.push("/"); return; }
      const formData = new FormData();
      formData.append("file", mdbFile);
      formData.append("datasetName", datasetName);

      const response = await fetch("/api/data/upload-mdb", {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` },
        body: formData,
      });

      // 🕵️ DEBUGGING: Read raw text to see if backend returned HTML or JSON
      const rawText = await response.text();
      console.log("🔴 BACKEND STATUS:", response.status);
      console.log("🔴 BACKEND RAW RESPONSE:", rawText);

      let result = {};
      try { result = JSON.parse(rawText); }
      catch (e) { result = { message: "Backend returned non-JSON (Check Console F12)" }; }

      if (response.ok) {
        setUploadMsg({ type: "success", text: result.message });
        setMdbFile(null);
        setDatasetName("");
        fetchMdbFiles();
      } else {
        setUploadMsg({ type: "error", text: result.message || "Ralat semasa memuat naik." });
      }
    } catch (error) {
      setUploadMsg({ type: "error", text: "Gagal menyambung ke pelayan." });
    } finally {
      setIsUploading(false);
    }
  };

  const adminNavItems = [
    { id: "overview", icon: "ph-squares-four", label: "Dashboard Overview" },
    { id: "prediction", icon: "ph-magic-wand", label: "AI Prediction" },
    { id: "skills", icon: "ph-chart-bar", label: "Skills Gap Analysis" },
    { id: "pathways", icon: "ph-path", label: "Learning Pathways" },
    { id: "management", icon: "ph-users-three", label: "Student Management" },
    { id: "counselor", icon: "ph-heart-half", label: "Kaunseling & Intervensi" },
    { id: "data", icon: "ph-database", label: "Pengurusan Data" },
  ];

  // Counselor dapat semua tab KECUALI 'data'
  const navItems = user?.role === "counselor" 
    ? adminNavItems.filter(item => item.id !== "data") 
    : adminNavItems;

  if (isLoading || !user) {
    return <div className="h-screen flex items-center justify-center text-slate-500">Memuatkan Dashboard...</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden text-slate-800 bg-[#F8FAFC] font-sans">
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
        ></div>
      )}

      <Sidebar
        navItems={navItems}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        currentUser={user}
        handleLogout={handleLogout}
      />

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative w-full">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-10 shrink-0">
          <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              <i className="ph-bold ph-list text-2xl"></i>
            </button>
            <div className="flex items-center gap-2 text-slate-400 bg-slate-100 px-4 py-2.5 rounded-full w-full md:w-96">
              <i className="ph ph-magnifying-glass text-lg"></i>
              <input
                type="text"
                placeholder="Cari pelajar, kursus, atau ID..."
                className="bg-transparent border-none outline-none text-sm w-full text-slate-700"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-20">
          {activeTab === "overview" && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-in-out]">
              <div className="flex justify-between items-end gap-2 mb-2">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    Overview Dashboard
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">
                    Statistik utama pembangunan bakat pelajar.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KpiCard
                  title="Jumlah Pelajar Aktif"
                  value={totalStudents}
                  isLoading={isLoading}
                  icon="ph-users"
                  iconBg="bg-blue-50"
                  iconColor="text-blue-600"
                  barColor="bg-blue-600"
                  barWidth={100}
                  delay={0}
                />
                <KpiCard
                  title="Purata Kebolehpasaran"
                  value={`${averageEmployability}%`}
                  isLoading={isLoading}
                  icon="ph-briefcase"
                  iconBg="bg-green-50"
                  iconColor="text-green-600"
                  barColor="bg-green-500"
                  barWidth={averageEmployability}
                  delay={100}
                />
                <KpiCard
                  title="Pelajar Berisiko Tinggi"
                  value={highRiskCount}
                  isLoading={isLoading}
                  icon="ph-warning"
                  iconBg="bg-red-50"
                  iconColor="text-red-600"
                  barColor="bg-red-500"
                  barWidth={
                    totalStudents ? (highRiskCount / totalStudents) * 100 : 0
                  }
                  delay={200}
                />
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-[slideUp_0.4s_ease-out_0.2s] anim-fill">
                <h3 className="font-bold text-lg text-slate-800 mb-6">
                  Purata Pencapaian PLO vs Sasaran
                </h3>
                <div className="h-80 w-full">
                  <Bar
                    data={ploChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: { y: { beginAtZero: true, max: 100 } },
                      animation: { duration: 800, easing: 'easeOutQuart' },
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-[slideUp_0.4s_ease-out_0.3s] anim-fill">
                  <h3 className="font-bold text-lg text-red-600 mb-4">
                    Pelajar Berisiko Tinggi
                  </h3>
                  <div className="space-y-4">
                    {highRiskStudents.slice(0, 5).map((s, idx) => (
                      <div
                        key={s.id}
                        onClick={() => handleNavigate(`/student-profile?id=${s.id}`)}
                        className="bg-red-50 p-4 rounded-xl border border-red-100 cursor-pointer hover:bg-red-100 hover:shadow-sm hover:translate-x-1 flex justify-between items-center transition-all duration-200 animate-[slideUp_0.3s_ease-out] anim-fill"
                        style={{ animationDelay: `${350 + idx * 60}ms` }}
                      >
                        <div>
                          <h4 className="font-bold text-slate-800">{s.nama}</h4>
                          <p className="text-xs text-red-500 font-bold">
                            {Number(s.attendance) < 80
                              ? "⚠️ Kehadiran: " + s.attendance + "%"
                              : Number(s.cgpa) < 2.0
                              ? "📉 CGPA: " + s.cgpa
                              : "🤖 AI: Risiko Tinggi"}
                          </p>
                        </div>
                        <i className="ph ph-caret-right text-red-400 transition-transform duration-200 group-hover:translate-x-1"></i>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-[slideUp_0.4s_ease-out_0.35s] anim-fill">
                  <h3 className="font-bold text-lg text-yellow-600 mb-4">
                    Top Performers
                  </h3>
                  <div className="space-y-4">
                    {topPerformers.map((s, idx) => (
                      <div
                        key={s.id}
                        className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 flex justify-between items-center cursor-pointer hover:bg-yellow-100 hover:shadow-sm hover:translate-x-1 transition-all duration-200 animate-[slideUp_0.3s_ease-out] anim-fill"
                        style={{ animationDelay: `${400 + idx * 60}ms` }}
                        onClick={() => handleNavigate(`/student-profile?id=${s.id}`)}
                      >
                        <div>
                          <h4 className="font-bold text-slate-800">{s.nama}</h4>
                          <p className="text-xs text-yellow-700 mt-1">
                            CGPA: {s.cgpa} |{" "}
                            {s.anugerah
                              ? "🏆 Penerima Anugerah"
                              : `Sijil: ${s.certification}`}
                          </p>
                        </div>
                        <span className="text-xl font-bold text-yellow-600">
                          {calculateTopPerformerScore(s.cgpa, s.attendance)}
                          %
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "prediction" && (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[75vh] animate-[fadeIn_0.3s_ease-in-out]">

    {/* --- LEFT PANEL: slides in from left --- */}
    <div className="lg:col-span-1 flex flex-col gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-y-auto animate-[slideInLeft_0.4s_ease-out] anim-fill">
      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
        <i className="ph ph-user-circle-gear text-2xl text-emerald-600"></i>
        Konteks Pelajar
      </h3>

      {/* Student Selector — searchable combobox with risk categories */}
      <div className="animate-[slideUp_0.4s_ease-out_0.1s] anim-fill" ref={aiSelectorRef}>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
          Cari & Pilih Pelajar
        </label>

        {/* Search input */}
        <div className="relative">
          <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none"></i>
          <input
            type="text"
            value={aiSearch}
            onChange={(e) => {
              setAiSearch(e.target.value);
              setIsAiDropdownOpen(true);
            }}
            onFocus={() => setIsAiDropdownOpen(true)}
            placeholder="Cari nama, ID atau kursus..."
            className="w-full p-2.5 pl-9 pr-9 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow duration-200"
          />
          {aiStudentId && (
            <button
              type="button"
              onClick={clearAiSelection}
              title="Kosongkan pilihan"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
            >
              <i className="ph-bold ph-x-circle text-lg"></i>
            </button>
          )}
        </div>

        {/* Risk category filter chips (Tinggi / Sederhana / Rendah) */}
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {["Semua", "Tinggi", "Sederhana", "Rendah"].map((level) => {
            const active = aiRiskFilter === level;
            const count =
              level === "Semua" ? students.length : aiRiskCounts[level] || 0;
            const dot =
              level === "Tinggi"
                ? "bg-red-500"
                : level === "Sederhana"
                  ? "bg-amber-500"
                  : level === "Rendah"
                    ? "bg-emerald-500"
                    : "bg-slate-400";
            return (
              <button
                key={level}
                type="button"
                onClick={() => {
                  setAiRiskFilter(level);
                  setIsAiDropdownOpen(true);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all duration-200 active:scale-95 ${
                  active
                    ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${dot}`}></span>
                {level}
                <span className={`px-1 rounded-full ${active ? "bg-white/20" : "bg-slate-100"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Dropdown results with risk badges */}
        {isAiDropdownOpen && (
          <div className="mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto scroll-smooth-mobile animate-[fadeIn_0.2s_ease-out]">
            {aiFilteredStudents.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                <i className="ph ph-smiley-sad text-2xl block mb-1"></i>
                Tiada pelajar sepadan carian.
              </div>
            ) : (
              aiFilteredStudents.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectAiStudent(s.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 border-b border-slate-50 last:border-b-0 ${
                    s.id === aiStudentId ? "bg-emerald-50" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold text-xs flex items-center justify-center overflow-hidden shrink-0">
                    {s.profileImage ? (
                      <img src={s.profileImage} alt={s.nama} className="w-full h-full object-cover" />
                    ) : (
                      s.nama?.charAt(0)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{s.nama}</p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {s.id} • {s.kursus}
                    </p>
                  </div>
                  <RiskBadge risk={s.dropoutRisk} showLabel={false} className="shrink-0" />
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Context Card */}
      {aiStudentId && (() => {
        const selected = students.find((s) => s.id === aiStudentId);
        if (!selected) return null;

        const plos = [
          { name: "PLO 1", val: selected.plo1 }, { name: "PLO 2", val: selected.plo2 },
          { name: "PLO 3", val: selected.plo3 }, { name: "PLO 4", val: selected.plo4 },
          { name: "PLO 5", val: selected.plo5 }, { name: "PLO 6", val: selected.plo6 },
          { name: "PLO 7", val: selected.plo7 }, { name: "PLO 8", val: selected.plo8 },
          { name: "PLO 9", val: selected.plo9 },
        ];
        const weakest = plos.reduce((min, curr) => (curr.val < min.val ? curr : min), plos[0]);
        const hasWeakness = weakest.val < 80;

        return (
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm space-y-3 animate-[scaleIn_0.3s_ease-out]">
            <div className="flex justify-between items-center gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-blue-100 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center text-blue-600 font-bold shrink-0">
                  {selected.profileImage ? (
                    <img src={selected.profileImage} alt={selected.nama} className="w-full h-full object-cover" />
                  ) : (
                    selected.nama?.charAt(0)
                  )}
                </div>
                <span className="font-bold text-slate-800 truncate">{selected.nama}</span>
              </div>
              <RiskBadge risk={selected.dropoutRisk} className="shrink-0" />
            </div>
            <div className="text-slate-600">
              <p><span className="font-semibold">Kursus:</span> {selected.kursus}</p>
              <p><span className="font-semibold">CGPA:</span> {Number(selected.cgpa).toFixed(2)}</p>
              <p><span className="font-semibold">Kehadiran:</span> {selected.attendance}%</p>
            </div>
            <div className="pt-2 border-t border-slate-200">
              <p className="text-xs text-slate-500 uppercase font-bold mb-1">Fokus Pemantauan</p>
              {hasWeakness ? (
                <p className="text-slate-700">
                  <i className="ph ph-warning-circle text-orange-500"></i> {weakest.name} ({weakest.val}%)
                </p>
              ) : (
                <p className="text-slate-700">
                  <i className="ph ph-check-circle text-emerald-500"></i> Semua PLO mencapai sasaran (≥80%)
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Quick Prompts */}
      <div className="mt-auto pt-4 border-t border-slate-100 animate-[slideUp_0.4s_ease-out_0.2s] anim-fill">
        <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Soalan Pantas:</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => handleSendAiMessage("Sila analisis kelemahan utama pelajar ini dan cadangkan intervensi.")}
            disabled={!aiStudentId}
            className="text-left text-xs p-2 bg-emerald-50 hover:bg-emerald-100 hover:shadow-sm text-emerald-800 rounded border border-emerald-200 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🔍 Analisis kelemahan & intervensi
          </button>
          <button
            onClick={() => handleSendAiMessage("Apakah sijil profesional yang paling sesuai untuk pelajar ini berdasarkan PLO mereka?")}
            disabled={!aiStudentId}
            className="text-left text-xs p-2 bg-blue-50 hover:bg-blue-100 hover:shadow-sm text-blue-800 rounded border border-blue-200 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🎓 Cadangan sijil profesional
          </button>
          <button
            onClick={() => handleSendAiMessage("Bagaimana prestasi akademik pelajar ini berbanding purata?")}
            disabled={!aiStudentId}
            className="text-left text-xs p-2 bg-purple-50 hover:bg-purple-100 hover:shadow-sm text-purple-800 rounded border border-purple-200 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📊 Ringkasan prestasi akademik
          </button>
        </div>
      </div>
    </div>

    {/* --- RIGHT PANEL: CHAT — slides in from right --- */}
    <div className="lg:col-span-2 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-[slideInRight_0.4s_ease-out] anim-fill">

      {/* Chat Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center animate-[floatSoft_3s_ease-in-out_infinite]">
          <i className="ph-fill ph-sparkle text-xl text-emerald-600"></i>
        </div>
        <div>
          <h3 className="font-bold text-slate-800">Pembantu Pintar TVETMARA</h3>
          <p className="text-xs text-slate-500">Sedia membantu analisis pelajar anda.</p>
        </div>
      </div>

      {/* Message Area */}
      <div className="flex-1 p-6 overflow-y-auto bg-slate-50/30 space-y-4">
        {aiMessages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 animate-[fadeIn_0.5s_ease-out]">
            <i className="ph ph-chats-circle text-5xl mb-3 opacity-20 animate-[floatSoft_4s_ease-in-out_infinite]"></i>
            <p className="text-sm">Pilih pelajar di sebelah kiri dan mulakan perbualan.</p>
          </div>
        )}

        {aiMessages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 animate-[slideUp_0.3s_ease-out] anim-fill ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "model" && (
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <i className="ph-fill ph-sparkle text-emerald-600"></i>
              </div>
            )}

            <div className={`max-w-[80%] p-3 rounded-xl shadow-sm whitespace-pre-wrap transition-shadow duration-200 hover:shadow-md ${
              msg.role === "user"
                ? "bg-emerald-600 text-white rounded-tr-none"
                : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
            }`}>
              {msg.role === "model" ? (
                <>
                  {msg.text ? renderAiText(msg.text) : null}
                  {msg.streaming && !msg.text && (
                    <span className="flex gap-1 items-center h-5">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </span>
                  )}
                  {msg.streaming && msg.text && (
                    <span className="inline-block w-2 h-4 ml-1 bg-emerald-500 animate-pulse align-middle"></span>
                  )}
                </>
              ) : (
                msg.text
              )}
            </div>

            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                <i className="ph-fill ph-user text-slate-600"></i>
              </div>
            )}
          </div>
        ))}

        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100">
        <div className="flex gap-2">
          <textarea
            rows="1"
            className="flex-1 p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none text-sm transition-shadow duration-200"
            placeholder={aiStudentId ? "Tanya sesuatu tentang pelajar ini..." : "Sila pilih pelajar dahulu..."}
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendAiMessage();
              }
            }}
            disabled={!aiStudentId || isAiTyping}
          />
          <button
            onClick={() => handleSendAiMessage()}
            disabled={!aiStudentId || !aiInput.trim() || isAiTyping}
            className="px-4 bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-600/20 text-white rounded-xl transition-all duration-200 active:scale-95 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAiTyping ? (
              <i className="ph ph-spinner-gap animate-spin text-xl"></i>
            ) : (
              <i className="ph-bold ph-paper-plane-tilt text-xl"></i>
            )}
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-2 text-center">
          AI boleh membuat kesilapan. Sila sahkan maklumat penting.
        </p>
      </div>
    </div>
  </div>
)}

          {activeTab === "skills" && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-in-out]">
              <h2 className="text-2xl font-bold text-slate-900 animate-[slideUp_0.4s_ease-out]">
                Skills Gap Analysis
              </h2>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-[slideUp_0.4s_ease-out_0.1s] anim-fill">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold uppercase">
                        PLO
                      </th>
                      <th className="px-6 py-4 text-xs font-bold uppercase">
                        Purata
                      </th>
                      <th className="px-6 py-4 text-xs font-bold uppercase">
                        Gap
                      </th>
                      <th className="px-6 py-4 text-xs font-bold uppercase">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {skillsGapData.map((s, idx) => (
                      <tr
                        key={s.plo}
                        className="hover:bg-slate-50 transition-colors duration-200 animate-[slideUp_0.3s_ease-out] anim-fill"
                        style={{ animationDelay: `${150 + idx * 40}ms` }}
                      >
                        <td className="px-6 py-4 font-medium">{s.plo}</td>
                        <td className="px-6 py-4">{s.average}%</td>
                        <td className="px-6 py-4">
                          <span
                            className={`font-bold ${s.gap > 0 ? "text-red-600" : "text-green-600"}`}
                          >
                            {s.gap > 0 ? `-${s.gap}%` : "0%"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded-md text-[10px] font-bold ${s.status === "Selamat" ? "bg-green-100 text-green-700" : s.status === "Perlu Peningkatan" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}
                          >
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "pathways" && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-in-out]">
              <h2 className="text-2xl font-bold text-slate-900 animate-[slideUp_0.4s_ease-out]">
                Learning Pathways
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommendedPathways.map((s, idx) => (
                  <div
                    key={s.plo}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300 animate-[slideUp_0.4s_ease-out] anim-fill"
                    style={{ animationDelay: `${100 + idx * 80}ms` }}
                  >
                    <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md mb-4 inline-block">
                      Jurang: {s.gap}%
                    </span>
                    <h3 className="font-bold text-slate-800 mb-1">{s.plo}</h3>
                    <div className="bg-blue-50 p-3 rounded-lg mt-4">
                      <p className="text-sm text-slate-700">
                        {pathwayMappings[s.plo]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "management" && (
            <div className="animate-[fadeIn_0.3s_ease-in-out]">
              <StudentListGrid
                students={students}
                onViewProfile={(id) => handleNavigate(`/student-profile?id=${id}`)}
                onAddStudent={() => {
                  setEditingStudent(null);
                  setFormData({
                    ID_Pelajar: "",
                    Nama: "",
                    Kehadiran_Pct: "",
                    CGPA: "",
                    Sijil_Profesional: "Tiada",
                    Kursus: "DFK",
                    Status_Pelajar: "Sederhana",
                  });
                  setIsModalOpen(true);
                }}
                readOnly={false}
              />
            </div>
          )}

          {activeTab === "counselor" && (
            <div className="animate-[fadeIn_0.3s_ease-in-out]">
              <CounselorDashboardClient currentUser={user} />
            </div>
          )}

          {activeTab === "data" && (
  <div className="space-y-6 max-w-5xl mx-auto animate-[fadeIn_0.3s_ease-in-out]">
    <div>
      <h2 className="text-2xl font-bold text-slate-900">Pengurusan Data TVET</h2>
      <p className="text-slate-500 text-sm mt-1">
        Muat naik, simpan, dan proses fail pangkalan data Microsoft Access (.mdb).
      </p>
    </div>

    {/* Upload Section */}
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
      <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
        <i className="ph ph-upload-simple text-blue-600"></i> 1. Muat Naik Fail Baharu
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Nama Dataset / Penerangan</label>
          <input
            type="text"
            placeholder="cth: Pengambilan Julai 2026"
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
            className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Fail .mdb</label>
          <input
            type="file"
            accept=".mdb"
            onChange={(e) => { setMdbFile(e.target.files[0]); setUploadMsg(null); }}
            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
      </div>
      <button
        onClick={handleMdbUpload}
        disabled={!mdbFile || !datasetName.trim() || isUploading}
        className={`w-full md:w-auto px-6 py-2.5 rounded-lg font-bold text-white transition flex items-center justify-center gap-2 ${!mdbFile || !datasetName.trim() || isUploading ? "bg-slate-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
      >
        {isUploading ? (
          <><i className="ph ph-spinner-gap animate-spin text-xl"></i> Memuat Naik...</>
        ) : (
          <><i className="ph ph-cloud-arrow-up text-lg"></i> Simpan Fail</>
        )}
      </button>
      {uploadMsg && (
        <div className={`p-3 rounded-lg text-sm font-medium animate-[fadeIn_0.3s_ease-in-out] ${uploadMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {uploadMsg.text}
        </div>
      )}
    </div>

    {/* Files List Section */}
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <i className="ph ph-database text-blue-600"></i> 2. Arkib Fail & Pemprosesan
          </h3>
          <p className="text-xs text-slate-500 mt-1">Pilih fail yang telah disimpan untuk diproses ke dalam database pelajar.</p>
        </div>
        {isAnyProcessing && (
          <span className="flex items-center gap-2 text-xs font-bold text-yellow-700 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded-full animate-pulse">
            <i className="ph ph-spinner-gap animate-spin"></i> ETL sedang berjalan...
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500">
            <tr>
              <th className="px-6 py-3">Nama Dataset</th>
              <th className="px-6 py-3">Fail Asal</th>
              <th className="px-6 py-3">Saiz</th>
              <th className="px-6 py-3">Tarikh Muat Naik</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoadingFiles ? (
              /* 💀 Skeleton loading rows */
              [1, 2, 3].map((i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-28 bg-slate-200 rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-16 bg-slate-200 rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-20 bg-slate-200 rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-5 w-16 bg-slate-200 rounded-full"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-12 bg-slate-200 rounded ml-auto"></div></td>
                </tr>
              ))
            ) : mdbFiles.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-10 text-center text-slate-400">
                  <i className="ph ph-cloud-arrow-up text-4xl text-slate-300"></i>
                  <p className="mt-2 text-sm">Tiada fail dimuat naik buat masa ini.</p>
                </td>
              </tr>
            ) : (
              mdbFiles.map((file) => {
                const isProcessingRow = file.status === "Processing" || processingId === file._id;
                return (
                  <tr
                    key={file._id}
                    className={`transition-colors duration-300 ${isProcessingRow ? "bg-yellow-50/60" : "hover:bg-slate-50"}`}
                  >
                    <td className="px-6 py-4 font-medium text-slate-800">{file.datasetName}</td>
                    <td className="px-6 py-4 text-slate-500">{file.originalName}</td>
                    <td className="px-6 py-4 text-slate-500">{(file.fileSize / (1024 * 1024)).toFixed(2)} MB</td>
                    <td className="px-6 py-4 text-slate-500">{new Date(file.uploadDate).toLocaleDateString("ms-MY")}</td>
                    <td className="px-6 py-4">
                      {file.status === "Processed" ? (
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-green-100 text-green-700 inline-flex items-center gap-1 animate-[fadeIn_0.4s_ease-in-out]">
                          <i className="ph-fill ph-check-circle"></i> Selesai ({file.recordsProcessed})
                        </span>
                      ) : file.status === "Saved" ? (
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700 inline-flex items-center gap-1 animate-[fadeIn_0.4s_ease-in-out]">
                          <i className="ph-fill ph-floppy-disk"></i> Saved
                        </span>
                      ) : file.status === "Processing" ? (
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-yellow-100 text-yellow-700 inline-flex items-center gap-1 animate-pulse">
                          <i className="ph ph-spinner-gap animate-spin"></i> Memproses...
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-red-100 text-red-700 inline-flex items-center gap-1 animate-[fadeIn_0.4s_ease-in-out]">
                          <i className="ph-fill ph-warning-circle"></i> Gagal
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button
                        onClick={() => handleProcessMdb(file._id)}
                        disabled={isAnyProcessing || deletingId === file._id}
                        className="text-blue-600 hover:text-blue-800 font-semibold disabled:text-slate-300 disabled:cursor-not-allowed transition"
                        title="Proses ke Database"
                      >
                        {isProcessingRow ? (
                          <i className="ph ph-spinner-gap animate-spin text-lg"></i>
                        ) : (
                          <i className="ph ph-play-circle text-lg"></i>
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteMdb(file._id)}
                        disabled={deletingId === file._id || file.status === "Processing"}
                        className="text-red-500 hover:text-red-700 font-semibold disabled:text-slate-300 disabled:cursor-not-allowed transition"
                        title="Padam Fail"
                      >
                        {deletingId === file._id ? (
                          <i className="ph ph-spinner-gap animate-spin text-lg"></i>
                        ) : (
                          <i className="ph ph-trash text-lg"></i>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
)}
        </div>
      </main>

      <StudentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingStudent={editingStudent}
        formData={formData}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
      />
    </div>
  );
}