"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getClientToken } from "@/lib/client-auth";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineController,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
} from "chart.js";
import { Bar, Radar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  LineController,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const getFullCourseName = (code) => {
  const names = {
    ITW: "Diploma Kompetensi Kimpalan",
    DFK: "Diploma Teknologi Komputer (Komputasi Awan)",
    DGA: "Diploma Teknologi Automotif",
    SLR: "Sijil Teknologi Kejuruteraan Mekanikal (Lukisan Rekabentuk)",
    DCG: "Diploma Kompetensi Elektrik (Industri)",
    SED: "Sijil Teknologi Kejuruteraan Elektrik (Domestik dan Industri)",
    PPU: "Diploma Teknologi Penyejukan dan Penyamanan Udara",
  };
  return names[code] || code || "Kursus Tidak Diketahui";
};

const StatusBadge = ({ status }) => {
  let color = "bg-gray-100 text-gray-800 border-gray-200";
  let label = status || "Sederhana";
  let icon = "ph-info";

  if (label === "Tinggi" || label === "Bermasalah") {
    color = "bg-red-50 text-red-700 border-red-200";
    label = "Tinggi";
    icon = "ph-warning-octagon";
  } else if (label === "Sederhana") {
    color = "bg-amber-50 text-amber-700 border-amber-200";
    label = "Sederhana";
    icon = "ph-clock";
  } else if (label === "Rendah" || label === "Cemerlang") {
    color = "bg-emerald-50 text-emerald-700 border-emerald-200";
    label = "Rendah";
    icon = "ph-check-circle";
  }
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${color} bg-opacity-90 backdrop-blur-sm shadow-sm`}
    >
      <i className={`ph-fill ${icon} text-sm`}></i> {label}
    </span>
  );
};

export default function StudentProfileClient({ studentId }) {
  const router = useRouter();
  const [skillGap, setSkillGap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("personal");

  useEffect(() => {
    if (!studentId) return;
    const t = getClientToken();
    if (!t) { router.push("/"); return; }
    fetch(`/api/students/${studentId}/skill-gap`, { headers: { Authorization: `Bearer ${t}` } })
      .then((res) => res.json())
      .then((data) => setSkillGap(data))
      .catch(() => setSkillGap(null))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading)
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1251AA]"></div>
      </div>
    );
  if (!skillGap || !skillGap.student)
    return (
      <div className="min-h-screen flex justify-center items-center">
        Pelajar tidak dijumpai.
      </div>
    );

  const { student, chart = {}, insight = {} } = skillGap;

  const cgpaVal = parseFloat(student.cgpa) || 0;
  const attendanceVal = parseFloat(student.attendance) || 0;

  let cgpaColor = "bg-red-500";
  if (cgpaVal >= 3.5) cgpaColor = "bg-emerald-500";
  else if (cgpaVal >= 2.5) cgpaColor = "bg-amber-500";

  const historyData = Array.isArray(student.academicHistory)
    ? student.academicHistory
    : [];
  const labels =
    historyData.length > 0
      ? historyData.map((h) => `Sem ${h.semester || "?"}`)
      : ["Semasa"];

  const gpaData =
    historyData.length > 0
      ? historyData.map((h) => parseFloat(h.gpa) || 0)
      : [cgpaVal];
  const attendanceData =
    historyData.length > 0
      ? historyData.map((h) => parseFloat(h.attendance) || 0)
      : [attendanceVal];

  const trendData = {
    labels: labels,
    datasets: [
      {
        type: "line",
        label: "GPA",
        data: gpaData,
        borderColor: "#2563EB",
        backgroundColor: "#2563EB",
        borderWidth: 2,
        tension: 0.3,
        yAxisID: "y",
      },
      {
        type: "bar",
        label: "Kehadiran (%)",
        data: attendanceData,
        backgroundColor: "rgba(16, 185, 129, 0.2)",
        borderColor: "#10B981",
        borderWidth: 1,
        borderRadius: 4,
        yAxisID: "y1",
      },
    ],
  };

  const radarLabels =
    chart.labels || Array.from({ length: 9 }, (_, i) => `PLO ${i + 1}`);
  const radarCurrent = chart.current || Array(9).fill(0);
  const radarTarget = chart.target || Array(9).fill(80);

  const radarData = {
    labels: radarLabels,
    datasets: [
      {
        label: `Data Pelajar (${studentId})`,
        data: radarCurrent,
        fill: true,
        backgroundColor: "rgba(37, 99, 235, 0.2)",
        borderColor: "#2563EB",
        pointBackgroundColor: "#2563EB",
      },
      {
        label: "Target Kursus",
        data: radarTarget,
        fill: true,
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        borderColor: "#10B981",
        borderDash: [5, 5],
        pointBackgroundColor: "#10B981",
      },
    ],
  };

  const hasZeroScore = radarCurrent.some((s) => s === 0);
  const employabilityScore = Math.min(
    100,
    Math.round((cgpaVal / 4) * 40 + attendanceVal * 0.6),
  );

  const handlePrint = () => window.print();

  const handleDownload = () => {
    const exportData = {
      studentDetails: student,
      academicHistory: student.academicHistory || [],
      aiInsight: insight.message || "Tiada insight",
      employabilityScore: employabilityScore,
      ploScores: radarLabels.map((label, i) => ({
        plo: label,
        score: radarCurrent[i],
        target: radarTarget[i],
      })),
    };
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Profil_Pelajar_${student.id || "unknown"}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#EEF3FB] p-6 font-sans">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => router.push("/staff-dashboard")}
            className="flex items-center gap-1 text-[#5A6A85] hover:text-[#1251AA] font-medium"
          >
            <i className="ph-bold ph-arrow-left"></i> Senarai Pelajar
          </button>
          <span className="text-[#5A6A85]">/</span>
          <span className="font-medium text-[#0A1628]">{student.nama}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-[rgba(18,81,170,0.13)] overflow-hidden sticky top-6">
            <div className="h-24 bg-[#0C2461] p-4 flex justify-between items-start">
              <div>
                <p className="text-white font-bold text-sm">TVETMARA IKMB</p>
                <p className="text-white/70 text-xs">
                  Sistem Pengurusan Pelajar
                </p>
              </div>
              <StatusBadge status={student.dropoutRisk} />
            </div>

            <div className="px-6 pb-6 -mt-12 text-center">
              <div className="w-24 h-24 mx-auto rounded-full bg-[#1251AA] text-white text-4xl font-bold flex items-center justify-center border-4 border-white mb-3">
                {student.nama?.charAt(0) || "?"}
              </div>
              <h2 className="text-lg font-bold text-[#0A1628]">
                {student.nama || "Nama Tidak Diketahui"}
              </h2>
              <p className="text-sm text-[#5A6A85] font-mono">{student.id}</p>

              <div className="mt-6 space-y-3 text-left">
                <div className="flex justify-between text-sm py-2 border-b border-gray-100">
                  <span className="text-[#5A6A85]">Kursus</span>
                  <span className="font-medium text-[#0A1628] text-right">
                    {getFullCourseName(student.kursus)}
                  </span>
                </div>
                <div className="flex justify-between text-sm py-2 border-b border-gray-100">
                  <span className="text-[#5A6A85]">Semester</span>
                  <span className="font-medium text-[#0A1628]">
                    {student.semester || "2"}
                  </span>
                </div>
                <div className="flex justify-between text-sm py-2 border-b border-gray-100">
                  <span className="text-[#5A6A85]">Sijil</span>
                  <span className="font-medium text-[#0A1628]">
                    {student.certification || "Tiada"}
                  </span>
                </div>
                <div className="flex justify-between text-sm py-2">
                  <span className="text-[#5A6A85]">Kehadiran</span>
                  <span className="font-medium text-[#0A1628]">
                    {attendanceVal}%
                  </span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2">
                <button className="bg-[#1251AA] text-white py-2 rounded-lg text-xs font-medium hover:bg-[#0C2461] flex items-center justify-center gap-1">
                  <i className="ph-bold ph-pencil-simple"></i> Edit
                </button>
                <button
                  onClick={handlePrint}
                  className="bg-gray-100 text-[#5A6A85] py-2 rounded-lg text-xs font-medium hover:bg-gray-200 flex items-center justify-center transition-colors"
                >
                  <i className="ph-bold ph-printer"></i>
                </button>
                <button
                  onClick={handleDownload}
                  className="bg-gray-100 text-[#5A6A85] py-2 rounded-lg text-xs font-medium hover:bg-gray-200 flex items-center justify-center transition-colors"
                >
                  <i className="ph-bold ph-download-simple"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-[rgba(18,81,170,0.13)]">
            <div className="border-b border-gray-200 flex">
              {["personal", "academic", "skills"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? "border-[#1251AA] text-[#1251AA]" : "border-transparent text-[#5A6A85] hover:text-[#0A1628]"}`}
                >
                  {tab === "personal"
                    ? "Maklumat Peribadi"
                    : tab === "academic"
                    ? "Rekod Akademik"
                    : "PLO & AI Insight"}
                </button>
              ))}
            </div>

            <div className="p-6">
              {activeTab === "personal" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-sm uppercase tracking-wide text-[#5A6A85] font-medium">
                      Maklumat Asas
                    </h3>
                    <div>
                      <label className="text-xs text-[#5A6A85]">Email</label>
                      <p className="text-sm text-[#0A1628] font-mono mt-1 break-all">
                        {student.id}@student.ikmb.edu.my
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-[#5A6A85]">
                        No. Telefon
                      </label>
                      <p className="text-sm text-[#0A1628] font-mono mt-1">
                        {student.noTelefon || "Tiada Rekod"}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-[#5A6A85]">No. KP</label>
                      <p className="text-sm text-[#0A1628] font-mono mt-1">
                        {student.noKP || "Tiada Rekod"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-sm uppercase tracking-wide text-[#5A6A85] font-medium">
                      Alamat
                    </h3>
                    <p className="text-sm text-[#0A1628] leading-relaxed">
                      {student.alamat || "Tiada Rekod"}
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "academic" && (
                <div className="space-y-6">
                  <div className="bg-[#EEF3FB] p-4 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[#5A6A85]">
                        Purata Gred Kumulatif (CGPA)
                      </p>
                      <p className="text-3xl font-bold text-[#0A1628] mt-1">
                        {cgpaVal.toFixed(2)}{" "}
                        <span className="text-base font-normal text-[#5A6A85]">
                          / 4.00
                        </span>
                      </p>
                    </div>
                    <div className="w-1/2 bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`${cgpaColor} h-full rounded-full`}
                        style={{ width: `${(cgpaVal / 4) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="border border-gray-100 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-[#0A1628] mb-4">
                      Trend GPA & Kehadiran
                    </h4>
                    <div className="h-64">
                      <Bar
                        data={trendData}
                        options={{
                          maintainAspectRatio: false,
                          scales: {
                            y: {
                              type: "linear",
                              display: true,
                              position: "left",
                              max: 4,
                              title: { display: true, text: "GPA" },
                            },
                            y1: {
                              type: "linear",
                              display: true,
                              position: "right",
                              max: 100,
                              title: { display: true, text: "Kehadiran (%)" },
                              grid: { drawOnChartArea: false },
                            },
                          },
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "skills" && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-4 rounded-lg text-white relative overflow-hidden">
                    <i className="ph-fill ph-magic-wand absolute -right-4 -bottom-4 text-7xl text-white/5"></i>
                    <h4 className="text-slate-300 font-medium text-sm mb-2 flex items-center gap-2">
                      <i className="ph-fill ph-robot"></i> Ramalan
                      Kebolehpasaran (AI)
                    </h4>
                    <div className="flex items-end gap-2 mb-4">
                      <span className="text-5xl font-bold">
                        {employabilityScore}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {insight.message ||
                        "Tiada analisis AI tersedia buat masa ini."}
                    </p>
                  </div>

                  <div className="border border-gray-100 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-sm font-medium text-[#0A1628]">
                        Analisis Kemahiran (PLO)
                      </h4>
                      {hasZeroScore && (
                        <div className="text-[10px] text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200 flex items-center gap-1 font-bold">
                          <i className="ph-fill ph-info"></i> DATA PLO BELUM
                          LENGKAP
                        </div>
                      )}
                    </div>
                    <div className="h-72">
                      <Radar
                        data={radarData}
                        options={{
                          maintainAspectRatio: false,
                          scales: {
                            r: {
                              min: 0,
                              max: 100,
                              beginAtZero: true,
                              ticks: { stepSize: 20 },
                            },
                          },
                        }}
                      />
                    </div>
                    {hasZeroScore && (
                      <p className="text-xs text-slate-400 italic mt-4">
                        Skor 0% mungkin disebabkan penilaian PLO belum
                        direkodkan oleh pensyarah.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border border-red-100 bg-red-50/50 p-4 rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold mb-3">
                        1
                      </div>
                      <h5 className="font-bold text-[#0A1628] text-sm mb-1">
                        Kaunseling Kehadiran
                      </h5>
                      <p className="text-xs text-[#5A6A85] mb-3">
                        Kehadiran jatuh bawah 80% pada bulan lepas. Jadualkan
                        sesi perjumpaan segera.
                      </p>
                      <button
                        onClick={() => alert("Temujanji berjaya dihantar!")}
                        className="w-full text-xs font-bold text-red-600 border border-red-200 bg-white py-2 rounded-lg hover:bg-red-50 transition"
                      >
                        Set Temujanji
                      </button>
                    </div>
                    <div className="border border-orange-100 bg-orange-50/50 p-4 rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold mb-3">
                        2
                      </div>
                      <h5 className="font-bold text-[#0A1628] text-sm mb-1">
                        Klinik Akademik
                      </h5>
                      <p className="text-xs text-[#5A6A85] mb-3">
                        Markah subjek Programming merosot. Masukkan pelajar
                        dalam kelas bimbingan tambahan.
                      </p>
                      <button
                        onClick={() => alert("Pendaftaran klinik berjaya!")}
                        className="w-full text-xs font-bold text-orange-600 border border-orange-200 bg-white py-2 rounded-lg hover:bg-orange-50 transition"
                      >
                        Daftar Klinik
                      </button>
                    </div>
                    <div className="border border-blue-100 bg-blue-50/50 p-4 rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold mb-3">
                        3
                      </div>
                      <h5 className="font-bold text-[#0A1628] text-sm mb-1">
                        Pembangunan Soft Skills
                      </h5>
                      <p className="text-xs text-[#5A6A85] mb-3">
                        Kemahiran komunikasi memuaskan. Tingkatkan melalui kem
                        kepimpinan.
                      </p>
                      <button
                        onClick={() => alert("Senarai program dipaparkan!")}
                        className="w-full text-xs font-bold text-blue-600 border border-blue-200 bg-white py-2 rounded-lg hover:bg-blue-50 transition"
                      >
                        Lihat Program
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}