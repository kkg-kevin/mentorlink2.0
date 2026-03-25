const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const MessageSchema = new Schema({
  thread: { type: Schema.Types.ObjectId, ref: 'Thread', required: true, index: true },
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  body: { type: String, required: true, trim: true, maxlength: 2000 },
  readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

MessageSchema.index({ thread: 1, createdAt: 1 });

module.exports = mongoose.model('Message', MessageSchema);
