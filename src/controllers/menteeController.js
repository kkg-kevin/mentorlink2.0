

const Mentor = require('../models/Mentor');

const Organization = require('../models/Organization');

const Mentee = require('../models/Mentee');

const Session = require('../models/Session');

const Feedback = require('../models/Feedback');
const MentorFeedback = require('../models/MentorFeedback');

const User = require('../models/User');

const { getMentorRatingMap } = require('../utils/mentorRatings');



function parseScheduledAt(value) {

  const scheduledAt = new Date(value);

  if (Number.isNaN(scheduledAt.getTime())) return null;

  return scheduledAt;

}



function sanitizeNotes(value) {

  return typeof value === 'string' ? value.trim().slice(0, 1000) : '';

}



function getProfilePicture(user) {

  return user && user.profilePicture ? user.profilePicture : '/images/Logo 1.png';

}



exports.dashboard = async (req,res)=>{

  if(!req.user || req.user.role !== 'mentee') return res.redirect('/auth/login');

  const mentee = await Mentee.findOne({ user: req.user._id });

  const mentors = await Mentor.find().populate('user').lean().catch(()=>[]);

  const companies = await Organization.find().populate('user').lean().catch(()=>[]);

  const sessions = mentee

    ? await Session.find({ mentee: mentee._id }).populate('mentor').populate({path:'mentor', populate:{path:'user'}}).lean().catch(()=>[])

    : [];

  const mentorRatings = await getMentorRatingMap(mentors.map((mentor) => mentor.user?._id));

  

  const mentorList = mentors.map((m) => {

    const rating = mentorRatings.get(m.user?._id?.toString()) || { avgRating: 0, ratingCount: 0 };



    return {

      id: m._id,

      name: m.user ? m.user.name : 'Mentor',

      expertise: m.specialization || m.industry,

      bio: m.bio || '',

      photo: getProfilePicture(m.user),

      availability: m.availability || 'Available',

      avgRating: rating.avgRating,

      ratingCount: rating.ratingCount,

      // Full profile fields for the profile modal

      phone: m.phone || '',

      industry: m.industry || '',

      specialization: m.specialization || '',

      experienceYears: m.experienceYears || 0,

      company: m.company || '',

      position: m.position || '',

      linkedinProfile: m.linkedinProfile || '',

      website: m.website || '',

      industries: m.industries || [],

      specialties: m.specialties || [],

      languages: m.languages || [],

      menteeLevel: m.menteeLevel || '',

      sessionFormat: m.sessionFormat || '',

      responseTime: m.responseTime || '',

      isProfilePublic: m.isProfilePublic,

      openToNewMentees: m.openToNewMentees,

      mentorshipCapacity: m.mentorshipCapacity || 0

    };

  });

  const companyList = companies.map(c=>({
    id: c._id,
    name: c.programName || c.user?.name || 'Company',
    field: c.website || '',
    logo: getProfilePicture(c.user),
    description: c.description || '',
    // Full profile fields
    website: c.website || '',
    location: c.location || '',
    linkedinProfile: c.linkedinProfile || '',
    focusAreas: c.focusAreas || [],
    programType: c.programType || '',
    sessionFormat: c.sessionFormat || '',
    targetLevel: c.targetLevel || '',
    programDuration: c.programDuration || '',
    openToNewMembers: c.openToNewMembers,
    memberCapacity: c.memberCapacity || 0
  }));

  

  res.render('mentee/mentee-page', { mentors: mentorList, companies: companyList, user: req.user, sessions: sessions.slice(0, 3) });

};



