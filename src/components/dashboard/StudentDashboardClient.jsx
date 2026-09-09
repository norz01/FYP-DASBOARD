"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { getClientUser, getClientToken } from "@/lib/client-auth";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Radar } from "react-chartjs-2";
import Sidebar from "../Sidebar";
import JobCard from "../JobCard";
import { calculateEmployability } from "@/lib/heuristics";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

const careerMapping = {
  ITW: [
    {
      title: "Juruteknik Kimpalan 6G",
      company: "Sapuran Energy",
      match: "95%",
      icon: "ph-fill ph-fire",
    },
    {
      title: "Welding Inspector",
      company: "SGS Malaysia",
      match: "88%",
      icon: "ph-fill ph-magnifying-glass",
    },
  ],
  DFK: [
    {
      title: "Cloud Engineer",
      company: "AWS Malaysia",
      match: "94%",
      icon: "ph-fill ph-cloud",
    },
    {
      title: "DevOps Engineer",
      company: "Maxis",
      match: "85%",
      icon: "ph-fill ph-terminal-window",
    },
  ],
  DGA: [
    {
      title: "Service Advisor",
      company: "Perodua",
      match: "92%",
      icon: "ph-fill ph-wrench",
    },
    {
      title: "Diagnostic Tech",
      company: "Tan Chong",
      match: "88%",
      icon: "ph-fill ph-engine",
    },
  ],
  SLR: [
    {
      title: "CAD Drafter",
      company: "Dyson",
      match: "96%",
      icon: "ph-fill ph-pencil-circle",
    },
    {
      title: "Design Engineer",
      company: "Proton",
      match: "89%",
      icon: "ph-fill ph-compass-tool",
    },
  ],
  DCG: [
    {
      title: "Chargeman A0",
      company: "TNB",
      match: "94%",
      icon: "ph-fill ph-lightning",
    },
    {
      title: "Industrial Electrician",
      company: "Intel",
      match: "89%",
      icon: "ph-fill ph-plugs-connected",
    },
  ],
  SED: [
    {
      title: "Wireman PW4",
      company: "Kontraktor Berdaftar",
      match: "91%",
      icon: "ph-fill ph-files",
    },
    {
      title: "Maintenance",
      company: "Panasonic",
      match: "87%",
      icon: "ph-fill ph-gear",
    },
  ],
  PPU: [
    {
      title: "HVAC Technician",
      company: "Daikin",
      match: "93%",
      icon: "ph-fill ph-thermometer-cold",
    },
    {
      title: "ACMV Supervisor",
      company: "Bina Puri",
      match: "86%",
      icon: "ph-fill ph-fan",
    },
  ],
};

const getFullCourseName = (code) => {
  const names = {
    ITW: "Diploma Kimpalan",
    DFK: "Diploma Komputasi Awan",
    DGA: "Diploma Automotif",
    SLR: "Sijil Lukisan Rekabentuk",
    DCG: "Diploma Elektrik Industri",
    SED: "Sijil Elektrik Domestik",
    PPU: "Diploma Penyejukan Udara",
  };
  return names[code] || code;
};

const initialSkillGap = {
  chart: {
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
    current: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    target: [80, 80, 80, 80, 80, 80, 80, 80, 80],
  },
  insight: {
    weakestSkill: "-",
    message:
      "Pilih pelajar untuk melihat analisis jurang skill daripada database.",
  },
  student: null,
};

