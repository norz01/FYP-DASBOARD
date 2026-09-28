import mongoose from 'mongoose';

const mdbFileSchema = new mongoose.Schema({
  datasetName: { type: String, required: true }, // Admin's custom name (e.g., "Intake July 2026")
  originalName: { type: String, required: true }, // Actual file name (e.g., data.mdb)
  filePath: { type: String, required: true },     // Absolute path on the server disk
  fileSize: { type: Number, required: true },     // in bytes
  status: { 
    type: String, 
    enum: ['Saved', 'Processing', 'Processed', 'Failed'], 
    default: 'Saved' 
  },
  recordsProcessed: { type: Number, default: 0 },
  uploadDate: { type: Date, default: Date.now },
  processedDate: { type: Date }
});

export default mongoose.model('MdbFile', mdbFileSchema);