exports.sessions = async (req,res)=> {

  if(!req.user || req.user.role !== 'mentee') return res.redirect('/auth/login');

  const mentee = await Mentee.findOne({ user: req.user._id });

  if(!mentee) return res.render('mentee/mentee-session', { user: req.user, sessions: [], stats: { activeMentors: 0, completedSessions: 0 } });

  const sessions = await Session.find({ mentee: mentee._id })

    .populate('mentor')

    .populate({path:'mentor', populate:{path:'user'}})

    .populate('organization')

    .populate({path:'organization', populate:{path:'user'}})

    .lean()

    .catch(()=>[]);

  

  // Calculate stats - only count accepted/completed sessions

  const acceptedOrCompletedSessions = sessions.filter(s => s.status === 'accepted' || s.status === 'completed');

  const uniqueMentors = [...new Set(acceptedOrCompletedSessions.filter(s => s.mentor).map(s => s.mentor._id.toString()))];

  const completedSessions = sessions.filter(s => s.status === 'completed').length;

  const stats = {

    activeMentors: uniqueMentors.length,

    completedSessions: completedSessions

  };

  

  res.render('mentee/mentee-session', { user: req.user, sessions, stats });

};



exports.sessionDetails = async (req,res)=> {

  if(!req.user || req.user.role !== 'mentee') return res.redirect('/auth/login');

  const mentee = await Mentee.findOne({ user: req.user._id }).lean().catch(()=>null);

  if(!mentee) return res.render('mentee/mentee-session', { user: req.user, sessions: [] });

  const session = await Session.findOne({ _id: req.params.id, mentee: mentee._id })

    .populate('mentor')

    .populate({path:'mentor', populate:{path:'user'}})

    .populate('organization')

    .populate({path:'organization', populate:{path:'user'}})

    .lean()

    .catch(()=>null);

  res.render('mentee/mentee-session', { user: req.user, sessions: session ? [session] : [] });

};



exports.feedback = async (req,res)=> {

  if(!req.user || req.user.role !== 'mentee') return res.redirect('/auth/login');

  const mentee = await Mentee.findOne({ user: req.user._id });

  if(!mentee) return res.render('mentee/mentee-feedback', { user: req.user, sessions: [], feedbacks: [], mentorFeedbacks: [] });

  const sessions = await Session.find({ mentee: mentee._id, status: 'completed' })

    .populate('mentor')

    .populate({path:'mentor', populate:{path:'user'}})

    .populate('organization')

    .populate({path:'organization', populate:{path:'user'}})

    .lean()

    .catch(()=>[]);

  const feedbacks = await Feedback.find({ from: req.user._id }).populate('to').lean().catch(()=>[]);
  const mentorFeedbacksRaw = await MentorFeedback.find({ to: req.user._id, isHidden: { $ne: true } })
    .populate({
      path: 'session',
      populate: { path: 'mentor', populate: { path: 'user' } }
    })
    .lean()
    .catch(()=>[]);

  const mentorFeedbacks = mentorFeedbacksRaw
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(feedback => ({
      id: feedback._id,
      comment: feedback.comment,
      createdAt: feedback.createdAt,
      sessionDate: feedback.session?.scheduledAt,
      mentorName: feedback.session?.mentor?.user?.name || 'Mentor',
      mentorAvatar: feedback.session?.mentor?.user?.profilePicture || '/images/Logo 1.png'
    }));

  

  // Mark sessions that already have feedback

  const sessionsWithFeedbackStatus = sessions.map(session => {

    const hasFeedback = feedbacks.some(feedback => 

      feedback.session && feedback.session.toString() === session._id.toString()

    );

    return { ...session, hasFeedback };

  });

  

  res.render('mentee/mentee-feedback', { user: req.user, sessions: sessionsWithFeedbackStatus, feedbacks, mentorFeedbacks });

};



