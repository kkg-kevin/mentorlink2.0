
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const SessionSchema = new Schema({
  mentor: { type: Schema.Types.ObjectId, ref: 'Mentor' },
  mentee: { type: Schema.Types.ObjectId, ref: 'Mentee', required: true, index: true },
  organization: { type: Schema.Types.ObjectId, ref: 'Organization' },
  scheduledAt: { type: Date, required: true, index: true },
  status: { type: String, enum: ['pending', 'accepted', 'completed', 'cancelled'], default: 'pending', index: true },
  notes: { type: String, trim: true, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now }
});

SessionSchema.pre('validate', function(next) {
  if (!this.mentor && !this.organization) {
    return next(new Error('A session must include a mentor or an organization.'));
  }

  if (!(this.scheduledAt instanceof Date) || Number.isNaN(this.scheduledAt.getTime())) {
    return next(new Error('A valid scheduled date is required.'));
  }

  next();
});

module.exports = mongoose.model('Session', SessionSchema);
