import mongoose from 'mongoose';

const TempRegistrationSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  name: { type: String, required: true, trim: true },
  username: { type: String, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: false });

export default mongoose.model('TempRegistration', TempRegistrationSchema);
