
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const Schema = mongoose.Schema;

const BCRYPT_PREFIX = '$2';

const UserSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, unique: true, required: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  profilePicture: { type: String, default: '' },
  passwordResetToken: { type: String, default: null },
  passwordResetExpiresAt: { type: Date, default: null },
  role: { type: String, enum: ['mentee', 'mentor', 'organization', 'admin'], default: 'mentee' },
  createdAt: { type: Date, default: Date.now }
});

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  if (typeof this.password === 'string' && this.password.startsWith(BCRYPT_PREFIX)) {
    return next();
  }

  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (error) {
    next(error);
  }
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password || !candidatePassword) return false;

  if (this.password.startsWith(BCRYPT_PREFIX)) {
    return bcrypt.compare(candidatePassword, this.password);
  }

  return candidatePassword === this.password;
};

module.exports = mongoose.model('User', UserSchema);
