
const crypto = require('crypto');
const User = require('../models/User');
exports.showLogin = (req,res)=> {
  const error = req.query.error === 'suspended'
    ? 'Your account has been suspended. Contact support for help.'
    : null;
  res.render('login', { error });
};
exports.showSignup = (req,res)=> res.render('signup');
exports.showForgotPassword = (req,res)=> res.render('forgot-password');
exports.showResetPassword = async (req,res)=>{
  try{
    const resetToken = req.params.token;
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpiresAt: { $gt: new Date() }
    }).lean();

    if(!user) return res.status(400).render('reset-password', { token: null, error: 'This reset link is invalid or has expired.' });

    res.render('reset-password', { token: resetToken });
  }catch(e){
    console.error(e);
    res.status(500).render('reset-password', { token: null, error: 'Unable to open reset form right now.' });
  }
};
exports.signup = async (req,res)=>{
  try{
    const {name,email,password,role} = req.body;
    const normalizedEmail = (email || '').trim().toLowerCase();
    const trimmedName = (name || '').trim();
    const trimmedPassword = (password || '').trim();

    if(!trimmedName || !normalizedEmail || !trimmedPassword) {
      return res.status(400).send('Missing required signup fields');
    }

    const user = new User({name: trimmedName,email: normalizedEmail,password: trimmedPassword,role: role||'mentee'});
    await user.save();
    req.session.userId = user._id;
    if(user.role==='mentor') return res.redirect('/mentor/dashboard');
    if(user.role==='organization') return res.redirect('/org/dashboard');
    return res.redirect('/mentee/dashboard');
  }catch(e){ console.error(e); res.status(500).send('Signup error'); }
};
exports.login = async (req,res)=>{
  try{
    const {email,password} = req.body;

    const normalizedEmail = (email || '').trim().toLowerCase();
    const user = await User.findOne({email: normalizedEmail});
    if(!user) return res.redirect('/auth/login');

    if (user.status === 'suspended') {
      return res.render('login', { error: 'Your account has been suspended. Contact support for help.' });
    }

    const isPasswordValid = await user.comparePassword(password || '');
    if(!isPasswordValid) return res.redirect('/auth/login');

    if(!user.password.startsWith('$2')){
      user.password = password || '';
      await user.save();
    }

    req.session.userId = user._id;
    if(user.role==='admin') return res.redirect('/admin/dashboard');
    if(user.role==='mentor') return res.redirect('/mentor/dashboard');
    if(user.role==='organization') return res.redirect('/org/dashboard');
    return res.redirect('/mentee/dashboard');
  }catch(e){ console.error(e); res.status(500).send('Login error'); }
};
exports.requestPasswordReset = async (req,res)=>{
  try{
    const normalizedEmail = (req.body.email || '').trim().toLowerCase();
    const genericMessage = 'If an account with that email exists, a reset link is ready.';
    if(!normalizedEmail) return res.status(400).render('forgot-password', { error: 'Enter your email address.' });

    const user = await User.findOne({ email: normalizedEmail });
    if(!user) return res.render('forgot-password', { success: genericMessage });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15);

    user.passwordResetToken = hashedToken;
    user.passwordResetExpiresAt = expiresAt;
    await user.save();

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const resetLink = `${baseUrl}/auth/reset-password/${rawToken}`;

    res.render('forgot-password', {
      success: genericMessage,
      resetLink: process.env.NODE_ENV === 'production' ? null : resetLink
    });
  }catch(e){
    console.error(e);
    res.status(500).render('forgot-password', { error: 'Unable to process password reset right now.' });
  }
};
exports.resetPassword = async (req,res)=>{
  try{
    const resetToken = req.params.token;
    const password = (req.body.password || '').trim();
    const confirmPassword = (req.body.confirmPassword || '').trim();

    if(!password || password.length < 6) {
      return res.status(400).render('reset-password', { token: resetToken, error: 'Use a password with at least 6 characters.' });
    }

    if(password !== confirmPassword) {
      return res.status(400).render('reset-password', { token: resetToken, error: 'Passwords do not match.' });
    }

    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpiresAt: { $gt: new Date() }
    });

    if(!user) {
      return res.status(400).render('reset-password', { token: null, error: 'This reset link is invalid or has expired.' });
    }

    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetExpiresAt = null;
    await user.save();

    res.render('login', { success: 'Password reset successful. You can now log in.' });
  }catch(e){
    console.error(e);
    res.status(500).render('reset-password', { token: req.params.token, error: 'Unable to reset password right now.' });
  }
};
exports.logout = (req,res)=> { req.session.destroy(()=> res.redirect('/')); };
