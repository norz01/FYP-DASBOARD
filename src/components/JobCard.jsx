import React from 'react';

export default function JobCard({ job }) {
    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition group">
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
    );
}