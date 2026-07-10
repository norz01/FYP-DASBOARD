// src/pages/StudentDashboard.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { Radar } from 'react-chartjs-2';
import { clearStoredUser, getStoredUser, getToken } from '../utils/auth';
import Sidebar from '../components/Sidebar';
import JobCard from '../components/JobCard';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const initialSkillGap = {
    chart: { labels:['PLO 1', 'PLO 2', 'PLO 3', 'PLO 4', 'PLO 5', 'PLO 6', 'PLO 7', 'PLO 8', 'PLO 9'], current:[0,0,0,0,0,0,0,0,0], target:[80,80,80,80,80,80,80,80,80] },
    insight: { weakestSkill: '-', message: 'Pilih pelajar untuk melihat analisis jurang skill daripada database.' },
    student: null,
};

const careerMapping = {
    'ITW': [{ title: 'Juruteknik Kimpalan 6G', company: 'Sapuran Energy', match: '95%', icon: 'ph-fill ph-fire' }, { title: 'Welding Inspector', company: 'SGS Malaysia', match: '88%', icon: 'ph-fill ph-magnifying-glass' }],
    'DFK': [{ title: 'Cloud Engineer', company: 'AWS Malaysia', match: '94%', icon: 'ph-fill ph-cloud' }, { title: 'DevOps Engineer', company: 'Maxis', match: '85%', icon: 'ph-fill ph-terminal-window' }],
    'DGA': [{ title: 'Service Advisor', company: 'Perodua', match: '92%', icon: 'ph-fill ph-wrench' }, { title: 'Diagnostic Tech', company: 'Tan Chong', match: '88%', icon: 'ph-fill ph-engine' }],
    'SLR': [{ title: 'CAD Drafter', company: 'Dyson', match: '96%', icon: 'ph-fill ph-pencil-circle' }, { title: 'Design Engineer', company: 'Proton', match: '89%', icon: 'ph-fill ph-compass-tool' }],
    'DCG': [{ title: 'Chargeman A0', company: 'TNB', match: '94%', icon: 'ph-fill ph-lightning' }, { title: 'Industrial Electrician', company: 'Intel', match: '89%', icon: 'ph-fill ph-plugs-connected' }],
    'SED': [{ title: 'Wireman PW4', company: 'Kontraktor Berdaftar', match: '91%', icon: 'ph-fill ph-files' }, { title: 'Maintenance', company: 'Panasonic', match: '87%', icon: 'ph-fill ph-gear' }],
    'PPU': [{ title: 'HVAC Technician', company: 'Daikin', match: '93%', icon: 'ph-fill ph-thermometer-cold' }, { title: 'ACMV Supervisor', company: 'Bina Puri', match: '86%', icon: 'ph-fill ph-fan' }]
};

const getFullCourseName = (code) => {
    const names = { 'ITW': 'Diploma Kimpalan', 'DFK': 'Diploma Komputasi Awan', 'DGA': 'Diploma Automotif', 'SLR': 'Sijil Lukisan Rekabentuk', 'DCG': 'Diploma Elektrik Industri', 'SED': 'Sijil Elektrik Domestik', 'PPU': 'Diploma Penyejukan Udara' };
    return names[code] || code;
};

