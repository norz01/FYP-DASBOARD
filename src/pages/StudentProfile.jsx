// src/pages/StudentProfile.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, RadialLinearScale, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Radar } from 'react-chartjs-2';
import { getToken } from '../utils/auth';

// Register ChartJS
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, RadialLinearScale, Title, Tooltip, Legend, Filler);

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

export default function StudentProfile() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const studentId = searchParams.get('id') || 'TVET001';

    const [skillGap, setSkillGap] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchSkillGap = async () => {
            try {
                // Dapatkan token menggunakan fungsi dari auth.js
                const token = getToken(); 
                
                const response = await fetch(`/api/students/${studentId}/skill-gap`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`, // Hantar token yang sah
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    console.error("Server Error:", response.status, errorData);
                    throw new Error('Tiada data pelajar dijumpai untuk akaun ini.');
                }
                
                const data = await response.json();
                setSkillGap(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchSkillGap();
    },[studentId]);

    // DATA UNTUK GRAF TREND (Campuran Bar & Line)
    const trendData = {
        labels:['Bulan 1', 'Bulan 2', 'Bulan 3', 'Bulan 4', 'Bulan 5'],
        datasets:[
            {
                type: 'line',
                label: 'Skor Akademik (%)',
                data:[75, 70, 65, 58, 55],
                borderColor: '#EF4444',
                backgroundColor: '#EF4444',
                borderWidth: 2,
                tension: 0.3
            },
            {
                type: 'bar',
                label: 'Kehadiran (%)',
                data:[95, 90, 85, 75, 70],
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderColor: '#3B82F6',
                borderWidth: 1,
                borderRadius: 4
            }
        ]
    };

    // DATA UNTUK GRAF RADAR
    const skillData = skillGap ? {
        labels: skillGap.chart.labels,
        datasets:[
            {
                label: `Data Pelajar (${studentId})`,
                data: skillGap.chart.current,
                fill: true,
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                borderColor: '#EF4444',
                pointBackgroundColor: '#EF4444'
            }, 
            {
                label: 'Target Kursus',
                data: skillGap.chart.target,
                fill: true,
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderColor: '#3B82F6',
                borderDash: [5, 5],
                pointBackgroundColor: '#3B82F6'
            }
        ]
    } : null;

    const hasZeroScore = skillGap?.chart.current.some((s) => s === 0);

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans pb-20">
            
            {/* TOP NAV (Back Button) */}
            <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <button onClick={() => navigate('/staff-dashboard')} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-medium transition-colors">
                        <i className="ph-bold ph-arrow-left text-xl"></i> Kembali ke Dashboard
                    </button>
                    <div className="font-bold text-blue-700 flex items-center gap-2">
                        <i className="ph-fill ph-brain"></i> IKMB AI-Hub
                    </div>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto px-4 mt-8 space-y-6 animate-[fadeIn_0.3s_ease-in-out]">

                {loading ? (
                    <div className="min-h-[50vh] flex items-center justify-center text-slate-500">Memuatkan data pelajar...</div>
                ) : error ? (
                    <div className="min-h-[50vh] flex items-center justify-center text-red-500 font-bold">{error}</div>
                ) : (
                    <>
                        {/* HEADER: PROFIL & AI STATUS */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Info Pelajar */}
                            <div className="lg:col-span-2 bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-6 items-start md:items-center">
                                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-slate-50 shadow-md bg-red-400 flex items-center justify-center text-white text-4xl font-bold">
                                    {studentId.slice(-2)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-3 mb-1">
                                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                                            {skillGap?.student.nama || `Pelajar ${studentId}`}
                                        </h1>
                                        <span className={`border px-3 py-1 rounded-full text-xs font-bold ${
                                            skillGap?.student.dropoutRisk === 'Tinggi' ? 'bg-red-100 text-red-700 border-red-200' : 
                                            skillGap?.student.dropoutRisk === 'Rendah' ? 'bg-green-100 text-green-700 border-green-200' : 
                                            'bg-yellow-100 text-yellow-700 border-yellow-200'
                                        }`}>
                                            {skillGap?.student.dropoutRisk}
                                        </span>
                                        {skillGap?.student.anugerah && (
                                            <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold border border-amber-200 flex items-center gap-1">
                                                <i className="ph-fill ph-trophy"></i> Anugerah
                                            </span>
                                        )}
                                        {skillGap?.student.kokoLulus && (
                                            <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200 flex items-center gap-1">
                                                <i className="ph-fill ph-check-circle"></i> Koko Lulus
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-slate-500 font-mono text-sm mb-3">No. Matrik: {studentId}</p>
                                    
                                    <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm">
                                        <p className="text-slate-600 col-span-2">
                                            <span className="font-semibold">Kursus:</span> {getFullCourseName(skillGap?.student.kursus)}
                                        </p>
                                        <p className="text-slate-600"><span className="font-semibold">Semester:</span> Semester {skillGap?.student.semester || '2'}</p>
                                        <p className="text-slate-600"><span className="font-semibold">Sijil:</span> {skillGap?.student.certification || 'Tiada'}</p>
                                        <p className="text-slate-600"><span className="font-semibold">Kehadiran:</span> <span className="text-blue-600 font-bold">{skillGap?.student.attendance}%</span></p>
                                    </div>
                                </div>
                            </div>

                            {/* AI Insight */}
                            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 shadow-sm border border-slate-700 text-white flex flex-col justify-center relative overflow-hidden">
                                <i className="ph-fill ph-magic-wand absolute -right-4 -bottom-4 text-7xl text-white/5"></i>
                                <h3 className="text-slate-300 font-medium text-sm mb-2 flex items-center gap-2">
                                    <i className="ph-fill ph-robot"></i> Ramalan Kebolehpasaran (AI)
                                </h3>
                                <div className="flex items-end gap-2 mb-4">
                                    <span className="text-5xl font-bold text-red-400">{Math.round((skillGap.student.cgpa / 4) * 100)}%</span>
                                    <span className="text-slate-400 text-sm mb-1">/ 100%</span>
                                </div>
                                <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-4">
                                    <div className="bg-red-500 h-full rounded-full" style={{width: `${Math.round((skillGap.student.cgpa / 4) * 100)}%`}}></div>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    {skillGap.insight.message}
                                </p>
                            </div>
                        </div>

                        {/* GRAF PRESTASI */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-slate-800">Sejarah Akademik & Kehadiran</h3>
                                    <button className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg hover:bg-blue-100">Muat Turun</button>
                                </div>
                                <div className="h-64 w-full"><Bar data={trendData} options={{ maintainAspectRatio: false }} /></div>
                            </div>

                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-slate-800">Radar Kemahiran Individu</h3>
                                    {hasZeroScore && (
                                        <div className="text-[10px] text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200 flex items-center gap-1 font-bold">
                                            <i className="ph-fill ph-info"></i> DATA PLO BELUM LENGKAP
                                        </div>
                                    )}
                                </div>
                                <div className="h-64 w-full flex flex-col items-center">
                                    {skillData && <Radar 
        data={skillData} 
        options={{ 
            maintainAspectRatio: false,
            scales: {
                r: {
                    min: 0,
                    max: 100,
                    beginAtZero: true,
                    ticks: {
                        stepSize: 20
                    }
                }
            }
        }} 
    />}
                                    {hasZeroScore && (
                                        <p className="text-[10px] text-slate-400 mt-2 italic">* Skor 0% mungkin disebabkan penilaian PLO belum direkodkan oleh pensyarah.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* INTERVENSI (PRESCRIPTIVE ANALYTICS) */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2 mb-6">
                                <i className="ph-fill ph-stethoscope text-blue-600"></i> Cadangan Intervensi (Prescriptive Analytics)
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="border border-red-100 bg-red-50/50 p-4 rounded-xl">
                                    <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold mb-3">1</div>
                                    <h4 className="font-bold text-slate-800 text-sm mb-1">Kaunseling Kehadiran</h4>
                                    <p className="text-xs text-slate-500 mb-3">Kehadiran jatuh bawah 80% pada bulan lepas. Jadualkan sesi perjumpaan segera.</p>
                                    <button onClick={() => alert('Temujanji berjaya dihantar kepada pelajar!')} className="w-full text-xs font-bold text-red-600 border border-red-200 bg-white py-2 rounded-lg hover:bg-red-50 transition">Set Temujanji</button>
                                </div>

                                <div className="border border-orange-100 bg-orange-50/50 p-4 rounded-xl">
                                    <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold mb-3">2</div>
                                    <h4 className="font-bold text-slate-800 text-sm mb-1">Klinik Akademik (Python)</h4>
                                    <p className="text-xs text-slate-500 mb-3">Markah subjek Programming merosot. Masukkan pelajar dalam kelas bimbingan tambahan.</p>
                                    <button className="w-full text-xs font-bold text-orange-600 border border-orange-200 bg-white py-2 rounded-lg hover:bg-orange-50 transition">Daftar Klinik</button>
                                </div>

                                <div className="border border-blue-100 bg-blue-50/50 p-4 rounded-xl">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold mb-3">3</div>
                                    <h4 className="font-bold text-slate-800 text-sm mb-1">Pembangunan Soft Skills</h4>
                                    <p className="text-xs text-slate-500 mb-3">Kemahiran komunikasi memuaskan. Tingkatkan melalui kem kepimpinan.</p>
                                    <button className="w-full text-xs font-bold text-blue-600 border border-blue-200 bg-white py-2 rounded-lg hover:bg-blue-50 transition">Lihat Program</button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}