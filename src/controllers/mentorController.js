
const Mentor = require('../models/Mentor');
const Mentee = require('../models/Mentee');
const Session = require('../models/Session');
const Feedback = require('../models/Feedback');
const User = require('../models/User');

exports.dashboard = async (req,res)=> {
  if(!req.user || req.user.role !== 'mentor') return res.redirect('/auth/login');
  const mentor = await Mentor.findOne({ user: req.user._id });
  if(!mentor) return res.render('mentor/mentor-page', { user: req.user, pendingSessions: [] });
  const pendingSessions = await Session.find({ mentor: mentor._id, status: 'pending' })
    .populate({
      path: 'mentee',
      populate: { path: 'user' }
    })
    .lean()
    .catch(()=>[]);
  res.render('mentor/mentor-page', { user: req.user, pendingSessions });
};

exports.sessions = async (req,res)=> {
  if(!req.user || req.user.role !== 'mentor') return res.redirect('/auth/login');
  const mentor = await Mentor.findOne({ user: req.user._id });
  if(!mentor) return res.render('mentor/mentor-session', { user: req.user, sessions: [], stats: { activeMentees: 0, completedSessions: 0 } });
  const sessions = await Session.find({ mentor: mentor._id })
    .populate('mentee')
    .populate({path:'mentee', populate:{path:'user'}})
    .lean()
    .catch(()=>[]);
  
  // Calculate stats
  const uniqueMentees = [...new Set(sessions.filter(s => s.mentee).map(s => s.mentee._id.toString()))];
  const completedSessions = sessions.filter(s => s.status === 'completed').length;
  const stats = {
    activeMentees: uniqueMentees.length,
    completedSessions: completedSessions
  };
  
  res.render('mentor/mentor-session', { user: req.user, sessions, stats });
};

exports.acceptSession = async (req,res)=>{
  if(!req.user || req.user.role !== 'mentor') return res.redirect('/auth/login');
  try {
    const mentor = await Mentor.findOne({ user: req.user._id });
    if(!mentor) return res.redirect('/mentor/dashboard');
    await Session.findOneAndUpdate({ _id: req.params.id, mentor: mentor._id, status: 'pending' }, { status: 'accepted' });
    res.redirect('/mentor/dashboard');
  } catch(e) {
    console.error(e);
    res.redirect('/mentor/dashboard');
  }
};

exports.rejectSession = async (req,res)=>{
  if(!req.user || req.user.role !== 'mentor') return res.redirect('/auth/login');
  try {
    const mentor = await Mentor.findOne({ user: req.user._id });
    if(!mentor) return res.redirect('/mentor/dashboard');
    await Session.findOneAndUpdate({ _id: req.params.id, mentor: mentor._id, status: 'pending' }, { status: 'cancelled' });
    res.redirect('/mentor/dashboard');
  } catch(e) {
    console.error(e);
    res.redirect('/mentor/dashboard');
  }
};

exports.completeSession = async (req,res)=>{
  if(!req.user || req.user.role !== 'mentor') return res.redirect('/auth/login');
  try {
    const mentor = await Mentor.findOne({ user: req.user._id });
    if(!mentor) return res.redirect('/mentor/sessions');
    await Session.findOneAndUpdate({ _id: req.params.id, mentor: mentor._id, status: 'accepted' }, { status: 'completed' });
    res.redirect('/mentor/sessions');
  } catch(e) {
    console.error(e);
    res.redirect('/mentor/sessions');
  }
};

exports.analytics = async (req,res)=> {
  if(!req.user || req.user.role !== 'mentor') return res.redirect('/auth/login');
  const mentor = await Mentor.findOne({ user: req.user._id });
  if(!mentor) return res.render('mentor/mentor-analytics', { user: req.user, stats: { mentees: 0, sessions: 0, avgRating: 0 } });
  
  const sessions = await Session.find({ mentor: mentor._id }).lean().catch(()=>[]);
  const menteeIds = [...new Set(sessions.map(s=>s.mentee?.toString()).filter(Boolean))];
  const feedbacks = await Feedback.find({ to: req.user._id }).lean().catch(()=>[]);
  
  const stats = {
    mentees: menteeIds.length,
    sessions: sessions.length,
    completed: sessions.filter(s=>s.status==='completed').length,
    avgRating: feedbacks.length > 0 ? (feedbacks.reduce((sum,f)=>sum+(f.rating||0),0) / feedbacks.length).toFixed(1) : 0
  };
  
  res.render('mentor/mentor-analytics', { user: req.user, stats });
};

exports.profile = async (req,res)=> {
  if(!req.user || req.user.role !== 'mentor') return res.redirect('/auth/login');
  const mentor = await Mentor.findOne({ user: req.user._id }).lean().catch(()=>null);
  res.render('mentor/mentor-profile', { user: req.user, mentor });
};

exports.updateProfile = async (req,res)=>{
  if(!req.user || req.user.role !== 'mentor') return res.redirect('/auth/login');
  try {
    const data = {
      phone: req.body.phone,
      industry: req.body.industry,
      experienceYears: parseInt(req.body.experienceYears) || 0,
      specialization: req.body.specialization,
      availability: req.body.availability,
      bio: req.body.bio
    };
    await Mentor.findOneAndUpdate({ user: req.user._id }, data, { upsert:true, new:true });
    if(req.file) {
      await User.findByIdAndUpdate(req.user._id, { profilePicture: `/uploads/profiles/${req.file.filename}` });
    }
    res.redirect('/mentor/profile');
  } catch(e) {
    console.error(e);
    res.redirect('/mentor/profile');
  }
};
