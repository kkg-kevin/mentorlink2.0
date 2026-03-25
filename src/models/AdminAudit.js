const mongoose = require('mongoose');

const { Schema } = mongoose;

const AdminAuditSchema = new Schema({
  admin: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  targetUser: { type: Schema.Types.ObjectId, ref: 'User' },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AdminAudit', AdminAuditSchema);