export default function StudentDashboardClient() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [skillGap, setSkillGap] = useState(initialSkillGap);
  const [isLoading, setIsLoading] = useState(true);

  const [customCerts, setCustomCerts] = useState([]);
  const [newCert, setNewCert] = useState({ name: "", issuer: "" });
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploadingCert, setIsUploadingCert] = useState(false);

  const [activeTab, setActiveTab] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const u = getClientUser();
    setUser(u);

    const t = getClientToken();
    if (t) {
      fetch("/api/students", { headers: { Authorization: `Bearer ${t}` } })
        .then((res) => res.json())
        .then((data) => {
          const isRestrictedUser = u?.role === "user" && u?.studentId;
          const visibleStudents = isRestrictedUser
            ? data.filter((s) => s.id === u.studentId)
            : data;
          setStudents(visibleStudents);
          if (visibleStudents.length > 0)
            setSelectedStudentId(visibleStudents[0].id);
        })
        .catch((err) => console.error("Fetch students error:", err))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const isRestrictedUser = user?.role === "user" && user?.studentId;
  const currentStudentLabel = user?.displayName || "Pelajar";

  const handleLogout = async (e) => {
    e.preventDefault();
    await logoutAction();
  };

  useEffect(() => {
    if (!selectedStudentId) return;
    setIsLoading(true);
    const loadStudentData = async () => {
      const t = getClientToken();
      if (!t) { router.push("/"); return; }
      try {
        const resGap = await fetch(`/api/students/${selectedStudentId}/skill-gap`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        setSkillGap(await resGap.json());

        const resStudent = await fetch(`/api/students/${selectedStudentId}`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        const studentData = await resStudent.json();
        setCustomCerts(studentData.uploadedCertificates || []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    loadStudentData();
  }, [selectedStudentId]);

  const radarData = {
    labels: skillGap.chart.labels,
    datasets: [
      {
        label: "Data Pelajar",
        data: skillGap.chart.current,
        fill: true,
        backgroundColor: "rgba(37, 99, 235, 0.2)",
        borderColor: "#2563EB",
        pointBackgroundColor: "#2563EB",
      },
      {
        label: "Target",
        data: skillGap.chart.target,
        fill: true,
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        borderColor: "#10B981",
        pointBackgroundColor: "#10B981",
        borderDash: [5, 5],
      },
    ],
  };

  const courseMappings = {
    "PLO 1": {
      title: "Professional Soft Skills: Communication",
      desc: "Kursus ini dicadangkan kerana skor komunikasi anda di bawah par industri.",
      bg: "bg-blue-600",
      btn: "bg-blue-50 text-blue-600 hover:bg-blue-100",
    },
    "PLO 2": {
      title: "Bengkel Pengaturcaraan Praktikal",
      desc: "Untuk meningkatkan kompetensi penyelesaian masalah pengaturcaraan.",
      bg: "bg-slate-900",
      btn: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    },
    "PLO 3": {
      title: "Latihan Keselamatan Industri (OSH)",
      desc: "Memperkukuhkan pemahaman tentang prosedur keselamatan tempat kerja.",
      bg: "bg-purple-600",
      btn: "bg-purple-50 text-purple-600 hover:bg-purple-100",
    },
    "PLO 4": {
      title: "Kursus Pengurusan Masa & Projek",
      desc: "Meningkatkan keupayaan merancang dan melaksanakan projek dengan cekap.",
      bg: "bg-blue-600",
      btn: "bg-blue-50 text-blue-600 hover:bg-blue-100",
    },
    "PLO 5": {
      title: "Bengkel Inovasi & Reka Bentuk Produk",
      desc: "Menambah kemahiran kreatif dalam merekabentuk penyelesaian baharu.",
      bg: "bg-slate-900",
      btn: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    },
    "PLO 6": {
      title: "Latihan Penyelesaian Kerosakan Motor/Elektrik",
      desc: "Peningkatan kemahiran teknikal dalam diagnosis kerosakan.",
      bg: "bg-purple-600",
      btn: "bg-purple-50 text-purple-600 hover:bg-purple-100",
    },
    "PLO 7": {
      title: "Kursus Keusahawanan & Pemasaran Digital",
      desc: "Memperluas kemahiran perniagaan dan pemasaran kendiri.",
      bg: "bg-blue-600",
      btn: "bg-blue-50 text-blue-600 hover:bg-blue-100",
    },
    "PLO 8": {
      title: "Bengkel Etika Kerja & Kepimpinan",
      desc: "Membentuk sahsiah dan kemahiran memimpin pasukan.",
      bg: "bg-slate-900",
      btn: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    },
    "PLO 9": {
      title: "Latihan Integriti & Tanggungjawab Profesional",
      desc: "Memantapkan nilai etika dan tanggungjawab di tempat kerja.",
      bg: "bg-purple-600",
      btn: "bg-purple-50 text-purple-600 hover:bg-purple-100",
    },
  };

  const weakestPlo = skillGap.insight?.weakestSkill || "PLO 1";
  const recommendedCourse =
    courseMappings[weakestPlo] || courseMappings["PLO 1"];

  const handleProfileImageChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append("file", file);

      try {
        const t = getClientToken();
        if (!t) { router.push("/"); return; }
        const res = await fetch(
          `/api/students/${selectedStudentId}/profile-image`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${t}`,
            },
            body: formData,
          },
        );

        if (!res.ok) throw new Error("Gagal memuat naik gambar profil");
        const data = await res.json();

        setSkillGap((prev) => ({
          ...prev,
          student: { ...prev.student, profileImage: data.imagePath },
        }));
      } catch (err) {
        console.error(err);
        alert("Ralat semasa memuat naik gambar profil.");
      }
    }
  };

  const handleCertInputChange = (e) => {
    setNewCert({ ...newCert, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleAddCertificate = async (e) => {
    e.preventDefault();
    if (!newCert.name || !newCert.issuer || !selectedFile) {
      alert("Sila isi nama, pengeluar, dan lampirkan fail.");
      return;
    }

    setIsUploadingCert(true);
    const formData = new FormData();
    formData.append("name", newCert.name);
    formData.append("issuer", newCert.issuer);
    formData.append("file", selectedFile);

    try {
      const t = getClientToken();
      if (!t) { router.push("/"); return; }
      const res = await fetch(
        `/api/students/${selectedStudentId}/certificates`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${t}`,
          },
          body: formData,
        },
      );

      if (!res.ok) throw new Error("Gagal memuat naik sijil");
      const data = await res.json();

      setCustomCerts([...customCerts, data.certificate]);
      setNewCert({ name: "", issuer: "" });
      setSelectedFile(null);
    } catch (err) {
      console.error(err);
      alert("Ralat semasa memuat naik sijil.");
    } finally {
      setIsUploadingCert(false);
    }
  };

  const handleDeleteCertificate = async (certId) => {
    try {
      const t = getClientToken();
      if (!t) { router.push("/"); return; }
      const res = await fetch(
        `/api/students/${selectedStudentId}/certificates/${certId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${t}` },
        },
      );

      if (!res.ok) throw new Error("Gagal memadam sijil");

      setCustomCerts(customCerts.filter((cert) => cert._id !== certId));
    } catch (err) {
      console.error(err);
      alert("Ralat semasa memadam sijil.");
    }
  };

  const navItems = [
    { id: "dashboard", icon: "ph-user-circle", label: "Profil & Prestasi" },
    { id: "profile", icon: "ph-pencil-line", label: "Kemaskini Sijil Saya" },
    { id: "career", icon: "ph-briefcase", label: "Padanan Kerjaya (AI)" },
    { id: "courses", icon: "ph-certificate", label: "Kursus Cadangan" },
  ];

  if (isLoading || !user) {
    return <div className="h-screen flex items-center justify-center text-slate-500">Memuatkan Dashboard...</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden text-slate-800 bg-[#F8FAFC] font-sans relative">
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
        <header className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10">
          <img
            src="/logo-tvetmara.jpg"
            alt="Logo"
            className="h-8 object-contain"
          />
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-slate-600 p-2 hover:bg-slate-100 rounded-lg"
          >
            <i className="ph-bold ph-list text-2xl"></i>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-20">
          {/* TAB 1: DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="animate-[fadeIn_0.3s_ease-in-out]">
              <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">
                    Selamat Datang, {currentStudentLabel}! 👋
                  </h1>
                  <p className="text-slate-500 text-sm">
                    Analisis prestasi dan potensi kerjaya anda.
                  </p>
                </div>
                {skillGap.student?.dropoutRisk === "Tinggi" ||
                skillGap.student?.dropoutRisk === "Bermasalah" ? (
                  <span className="bg-red-100 text-red-700 px-4 py-2 rounded-full text-xs font-bold border border-red-200">
                    ⚠️ Risiko Tinggi
                  </span>
                ) : skillGap.student?.dropoutRisk === "Sederhana" ? (
                  <span className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-full text-xs font-bold border border-yellow-200">
                    ⚠️ Perhatian Diperlukan
                  </span>
                ) : (
                  <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-xs font-bold border border-green-200">
                    ✅ Status: Good Standing
                  </span>
                )}
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-sm text-slate-500 mb-1">
                    Ramalan Kebolehpasaran
                  </p>
<h2 className="text-3xl font-bold text-slate-900">
                     {skillGap.student
                       ? calculateEmployability(skillGap.student.cgpa, skillGap.student.attendance)
                       : 0}
                     %
                   </h2>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-sm text-slate-500 mb-1">
                    Purata Kehadiran
                  </p>
                  <h2 className="text-3xl font-bold text-slate-900">
                    {skillGap.student?.attendance || 0}%
                  </h2>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-sm text-slate-500 mb-1">CGPA Terkini</p>
                  <h2 className="text-3xl font-bold text-slate-900">
                    {skillGap.student?.cgpa || "0.00"}
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <i className="ph-fill ph-radar text-blue-600"></i>{" "}
                      Analisis Jurang Skill
                    </h3>
                    {students.length > 1 && !isRestrictedUser ? (
                      <select
                        value={selectedStudentId}
                        onChange={(e) => setSelectedStudentId(e.target.value)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
                      >
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.id} • Risiko {s.dropoutRisk}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600">
                        {selectedStudentId || "Pelajar"}
                      </span>
                    )}
                  </div>
                  <div className="h-64 flex items-center justify-center">
                    {isLoading ? (
                      <p>Memuatkan...</p>
                    ) : (
                      <Radar
                        data={radarData}
                        options={{
                          maintainAspectRatio: false,
                          scales: {
                            r: {
                              beginAtZero: true,
                              min: 0,
                              max: 100,
                              ticks: { stepSize: 20 },
                            },
                          },
                        }}
                      />
                    )}
                  </div>
                  <div className="mt-4 bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                    <p className="text-xs font-bold text-yellow-700 mb-1">
                      CADANGAN AI:
                    </p>
                    <p className="text-sm text-slate-700">
                      {skillGap.insight.message}
                    </p>
                  </div>
                </div>
                <div className="bg-slate-900 p-6 rounded-2xl text-white flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-bold">
                      Peluang Kerjaya Teratas
                    </h3>
                    <p className="text-slate-300 text-sm mt-2">
                      Berdasarkan kursus{" "}
                      <strong>
                        {getFullCourseName(skillGap.student?.kursus)}
                      </strong>
                      :
                    </p>
                    <div className="mt-4 space-y-3">
                      {(careerMapping[skillGap.student?.kursus] || [])
                        .slice(0, 2)
                        .map((j, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 bg-white/5 p-3 rounded-lg"
                          >
                            <i className={`${j.icon} text-blue-400`}></i>
                            <div className="text-xs">
                              <p className="font-bold">{j.title}</p>
                              <p className="opacity-60">{j.company}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab("career")}
                    className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold"
                  >
                    Lihat Analisis Penuh →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROFILE & CERTIFICATES */}
          {activeTab === "profile" && (
            <div className="animate-[fadeIn_0.3s_ease-in-out]">
              <header className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">
                  Kemaskini Sijil Saya
                </h1>
                <p className="text-slate-500">
                  Uruskan sijil tambahan dan gambar profil anda.
                </p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center">
                  <label
                    htmlFor="profileImg"
                    className="relative w-32 h-32 rounded-full bg-slate-100 border-4 border-white shadow-md cursor-pointer flex items-center justify-center text-slate-400 font-bold text-4xl overflow-hidden group"
                  >
                    {skillGap.student?.profileImage ? (
                      <img
                        src={skillGap.student.profileImage}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{skillGap.student?.nama?.charAt(0) || "P"}</span>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                      <i className="ph-fill ph-camera text-3xl"></i>
                      <span className="text-xs mt-1 font-bold">
                        Tukar Gambar
                      </span>
                    </div>
                    <input
                      type="file"
                      id="profileImg"
                      accept="image/*"
                      onChange={handleProfileImageChange}
                      className="hidden"
                    />
                  </label>
                  <div className="mt-6 w-full space-y-3">
                    <div>
                      <label className="text-xs text-slate-500">
                        Nama Pelajar
                      </label>
                      <input
                        type="text"
                        disabled
                        value={skillGap.student?.nama || ""}
                        className="mt-1 w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm text-slate-700 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">
                        No. Pendaftaran
                      </label>
                      <input
                        type="text"
                        disabled
                        value={skillGap.student?.id || ""}
                        className="mt-1 w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm text-slate-700 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Kursus</label>
                      <input
                        type="text"
                        disabled
                        value={getFullCourseName(skillGap.student?.kursus)}
                        className="mt-1 w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm text-slate-700 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                    <i className="ph-fill ph-certificate text-blue-600"></i>{" "}
                    Tambah Sijil Baru
                  </h3>
                  <form
                    onSubmit={handleAddCertificate}
                    className="space-y-4 mb-8 border-b border-slate-100 pb-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-500 font-medium">
                          Nama Sijil
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={newCert.name}
                          onChange={handleCertInputChange}
                          placeholder="cth: Sijil Kompetensi Kimpalan"
                          className="mt-1 w-full bg-white border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 font-medium">
                          Pengeluar (Issuer)
                        </label>
                        <input
                          type="text"
                          name="issuer"
                          value={newCert.issuer}
                          onChange={handleCertInputChange}
                          placeholder="cth: CIDB"
                          className="mt-1 w-full bg-white border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-medium">
                        Lampiran Fail (PDF/PNG/JPG - Max 5MB)
                      </label>
                      {!selectedFile ? (
                        <label className="mt-1 w-full flex flex-col items-center justify-center h-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                          <i className="ph-fill ph-upload-simple text-2xl text-slate-400"></i>
                          <span className="text-xs text-slate-500 mt-1">
                            Klik untuk memilih fail
                          </span>
                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>
                      ) : (
                        <div className="mt-1 flex items-center justify-between bg-blue-50 p-3 rounded-xl border border-blue-100">
                          <div className="flex items-center gap-2 text-sm text-blue-700">
                            <i className="ph-fill ph-file text-xl"></i>{" "}
                            {selectedFile.name}
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedFile(null)}
                            className="text-red-500 hover:bg-red-50 p-1 rounded"
                          >
                            <i className="ph-bold ph-x text-lg"></i>
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={isUploadingCert}
                      className="w-full py-2.5 bg-blue-600 text-white hover:bg-blue-500 disabled:bg-slate-400 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      {isUploadingCert ? (
                        "Sedang Memuat Naik..."
                      ) : (
                        <>
                          <i className="ph-bold ph-plus"></i> Tambah Sijil
                        </>
                      )}
                    </button>
                  </form>

                  <h3 className="font-bold text-lg text-slate-900 mb-4">
                    Senarai Sijil
                  </h3>
                  {customCerts.length === 0 ? (
                    <p className="text-sm text-slate-400 italic text-center py-6">
                      Tiada sijil tambahan dijumpai. Sila tambah menggunakan
                      borang di atas.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {customCerts.map((cert) => (
                        <div
                          key={cert._id || cert.id}
                          className="border border-slate-100 p-4 rounded-xl bg-white shadow-sm hover:shadow-md transition flex items-start justify-between gap-4"
                        >
                          <div className="flex gap-3">
                            <a
                              href={cert.filePath}
                              target="_blank"
                              rel="noreferrer"
                              className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"
                            >
                              <i className="ph-fill ph-file-pdf text-xl"></i>
                            </a>
                            <div>
                              <p className="font-bold text-sm text-slate-900">
                                {cert.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {cert.issuer}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-1 truncate">
                                {cert.fileName}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              handleDeleteCertificate(cert._id || cert.id)
                            }
                            className="text-slate-300 hover:text-red-500 transition p-1"
                          >
                            <i className="ph-bold ph-trash text-lg"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CAREER */}
          {activeTab === "career" && (
            <div className="animate-[fadeIn_0.3s_ease-in-out]">
              <header className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">
                  Padanan Kerjaya Pintar
                </h1>
                <p className="text-slate-500">
                  Peluang disyorkan oleh AI untuk kursus{" "}
                  <strong>{getFullCourseName(skillGap.student?.kursus)}</strong>
                  .
                </p>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(careerMapping[skillGap.student?.kursus] || []).map(
                  (job, idx) => (
                    <JobCard key={idx} job={job} />
                  ),
                )}
              </div>
            </div>
          )}

          {/* TAB 4: COURSES */}
          {activeTab === "courses" && (
            <div className="animate-[fadeIn_0.3s_ease-in-out]">
              <header className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">
                  Kursus Cadangan (Personalized)
                </h1>
                <p className="text-slate-500">
                  Senarai kursus untuk menutup jurang kemahiran anda berdasarkan
                  PLO terlemah:{" "}
                  <strong className="text-blue-600">{weakestPlo}</strong>.
                </p>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition flex flex-col h-full relative">
                  <div
                    className={`${recommendedCourse.bg} p-6 h-40 flex flex-col justify-end`}
                  >
                    <span className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1 rounded-lg">
                      Disyorkan AI
                    </span>
                    <h3 className="text-white font-bold text-xl leading-tight">
                      {recommendedCourse.title}
                    </h3>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-xs text-slate-500 font-semibold mb-3 flex items-center gap-2">
                        <i className="ph-fill ph-clock text-lg"></i> 4 Jam •
                        Online
                      </p>
                      <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                        {recommendedCourse.desc}
                      </p>
                    </div>
                    <button
                      className={`w-full py-3 font-bold rounded-xl text-sm transition-colors ${recommendedCourse.btn}`}
                    >
                      Mula Belajar
                    </button>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition flex flex-col h-full">
                  <div className="bg-slate-900 p-6 h-40 relative flex flex-col justify-end">
                    <span className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1 rounded-lg">
                      Advanced
                    </span>
                    <h3 className="text-white font-bold text-xl leading-tight">
                      AWS Cloud Practitioner Essentials
                    </h3>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-xs text-slate-500 font-semibold mb-3 flex items-center gap-2">
                        <i className="ph-fill ph-chalkboard-teacher text-lg"></i>{" "}
                        6 Jam • Bengkel IKMB
                      </p>
                      <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                        Untuk meningkatkan peluang anda mendapat kerja "Cloud
                        Engineer" di industri teknologi.
                      </p>
                    </div>
                    <button className="w-full py-3 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold rounded-xl text-sm transition-colors">
                      Daftar Sesi
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}