
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const MentorSchema = new Schema({
  user: {type:Schema.Types.ObjectId, ref:'User', required:true},
  phone: String, industry: String, experienceYears: Number, specialization: String, availability: String, bio: String
});
module.exports = mongoose.model('Mentor', MentorSchema);
