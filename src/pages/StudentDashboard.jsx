// src/pages/StudentDashboard.jsx

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
// 🔥 NEW: We imported getToken here!
import { clearStoredUser, getStoredUser, getToken } from '../utils/auth'; 

// Register ChartJS untuk Radar Chart
ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const initialSkillGap = {
    chart: {
        labels:['Koding', 'Rangkaian', 'Kehadiran', 'Akademik', 'Pensijilan'],
        current:[0, 0, 0, 0, 0],
        target:[80, 80, 85, 85, 75],
    },
    insight: {
        weakestSkill: '-',
        message: 'Pilih pelajar untuk melihat analisis jurang skill daripada database.',
    },
    student: null,
};

const careerMapping = {
    'ITW': [
        { title: 'Juruteknik Kimpalan 6G', company: 'Sapuran Energy / Petronas', match: '95%', icon: 'ph-fill ph-fire' },
        { title: 'Welding Inspector (CSWIP)', company: 'SGS Malaysia', match: '88%', icon: 'ph-fill ph-magnifying-glass' },
        { title: 'Fabrication Supervisor', company: 'MMHE Pasir Gudang', match: '82%', icon: 'ph-fill ph-factory' }
    ],
    'DFK': [
        { title: 'Cloud Infrastructure Engineer', company: 'AWS Malaysia / TechData', match: '94%', icon: 'ph-fill ph-cloud' },
        { title: 'Cloud Support Specialist', company: 'Microsoft Azure Partner', match: '90%', icon: 'ph-fill ph-headset' },
        { title: 'Junior DevOps Engineer', company: 'Maxis / CelcomDigi', match: '85%', icon: 'ph-fill ph-terminal-window' }
    ],
    'DGA': [
        { title: 'Service Advisor', company: 'Perodua / Toyota Service Centre', match: '92%', icon: 'ph-fill ph-wrench' },
        { title: 'Automotive Diagnostic Tech', company: 'Tan Chong Motors', match: '88%', icon: 'ph-fill ph-engine' },
        { title: 'Workshop Manager', company: 'Sime Darby Motors', match: '80%', icon: 'ph-fill ph-house-line' }
    ],
    'SLR': [
        { title: 'CAD Drafter (Mechanical)', company: 'Dyson Malaysia', match: '96%', icon: 'ph-fill ph-pencil-circle' },
        { title: 'Junior Design Engineer', company: 'Proton / Perodua R&D', match: '89%', icon: 'ph-fill ph-compass-tool' },
        { title: '3D Modeler', company: 'Engineering Design Firm', match: '84%', icon: 'ph-fill ph-cube' }
    ],
    'DCG': [
        { title: 'Electrical Chargeman (A0)', company: 'TNB / Solar Panel Firm', match: '94%', icon: 'ph-fill ph-lightning' },
        { title: 'Industrial Electrician', company: 'Intel Malaysia', match: '89%', icon: 'ph-fill ph-plugs-connected' },
        { title: 'Control System Technician', company: 'Petronas Gas', match: '85%', icon: 'ph-fill ph-cpu' }
    ],
    'SED': [
        { title: 'Wireman (PW4)', company: 'Kontraktor Elektrik Berdaftar', match: '91%', icon: 'ph-fill ph-files' },
        { title: 'Electrical Maintenance', company: 'Panasonic Manufacturing', match: '87%', icon: 'ph-fill ph-gear' },
        { title: 'Building Electrician', company: 'EcoWorld / SP Setia', match: '83%', icon: 'ph-fill ph-buildings' }
    ],
    'PPU': [
        { title: 'HVAC Technician', company: 'Carrier Malaysia / Daikin', match: '93%', icon: 'ph-fill ph-thermometer-cold' },
        { title: 'ACMV Supervisor', company: 'Bina Puri / Construction Firm', match: '86%', icon: 'ph-fill ph-fan' },
        { title: 'Refrigeration Engineer', company: 'Cold Chain Logistics', match: '82%', icon: 'ph-fill ph-snowflake' }
    ]
};

