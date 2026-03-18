
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const FeedbackSchema = new Schema({
  session: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
  from: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, trim: true, maxlength: 2000 },
  createdAt: { type: Date, default: Date.now }
});

// Ensure one feedback per session per user
FeedbackSchema.index({ session: 1, from: 1 }, { unique: true });

module.exports = mongoose.model('Feedback', FeedbackSchema);
