const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const ThreadSchema = new Schema({
  participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
  lastMessageAt: { type: Date, default: null },
  lastMessagePreview: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

ThreadSchema.index({ participants: 1 });
ThreadSchema.index({ lastMessageAt: -1, createdAt: -1 });

module.exports = mongoose.model('Thread', ThreadSchema);
