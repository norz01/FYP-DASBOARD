"use client";
import { useState, useEffect, useMemo, useRef } from "react";
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
import { SectionCard, SkeletonList, EmptyState, Badge, PillTabs } from "@/components/ui/dashboard-kit";
import MergedLaporanTab from "./MergedLaporanTab";
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
  const [activeDataset, setActiveDataset] = useState(null);
  const [semesters, setSemesters] = useState([]);

  const [careerView, setCareerView] = useState("auto");
  const [manualQuery, setManualQuery] = useState("");
  const [manualLocation, setManualLocation] = useState("Malaysia");
  const [manualEmploymentType, setManualEmploymentType] = useState("INTERN");
  const [manualDatePosted, setManualDatePosted] = useState("all");
  const [manualJobs, setManualJobs] = useState([]);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualSearched, setManualSearched] = useState(false);
  const [manualCursor, setManualCursor] = useState(null);
  const [lastManualSearch, setLastManualSearch] = useState(null);
  const [manualFailedPage, setManualFailedPage] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [recentOpen, setRecentOpen] = useState(false);
  const [recentIndex, setRecentIndex] = useState(-1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [careerResetAt, setCareerResetAt] = useState(null);
  const [detailsJobId, setDetailsJobId] = useState(null);
  const [jobDetails, setJobDetails] = useState(null);
  const [savedJobs, setSavedJobs] = useState([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState("");
  const [savedRetry, setSavedRetry] = useState(0);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savingIds, setSavingIds] = useState([]);
  const saveRequests = useRef(new Map());
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [pathway, setPathway] = useState(null);
  const [pathwayJobs, setPathwayJobs] = useState([]);
  const [pathwayLoading, setPathwayLoading] = useState(false);
  const [pathwayError, setPathwayError] = useState("");
  const [pathwayWarning, setPathwayWarning] = useState("");
  const [pathwayRetry, setPathwayRetry] = useState(0);
  const manualRequest = useRef(null);
  const historyRequest = useRef(null);
  const detailsRequest = useRef(null);
  const careerJobs = useMemo(() => careerView === "saved" ? savedJobs : careerView === "manual" ? manualJobs : pathwayJobs, [careerView, savedJobs, manualJobs, pathwayJobs]);
  const visibleRecentSearches = useMemo(() => recentSearches.filter((keyword) => keyword.toLowerCase().includes(manualQuery.trim().toLowerCase())), [recentSearches, manualQuery]);

  useEffect(() => () => {
    manualRequest.current?.abort();
    historyRequest.current?.abort();
    detailsRequest.current?.abort();
    for (const controller of saveRequests.current.values()) controller.abort();
  }, []);

  useEffect(() => {
    setRecentSearches([]);
    setRecentOpen(false);
    setJobDetails(null); setDetailsJobId(null);
    setDetailsLoading(false);
    setDetailsError("");
    setManualCursor(null);
    setLastManualSearch(null);
    setManualFailedPage(false);
    setManualError("");
    setHistoryError("");
    setManualJobs([]);
    setManualLoading(false);
    manualRequest.current?.abort();
    historyRequest.current?.abort();
    detailsRequest.current?.abort();
  }, [selectedStudentId]);

  useEffect(() => {
    if (!careerResetAt) return;
    const timeout = setTimeout(() => {
      manualRequest.current?.abort();
      historyRequest.current?.abort();
      detailsRequest.current?.abort();
      setManualJobs([]);
      setPathwayJobs([]);
      setRecentSearches([]);
      setRecentOpen(false);
      setManualCursor(null);
      setLastManualSearch(null);
      setManualFailedPage(false);
      setJobDetails(null); setDetailsJobId(null);
      setDetailsError("");
      setHistoryError("");
      setManualLoading(false);
      setHistoryLoading(false);
      setDetailsLoading(false);
      setManualError("Carian harian telah ditetapkan semula pada 8 pagi. Mulakan carian baharu.");
      setCareerResetAt(null);
      setPathwayRetry((value) => value + 1);
    }, Math.max(0, careerResetAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [careerResetAt]);

  useEffect(() => {
    setSavedJobs([]);
    setSavingIds([]);
    setSaveMessage("");
    setSaveError("");
    for (const controller of saveRequests.current.values()) controller.abort();
    saveRequests.current.clear();
  }, [user?.studentId, user?.role]);

  useEffect(() => {
    if (user?.role !== "user" || !user?.studentId) return;
    const controller = new AbortController();
    setSavedLoading(true);
    setSavedError("");
    async function loadSavedJobs() {
      try {
        const res = await fetch("/api/careers/saved-jobs", { signal: controller.signal });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || "Jawatan disimpan tidak dapat dimuatkan.");
        if (!controller.signal.aborted) setSavedJobs(data.jobs);
      } catch (error) {
        if (!controller.signal.aborted) setSavedError(error.message);
      } finally {
        if (!controller.signal.aborted) setSavedLoading(false);
      }
    }
    loadSavedJobs();
    return () => controller.abort();
  }, [user?.studentId, user?.role, savedRetry]);

  const toggleSavedJob = async (job) => {
    if (savedLoading || savedError || saveRequests.current.has(job.jobId)) return;
    const removing = savedJobs.some((saved) => saved.jobId === job.jobId);
    const controller = new AbortController();
    saveRequests.current.set(job.jobId, controller);
    setSavingIds((ids) => [...ids, job.jobId]);
    setSaveMessage("");
    setSaveError("");
    try {
      const url = `/api/careers/saved-jobs${removing ? `?${new URLSearchParams({ job_id: job.jobId })}` : ""}`;
      const res = await fetch(url, {
        method: removing ? "DELETE" : "POST",
        ...(removing ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job }) }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Jawatan tidak dapat disimpan. Sila cuba lagi.");
      if (controller.signal.aborted) return;
      setSavedJobs((jobs) => removing ? jobs.filter((saved) => saved.jobId !== job.jobId) : [data.job, ...jobs.filter((saved) => saved.jobId !== job.jobId)]);
      setSaveMessage(removing ? "Jawatan dikeluarkan daripada simpanan." : "Jawatan berjaya disimpan.");
    } catch (error) {
      if (!controller.signal.aborted) setSaveError(error.message);
    } finally {
      if (!controller.signal.aborted) {
        saveRequests.current.delete(job.jobId);
        setSavingIds((ids) => ids.filter((id) => id !== job.jobId));
      }
    }
  };

  const toggleJobDetails = (job) => {
    if (detailsJobId !== job.jobId) { loadJobDetails(job); return; }
    detailsRequest.current?.abort();
    setDetailsJobId(null);
    setJobDetails(null);
    setDetailsError("");
    setDetailsLoading(false);
  };

  const loadRecentSearches = async () => {
    historyRequest.current?.abort();
    const controller = new AbortController();
    historyRequest.current = controller;
    setRecentOpen(true);
    setRecentIndex(-1);
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const params = new URLSearchParams(selectedStudentId ? { studentId: selectedStudentId } : {});
      const res = await fetch(`/api/careers/history?${params}`, { signal: controller.signal });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Sejarah carian tidak tersedia.");
      if (controller.signal.aborted) return;
      if (data.resetAt <= Date.now()) throw new Error("Sejarah harian telah ditetapkan semula.");
      setRecentSearches(data.keywords);
      setCareerResetAt(data.resetAt);
    } catch (error) {
      if (!controller.signal.aborted) { setRecentSearches([]); setHistoryError(error.message); }
    } finally {
      if (!controller.signal.aborted) setHistoryLoading(false);
    }
  };

  const loadJobDetails = async (job) => {
    detailsRequest.current?.abort();
    const controller = new AbortController();
    detailsRequest.current = controller;
    setJobDetails(null); setDetailsJobId(null);
    setDetailsError("");
    setDetailsLoading(true);
    setDetailsJobId(job.jobId);
    try {
      const params = new URLSearchParams({ job_id: job.jobId, ...(selectedStudentId ? { studentId: selectedStudentId } : {}) });
      const res = await fetch(`/api/careers/job-details?${params}`, { signal: controller.signal });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Butiran jawatan tidak tersedia.");
      if (controller.signal.aborted) return;
      if (data.resetAt <= Date.now()) throw new Error("Butiran harian telah ditetapkan semula. Cuba lagi.");
      setJobDetails(data.job);
      setCareerResetAt(data.resetAt);
    } catch (error) {
      if (!controller.signal.aborted) setDetailsError(error.message);
    } finally {
      if (!controller.signal.aborted) setDetailsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "career" || careerView !== "pathway" || !selectedStudentId) return;
    const controller = new AbortController();
    setPathway(null);
    setPathwayJobs([]);
    setPathwayError("");
    setPathwayWarning("");
    setPathwayLoading(true);
    async function loadPathway() {
      try {
        const res = await fetch(`/api/careers/pathways/${encodeURIComponent(selectedStudentId)}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || "Laluan pembelajaran tidak dapat dimuatkan.");
        if (controller.signal.aborted) return;
        if (data.resetAt <= Date.now()) throw new Error("Carian harian telah ditetapkan semula. Cuba lagi.");
        setPathway(data.pathway);
        setPathwayJobs(data.jobs);
        setPathwayWarning(data.warning || "");
        if (data.resetAt) setCareerResetAt(data.resetAt);
      } catch (error) {
        if (!controller.signal.aborted) setPathwayError(error.message || "Sambungan gagal. Sila cuba lagi.");
      } finally {
        if (!controller.signal.aborted) setPathwayLoading(false);
      }
    }
    loadPathway();
    return () => controller.abort();
  }, [activeTab, careerView, selectedStudentId, pathwayRetry]);

  const handleManualSearch = async (event, suggested = null, append = false) => {
    event?.preventDefault();
    const search = append ? lastManualSearch : { ...(suggested || { q: manualQuery, location: manualLocation, employmentType: manualEmploymentType }), date_posted: manualDatePosted };
    if (!search || (append && (!manualCursor || !careerResetAt || careerResetAt <= Date.now()))) return;
    if (!search.q.trim() || !search.location.trim()) return;
    manualRequest.current?.abort();
    const controller = new AbortController();
    manualRequest.current = controller;
    setCareerView("manual");
    setManualQuery(search.q);
    setManualLocation(search.location);
    setManualEmploymentType(search.employmentType);
    setManualDatePosted(search.date_posted);
    setRecentOpen(false);
    if (!append) {
      setManualJobs([]);
      setManualCursor(null);
      setJobDetails(null); setDetailsJobId(null);
      setDetailsLoading(false);
      setDetailsError("");
      detailsRequest.current?.abort();
    }
    setManualError("");
    setManualFailedPage(false);
    setManualSearched(true);
    setManualLoading(true);
    try {
      const params = new URLSearchParams({ ...search, ...(append ? { cursor: manualCursor } : {}), ...(selectedStudentId ? { studentId: selectedStudentId } : {}) });
      const res = await fetch(`/api/careers/search?${params}`, { signal: controller.signal });
      const data = await res.json();
      if (!res.ok || !data.success) {
        const error = new Error(data.warning || data.message || "Carian tidak dapat dimuatkan.");
        error.code = data.code;
        throw error;
      }
      if (controller.signal.aborted) return;
      if (data.resetAt <= Date.now()) throw new Error("Carian harian telah ditetapkan semula. Mulakan carian baharu.");
      setManualJobs((previous) => append ? [...new Map([...previous, ...data.jobs].map((job) => [job.jobId, job])).values()] : data.jobs);
      setManualCursor(data.cursor || null);
      setLastManualSearch(search);
      if (data.resetAt) setCareerResetAt(data.resetAt);
    } catch (error) {
      if (!controller.signal.aborted) {
        setManualError(error.message || "Sambungan gagal. Sila cuba lagi.");
        setManualFailedPage(append);
        if (["DAILY_RESET", "PROVIDER_INVALID_QUERY"].includes(error.code)) {
          setManualCursor(null);
          setManualFailedPage(false);
          if (error.code === "DAILY_RESET") setManualJobs([]);
        }
      }
    } finally {
      if (!controller.signal.aborted) setManualLoading(false);
    }
  };

  useEffect(() => {
    const u = getClientUser();
    setUser(u);
    const t = getClientToken();
    if (t) {
      fetch("/api/semesters", { headers: { Authorization: `Bearer ${t}` } })
        .then(async (res) => {
          if (res.status === 403) {
            const d = await res.json().catch(() => ({}));
            if (d.code === "PASSWORD_CHANGE_REQUIRED") {
              window.location.href = "/change-password";
              return [];
            }
          }
          return res.json();
        })
        .then(data => {
          const list = Array.isArray(data) ? data : [];
          setSemesters(list);
          const currentSem = list.find(s => s.isCurrentSemester);
          if (currentSem) {
            setActiveDataset(currentSem.datasetName);
          } else if (list.length > 0) {
            setActiveDataset(list[0].datasetName);
          } else {
            setActiveDataset(null);
            setStudents([]);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          console.error("Fetch semesters error:", err);
          setActiveDataset(null);
          setStudents([]);
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeDataset) {
      setStudents([]);
      setIsLoading(false);
      return;
    }
    const u = getClientUser();
    const t = getClientToken();
    if (t) {
      setIsLoading(true);
      const url = `/api/students?dataset=${encodeURIComponent(activeDataset)}`;
      fetch(url, { headers: { Authorization: `Bearer ${t}` } })
        .then((res) => res.json())
        .then((data) => {
          const list = Array.isArray(data) ? data : [];
          const isRestrictedUser = u?.role === "user" && u?.studentId;
          const visibleStudents = isRestrictedUser
            ? list.filter((s) => s.id === u.studentId)
            : list;
          setStudents(visibleStudents);
          if (visibleStudents.length > 0) {
            setSelectedStudentId((prev) =>
              visibleStudents.some((s) => s.id === prev) ? prev : visibleStudents[0].id
            );
          } else {
            setSelectedStudentId("");
          }
        })
        .catch((err) => console.error("Fetch students error:", err))
        .finally(() => setIsLoading(false));
    }
  }, [activeDataset]);

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
        const datasetQuery = activeDataset ? `?dataset=${encodeURIComponent(activeDataset)}` : "";
        const resGap = await fetch(`/api/students/${selectedStudentId}/skill-gap${datasetQuery}`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        setSkillGap(await resGap.json());

        const resStudent = await fetch(`/api/students/${selectedStudentId}${datasetQuery}`, {
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
  }, [selectedStudentId, activeDataset]);

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

        // Sync the main students array so it persists across tabs
        setStudents((prev) =>
          prev.map((s) =>
            s.id === selectedStudentId ? { ...s, profileImage: data.imagePath } : s
          )
        );
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
    { id: "reports", icon: "ph-tray", label: "Laporan & Temujanji" },
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
        profileImage={skillGap.student?.profileImage}
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
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-blue-100 border-2 border-white shadow-md overflow-hidden flex items-center justify-center text-blue-600 font-bold text-xl shrink-0">
                    {skillGap.student?.profileImage ? (
                      <img src={skillGap.student.profileImage} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      skillGap.student?.nama?.charAt(0) || "P"
                    )}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                      Selamat Datang, {currentStudentLabel}! 👋
                    </h1>
                    <p className="text-slate-500 text-sm">
                      Analisis prestasi dan potensi kerjaya anda.
                    </p>
                  </div>
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

              {activeDataset && (
                <div className="mb-6 animate-[fadeIn_0.3s_ease-in-out]">
                  <span className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-full text-sm font-bold shadow-sm">
                    <i className="ph-fill ph-calendar-check text-lg"></i>
                    Semester Semasa: <span className="font-extrabold text-blue-900">{activeDataset}</span>
                  </span>
                </div>
              )}

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

          {/* TAB: REPORTS / LAPORAN & TEMUJANJI */}
          {activeTab === "reports" && (
            <div className="animate-[fadeIn_0.3s_ease-in-out]">
              <MergedLaporanTab user={user} />
            </div>
          )}

          {/* TAB 3: CAREER */}
          {activeTab === "career" && (
            <div className="animate-[fadeIn_0.3s_ease-in-out] anim-fill">
              <SectionCard title="Kerjaya & Laluan Pembelajaran" icon="ph-briefcase" subtitle="Terokai jawatan dan rancang langkah seterusnya mengikut kemahiran anda.">
                <PillTabs
                  tabs={[
                    { id: "auto", label: "Cadangan Automatik", icon: "ph-sparkle" },
                    { id: "manual", label: "Carian Manual", icon: "ph-magnifying-glass" },
                    { id: "pathway", label: "Laluan Pembelajaran", icon: "ph-path" },
                    ...(isRestrictedUser ? [{ id: "saved", label: "Disimpan", icon: "ph-bookmark-simple", count: savedJobs.length }] : []),
                  ]}
                  activeTab={careerView}
                  setActiveTab={setCareerView}
                />

                {saveMessage && <p role="status" className="mt-3 text-sm text-emerald-700">{saveMessage}</p>}
                {saveError && <p role="alert" className="mt-3 text-sm text-red-700">{saveError}</p>}
                {savedError && <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 text-sm text-red-700"><p>{savedError}</p><button type="button" onClick={() => setSavedRetry((value) => value + 1)} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 touch-target active:scale-95">Muat Semula Simpanan</button></div>}

                {careerView === "auto" && (
                  <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
                    <p className="text-sm text-slate-500">Contoh kerjaya mengikut kursus. Gunakan carian untuk melihat jawatan yang disenaraikan oleh majikan.</p>
                    {(careerMapping[skillGap.student?.kursus] || []).length ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {careerMapping[skillGap.student.kursus].map((job) => (
                          <JobCard key={job.title} job={job} onSearch={(q) => handleManualSearch(null, { q, location: "Malaysia", employmentType: "INTERN" })} />
                        ))}
                      </div>
                    ) : <EmptyState icon="ph-briefcase" title="Cadangan belum tersedia" message="Gunakan Carian Manual untuk mencari jawatan pilihan anda." />}
                  </div>
                )}

                {careerView === "manual" && (
                  <form onSubmit={handleManualSearch} className="mt-4 space-y-3 animate-[slideUp_0.3s_ease-out] anim-fill stagger-1">
                    <div onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setRecentOpen(false); }}>
                      <label htmlFor="career-query" className="block text-sm font-semibold text-slate-700 mb-1">Kata kunci jawatan</label>
                      <input id="career-query" value={manualQuery} onChange={(e) => { setManualQuery(e.target.value); setRecentIndex(-1); }} required maxLength={150}
                        onFocus={loadRecentSearches} role="combobox" aria-expanded={recentOpen} aria-controls="career-recent-searches" aria-autocomplete="list"
                        aria-activedescendant={recentOpen && recentIndex >= 0 ? `career-recent-${recentIndex}` : undefined}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") setRecentOpen(false);
                          if (recentOpen && visibleRecentSearches.length && ["ArrowDown", "ArrowUp"].includes(event.key)) {
                            event.preventDefault();
                            setRecentIndex((index) => event.key === "ArrowDown" ? (index + 1) % visibleRecentSearches.length : (index <= 0 ? visibleRecentSearches.length - 1 : index - 1));
                          }
                          if (event.key === "Enter" && recentOpen && recentIndex >= 0) {
                            event.preventDefault();
                            handleManualSearch(null, { q: visibleRecentSearches[recentIndex], location: manualLocation, employmentType: manualEmploymentType });
                          }
                        }}
                        placeholder="Contoh: Welder, IT Support" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500" />
                      {recentOpen && (
                        <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-sm p-2 animate-[fadeIn_0.2s_ease-out]">
                          <p className="px-2 py-1 text-xs font-semibold text-slate-500">Carian terkini jabatan anda hari ini</p>
                          {historyLoading ? <SkeletonList rows={2} /> : historyError ? <p className="px-2 py-2 text-xs text-slate-500">{historyError}</p> : (
                            <ul id="career-recent-searches" role="listbox" aria-label="Carian terkini jabatan">
                              {visibleRecentSearches.map((keyword, index) => <li key={keyword} role="presentation"><button id={`career-recent-${index}`} type="button" role="option" aria-selected={recentIndex === index}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => handleManualSearch(null, { q: keyword, location: manualLocation, employmentType: manualEmploymentType })}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm touch-target active:scale-95 ${recentIndex === index ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50 text-slate-700"}`}><i className="ph ph-clock-counter-clockwise mr-2" aria-hidden="true"></i>{keyword}</button></li>)}
                            </ul>
                          )}
                          {!historyLoading && !historyError && !visibleRecentSearches.length && <p className="px-2 py-2 text-xs text-slate-500">Tiada carian terkini yang sepadan.</p>}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="career-location" className="block text-sm font-semibold text-slate-700 mb-1">Lokasi di Malaysia</label>
                        <input id="career-location" value={manualLocation} onChange={(e) => setManualLocation(e.target.value)} required maxLength={100}
                          placeholder="Malaysia atau Terengganu" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label htmlFor="career-date-posted" className="block text-sm font-semibold text-slate-700 mb-1">Tarikh iklan</label>
                        <select id="career-date-posted" value={manualDatePosted} onChange={(event) => setManualDatePosted(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500">
                          <option value="all">Semua tarikh</option><option value="today">Hari ini</option><option value="3days">3 hari lepas</option><option value="week">Minggu ini</option><option value="month">Bulan ini</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="career-employment" className="block text-sm font-semibold text-slate-700 mb-1">Jenis pekerjaan</label>
                        <select id="career-employment" value={manualEmploymentType} onChange={(e) => setManualEmploymentType(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500">
                          <option value="INTERN">Latihan industri</option>
                          <option value="FULLTIME">Sepenuh masa</option>
                          <option value="PARTTIME">Separuh masa</option>
                          <option value="CONTRACTOR">Kontrak</option>
                        </select>
                      </div>
                    </div>
                    <button type="submit" disabled={manualLoading || !manualQuery.trim() || !manualLocation.trim()} className="px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors touch-target active:scale-95">
                      <i className={`ph ${manualLoading ? "ph-spinner-gap animate-spin" : "ph-magnifying-glass"} mr-2`} aria-hidden="true"></i>
                      {manualLoading ? "Mencari…" : "Cari Jawatan"}
                    </button>
                  </form>
                )}

                {careerView === "pathway" && !selectedStudentId && <EmptyState icon="ph-student" title="Rekod pelajar diperlukan" message="Laluan pembelajaran tersedia selepas akaun dipautkan kepada rekod pelajar." />}
                {careerView === "pathway" && pathway && !pathwayLoading && (
                  <div className="mt-4 space-y-5 animate-[fadeIn_0.3s_ease-out] anim-fill stagger-1">
                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                      <h4 className="font-bold text-blue-900"><i className="ph ph-target mr-1" aria-hidden="true"></i>{pathway.courseName}</h4>
                      {pathway.supported ? (
                        <div className="flex flex-wrap gap-2 mt-3">{pathway.targetRoles.map((role) => <Badge key={role} tone="blue">{role}</Badge>)}</div>
                      ) : <p className="text-sm text-blue-800 mt-2">Pemetaan kursus ini belum tersedia. Semak pilihan bersama penyelaras atau gunakan Carian Manual.</p>}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between gap-3"><h4 className="font-semibold text-slate-800">Indeks kesediaan</h4><Badge tone="blue">{pathway.readinessScore}/100</Badge></div>
                      <div role="progressbar" aria-label="Indeks kesediaan" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pathway.readinessScore} className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${pathway.readinessScore}%` }} />
                      </div>
                      <p className="text-xs text-slate-500">{pathway.readinessExplanation}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800 mb-3">Pelan tindakan anda</h4>
                      <ol className="space-y-3 list-decimal pl-5 text-sm text-slate-600">
                        {pathway.actionPlan.map((action) => <li key={action.title}><p className="font-semibold text-slate-800">{action.title}</p><p>{action.description}</p></li>)}
                      </ol>
                    </div>
                    {pathway.recommendedCertifications.length > 0 && (
                      <div className="animate-[slideUp_0.3s_ease-out] anim-fill stagger-2">
                        <h4 className="font-semibold text-slate-800 mb-2">Pensijilan untuk diterokai</h4>
                        <div className="flex flex-wrap gap-2">{pathway.recommendedCertifications.map((cert) => <Badge key={cert} tone="purple">{cert}</Badge>)}</div>
                      </div>
                    )}
                    {pathway.suggestedSearches.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-slate-800 mb-2">Carian dicadangkan</h4>
                        <div className="flex flex-wrap gap-2">{pathway.suggestedSearches.map((search) => (
                          <button key={search.label} type="button" onClick={() => handleManualSearch(null, { q: search.q, location: search.location, employmentType: search.employmentType })}
                            className="px-3 py-2 text-xs font-medium bg-slate-100 text-slate-700 rounded-full hover:bg-blue-100 hover:text-blue-700 transition-all touch-target active:scale-95">
                            <i className="ph ph-magnifying-glass mr-1" aria-hidden="true"></i>{search.label} · {search.location}
                          </button>
                        ))}</div>
                      </div>
                    )}
                  </div>
                )}

                {careerView !== "auto" && (
                  <div className="mt-6" aria-live="polite" aria-busy={careerView === "saved" ? savedLoading : careerView === "manual" ? manualLoading : pathwayLoading}>
                    {(careerView === "saved" ? savedLoading : careerView === "manual" ? manualLoading && !manualJobs.length : pathwayLoading) ? <SkeletonList rows={3} /> : (
                      <>
                        {(careerView === "manual" ? manualError : careerView === "pathway" ? pathwayError || pathwayWarning : "") ? (
                          <div role="alert" className="space-y-3">
                            <EmptyState icon="ph-warning-circle" title={careerView === "pathway" && pathway ? "Jawatan belum dapat dimuatkan" : "Permintaan tidak berjaya"} message={careerView === "manual" ? manualError : pathwayError || pathwayWarning} />
                            <button type="button" onClick={() => careerView === "manual" ? handleManualSearch(null, null, manualFailedPage) : setPathwayRetry((value) => value + 1)} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl touch-target active:scale-95">Cuba Lagi</button>
                          </div>
                        ) : null}
                        {careerJobs.length ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{careerJobs.map((job, index) => <JobCard key={job.jobId} job={job} isDynamic onDetails={toggleJobDetails}
                            detailsOpen={detailsJobId === job.jobId} details={jobDetails} detailsLoading={detailsLoading} detailsError={detailsError} onRetryDetails={loadJobDetails}
                            isSaved={savedJobs.some((saved) => saved.jobId === job.jobId)} onToggleSave={isRestrictedUser ? toggleSavedJob : undefined}
                            saveDisabled={savedLoading || Boolean(savedError) || savingIds.includes(job.jobId)} delay={index * 60} />)}</div>
                        ) : careerView === "saved" && !savedError ? <EmptyState icon="ph-bookmark-simple" title="Belum ada jawatan disimpan" message="Tekan Simpan pada jawatan yang anda ingin lihat semula." /> : careerView === "manual" && !manualError ? (
                          <EmptyState icon="ph-magnifying-glass" title={manualSearched ? "Tiada jawatan ditemui" : "Mulakan carian anda"} message={manualSearched ? "Cuba kata kunci lain atau luaskan lokasi carian." : "Masukkan jawatan, lokasi dan jenis pekerjaan untuk melihat peluang semasa."} />
                        ) : careerView === "pathway" && pathway?.supported && !pathwayError && !pathwayWarning ? <EmptyState icon="ph-briefcase" title="Tiada jawatan ditemui" message="Teruskan pelan pembelajaran anda atau cuba salah satu carian dicadangkan." /> : null}
                        {careerView === "manual" && manualCursor && <button type="button" disabled={manualLoading} onClick={() => handleManualSearch(null, null, true)} className="mt-4 px-4 py-3 rounded-xl bg-blue-50 text-blue-700 disabled:opacity-50 touch-target active:scale-95">{manualLoading ? "Memuatkan…" : "Muat Lagi"}</button>}
                      </>
                    )}
                  </div>
                )}

              </SectionCard>
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
