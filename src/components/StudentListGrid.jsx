import React, { useState, useMemo } from "react";

const courseMap = {
  ITW: "Diploma Kimpalan",
  DFK: "Diploma Teknologi Komputer",
  DGA: "Diploma Automotif",
  SLR: "Sijil Lukisan Rekabentuk",
  DCG: "Diploma Elektrik (Industri)",
  SED: "Sijil Elektrik Domestik",
  PPU: "Diploma Penyejukan & Udara",
};

export default function StudentListGrid({
  students,
  onViewProfile,
  onAddStudent,
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Semua");

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchSearch =
        s.nama?.toLowerCase().includes(search.toLowerCase()) ||
        s.id?.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === "Semua" || s.kursus === filter;
      return matchSearch && matchFilter;
    });
  }, [students, search, filter]);

  const filters = ["Semua", "ITW", "DFK", "DGA", "SLR", "DCG", "SED", "PPU"];

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h2 className="text-xl font-bold text-[#0A1628]">
            Pengurusan Pelajar
          </h2>
          <p className="text-sm text-[#5A6A85]">
            Menampilkan {filteredStudents.length} daripada {students.length}{" "}
            pelajar
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6A85] text-lg"></i>
            <input
              type="text"
              placeholder="Cari nama atau ID pelajar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[rgba(18,81,170,0.13)] rounded-lg text-sm text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#1251AA]"
            />
          </div>
          <button
            onClick={onAddStudent}
            className="bg-[#1251AA] text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-[#0C2461] transition-colors flex items-center gap-2"
          >
            <i className="ph-bold ph-plus text-lg"></i> Tambah
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f
                ? "bg-[#0C2461] text-white"
                : "bg-white text-[#5A6A85] hover:bg-gray-50 border border-[rgba(18,81,170,0.13)]"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Student Grid */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white border border-[rgba(18,81,170,0.13)] rounded-xl p-12 text-center">
          <i className="ph ph-smiley-sad text-5xl text-[#5A6A85] mb-4"></i>
          <h3 className="text-lg font-medium text-[#0A1628]">
            Tiada pelajar dijumpai
          </h3>
          <p className="text-sm text-[#5A6A85] mt-1">
            Cuba ubah kata kunci carian.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredStudents.map((student) => (
            <div
              key={student.id}
              onClick={() => onViewProfile(student.id)}
              className="relative bg-white border border-[rgba(18,81,170,0.13)] rounded-xl overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              {/* Banner Header */}
              <div className="h-20 bg-[#0C2461] flex justify-end items-start p-3 relative">
                {/* Replaced Status Badge with Semester Badge */}
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white/15 text-white backdrop-blur-sm border border-white/20 shadow-sm">
                  <i className="ph-fill ph-graduation-cap text-sm"></i> Sem{" "}
                  {student.semester || "1"}
                </span>
              </div>

              {/* Absolutely Positioned Avatar (Guarantees no clipping) */}
              <div className="absolute top-8 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-[#1251AA] text-white text-3xl font-bold flex items-center justify-center border-4 border-white shadow-md z-10">
                {student.nama?.charAt(0)}
              </div>

              {/* Content Wrapper (Padded top to make room for the absolute avatar) */}
              <div className="pt-14 pb-5 px-5 flex flex-col items-center text-center">
                <h3 className="font-bold text-[#0A1628] truncate w-full">
                  {student.nama}
                </h3>
                <p className="text-xs text-[#5A6A85] mt-1">
                  {courseMap[student.kursus] || student.kursus}
                </p>

                <div className="mt-3 w-full pt-3 border-t border-[rgba(18,81,170,0.13)] flex justify-between items-center text-xs">
                  <div className="text-left">
                    <p className="text-[#5A6A85]">ID</p>
                    <p className="font-mono font-medium text-[#0A1628] mt-0.5">
                      {student.id}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#5A6A85]">CGPA</p>
                    <p className="font-bold text-[#1251AA] mt-0.5">
                      {student.cgpa}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
