"use client";
import { useState, useEffect } from "react";
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

  const [manualPredict, setManualPredict] = useState({
    cgpa: 3.0,
    attendance: 85,
    plo1: 80,
    plo2: 80,
    plo3: 80,
    plo4: 80,
    plo5: 80,
    plo6: 80,
    plo7: 80,
    plo8: 80,
    plo9: 80,
    certification: "Tiada",
  });
  const [manualResult, setManualResult] = useState(null);

  const [mdbFile, setMdbFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);

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
    } else {
      setIsLoading(false);
    }
  }, []);

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
  const calculateEmployability = (s) =>
    Math.min(
      100,
      Math.round((Number(s.cgpa) / 4) * 40 + Number(s.attendance) * 0.6),
    );
  const averageEmployability =
    totalStudents > 0
      ? (
          students.reduce((acc, s) => acc + calculateEmployability(s), 0) /
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

  const handleInputChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleManualChange = (e) =>
    setManualPredict({ ...manualPredict, [e.target.name]: e.target.value });

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

  const runManualPrediction = async () => {
    const t = getClientToken();
    if (!t) { router.push("/"); return; }
    const response = await fetch("/api/predict/manual", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`,
      },
      body: JSON.stringify(manualPredict),
    });
    if (response.ok) setManualResult((await response.json()).prediction);
  };

  const handleMdbUpload = async () => {
    if (!mdbFile) return;
    setIsUploading(true);
    setUploadMsg(null);
    try {
      const t = getClientToken();
      if (!t) { router.push("/"); return; }
      const formData = new FormData();
      formData.append("file", mdbFile);

      const response = await fetch("/api/data/upload-mdb", {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` },
        body: formData,
      });

      const result = await response.json().catch(() => ({}));
      if (response.ok) {
        setUploadMsg({ type: "success", text: result.message });
        setMdbFile(null);
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setUploadMsg({ type: "error", text: result.message || "Ralat semasa memuat naik." });
      }
    } catch (error) {
      setUploadMsg({ type: "error", text: "Gagal menyambung ke pelayan." });
    } finally {
      setIsUploading(false);
    }
  };

  const navItems = [
    { id: "overview", icon: "ph-squares-four", label: "Dashboard Overview" },
    { id: "prediction", icon: "ph-magic-wand", label: "AI Prediction" },
    { id: "skills", icon: "ph-chart-bar", label: "Skills Gap Analysis" },
    { id: "pathways", icon: "ph-path", label: "Learning Pathways" },
    { id: "management", icon: "ph-users-three", label: "Student Management" },
    { id: "data", icon: "ph-database", label: "Pengurusan Data" },
  ];

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
                />
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
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
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="font-bold text-lg text-red-600 mb-4">
                    Pelajar Berisiko Tinggi
                  </h3>
                  <div className="space-y-4">
                    {highRiskStudents.slice(0, 5).map((s) => (
                      <div
                        key={s.id}
                        onClick={() => handleNavigate(`/student-profile?id=${s.id}`)}
                        className="bg-red-50 p-4 rounded-xl border border-red-100 cursor-pointer hover:bg-red-100 flex justify-between items-center"
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
                        <i className="ph ph-caret-right text-red-400"></i>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="font-bold text-lg text-yellow-600 mb-4">
                    Top Performers
                  </h3>
                  <div className="space-y-4">
                    {topPerformers.map((s) => (
                      <div
                        key={s.id}
                        className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 flex justify-between items-center cursor-pointer hover:bg-yellow-100"
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
                          {Math.min(
                            100,
                            Math.round(
                              (Number(s.cgpa) / 4) * 60 +
                                Number(s.attendance) * 0.4,
                            ),
                          )}
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
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900">
                AI Manual Prediction
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-500">
                        CGPA
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        name="cgpa"
                        value={manualPredict.cgpa}
                        onChange={handleManualChange}
                        className="border p-2 rounded-lg"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-500">
                        Kehadiran (%)
                      </label>
                      <input
                        type="number"
                        name="attendance"
                        value={manualPredict.attendance}
                        onChange={handleManualChange}
                        className="border p-2 rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500">
                      Sijil
                    </label>
                    <select
                      name="certification"
                      value={manualPredict.certification}
                      onChange={handleManualChange}
                      className="border p-2 rounded-lg"
                    >
                      <option>Tiada</option>
                      <option>CompTIA</option>
                      <option>Cisco CCNA</option>
                      <option>AWS Cloud</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                      <div key={n} className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-500">
                          PLO {n}
                        </label>
                        <input
                          type="number"
                          name={`plo${n}`}
                          value={manualPredict[`plo${n}`]}
                          onChange={handleManualChange}
                          className="border p-2 rounded-lg"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={runManualPrediction}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700"
                  >
                    Jana Ramalan AI
                  </button>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center">
                  {manualResult ? (
                    <div className="text-center space-y-4">
                      <i className="ph-fill ph-robot text-6xl text-blue-600"></i>
                      <h3 className="text-xl font-bold">
                        Keputusan Ramalan AI
                      </h3>
                      <div
                        className={`text-4xl font-bold px-6 py-3 rounded-xl ${manualResult === "Rendah" ? "bg-green-100 text-green-700" : manualResult === "Sederhana" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}
                      >
                        {manualResult}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-slate-400">
                      <i className="ph ph-seal-question text-6xl"></i>
                      <p className="mt-4">Keputusan akan dipaparkan di sini.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "skills" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900">
                Skills Gap Analysis
              </h2>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
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
                    {skillsGapData.map((s) => (
                      <tr key={s.plo} className="hover:bg-slate-50">
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
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900">
                Learning Pathways
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommendedPathways.map((s) => (
                  <div
                    key={s.plo}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
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
            />
          )}

          {activeTab === "data" && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Pengurusan Data TVET
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  Muat naik fail pangkalan data Microsoft Access (.mdb) untuk
                  mengemas kini rekod pelajar.
                </p>
              </div>
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
                <div
                  className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition"
                  onClick={() =>
                    document.getElementById("mdb-upload-input").click()
                  }
                >
                  <input
                    id="mdb-upload-input"
                    type="file"
                    accept=".mdb"
                    className="hidden"
                    onChange={(e) => {
                      setMdbFile(e.target.files[0]);
                      setUploadMsg(null);
                    }}
                  />
                  <i className="ph ph-upload-simple text-5xl text-slate-400"></i>
                  {mdbFile ? (
                    <p className="mt-3 text-sm font-bold text-blue-600">
                      {mdbFile.name}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      Klik untuk pilih fail{" "}
                      <span className="font-bold">.mdb</span>
                    </p>
                  )}
                </div>
                <button
                  onClick={handleMdbUpload}
                  disabled={!mdbFile || isUploading}
                  className={`w-full py-3 rounded-lg font-bold text-white transition flex items-center justify-center gap-2 ${!mdbFile || isUploading ? "bg-slate-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
                >
                  {isUploading ? (
                    <>
                      <i className="ph ph-spinner-gap animate-spin text-xl"></i>{" "}
                      Memproses Data...
                    </>
                  ) : (
                    "Jana & Kemas Kini Database"
                  )}
                </button>
                {uploadMsg && (
                  <div
                    className={`p-4 rounded-lg text-sm font-medium ${uploadMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                  >
                    {uploadMsg.text}
                  </div>
                )}
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg text-xs text-blue-800">
                  <p className="font-bold mb-1">Nota:</p>
                  <p>
                    Sistem akan mengekstrak data dari fail MDB, memprosesnya
                    melalui enjin Python, dan mengemas kini pangkalan data
                    MongoDB. Sijil dan gambar profil yang telah dimuat naik oleh
                    pelajar sedia ada akan kekal tidak terjejas.
                  </p>
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