const getFullCourseName = (code) => {
    const names = {
        'ITW': 'Diploma Kompetensi Kimpalan',
        'DFK': 'Diploma Teknologi Komputer (Komputasi Awan)',
        'DGA': 'Diploma Teknologi Automotif',
        'SLR': 'Sijil Teknologi Kejuruteraan Mekanikal (Lukisan Rekabentuk)',
        'DCG': 'Diploma Kompetensi Elektrik (Industri)',
        'SED': 'Sijil Teknologi Kejuruteraan Elektrik (Domestik dan Industri)',
        'PPU': 'Diploma Teknologi Penyejukan dan Penyamanan Udara'
    };
    return names[code] || code;
};

export default function StudentDashboard() {
    const navigate = useNavigate();
    const currentUser = getStoredUser();
    const isRestrictedUser = currentUser?.role === 'user' && currentUser?.studentId;
    const currentStudentLabel = currentUser?.displayName || currentUser?.studentId || 'Pelajar';
    
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [students, setStudents] = useState([]);
    const[selectedStudentId, setSelectedStudentId] = useState('');
    const [skillGap, setSkillGap] = useState(initialSkillGap);
    const [isSkillGapLoading, setIsSkillGapLoading] = useState(true);
    const [skillGapError, setSkillGapError] = useState('');

    const handleLogout = (e) => {
        e.preventDefault();
        clearStoredUser();
        navigate('/');
    };

    useEffect(() => {
        let isActive = true;

        const loadStudents = async () => {
            try {
                const token = getToken(); // 🔥 Get the token from localStorage
                
                // 🔥 Add the Authorization header to the request
                const response = await fetch('/api/students', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error('Gagal mendapatkan senarai pelajar.');
                }

                const data = await response.json();

                if (!isActive) return;

                const visibleStudents = isRestrictedUser
                    ? data.filter((student) => student.id === currentUser.studentId)
                    : data;

                setStudents(visibleStudents);

                if (visibleStudents.length > 0) {
                    setSelectedStudentId(visibleStudents[0].id);
                } else {
                    setIsSkillGapLoading(false);
                    setSkillGapError('Tiada data pelajar dijumpai untuk akaun ini.');
                }
            } catch (error) {
                if (!isActive) return;
                setIsSkillGapLoading(false);
                setSkillGapError(error.message);
            }
        };

        loadStudents();

        return () => {
            isActive = false;
        };
    },[currentUser?.studentId, isRestrictedUser]);

    useEffect(() => {
        if (!selectedStudentId) return;

        let isActive = true;

        const loadSkillGap = async () => {
            setIsSkillGapLoading(true);
            setSkillGapError('');

            try {
                const token = getToken(); // 🔥 Get the token from localStorage
                
                // 🔥 Add the Authorization header to the request
                const response = await fetch(`/api/students/${selectedStudentId}/skill-gap`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error('Gagal mendapatkan data jurang skill pelajar.');
                }

                const data = await response.json();

                if (!isActive) return;

                setSkillGap(data);
            } catch (error) {
                if (!isActive) return;
                setSkillGap(initialSkillGap);
                setSkillGapError(error.message);
            } finally {
                if (isActive) setIsSkillGapLoading(false);
            }
        };

        loadSkillGap();

        return () => {
            isActive = false;
        };
    },[selectedStudentId]);

    const radarData = {
        labels: skillGap.chart.labels,
        datasets:[
            {
                label: 'Data Pelajar', 
                data: skillGap.chart.current,
                fill: true, 
                backgroundColor: 'rgba(37, 99, 235, 0.2)', 
                borderColor: '#2563EB', 
                pointBackgroundColor: '#2563EB',
            }, 
            {
                label: 'Target', 
                data: skillGap.chart.target,
                fill: true, 
                backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                borderColor: '#10B981', 
                pointBackgroundColor: '#10B981', 
                borderDash: [5, 5]
            }
        ]
    };

    const radarOptions = {
        maintainAspectRatio: false,
        scales: {
            r: {
                beginAtZero: true,
                min: 0,
                max: 100,
                ticks: { stepSize: 20 },
            },
        },
    };

    const hasZeroScores = skillGap.chart.current.some((score) => score === 0);
    const refinedInsight = hasZeroScores 
        ? `Sistem mengesan beberapa kompetensi (termasuk PLO 7) belum direkodkan. Sila rujuk pensyarah kursus ${getFullCourseName(skillGap.student?.kursus)} anda untuk kemaskini penilaian.`
        : skillGap.insight.message;

    return (
        <div className="flex h-screen overflow-hidden text-slate-800 bg-[#F8FAFC] font-sans relative">
            
            {/* 1. MOBILE OVERLAY */}
            {isSidebarOpen && (
                <div 
                    onClick={() => setIsSidebarOpen(false)} 
                    className="fixed inset-0 bg-black/50 z-20 md:hidden transition-opacity"
                ></div>
            )}

            {/* 2. SIDEBAR */}
            <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200 flex flex-col transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 md:relative md:translate-x-0 shadow-2xl md:shadow-none`}>
                
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                     <img src="/logo-tvetmara.jpg" alt="TVETMARA" className="w-48 h-auto object-contain" />
                     <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-red-500">
                        <i className="ph-bold ph-x text-xl"></i>
                     </button>
                </div>
                
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <p className="px-4 text-xs font-bold text-slate-400 uppercase mb-2">Menu Pelajar</p>
                    
                    <button onClick={() => {setActiveTab('dashboard'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                        <i className="ph-fill ph-user-circle text-lg"></i> Profil & Prestasi
                    </button>
                    
                    <button onClick={() => {setActiveTab('career'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${activeTab === 'career' ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                        <i className="ph ph-briefcase text-lg"></i> Padanan Kerjaya (AI)
                    </button>
                    
                    <button onClick={() => {setActiveTab('courses'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${activeTab === 'courses' ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                        <i className="ph ph-certificate text-lg"></i> Kursus Cadangan
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                {currentStudentLabel.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                                <p className="text-sm font-bold text-slate-800 truncate w-32">{currentStudentLabel}</p>
                                <p className="text-xs text-slate-500">{currentUser?.studentId || 'Akaun Pelajar'}</p>
                            </div>
                        </div>
                        <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                            <i className="ph-bold ph-sign-out text-xl"></i>
                        </button>
                    </div>
                </div>
            </aside>

            {/* 3. MAIN CONTENT */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden relative w-full">
                
                {/* Mobile Header */}
                <header className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10">
                    <img src="/logo-tvetmara.jpg" alt="Logo" className="h-8 object-contain" />
                    <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600 p-2 hover:bg-slate-100 rounded-lg transition">
                        <i className="ph-bold ph-list text-2xl"></i>
                    </button>
                </header>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-20">
                    
                    {/* TAB 1: DASHBOARD */}
                    {activeTab === 'dashboard' && (
                        <div className="animate-[fadeIn_0.3s_ease-in-out]">
                            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                                <div>
                                    <h1 className="text-2xl font-bold text-slate-900">Selamat Datang, {currentStudentLabel}! 👋</h1>
                                    <p className="text-slate-500 text-sm md:text-base">Analisis prestasi dan potensi kerjaya anda.</p>
                                </div>
                                {/* 🔥 DYNAMIC: Status Badge based on AI Risk Prediction */}
                                {skillGap.student && (skillGap.student.dropoutRisk === 'Tinggi' || skillGap.student.dropoutRisk === 'Bermasalah') ? (
                                    <span className="bg-red-100 text-red-700 px-4 py-2 rounded-full text-xs font-bold border border-red-200 shadow-sm">
                                       <i className="ph-fill ph-warning-octagon mr-1"></i> Risiko Tinggi
                                    </span>
                                ) : skillGap.student && skillGap.student.dropoutRisk === 'Sederhana' ? (
                                    <span className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-full text-xs font-bold border border-yellow-200 shadow-sm">
                                       <i className="ph-fill ph-warning-circle mr-1"></i> Perhatian Diperlukan
                                    </span>
                                ) : (
                                    <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-xs font-bold border border-green-200 shadow-sm">
                                       <i className="ph-fill ph-check-circle mr-1"></i> Status: Good Standing
                                    </span>
                                )}
                            </header>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
                                {/* Employability Prediction (Mock Calculation based on CGPA and Attendance) */}
                                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                                    <div className="absolute right-0 top-0 p-4 opacity-10"><i className="ph-fill ph-chart-line-up text-6xl text-blue-600"></i></div>
                                    <p className="text-sm text-slate-500 font-medium mb-1">Ramalan Kebolehpasaran</p>
                                    <h2 className="text-3xl font-bold text-slate-900">
                                        {skillGap.student ? Math.min(100, Math.round((skillGap.student.cgpa / 4) * 40 + (skillGap.student.attendance * 0.6))) : 0}%
                                    </h2>
                                    <p className="text-xs text-blue-600 mt-2 font-bold">Berdasarkan AI Model</p>
                                </div>

                                {/* 🔥 DYNAMIC: Real Attendance Data */}
                                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                    <p className="text-sm text-slate-500 font-medium mb-1">Purata Kehadiran</p>
                                    <h2 className="text-3xl font-bold text-slate-900">{skillGap.student ? skillGap.student.attendance : 0}%</h2>
                                    <div className="w-full bg-slate-100 h-2 rounded-full mt-3">
                                        <div 
                                            className={`h-full rounded-full ${skillGap.student && skillGap.student.attendance < 80 ? 'bg-red-500' : 'bg-green-500'}`} 
                                            style={{width: `${skillGap.student ? skillGap.student.attendance : 0}%`}}
                                        ></div>
                                    </div>
                                </div>

                                {/* 🔥 DYNAMIC: Real CGPA Data */}
                                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                    <p className="text-sm text-slate-500 font-medium mb-1">CGPA Terkini</p>
                                    <h2 className="text-3xl font-bold text-slate-900">{skillGap.student ? skillGap.student.cgpa : '0.00'}</h2>
                                    <p className={`text-xs mt-2 font-bold ${skillGap.student && skillGap.student.cgpa >= 3.5 ? 'text-blue-600' : skillGap.student && skillGap.student.cgpa >= 3.0 ? 'text-green-600' : 'text-orange-500'}`}>
                                        {skillGap.student && skillGap.student.cgpa >= 3.5 ? 'Anugerah Dekan' : skillGap.student && skillGap.student.cgpa >= 3.0 ? 'Kepujian' : 'Perlu Perhatian'}
                                    </p>
                                </div>
                            </div>

                            {/* KEEP THE RADAR CHART BELOW THIS EXACTLY THE SAME */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                                <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <h3 className="font-bold text-lg flex items-center gap-2">
                                            <i className="ph-fill ph-radar text-blue-600"></i> Analisis Jurang Skill
                                        </h3>
                                        {hasZeroScores && (
                                            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold animate-pulse">
                                                PENILAIAN DALAM PROSES
                                            </span>
                                        )}
                                        {students.length > 1 ? (
                                            <select
                                                value={selectedStudentId}
                                                onChange={(event) => setSelectedStudentId(event.target.value)}
                                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
                                            >
                                                {students.map((student) => (
                                                    <option key={student.id} value={student.id}>
                                                        {student.id} • Risiko {student.dropoutRisk}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600">
                                                {selectedStudentId || currentUser?.studentId || 'User'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="h-64 flex items-center justify-center">
                                        {isSkillGapLoading ? (
                                            <p className="text-sm text-slate-500">Memuatkan data radar chart...</p>
                                        ) : skillGapError ? (
                                            <p className="text-sm text-red-600 text-center">{skillGapError}</p>
                                        ) : (
                                            <Radar data={radarData} options={radarOptions} />
                                        )}
                                    </div>
                                    <div className="mt-4 bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                                        <p className="text-xs font-bold text-yellow-700 mb-1">CADANGAN AI:</p>
                                        <p className="text-sm text-slate-700 leading-relaxed">{refinedInsight}</p>
                                        {skillGap.student && (
                                            <p className="mt-3 text-xs text-slate-500">
                                                ID: <strong>{skillGap.student.id}</strong> | CGPA: <strong>{skillGap.student.cgpa}</strong> | Kehadiran: <strong>{skillGap.student.attendance}%</strong> | Sijil: <strong>{skillGap.student.certification}</strong>
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl text-white shadow-lg flex flex-col justify-between">
                                    <div>
                                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-4"><i className="ph-fill ph-briefcase text-2xl text-blue-400"></i></div>
                                        <h3 className="text-xl font-bold">Peluang Kerjaya Teratas</h3>
                                        <p className="text-slate-300 text-sm mt-2">Berdasarkan kursus <strong>{getFullCourseName(skillGap.student?.kursus) || 'Sila Pilih'}</strong>, jawatan ini paling sesuai untuk anda:</p>
                                        
                                        <div className="mt-4 space-y-3">
                                            {(careerMapping[skillGap.student?.kursus] || careerMapping['DFK']).slice(0, 2).map((j, i) => (
                                                <div key={i} className="flex items-center gap-3 bg-white/5 p-3 rounded-lg border border-white/10">
                                                    <i className={`${j.icon} text-blue-400`}></i>
                                                    <div className="text-xs">
                                                        <p className="font-bold">{j.title}</p>
                                                        <p className="opacity-60">{j.company}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <button onClick={() => setActiveTab('career')} className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition flex items-center justify-center gap-2">
                                        Lihat Analisis Penuh <i className="ph ph-arrow-right"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: CAREER */}
                    {activeTab === 'career' && (
                        <div className="animate-[fadeIn_0.3s_ease-in-out]">
                            <header className="mb-8">
                                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                    <i className="ph-fill ph-briefcase text-blue-600"></i> Padanan Kerjaya Pintar
                                </h1>
                                <p className="text-slate-500">
                                    Berdasarkan kemahiran dalam kursus <strong>{getFullCourseName(skillGap.student?.kursus)}</strong>, berikut adalah peluang yang disyorkan oleh AI:
                                </p>
                            </header>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {(careerMapping[skillGap.student?.kursus] || []).length > 0 ? (
                                    careerMapping[skillGap.student?.kursus].map((job, idx) => (
                                        <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition group">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                    <i className={job.icon}></i>
                                                </div>
                                                <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-100 flex items-center gap-1">
                                                    <i className="ph-fill ph-sparkle"></i> {job.match} Match
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-lg text-slate-900">{job.title}</h3>
                                            <p className="text-slate-500 text-sm mb-4">{job.company}</p>
                                            <button className="w-full py-2.5 bg-slate-50 text-slate-600 hover:bg-blue-600 hover:text-white rounded-lg text-sm font-bold transition">
                                                Mohon Sekarang
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-2 py-20 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                                        <i className="ph ph-magnifying-glass text-4xl text-slate-300 mb-2"></i>
                                        <p className="text-slate-500 font-medium">Tiada data padanan untuk kod kursus ini.</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-6">
                                {(careerMapping[skillGap.student?.kursus] || careerMapping['DFK']).map((job, idx) => (
                                    <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
                                        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                            <div className="flex gap-4 w-full">
                                                <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 text-2xl shrink-0">
                                                    <i className={job.icon}></i>
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-lg text-slate-900">{job.title}</h3>
                                                    <p className="text-slate-500 text-sm mb-2">{job.company}</p>
                                                </div>
                                            </div>
                                            <span className="bg-green-50 text-green-600 px-4 py-1.5 rounded-full text-sm font-bold border border-green-200 flex items-center gap-1">
                                                <i className="ph-fill ph-sparkle"></i> {job.match} Match
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TAB 3: COURSES */}
                    {activeTab === 'courses' && (
                        <div className="animate-[fadeIn_0.3s_ease-in-out]">
                            <header className="mb-8">
                                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                    <i className="ph-fill ph-certificate text-purple-600"></i> Kursus Cadangan (Personalized)
                                </h1>
                                <p className="text-slate-500">Senarai kursus untuk menutup jurang kemahiran (Skill Gap) anda.</p>
                            </header>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {/* Course 1 */}
                                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col h-full">
                                    <div className="bg-blue-600 p-6 h-40 relative flex flex-col justify-end">
                                        <span className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1 rounded-lg">Disyorkan AI</span>
                                        <h3 className="text-white font-bold text-xl leading-tight">Professional Soft Skills: Communication</h3>
                                    </div>
                                    <div className="p-6 flex-1 flex flex-col justify-between">
                                        <div>
                                            <p className="text-xs text-slate-500 font-semibold mb-3 flex items-center gap-2"><i className="ph-fill ph-clock text-lg"></i> 4 Jam • Online</p>
                                            <p className="text-sm text-slate-600 mb-6 leading-relaxed">Kursus ini dicadangkan kerana skor komunikasi anda (60%) di bawah par industri.</p>
                                        </div>
                                        <button className="w-full py-3 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold rounded-xl text-sm transition-colors">Mula Belajar</button>
                                    </div>
                                </div>

                                {/* Course 2 */}
                                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col h-full">
                                    <div className="bg-slate-900 p-6 h-40 relative flex flex-col justify-end">
                                        <span className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1 rounded-lg">Advanced</span>
                                        <h3 className="text-white font-bold text-xl leading-tight">AWS Cloud Practitioner Essentials</h3>
                                    </div>
                                    <div className="p-6 flex-1 flex flex-col justify-between">
                                        <div>
                                            <p className="text-xs text-slate-500 font-semibold mb-3 flex items-center gap-2"><i className="ph-fill ph-chalkboard-teacher text-lg"></i> 6 Jam • Bengkel IKMB</p>
                                            <p className="text-sm text-slate-600 mb-6 leading-relaxed">Untuk meningkatkan peluang anda mendapat kerja "Cloud Engineer".</p>
                                        </div>
                                        <button className="w-full py-3 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold rounded-xl text-sm transition-colors">Daftar Sesi</button>
                                    </div>
                                </div>

                                {/* Course 3 */}
                                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col h-full">
                                    <div className="bg-purple-600 p-6 h-40 relative flex flex-col justify-end">
                                        <span className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1 rounded-lg">Trending</span>
                                        <h3 className="text-white font-bold text-xl leading-tight">Introduction to AI Tools</h3>
                                    </div>
                                    <div className="p-6 flex-1 flex flex-col justify-between">
                                        <div>
                                            <p className="text-xs text-slate-500 font-semibold mb-3 flex items-center gap-2"><i className="ph-fill ph-video text-lg"></i> 2 Jam • Video</p>
                                            <p className="text-sm text-slate-600 mb-6 leading-relaxed">Persediaan menghadapi Revolusi Industri 4.0 dan ekonomi digital.</p>
                                        </div>
                                        <button className="w-full py-3 bg-purple-50 text-purple-600 hover:bg-purple-100 font-bold rounded-xl text-sm transition-colors">Tonton Video</button>
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