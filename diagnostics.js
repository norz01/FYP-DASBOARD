print("== 1. Total students ==", db.students.countDocuments({}));
print("== 2. Total users ==", db.users.countDocuments({}));

print("== 3. Duplicate ID_Pelajar (top 20) ==");
printjson(db.students.aggregate([
  { $group: { _id: "$ID_Pelajar", n: { $sum: 1 } } },
  { $match: { n: { $gt: 1 } } },
  { $sort: { n: -1 } },
  { $limit: 20 }
]).toArray());

print("== 4. Students per Kursus ==");
printjson(db.students.aggregate([
  { $group: { _id: "$Kursus", n: { $sum: 1 } } },
  { $sort: { n: -1 } }
]).toArray());

print("== 5. IDs with leading/trailing whitespace ==",
  db.students.countDocuments({ ID_Pelajar: { $regex: "^\\s+|\\s+$" } }));

print("== 6. MDB processing ledger ==");
printjson(db.mdbfiles.find({}, {
  datasetName: 1, originalName: 1, status: 1,
  recordsProcessed: 1, uploadDate: 1, processedDate: 1
}).sort({ uploadDate: -1 }).toArray());

print("== 7. Sample records ==");
printjson(db.students.find({}, { ID_Pelajar: 1, Nama: 1, Kursus: 1, Semester: 1 }).limit(10).toArray());