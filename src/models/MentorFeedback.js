const mongoose = require('mongoose');

const { Schema } = mongoose;

const MentorFeedbackSchema = new Schema({
  session: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
  from: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  comment: { type: String, required: true, trim: true, maxlength: 2000 },
  isHidden: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

MentorFeedbackSchema.index({ session: 1, from: 1 }, { unique: true });

module.exports = mongoose.model('MentorFeedback', MentorFeedbackSchema);
