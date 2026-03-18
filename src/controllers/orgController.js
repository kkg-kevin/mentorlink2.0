
const Organization = require('../models/Organization');
const Session = require('../models/Session');
const Feedback = require('../models/Feedback');
const Mentee = require('../models/Mentee');
const User = require('../models/User');

exports.dashboard = async (req,res)=> {
  if(!req.user || req.user.role !== 'organization') return res.redirect('/auth/login');
  const org = await Organization.findOne({ user: req.user._id });
  if(!org) return res.render('organization/organization-page', { user: req.user, pendingSessions: [] });
  const pendingSessions = await Session.find({ organization: org._id, status: 'pending' })
    .populate('mentee')
    .populate('mentor')
    .populate({path:'mentee', populate:{path:'user'}})
    .populate({path:'mentor', populate:{path:'user'}})
    .lean()
    .catch(()=>[]);
  res.render('organization/organization-page', { user: req.user, pendingSessions });
};

exports.sessions = async (req,res)=> {
  if(!req.user || req.user.role !== 'organization') return res.redirect('/auth/login');
  const org = await Organization.findOne({ user: req.user._id });
  if(!org) return res.render('organization/organization-session', { user: req.user, sessions: [] });
  const sessions = await Session.find({ organization: org._id })
    .populate('mentee')
    .populate('mentor')
    .populate({path:'mentee', populate:{path:'user'}})
    .populate({path:'mentor', populate:{path:'user'}})
    .lean()
    .catch(()=>[]);
  res.render('organization/organization-session', { user: req.user, sessions });
};

exports.acceptSession = async (req,res)=>{
  if(!req.user || req.user.role !== 'organization') return res.redirect('/auth/login');
  try {
    const org = await Organization.findOne({ user: req.user._id });
    if(!org) return res.redirect('/org/dashboard');
    await Session.findOneAndUpdate({ _id: req.params.id, organization: org._id, status: 'pending' }, { status: 'accepted' });
    res.redirect('/org/dashboard');
  } catch(e) {
    console.error(e);
    res.redirect('/org/dashboard');
  }
};

exports.completeSession = async (req,res)=>{
  if(!req.user || req.user.role !== 'organization') return res.redirect('/auth/login');
  try {
    const org = await Organization.findOne({ user: req.user._id });
    if(!org) return res.redirect('/org/sessions');
    await Session.findOneAndUpdate({ _id: req.params.id, organization: org._id, status: 'accepted' }, { status: 'completed' });
    res.redirect('/org/sessions');
  } catch(e) {
    console.error(e);
    res.redirect('/org/sessions');
  }
};

exports.analytics = async (req,res)=> {
  if(!req.user || req.user.role !== 'organization') return res.redirect('/auth/login');
  const org = await Organization.findOne({ user: req.user._id });
  if(!org) return res.render('organization/organization-analytics', { user: req.user, stats: { mentees: 0, sessions: 0, avgRating: 0 } });
  
  const sessions = await Session.find({ organization: org._id }).lean().catch(()=>[]);
  const menteeIds = [...new Set(sessions.map(s=>s.mentee?.toString()).filter(Boolean))];
  const sessionFeedbacks = await Feedback.find({ session: { $in: sessions.map(s=>s._id) } }).lean().catch(()=>[]);
  
  const stats = {
    mentees: menteeIds.length,
    sessions: sessions.length,
    completed: sessions.filter(s=>s.status==='completed').length,
    avgRating: sessionFeedbacks.length > 0 ? (sessionFeedbacks.reduce((sum,f)=>sum+(f.rating||0),0) / sessionFeedbacks.length).toFixed(1) : 0
  };
  
  res.render('organization/organization-analytics', { user: req.user, stats });
};

exports.profile = async (req,res)=> {
  if(!req.user || req.user.role !== 'organization') return res.redirect('/auth/login');
  const org = await Organization.findOne({ user: req.user._id }).lean().catch(()=>null);
  res.render('organization/organization-profile', { user: req.user, organization: org });
};

exports.updateProfile = async (req,res)=>{
  if(!req.user || req.user.role !== 'organization') return res.redirect('/auth/login');
  try {
    const data = {
      programName: req.body.programName,
      website: req.body.website,
      description: req.body.description
    };
    await Organization.findOneAndUpdate({ user: req.user._id }, data, { upsert:true, new:true });
    if(req.file) {
      await User.findByIdAndUpdate(req.user._id, { profilePicture: `/uploads/profiles/${req.file.filename}` });
    }
    res.redirect('/org/profile');
  } catch(e) {
    console.error(e);
    res.redirect('/org/profile');
  }
};
