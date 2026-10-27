export const pathwayMap = {
  SED: {
    courseName: "Diploma Kompetensi Elektrik (Penyelenggaraan) (Industri)",
    targetRoles: ["Electrical Technician", "Chargeman Trainee (PW4)", "Penjaga Jentera Elektrik"],
    baseQuery: "Electrical Maintenance Technician Industrial",
    recommendedCertifications: ["Sijil Kompetisi Juruwireman (PW2/PW4)", "Chargeman AO/A4 (Suruhanjaya Tenaga)", "CIDB Green Card"],
    suggestedSearches: [
      { label: "Electrical Intern", q: "Electrical Technician Intern", location: "Malaysia", employmentType: "INTERN" },
      { label: "Wireman / Chargeman", q: "Wireman Chargeman Trainee", location: "Malaysia", employmentType: "INTERN" },
    ],
  },
  ITW: {
    courseName: "Diploma Kompetensi Kimpalan",
    targetRoles: ["Welder / Fabricator", "Welding Inspector (VI)", "NDT Technician", "Pipe Welder"],
    baseQuery: "Welder Fabricator QAQC NDT",
    recommendedCertifications: ["TWIMC", "ASME / AWS Welding", "NDT Level 1/2", "Visual Inspector (VI)"],
    suggestedSearches: [
      { label: "Welder Intern", q: "Welder Fabricator Intern", location: "Malaysia", employmentType: "INTERN" },
      { label: "Oil & Gas Welder", q: "Pipe Welder NDT Intern", location: "Terengganu", employmentType: "INTERN" },
    ],
  },
  DFK: {
    courseName: "Diploma Teknologi Komputer (Komputasi Awan)",
    targetRoles: ["Cloud Support Trainee", "IT Support Technician", "System Administrator Assistant"],
    baseQuery: "Cloud Computing IT Support System Admin",
    recommendedCertifications: ["AWS Certified Cloud Practitioner", "Microsoft Azure Fundamentals (AZ-900)", "Cisco CCNA"],
    suggestedSearches: [
      { label: "Cloud Intern", q: "Cloud Computing Support Intern", location: "Malaysia", employmentType: "INTERN" },
      { label: "IT Support", q: "IT Support Technician Intern", location: "Malaysia", employmentType: "INTERN" },
    ],
  },
  PPU: {
    courseName: "Diploma Teknologi Penyejukan dan Penyamanan Udara",
    targetRoles: ["HVAC Technician Trainee", "Air Conditioning Mechanic", "Facility M&E Assistant"],
    baseQuery: "HVAC Air Conditioning Refrigeration Technician",
    recommendedCertifications: ["CIDB Green Card", "DOS Refrigerant Handling", "SKM/DKM (Penyejukan)"],
    suggestedSearches: [
      { label: "HVAC Intern", q: "HVAC Technician Intern", location: "Malaysia", employmentType: "INTERN" },
      { label: "Facility M&E", q: "Facility Maintenance M&E Intern", location: "Malaysia", employmentType: "INTERN" },
    ],
  },
  SLR: {
    courseName: "Sijil Teknologi Kejuruteraan Mekanikal (Lukisan Rekabentuk)",
    targetRoles: ["CAD Drafter Intern", "Mechanical Design Trainee", "Junior Draftsperson"],
    baseQuery: "CAD Drafter Mechanical Design AutoCAD SolidWorks",
    recommendedCertifications: ["AutoCAD Certified Professional", "SolidWorks CSWA"],
    suggestedSearches: [
      { label: "CAD Drafter", q: "CAD Drafter Intern AutoCAD", location: "Malaysia", employmentType: "INTERN" },
      { label: "Mechanical Design", q: "Mechanical Design Trainee", location: "Malaysia", employmentType: "INTERN" },
    ],
  },
};

function score(value, max) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(max, numeric)) : 0;
}

export function buildStudentPathway(student) {
  const courseCode = String(student.Kursus || "").replaceAll("*", "").trim().toUpperCase();
  const course = pathwayMap[courseCode] || {
    courseName: courseCode || "Kursus belum direkodkan",
    targetRoles: [],
    baseQuery: null,
    recommendedCertifications: [],
    suggestedSearches: [],
  };
  const ploScores = Array.from({ length: 9 }, (_, i) => score(student[`PLO_${i + 1}`], 100));
  const ploAverage = ploScores.reduce((sum, value) => sum + value, 0) / 9;
  const cgpa = score(student.CGPA, 4);
  const attendance = score(student.Kehadiran_Pct, 100);
  const readinessScore = Math.round(ploAverage * 0.4 + (cgpa / 4) * 30 + attendance * 0.3);
  const actionPlan = [];
  const missingPlos = ploScores.flatMap((value, i) => value === 0 ? [`PLO ${i + 1}`] : []);
  if (missingPlos.length) {
    actionPlan.push({ title: "Lengkapkan rekod PLO", description: `Semak ${missingPlos.join(", ")} bersama pensyarah. Skor sifar dianggap belum direkodkan.` });
  }
  const weakPlos = ploScores.flatMap((value, i) => value > 0 && value < 80 ? [`PLO ${i + 1}`] : []);
  if (weakPlos.length) {
    actionPlan.push({ title: "Tingkatkan kemahiran PLO", description: `Utamakan latihan untuk ${weakPlos.join(", ")} sehingga mencapai sasaran 80%.` });
  }
  if (cgpa < 3) actionPlan.push({ title: "Kukuhkan pencapaian akademik", description: "Bincangkan pelan ulang kaji dan klinik akademik dengan pensyarah untuk mencapai CGPA 3.00." });
  if (attendance < 80) actionPlan.push({ title: "Perbaiki kehadiran", description: "Rancang jadual bersama penasihat untuk mencapai kehadiran sekurang-kurangnya 80%." });
  if (course.recommendedCertifications.length) {
    actionPlan.push({ title: "Rancang pensijilan industri", description: `Semak syarat, pengalaman dan latihan yang diperlukan untuk ${course.recommendedCertifications.join(", ")}.` });
  }
  actionPlan.push({ title: "Sediakan permohonan latihan industri", description: "Kemas kini CV, sijil dan portfolio projek. Sesuaikan permohonan dengan syarat setiap jawatan." });

  return {
    ...course,
    courseCode,
    supported: Boolean(pathwayMap[courseCode]),
    readinessScore,
    readinessExplanation: "Indeks panduan: purata 9 PLO (40%), CGPA (30%) dan kehadiran (30%). Data belum direkodkan dikira sifar. Ini bukan kebarangkalian mendapat kerja.",
    actionPlan,
  };
}
