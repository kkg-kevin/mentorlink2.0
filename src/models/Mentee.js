
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const MenteeSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  phone: String,
  educationLevel: String,
  goals: String,
  skills: [String],
  location: String,
  currentRole: String,
  institution: String,
  learningStyle: { type: String, enum: ['visual', 'hands-on', 'reading', 'discussion', ''] },
  communicationPreference: { type: String, enum: ['video', 'chat', 'email', 'in-person', ''] },
  mentorshipExperience: { type: String, enum: ['first-time', 'some', 'experienced', ''] },
  sessionFrequency: { type: String, enum: ['weekly', 'biweekly', 'monthly', 'as-needed', ''] },
  isProfilePublic: { type: Boolean, default: true },
  openToMentorship: { type: Boolean, default: true }
});
module.exports = mongoose.model('Mentee', MenteeSchema);
