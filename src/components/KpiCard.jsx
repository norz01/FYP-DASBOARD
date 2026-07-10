import React from 'react';

export default function KpiCard({ title, value, isLoading, icon, iconBg, iconColor, barColor, barWidth, subtitle }) {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-start mb-2">
                <p className="text-sm text-slate-500 font-medium">{title}</p>
                <div className={`p-1.5 ${iconBg} ${iconColor} rounded-lg`}>
                    <i className={`ph-fill ${icon} text-lg`}></i>
                </div>
            </div>
            <h3 className="text-3xl font-bold text-slate-900">{isLoading ? '-' : value}</h3>
            {subtitle && <p className={`text-xs mt-2 font-bold ${iconColor}`}>{subtitle}</p>}
            <div className="w-full bg-slate-100 h-1.5 mt-4 rounded-full overflow-hidden">
                <div className={`${barColor} h-full rounded-full transition-all duration-500`} style={{width: `${barWidth}%`}}></div>
            </div>
        </div>
    );
}