exports.submitFeedback = async (req,res)=>{

  if(!req.user || req.user.role !== 'mentee') return res.redirect('/auth/login');

  try {

    const { sessionId, rating, comment } = req.body;

    const mentee = await Mentee.findOne({ user: req.user._id });

    if(!mentee) return res.redirect('/mentee/feedback?error=failed');

    

    // Check if feedback already exists for this session

    const existingFeedback = await Feedback.findOne({ session: sessionId, from: req.user._id });

    if(existingFeedback) {

      console.log('Feedback already exists for this session');

      return res.redirect('/mentee/feedback?error=duplicate');

    }



    const session = await Session.findOne({ _id: sessionId, mentee: mentee._id, status: 'completed' })

      .populate({ path: 'mentor', populate: { path: 'user' } })

      .populate({ path: 'organization', populate: { path: 'user' } });

    if(!session) return res.redirect('/mentee/feedback?error=failed');



    const recipientId = session.mentor?.user?._id || session.organization?.user?._id;

    const numericRating = parseInt(rating, 10);

    const trimmedComment = typeof comment === 'string' ? comment.trim() : '';

    if(!recipientId || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5 || !trimmedComment) {

      return res.redirect('/mentee/feedback?error=failed');

    }

    

    const feedback = new Feedback({ session: sessionId, from: req.user._id, to: recipientId, rating: numericRating, comment: trimmedComment });

    await feedback.save();

    res.redirect('/mentee/feedback?success=true');

  } catch(e) {

    console.error(e);

    res.redirect('/mentee/feedback?error=failed');

  }

};

exports.mentorFeedback = async (req,res)=> {
  if(!req.user || req.user.role !== 'mentee') return res.redirect('/auth/login');
  const mentee = await Mentee.findOne({ user: req.user._id });
  if(!mentee) return res.render('mentee/mentee-mentor-feedback', { user: req.user, feedbacks: [] });

  const feedbacks = await MentorFeedback.find({ to: req.user._id, isHidden: { $ne: true } })
    .populate({
      path: 'session',
      populate: { path: 'mentor', populate: { path: 'user' } }
    })
    .lean()
    .catch(()=>[]);

  const feedbackCards = feedbacks
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(feedback => ({
      id: feedback._id,
      comment: feedback.comment,
      createdAt: feedback.createdAt,
      sessionDate: feedback.session?.scheduledAt,
      mentorName: feedback.session?.mentor?.user?.name || 'Mentor',
      mentorAvatar: feedback.session?.mentor?.user?.profilePicture || '/images/Logo 1.png',
      sessionId: feedback.session?._id
    }));

  res.render('mentee/mentee-mentor-feedback', { user: req.user, feedbacks: feedbackCards });
};



exports.requestSession = async (req,res)=>{

  if(!req.user || req.user.role !== 'mentee') return res.redirect('/auth/login');

  try {

    const { mentorId, scheduledAt, notes } = req.body;

    const scheduledDate = parseScheduledAt(scheduledAt);

    if(!mentorId || !scheduledDate) return res.redirect('/mentee/dashboard');



    const mentor = await Mentor.findById(mentorId).lean();

    if(!mentor) return res.redirect('/mentee/dashboard');



    const mentee = await Mentee.findOneAndUpdate(

      { user: req.user._id },

      { $setOnInsert: { user: req.user._id } },

      { upsert: true, new: true }

    );



    const duplicateSession = await Session.findOne({

      mentee: mentee._id,

      mentor: mentorId,

      organization: null,

      scheduledAt: scheduledDate,

      status: { $in: ['pending', 'accepted'] }

    }).lean();

    if(duplicateSession) return res.redirect('/mentee/sessions');



    const session = new Session({ mentee: mentee._id, mentor: mentorId, scheduledAt: scheduledDate, status: 'pending', notes: sanitizeNotes(notes) });

    await session.save();

    res.redirect('/mentee/sessions');

  } catch(e) {

    console.error(e);

    res.redirect('/mentee/dashboard');

  }

};



