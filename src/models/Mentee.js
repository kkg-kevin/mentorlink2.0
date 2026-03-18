
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const MenteeSchema = new Schema({
  user: {type:Schema.Types.ObjectId, ref:'User', required:true},
  phone: String, educationLevel: String, goals: String, skills: [String]
});
module.exports = mongoose.model('Mentee', MenteeSchema);
