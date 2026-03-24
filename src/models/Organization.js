
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const OrgSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  programName: String,
  website: String,
  description: String,
  location: String,
  linkedinProfile: String,
  focusAreas: [String],
  programType: { type: String, enum: ['bootcamp', 'internship', 'mentorship-circle', 'one-on-one', 'workshop', ''] },
  sessionFormat: { type: String, enum: ['online', 'in-person', 'hybrid', ''] },
  targetLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'all-levels', ''] },
  programDuration: String,
  openToNewMembers: { type: Boolean, default: true },
  memberCapacity: { type: Number, default: 0 }
});
module.exports = mongoose.model('Organization', OrgSchema);