exports.requestOrganizationSession = async (req,res)=>{

  if(!req.user || req.user.role !== 'mentee') return res.redirect('/auth/login');

  try {

    const { organizationId, mentorId, scheduledAt, notes } = req.body;

    const scheduledDate = parseScheduledAt(scheduledAt);

    if(!organizationId || !scheduledDate) return res.redirect('/mentee/dashboard');



    const organization = await Organization.findById(organizationId).lean();

    if(!organization) return res.redirect('/mentee/dashboard');



    if(mentorId) {

      const mentor = await Mentor.findById(mentorId).lean();

      if(!mentor) return res.redirect('/mentee/dashboard');

    }



    const mentee = await Mentee.findOneAndUpdate(

      { user: req.user._id },

      { $setOnInsert: { user: req.user._id } },

      { upsert: true, new: true }

    );



    const duplicateSession = await Session.findOne({

      mentee: mentee._id,

      organization: organizationId,

      mentor: mentorId || null,

      scheduledAt: scheduledDate,

      status: { $in: ['pending', 'accepted'] }

    }).lean();

    if(duplicateSession) return res.redirect('/mentee/sessions');



    const session = new Session({ 

      mentee: mentee._id, 

      organization: organizationId,

      mentor: mentorId || null,

      scheduledAt: scheduledDate, 

      status: 'pending', 

      notes: sanitizeNotes(notes)

    });

    await session.save();

    res.redirect('/mentee/sessions');

  } catch(e) {

    console.error(e);

    res.redirect('/mentee/dashboard');

  }

};



exports.cancelSession = async (req,res)=>{

  if(!req.user || req.user.role !== 'mentee') return res.redirect('/auth/login');

  try {

    const mentee = await Mentee.findOne({ user: req.user._id });

    if(!mentee) return res.redirect('/mentee/sessions');

    await Session.findOneAndUpdate({ _id: req.params.id, mentee: mentee._id, status: { $in: ['pending', 'accepted'] } }, { status: 'cancelled' });

    res.redirect('/mentee/sessions');

  } catch(e) {

    console.error(e);

    res.redirect('/mentee/sessions');

  }

};



exports.profile = async (req,res)=>{

  if(!req.user || req.user.role !== 'mentee') return res.redirect('/auth/login');

  const mentee = await Mentee.findOne({ user: req.user._id }).lean().catch(()=>null);

  

  // Calculate profile completeness safely

  let profileCompleteness = 0;

  let profileIncomplete = true;

  if (mentee) {

    const profileFields = [

      'phone', 'educationLevel', 'goals', 'skills',

      'location', 'currentRole', 'institution', 'learningStyle',

      'communicationPreference', 'mentorshipExperience', 'sessionFrequency'

    ];

    let filledFields = 0;

    profileFields.forEach(field => {

      if (mentee[field] && (Array.isArray(mentee[field]) ? mentee[field].length > 0 : mentee[field].toString().trim() !== '')) {

        filledFields++;

      }

    });

    profileCompleteness = Math.round((filledFields / profileFields.length) * 100);

    profileIncomplete = profileCompleteness < 100;

  }

  

  res.render('mentee/mentee-profile', { user: req.user, mentee, profileCompleteness, profileIncomplete });

};



exports.updateProfile = async (req,res)=>{

  if(!req.user || req.user.role !== 'mentee') return res.redirect('/auth/login');

  try {

    const data = { 

      phone: req.body.phone, 

      educationLevel: req.body.education, 

      goals: req.body.goal, 

      skills: (req.body.skills||'').split(',').map(s=>s.trim()).filter(Boolean),

      location: req.body.location,

      currentRole: req.body.currentRole,

      institution: req.body.institution,

      learningStyle: req.body.learningStyle,

      communicationPreference: req.body.communicationPreference,

      mentorshipExperience: req.body.mentorshipExperience,

      sessionFrequency: req.body.sessionFrequency,

      isProfilePublic: req.body.isProfilePublic === 'true',

      openToMentorship: req.body.openToMentorship === 'true'

    };

    await Mentee.findOneAndUpdate({ user: req.user._id }, data, { upsert:true, new:true });

    if(req.file) {

      await User.findByIdAndUpdate(req.user._id, { profilePicture: `/uploads/profiles/${req.file.filename}` });

    }

    res.redirect('/mentee/profile');

  } catch(e) {

    console.error(e);

    res.redirect('/mentee/profile');

  }

};

