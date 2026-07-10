import Student from './models/Student.js';

const certificationScores = {
 'Tiada': 35,
 'CompTIA': 70,
 'Cisco CCNA': 85,
 'AWS Cloud': 90,
};

function normaliseStudent(record) {
  const dropoutRiskMap = {
    'Bermasalah': 'Tinggi',
    'Sederhana': 'Sederhana',
    'Cemerlang': 'Rendah',
    'Pending AI': 'Pending'
  };

  const attendance = Number(record.Kehadiran_Pct) || 0;
  const cgpa = Number(record.CGPA) || 0;
  
  let assignedRisk = dropoutRiskMap[record.Status_Pelajar] || 'Sederhana';
  
  if (attendance < 80 || cgpa < 2.0) {
    assignedRisk = 'Tinggi';
  } else if (cgpa >= 3.5) {
    assignedRisk = 'Rendah';
  } else if (record.Status_Pelajar === 'Cemerlang') {
    assignedRisk = 'Rendah';
  }

  const history = (record.academicHistory || []).map(h => ({
    semester: h.semester,
    cgpa: Number(h.cgpa) || 0,
    attendance: Number(h.attendance) || 0
  }));

  return {
    id: record.ID_Pelajar,
    nama: record.Nama || "Pelajar IKMB",
    kursus: record.Kursus || "Umum",
    semester: record.Semester || 1,
    attendance: attendance,
    cgpa: cgpa,
    anugerah: record.Anugerah || false,
    kokoLulus: record.Koko_Lulus || false,
    plo1: Number(record.PLO_1) || 0,
    plo2: Number(record.PLO_2) || 0,
    plo3: Number(record.PLO_3) || 0,
    plo4: Number(record.PLO_4) || 0,
    plo5: Number(record.PLO_5) || 0,
    plo6: Number(record.PLO_6) || 0,
    plo7: Number(record.PLO_7) || 0,
    plo8: Number(record.PLO_8) || 0,
    plo9: Number(record.PLO_9) || 0,
    certification: record.Sijil_Profesional || 'Tiada',
    certificationScore: certificationScores[record.Sijil_Profesional] ?? 50,
  dropoutRisk: assignedRisk,
  careerStatus: 'Pelajar',
  academicHistory: history,
  };
}

async function getStudentsDataset() {
  const rows = await Student.find({});
  return rows.map((row) => normaliseStudent(row));
}

function buildMetrics(student) {
  return [
    { label: 'PLO 1', value: student.plo1, target: 80 },
    { label: 'PLO 2', value: student.plo2, target: 80 },
    { label: 'PLO 3', value: student.plo3, target: 80 },
    { label: 'PLO 4', value: student.plo4, target: 80 },
    { label: 'PLO 5', value: student.plo5, target: 80 },
    { label: 'PLO 6', value: student.plo6, target: 80 },
    { label: 'PLO 7', value: student.plo7, target: 80 },
    { label: 'PLO 8', value: student.plo8, target: 80 },
    { label: 'PLO 9', value: student.plo9, target: 80 }
  ];
}

function buildInsight(metrics, student) {
  const weakestMetric = metrics.reduce((lowest, current) =>
    current.value < lowest.value ? current : lowest
  );

  if (weakestMetric.value === 0) {
    return {
      weakestSkill: weakestMetric.label,
      message: `Nota: Penilaian untuk "${weakestMetric.label}" belum direkodkan sepenuhnya. AI tidak dapat membuat analisa tepat.`,
    };
  }

  const improvementGap = Math.max(weakestMetric.target - weakestMetric.value, 0);
  const priorityText = improvementGap >= 20 ? 'perlu diberi perhatian segera' : 'bole dipertingkatkan lagi';

  return {
    weakestSkill: weakestMetric.label,
    message: `Berdasarkan analisis, "${weakestMetric.label}" adalah kemahiran terlemah (${weakestMetric.value}%). Risiko ${student.dropoutRisk.toLowerCase()} dan ${priorityText}.`,
  };
}

// Refactored to accept generic features for manual prediction
export async function getRealAIPrediction(features) {
  try {
    const aiResponse = await fetch('http://127.0.0.1:8000/predict/risk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        CGPA: features.cgpa,
        Attendance: features.attendance,
        PLO_1: features.plo1,
        PLO_2: features.plo2,
        PLO_3: features.plo3,
        PLO_4: features.plo4,
        PLO_5: features.plo5,
        PLO_6: features.plo6,
        PLO_7: features.plo7,
        PLO_8: features.plo8,
        PLO_9: features.plo9,
        Sijil: features.certification || 'Tiada'
      })
    });

    if (!aiResponse.ok) throw new Error('AI Server error');

    const data = await aiResponse.json();
    const rawPrediction = data.prediction || data.result || 'Sederhana';

    const predictionMap = {
      Bermasalah: 'Tinggi',
      Sederhana: 'Sederhana',
      Cemerlang: 'Rendah'
    };

    return predictionMap[rawPrediction] || rawPrediction;
  } catch (error) {
    console.error(`❌ AI Prediction failed:`, error.message);
    if (features.attendance < 80 || features.cgpa < 2.0) return 'Tinggi';
    if (features.cgpa >= 3.5) return 'Rendah';
    return 'Sederhana';
  }
}

export async function getAllStudents() {
  return await getStudentsDataset();
}

export async function getStudentById(studentId) {
  const row = await Student.findOne({ ID_Pelajar: studentId });
  return row ? normaliseStudent(row) : null;
}

export async function getStudentSkillGapById(studentId) {
  const student = await getStudentById(studentId);
  if (!student) return null;

  const trueAiRisk = await getRealAIPrediction(student);
  student.dropoutRisk = trueAiRisk;

  const metrics = buildMetrics(student);

  return {
    student,
    chart: {
      labels: metrics.map((m) => m.label),
      current: metrics.map((m) => m.value),
      target: metrics.map((m) => m.target),
    },
    insight: buildInsight(metrics, student),
  };
}

// --- CRUD OPERATIONS ---

export const createStudent = async (studentData) => {
  const newStudent = new Student(studentData);
  return await newStudent.save();
};

export const updateStudent = async (id, updateData) => {
  return await Student.findOneAndUpdate({ ID_Pelajar: id }, updateData, { new: true, runValidators: true });
};

export const deleteStudent = async (id) => {
  return await Student.findOneAndDelete({ ID_Pelajar: id });
};