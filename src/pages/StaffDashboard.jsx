// src/pages/StaffDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, RadialLinearScale, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
// 🔥 NEW: Imported getToken
import { clearStoredUser, getStoredUser, getToken } from '../utils/auth';

// Register ChartJS
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, RadialLinearScale, Title, Tooltip, Legend, Filler);

export default function StaffDashboard() {
    const navigate = useNavigate();
    const currentUser = getStoredUser();
    const displayName = currentUser?.displayName || 'Admin IKMB';
    const userInitials = displayName
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    
    // STATE
    const [activeTab, setActiveTab] = useState('overview');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    
    // 🔥 NEW: States for Database Data
    const [students, setStudents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // 🔥 NEW: Student Management States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [formData, setFormData] = useState({
        ID_Pelajar: '', Kehadiran_Pct: '', CGPA: '', Sijil_Profesional: 'Tiada',
        PLO_1: '0', PLO_2: '0', PLO_3: '0', PLO_4: '0', PLO_5: '0', 
        PLO_6: '0', PLO_7: '0', PLO_8: '0', PLO_9: '0', Status_Pelajar: 'Sederhana'
    });

    const handleLogout = (e) => {
        e.preventDefault();
        clearStoredUser();
        navigate('/');
    };

    // 🔥 NEW: Fetch real students data from API
    useEffect(() => {
        const fetchStudents = async () => {
            try {
                const token = getToken();
                const response = await fetch('/api/students', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    setStudents(data);
                }
            } catch (error) {
                console.error("Gagal mendapatkan senarai pelajar:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStudents();
    },[]);

    // 🔥 NEW: Calculate Real KPIs
    const totalStudents = students.length;
    
    const highRiskStudents = students.filter(s => 
        s.dropoutRisk === 'Tinggi' || 
        s.dropoutRisk === 'Bermasalah' ||
        Number(s.attendance) < 80 ||
        Number(s.cgpa) < 2.0
    );
    const highRiskCount = highRiskStudents.length;

    // Helper: Calculate individual employability
    const calculateEmployability = (student) => {
        return Math.min(100, Math.round((Number(student.cgpa) / 4) * 40 + (Number(student.attendance) * 0.6)));
    };

    // Calculate Average Employability
    const averageEmployability = totalStudents > 0 
        ? (students.reduce((acc, s) => acc + calculateEmployability(s), 0) / totalStudents).toFixed(1)
        : 0;

    // Find Top 10 Performers by CGPA
    const topPerformers = [...students].sort((a, b) => Number(b.cgpa) - Number(a.cgpa)).slice(0, 10);

    // 🔥 NEW: Helper functions for Student Management
    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const openAddModal = () => {
        setEditingStudent(null);
        setFormData({
            ID_Pelajar: '', Kehadiran_Pct: '', CGPA: '', Sijil_Profesional: 'Tiada',
            PLO_1: '0', PLO_2: '0', PLO_3: '0', PLO_4: '0', PLO_5: '0', 
            PLO_6: '0', PLO_7: '0', PLO_8: '0', PLO_9: '0', Status_Pelajar: 'Sederhana'
        });
        setIsModalOpen(true);
    };

    const openEditModal = (student) => {
        setEditingStudent(student.id);
        setFormData({
            ID_Pelajar: student.id || student.ID_Pelajar,
            Kehadiran_Pct: student.attendance || student.Kehadiran_Pct,
            CGPA: student.cgpa || student.CGPA,
            Sijil_Profesional: student.certification || student.Sijil_Profesional || 'Tiada',
            PLO_1: student.plo1?.toString() || '0',
            PLO_2: student.plo2?.toString() || '0',
            PLO_3: student.plo3?.toString() || '0',
            PLO_4: student.plo4?.toString() || '0',
            PLO_5: student.plo5?.toString() || '0',
            PLO_6: student.plo6?.toString() || '0',
            PLO_7: student.plo7?.toString() || '0',
            PLO_8: student.plo8?.toString() || '0',
            PLO_9: student.plo9?.toString() || '0',
            Status_Pelajar: student.dropoutRisk === 'Rendah' ? 'Cemerlang' : student.dropoutRisk === 'Tinggi' ? 'Bermasalah' : 'Sederhana'
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const token = getToken();
        const method = editingStudent ? 'PUT' : 'POST';
        const url = editingStudent ? `/api/students/${editingStudent}` : '/api/students';

        const response = await fetch(url, {
            method,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            alert(editingStudent ? "Data dikemaskini!" : "Pelajar ditambah!");
            setIsModalOpen(false);
            window.location.reload();
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Adakah anda pasti mahu memadam data pelajar ini?")) {
            const token = getToken();
            const response = await fetch(`/api/students/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setStudents(students.filter(s => s.id !== id && s.ID_Pelajar !== id));
            }
        }
    };

    // --- DATA GRAF (Kekal statik kerana perlukan data historikal berbilang semester) ---
    const performanceData = {
        labels:['Januari - Jun 2025', 'Julai - Disember 2025', 'Januari - Jun 2026', 'Julai - Disember 2026'],
        datasets: [
            { 
                label: 'Prestasi Akademik', data:[75, 80, 84, 88], borderColor: '#2563EB', backgroundColor: '#2563EB', tension: 0.3, borderWidth: 3, pointBackgroundColor: '#2563EB'
            },
            { 
                label: 'Kompetensi Kemahiran', data:[65, 75, 82, 86], borderColor: '#10B981', backgroundColor: '#10B981', tension: 0.3, borderWidth: 3, pointBackgroundColor: '#10B981'
            },
            { 
                label: 'Kesesuaian Industri', data:[60, 70, 78, 85], borderColor: '#F59E0B', backgroundColor: '#F59E0B', tension: 0.3, borderWidth: 3, pointBackgroundColor: '#F59E0B'
            }
        ]
    };

    const chartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } } },
        scales: {
            y: { beginAtZero: true, max: 100, title: { display: true, text: 'Skor Pencapaian (%)', font: { weight: 'bold' } } },
            x: { title: { display: true, text: 'Sesi Pengajian', font: { weight: 'bold' } } }
        }
    };

    return (
        <div className="flex h-screen overflow-hidden text-slate-800 bg-[#F8FAFC] font-sans">
            
            {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-20 md:hidden transition-opacity"></div>}

            {/* SIDEBAR */}
            <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200 flex flex-col transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 md:relative md:translate-x-0 shadow-2xl md:shadow-none`}>
                <div className="p-6 flex items-center justify-between border-b border-slate-100">
                    <img src="/logo-tvetmara.jpg" alt="TVETMARA" className="w-48 h-auto object-contain" />
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-slate-600">
                        <i className="ph-bold ph-x text-xl"></i>
                    </button>
                </div>

                <nav className="flex-1 py-4 space-y-2 overflow-y-auto">
                    <p className="px-6 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-2">Menu Utama</p>
                    
                    <button onClick={() => {setActiveTab('overview'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-all ${activeTab === 'overview' ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                        <i className="ph ph-squares-four text-lg"></i> Dashboard Overview
                    </button>
                    <button onClick={() => {setActiveTab('prediction'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-all ${activeTab === 'prediction' ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                        <i className="ph ph-magic-wand text-lg"></i> AI Prediction
                    </button>
                    <button onClick={() => {setActiveTab('skills'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-all ${activeTab === 'skills' ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                        <i className="ph ph-chart-bar text-lg"></i> Skills Gap Analysis
                    </button>
                    <button onClick={() => {setActiveTab('pathways'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-all ${activeTab === 'pathways' ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                        <i className="ph ph-path text-lg"></i> Learning Pathways
                    </button>
                    <button onClick={() => {setActiveTab('management'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-all ${activeTab === 'management' ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                        <i className="ph ph-users-three text-lg"></i> Student Management
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-10 h-10 rounded-full bg-blue-600 flex justify-center items-center text-white font-bold text-sm">{userInitials}</div>
                            <div className="flex flex-col">
                                <p className="text-sm font-bold text-slate-800">{displayName}</p>
                                <p className="text-[10px] text-slate-500 font-bold uppercase">Penyelaras</p>
                            </div>
                        </div>
                        <button onClick={handleLogout} className="text-slate-400 hover:text-red-600 transition"><i className="ph-bold ph-sign-out text-xl"></i></button>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden relative w-full">
                
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-10 shrink-0">
                    <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
                        <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"><i className="ph-bold ph-list text-2xl"></i></button>
                        <div className="flex items-center gap-2 text-slate-400 bg-slate-100 px-4 py-2.5 rounded-full w-full md:w-96">
                            <i className="ph ph-magnifying-glass text-lg"></i>
                            <input type="text" placeholder="Cari pelajar, kursus, atau skill..." className="bg-transparent border-none outline-none text-sm w-full text-slate-700" />
                        </div>
                    </div>
                    <div className="flex items-center gap-4 ml-2">
                        <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition">
                            <i className="ph ph-bell text-xl"></i><span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-20">
                    
                    {activeTab === 'overview' && (
                        <div className="space-y-6 animate-[fadeIn_0.3s_ease-in-out]">
                            
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-2 mb-2">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">Overview Dashboard</h2>
                                    <p className="text-slate-500 text-sm mt-1">Statistik utama pembangunan kemahiran dan bakat pelajar TVETMARA Besut.</p>
                                </div>
                                <span className="px-4 py-1.5 bg-purple-50 text-purple-700 text-xs font-bold rounded-full border border-purple-200">AI-Enabled Analytics</span>
                            </div>
                            
                            {/* 🔥 DYNAMIC KPI CARDS */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="text-sm text-slate-500 font-medium">Jumlah Pelajar Aktif</p>
                                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><i className="ph-fill ph-users text-lg"></i></div>
                                    </div>
                                    <h3 className="text-3xl font-bold text-slate-900">{isLoading ? '-' : totalStudents}</h3>
                                    <p className="text-xs text-blue-600 font-bold mt-2">Berdasarkan Database</p>
                                    <div className="w-full bg-slate-100 h-1.5 mt-4 rounded-full overflow-hidden">
                                        <div className="bg-blue-600 h-full rounded-full" style={{width: '100%'}}></div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="text-sm text-slate-500 font-medium">Purata Kebolehpasaran</p>
                                        <div className="p-1.5 bg-green-50 text-green-600 rounded-lg"><i className="ph-fill ph-briefcase text-lg"></i></div>
                                    </div>
                                    <h3 className="text-3xl font-bold text-slate-900">{isLoading ? '-' : `${averageEmployability}%`}</h3>
                                    <p className="text-xs text-green-600 font-bold mt-2">Kiraan AI Dashboard</p>
                                    <div className="w-full bg-slate-100 h-1.5 mt-4 rounded-full overflow-hidden">
                                        <div className="bg-green-500 h-full rounded-full" style={{width: `${averageEmployability}%`}}></div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="text-sm text-slate-500 font-medium">Pelajar Berisiko Tinggi</p>
                                        <div className="p-1.5 bg-red-50 text-red-600 rounded-lg"><i className="ph-fill ph-warning text-lg"></i></div>
                                    </div>
                                    <h3 className="text-3xl font-bold text-slate-900">{isLoading ? '-' : highRiskCount}</h3>
                                    <p className="text-xs text-red-600 font-bold mt-2">Memerlukan Perhatian</p>
                                    <div className="w-full bg-slate-100 h-1.5 mt-4 rounded-full overflow-hidden">
                                        <div className="bg-red-500 h-full rounded-full" style={{width: `${totalStudents ? (highRiskCount/totalStudents)*100 : 0}%`}}></div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
                                    <i className="ph-bold ph-trend-up text-blue-600"></i> Trend Prestasi & Pembangunan Bakat (Mock Data)
                                </h3>
                                <div className="h-80 w-full">
                                    <Line data={performanceData} options={chartOptions} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* 🔥 DYNAMIC: Kiri: Pelajar Berisiko */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                    <h3 className="font-bold text-lg text-red-600 flex items-center gap-2 mb-4">
                                        <i className="ph-fill ph-warning-circle"></i> Pelajar Berisiko Tinggi (Data Sebenar)
                                    </h3>
                                    <div className="space-y-4">
                                        {isLoading ? (
                                            <p className="text-sm text-slate-500">Memuatkan data...</p>
                                        ) : highRiskStudents.length === 0 ? (
                                            <div className="text-center py-10">
                                                <i className="ph ph-check-circle text-4xl text-green-500 mb-2"></i>
                                                <p className="text-sm text-green-600 font-bold">Tiada pelajar berisiko tinggi.</p>
                                            </div>
                                        ) : (
                                            highRiskStudents.slice(0, 10).map((student) => (
                                                <div key={student.id} onClick={() => navigate(`/student-profile?id=${student.id}`)} className="bg-red-50 p-4 rounded-xl border border-red-100 cursor-pointer hover:bg-red-100 transition-all flex justify-between items-center group">
                                                    <div>
                                                        <h4 className="font-bold text-slate-800">{student.nama || 'Pelajar ' + student.id}</h4>
                                                        <p className="text-[10px] text-slate-500 font-mono mb-1">{student.id} • Kursus {student.kursus}</p>
                                                        <p className="text-xs text-red-500 font-bold">
                                                            {Number(student.attendance) < 80 ? '⚠️ Kehadiran: ' + student.attendance + '%' : '📉 Prestasi Rendah: ' + student.cgpa}
                                                        </p>
                                                    </div>
                                                    <i className="ph ph-caret-right text-red-400 group-hover:translate-x-1 transition-transform"></i>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* 🔥 DYNAMIC: Kanan: Top Performers */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                    <h3 className="font-bold text-lg text-yellow-600 flex items-center gap-2 mb-4">
                                        <i className="ph-fill ph-star"></i> Top Performers - AI Recognition
                                    </h3>
                                    <div className="space-y-4">
                                        {isLoading ? (
                                            <p className="text-sm text-slate-500">Memuatkan data...</p>
                                        ) : topPerformers.length === 0 ? (
                                            <p className="text-sm text-slate-500">Tiada data pelajar.</p>
                                        ) : (
                                            topPerformers.map((student) => (
                                                <div key={student.id} className="bg-yellow-50 p-5 rounded-xl border border-yellow-100 flex justify-between items-center cursor-pointer hover:bg-yellow-100 transition-colors" onClick={() => navigate(`/student-profile?id=${student.id}`)}>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800">{student.nama || `Pelajar ${student.id}`}</h4>
                                                        <p className="text-xs text-yellow-700 mt-1">
                                                            CGPA: {student.cgpa} | {student.anugerah ? '🏆 Penerima Anugerah' : `Sijil: ${student.certification}`}
                                                        </p>
                                                    </div>
                                                    <span className="text-2xl font-bold text-yellow-600">
                                                        {Math.min(100, Math.round((Number(student.cgpa) / 4) * 60 + (Number(student.attendance) * 0.4)))}%
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'prediction' && (<div className="p-8 text-center text-slate-500">Kandungan AI Prediction.</div>)}
                    {activeTab === 'skills' && (<div className="p-8 text-center text-slate-500">Kandungan Skills Gap.</div>)}
                    {activeTab === 'pathways' && (<div className="p-8 text-center text-slate-500">Kandungan Learning Pathways.</div>)}

                    {activeTab === 'management' && (
                        <div className="space-y-6 animate-[fadeIn_0.3s_ease-in-out]">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-bold text-slate-900">Pengurusan Pelajar</h2>
                                <button onClick={openAddModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
                                    <i className="ph-bold ph-plus"></i> Tambah Pelajar
                                </button>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">ID Pelajar</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">CGPA</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Kehadiran</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Tindakan</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {students.map((student) => (
                                            <tr key={student.id || student.ID_Pelajar} className="hover:bg-slate-50/50">
                                                <td className="px-6 py-4 font-medium text-slate-800">{student.id || student.ID_Pelajar}</td>
                                                <td className="px-6 py-4">{student.cgpa || student.CGPA}</td>
                                                <td className="px-6 py-4">{student.attendance || student.Kehadiran_Pct}%</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${student.dropoutRisk === 'Rendah' || student.Status_Pelajar === 'Cemerlang' ? 'bg-green-100 text-green-700' : student.dropoutRisk === 'Tinggi' || student.Status_Pelajar === 'Bermasalah' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                        {student.dropoutRisk === 'Rendah' ? 'Cemerlang' : student.dropoutRisk === 'Tinggi' ? 'Bermasalah' : 'Sederhana'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right space-x-2">
                                                    <button onClick={() => openEditModal(student)} className="text-blue-600 hover:text-blue-800"><i className="ph-bold ph-pencil-simple text-lg"></i></button>
                                                    <button onClick={() => handleDelete(student.id || student.ID_Pelajar)} className="text-red-600 hover:text-red-800"><i className="ph-bold ph-trash text-lg"></i></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* MODAL FORM */}
                            {isModalOpen && (
                                <div className="fixed inset-0 bg-black/60 z-[100] flex justify-center items-center p-4">
                                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8">
                                        <h3 className="text-xl font-bold mb-4">{editingStudent ? 'Kemaskini Pelajar' : 'Tambah Pelajar Baharu'}</h3>
                                        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1">
                                                <label className="text-xs font-bold text-slate-500">ID Pelajar</label>
                                                <input name="ID_Pelajar" value={formData.ID_Pelajar} onChange={handleInputChange} className="border p-2 rounded-lg" required disabled={!!editingStudent}/>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-xs font-bold text-slate-500">CGPA</label>
                                                <input name="CGPA" value={formData.CGPA} onChange={handleInputChange} className="border p-2 rounded-lg" required/>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-xs font-bold text-slate-500">Kehadiran (%)</label>
                                                <input name="Kehadiran_Pct" value={formData.Kehadiran_Pct} onChange={handleInputChange} className="border p-2 rounded-lg" required/>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-xs font-bold text-slate-500">Sijil Profesional</label>
                                                <select name="Sijil_Profesional" value={formData.Sijil_Profesional} onChange={handleInputChange} className="border p-2 rounded-lg">
                                                    <option value="Tiada">Tiada</option>
                                                    <option value="CompTIA">CompTIA</option>
                                                    <option value="Cisco CCNA">Cisco CCNA</option>
                                                    <option value="AWS Cloud">AWS Cloud</option>
                                                </select>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-xs font-bold text-slate-500">Status Pelajar</label>
                                                <select name="Status_Pelajar" value={formData.Status_Pelajar} onChange={handleInputChange} className="border p-2 rounded-lg">
                                                    <option value="Bermasalah">Bermasalah</option>
                                                    <option value="Sederhana">Sederhana</option>
                                                    <option value="Cemerlang">Cemerlang</option>
                                                </select>
                                            </div>
                                            <div className="col-span-2 flex justify-end gap-3 mt-4">
                                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500">Batal</button>
                                                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg">Simpan</button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
}