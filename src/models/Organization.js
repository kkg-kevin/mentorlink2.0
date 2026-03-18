
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const OrgSchema = new Schema({
  user: {type:Schema.Types.ObjectId, ref:'User', required:true},
  programName: String, website: String, description: String
});
module.exports = mongoose.model('Organization', OrgSchema);
