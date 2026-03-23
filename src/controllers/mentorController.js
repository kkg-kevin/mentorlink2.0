
const Mentor = require('../models/Mentor');
const Mentee = require('../models/Mentee');
const Session = require('../models/Session');
const Feedback = require('../models/Feedback');
const User = require('../models/User');
const { getMentorRatingMap, getMentorReviews } = require('../utils/mentorRatings');

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
  const mentorRatingMap = await getMentorRatingMap([req.user._id]);
  const mentorRating = mentorRatingMap.get(req.user._id.toString()) || { avgRating: 0, ratingCount: 0 };
  const recentReviews = await getMentorReviews(req.user._id, 4);
  
  // Calculate profile completeness safely
  let profileCompleteness = 0;
  let profileIncomplete = true;
  if (mentor) {
    const profileFields = [
      'phone', 'industry', 'experienceYears', 'specialization', 'availability', 'bio',
      'company', 'position', 'linkedinProfile', 'website', 'industries', 'specialties', 
      'languages', 'menteeLevel', 'sessionFormat', 'responseTime'
    ];
    let filledFields = 0;
    profileFields.forEach(field => {
      if (mentor[field] && (Array.isArray(mentor[field]) ? mentor[field].length > 0 : mentor[field].toString().trim() !== '')) {
        filledFields++;
      }
    });
    profileCompleteness = Math.round((filledFields / profileFields.length) * 100);
    profileIncomplete = profileCompleteness < 100;
  }
  
  res.render('mentor/mentor-profile', { 
    user: req.user, 
    mentor, 
    mentorRating, 
    recentReviews, 
    hasRecentReviews: recentReviews.length > 0,
    profileCompleteness,
    profileIncomplete
  });
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
      bio: req.body.bio,
      // New optional fields
      company: req.body.company,
      position: req.body.position,
      linkedinProfile: req.body.linkedinProfile,
      website: req.body.website,
      industries: (req.body.industries||'').split(',').map(s=>s.trim()).filter(Boolean),
      specialties: (req.body.specialties||'').split(',').map(s=>s.trim()).filter(Boolean),
      languages: (req.body.languages||'').split(',').map(s=>s.trim()).filter(Boolean),
      menteeLevel: req.body.menteeLevel,
      sessionFormat: req.body.sessionFormat,
      responseTime: req.body.responseTime,
      isProfilePublic: req.body.isProfilePublic === 'true',
      openToNewMentees: req.body.openToNewMentees === 'true',
      mentorshipCapacity: parseInt(req.body.mentorshipCapacity) || 5
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
