const mongoose = require('mongoose');

const { Schema } = mongoose;

const AnnouncementSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  targetRole: { type: String, enum: ['all', 'mentor', 'mentee', 'organization'], default: 'all' },
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Announcement', AnnouncementSchema);