export default function StudentDashboard() {
    const navigate = useNavigate();
    const currentUser = getStoredUser();
    const isRestrictedUser = currentUser?.role === 'user' && currentUser?.studentId;
    const currentStudentLabel = currentUser?.displayName || 'Pelajar';
    
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [students, setStudents] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [skillGap, setSkillGap] = useState(initialSkillGap);
    const [isLoading, setIsLoading] = useState(true);

    const handleLogout = (e) => { e.preventDefault(); clearStoredUser(); navigate('/'); };

    useEffect(() => {
        const loadStudents = async () => {
            try {
                const res = await fetch('/api/students', { headers: { 'Authorization': `Bearer ${getToken()}` }});
                const data = await res.json();
                
                // SECURITY FIX: If logged in as a student, only show THEIR data
                const visibleStudents = isRestrictedUser
                    ? data.filter((student) => student.id === currentUser.studentId)
                    : data;

                setStudents(visibleStudents);
                if (visibleStudents.length > 0) setSelectedStudentId(visibleStudents[0].id);
            } catch (e) { console.error(e); } 
            finally { setIsLoading(false); }
        };
        loadStudents();
    }, [currentUser?.studentId, isRestrictedUser]);

    useEffect(() => {
        if (!selectedStudentId) return;
        const loadSkillGap = async () => {
            try {
                const res = await fetch(`/api/students/${selectedStudentId}/skill-gap`, { headers: { 'Authorization': `Bearer ${getToken()}` }});
                setSkillGap(await res.json());
            } catch (e) { console.error(e); }
        };
        loadSkillGap();
    }, [selectedStudentId]);

    const radarData = {
        labels: skillGap.chart.labels,
        datasets: [
            { label: 'Data Pelajar', data: skillGap.chart.current, fill: true, backgroundColor: 'rgba(37, 99, 235, 0.2)', borderColor: '#2563EB', pointBackgroundColor: '#2563EB' },
            { label: 'Target', data: skillGap.chart.target, fill: true, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: '#10B981', pointBackgroundColor: '#10B981', borderDash: [5, 5] }
        ]
    };

    // Dynamic Course Recommendations based on weakest PLO
    const courseMappings = {
        'PLO 1': { title: 'Professional Soft Skills: Communication', desc: 'Kursus ini dicadangkan kerana skor komunikasi anda di bawah par industri.', bg: 'bg-blue-600', btn: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
        'PLO 2': { title: 'Bengkel Pengaturcaraan Praktikal', desc: 'Untuk meningkatkan kompetensi penyelesaian masalah pengaturcaraan.', bg: 'bg-slate-900', btn: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
        'PLO 3': { title: 'Latihan Keselamatan Industri (OSH)', desc: 'Memperkukuhkan pemahaman tentang prosedur keselamatan tempat kerja.', bg: 'bg-purple-600', btn: 'bg-purple-50 text-purple-600 hover:bg-purple-100' },
        'PLO 4': { title: 'Kursus Pengurusan Masa & Projek', desc: 'Meningkatkan keupayaan merancang dan melaksanakan projek dengan cekap.', bg: 'bg-blue-600', btn: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
        'PLO 5': { title: 'Bengkel Inovasi & Reka Bentuk Produk', desc: 'Menambah kemahiran kreatif dalam merekabentuk penyelesaian baharu.', bg: 'bg-slate-900', btn: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
        'PLO 6': { title: 'Latihan Penyelesaian Kerosakan Motor/Elektrik', desc: 'Peningkatan kemahiran teknikal dalam diagnosis kerosakan.', bg: 'bg-purple-600', btn: 'bg-purple-50 text-purple-600 hover:bg-purple-100' },
        'PLO 7': { title: 'Kursus Keusahawanan & Pemasaran Digital', desc: 'Memperluas kemahiran perniagaan dan pemasaran kendiri.', bg: 'bg-blue-600', btn: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
        'PLO 8': { title: 'Bengkel Etika Kerja & Kepimpinan', desc: 'Membentuk sahsiah dan kemahiran memimpin pasukan.', bg: 'bg-slate-900', btn: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
        'PLO 9': { title: 'Latihan Integriti & Tanggungjawab Profesional', desc: 'Memantapkan nilai etika dan tanggungjawab di tempat kerja.', bg: 'bg-purple-600', btn: 'bg-purple-50 text-purple-600 hover:bg-purple-100' }
    };

    // Get the weakest PLO from skillGap insight. Fallback to PLO 1 if null.
    const weakestPlo = skillGap.insight?.weakestSkill || 'PLO 1';
    const recommendedCourse = courseMappings[weakestPlo] || courseMappings['PLO 1'];

    const navItems = [
        { id: 'dashboard', icon: 'ph-user-circle', label: 'Profil & Prestasi' },
        { id: 'career', icon: 'ph-briefcase', label: 'Padanan Kerjaya (AI)' },
        { id: 'courses', icon: 'ph-certificate', label: 'Kursus Cadangan' }
    ];

    return (
        <div className="flex h-screen overflow-hidden text-slate-800 bg-[#F8FAFC] font-sans relative">
            {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-20 md:hidden"></div>}
            
            <Sidebar navItems={navItems} activeTab={activeTab} setActiveTab={setActiveTab} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} currentUser={currentUser} handleLogout={handleLogout} />

            <main className="flex-1 flex flex-col h-screen overflow-hidden relative w-full">
                <header className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10">
                    <img src="/logo-tvetmara.jpg" alt="Logo" className="h-8 object-contain" />
                    <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600 p-2 hover:bg-slate-100 rounded-lg"><i className="ph-bold ph-list text-2xl"></i></button>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-20">
                    {activeTab === 'dashboard' && (
                        <div className="animate-[fadeIn_0.3s_ease-in-out]">
                            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                                <div>
                                    <h1 className="text-2xl font-bold text-slate-900">Selamat Datang, {currentStudentLabel}! 👋</h1>
                                    <p className="text-slate-500 text-sm">Analisis prestasi dan potensi kerjaya anda.</p>
                                </div>
                                {skillGap.student?.dropoutRisk === 'Tinggi' || skillGap.student?.dropoutRisk === 'Bermasalah' ? (
                                    <span className="bg-red-100 text-red-700 px-4 py-2 rounded-full text-xs font-bold border border-red-200">⚠️ Risiko Tinggi</span>
                                ) : skillGap.student?.dropoutRisk === 'Sederhana' ? (
                                    <span className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-full text-xs font-bold border border-yellow-200">⚠️ Perhatian Diperlukan</span>
                                ) : (
                                    <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-xs font-bold border border-green-200">✅ Status: Good Standing</span>
                                )}
                            </header>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                    <p className="text-sm text-slate-500 mb-1">Ramalan Kebolehpasaran</p>
                                    <h2 className="text-3xl font-bold text-slate-900">{skillGap.student ? Math.min(100, Math.round((skillGap.student.cgpa / 4) * 40 + (skillGap.student.attendance * 0.6))) : 0}%</h2>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                    <p className="text-sm text-slate-500 mb-1">Purata Kehadiran</p>
                                    <h2 className="text-3xl font-bold text-slate-900">{skillGap.student?.attendance || 0}%</h2>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                    <p className="text-sm text-slate-500 mb-1">CGPA Terkini</p>
                                    <h2 className="text-3xl font-bold text-slate-900">{skillGap.student?.cgpa || '0.00'}</h2>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <h3 className="font-bold text-lg flex items-center gap-2"><i className="ph-fill ph-radar text-blue-600"></i> Analisis Jurang Skill</h3>
                                        {students.length > 1 && !isRestrictedUser ? (
                                            <select
                                                value={selectedStudentId}
                                                onChange={(e) => setSelectedStudentId(e.target.value)}
                                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
                                            >
                                                {students.map((s) => (<option key={s.id} value={s.id}>{s.id} • Risiko {s.dropoutRisk}</option>))}
                                            </select>
                                        ) : (
                                            <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600">{selectedStudentId || 'Pelajar'}</span>
                                        )}
                                    </div>
                                    <div className="h-64 flex items-center justify-center">
                                        {isLoading ? <p>Memuatkan...</p> : <Radar data={radarData} options={{ maintainAspectRatio: false, scales: { r: { beginAtZero: true, min: 0, max: 100, ticks: { stepSize: 20 } } } }} />}
                                    </div>
                                    <div className="mt-4 bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                                        <p className="text-xs font-bold text-yellow-700 mb-1">CADANGAN AI:</p>
                                        <p className="text-sm text-slate-700">{skillGap.insight.message}</p>
                                    </div>
                                </div>
                                <div className="bg-slate-900 p-6 rounded-2xl text-white flex flex-col justify-between">
                                    <div>
                                        <h3 className="text-xl font-bold">Peluang Kerjaya Teratas</h3>
                                        <p className="text-slate-300 text-sm mt-2">Berdasarkan kursus <strong>{getFullCourseName(skillGap.student?.kursus)}</strong>:</p>
                                        <div className="mt-4 space-y-3">
                                            {(careerMapping[skillGap.student?.kursus] || []).slice(0, 2).map((j, i) => (
                                                <div key={i} className="flex items-center gap-3 bg-white/5 p-3 rounded-lg">
                                                    <i className={`${j.icon} text-blue-400`}></i>
                                                    <div className="text-xs"><p className="font-bold">{j.title}</p><p className="opacity-60">{j.company}</p></div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <button onClick={() => setActiveTab('career')} className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold">Lihat Analisis Penuh →</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'career' && (
                        <div className="animate-[fadeIn_0.3s_ease-in-out]">
                            <header className="mb-8">
                                <h1 className="text-2xl font-bold text-slate-900">Padanan Kerjaya Pintar</h1>
                                <p className="text-slate-500">Peluang disyorkan oleh AI untuk kursus <strong>{getFullCourseName(skillGap.student?.kursus)}</strong>.</p>
                            </header>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {(careerMapping[skillGap.student?.kursus] || []).map((job, idx) => <JobCard key={idx} job={job} />)}
                            </div>
                        </div>
                    )}

                    {activeTab === 'courses' && (
                        <div className="animate-[fadeIn_0.3s_ease-in-out]">
                            <header className="mb-8">
                                <h1 className="text-2xl font-bold text-slate-900">Kursus Cadangan (Personalized)</h1>
                                <p className="text-slate-500">Senarai kursus untuk menutup jurang kemahiran anda berdasarkan PLO terlemah: <strong className="text-blue-600">{weakestPlo}</strong>.</p>
                            </header>
                            
                            {/* Dynamic AI Recommended Course */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div className="bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition flex flex-col h-full">
                                    <div className={`${recommendedCourse.bg} p-6 h-40 flex flex-col justify-end`}>
                                        <span className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1 rounded-lg">Disyorkan AI</span>
                                        <h3 className="text-white font-bold text-xl leading-tight">{recommendedCourse.title}</h3>
                                    </div>
                                    <div className="p-6 flex-1 flex flex-col justify-between">
                                        <div>
                                            <p className="text-xs text-slate-500 font-semibold mb-3 flex items-center gap-2"><i className="ph-fill ph-clock text-lg"></i> 4 Jam • Online</p>
                                            <p className="text-sm text-slate-600 mb-6 leading-relaxed">{recommendedCourse.desc}</p>
                                        </div>
                                        <button className={`w-full py-3 font-bold rounded-xl text-sm transition-colors ${recommendedCourse.btn}`}>Mula Belajar</button>
                                    </div>
                                </div>

                                {/* AWS Cloud Practitioner */}
                                <div className="bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition flex flex-col h-full">
                                    <div className="bg-slate-900 p-6 h-40 relative flex flex-col justify-end">
                                        <span className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1 rounded-lg">Advanced</span>
                                        <h3 className="text-white font-bold text-xl leading-tight">AWS Cloud Practitioner Essentials</h3>
                                    </div>
                                    <div className="p-6 flex-1 flex flex-col justify-between">
                                        <div>
                                            <p className="text-xs text-slate-500 font-semibold mb-3 flex items-center gap-2"><i className="ph-fill ph-chalkboard-teacher text-lg"></i> 6 Jam • Bengkel IKMB</p>
                                            <p className="text-sm text-slate-600 mb-6 leading-relaxed">Untuk meningkatkan peluang anda mendapat kerja "Cloud Engineer" di industri teknologi.</p>
                                        </div>
                                        <button className="w-full py-3 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold rounded-xl text-sm transition-colors">Daftar Sesi</button>
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