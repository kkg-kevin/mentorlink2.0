
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const MentorSchema = new Schema({
  user: {type:Schema.Types.ObjectId, ref:'User', required:true},
  phone: String, 
  industry: String, 
  experienceYears: Number, 
  specialization: String, 
  availability: String, 
  bio: String,
  // New optional fields for enhanced mentor profile
  company: String,
  position: String,
  linkedinProfile: String,
  website: String,
  industries: [String],
  specialties: [String],
  languages: [String],
  menteeLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'all-levels', ''] },
  sessionFormat: { type: String, enum: ['online', 'in-person', 'hybrid', ''] },
  responseTime: { type: String, enum: ['within-24h', 'within-48h', 'within-week', ''] },
  isProfilePublic: { type: Boolean, default: true },
  openToNewMentees: { type: Boolean, default: true },
  mentorshipCapacity: { type: Number, default: 5 }
});
module.exports = mongoose.model('Mentor', MentorSchema);
