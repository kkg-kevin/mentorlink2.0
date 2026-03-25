
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
  if(!org) {
    const rangeDays = 30;
    const compareEnabled = false;
    const emptyRatings = [5,4,3,2,1].map(stars => ({ stars, count: 0, percent: 0 }));
    const emptyFunnel = [
      { label: 'Requested', count: 0, rate: null, isFirst: true },
      { label: 'Accepted', count: 0, rate: 0, isFirst: false },
      { label: 'Completed', count: 0, rate: 0, isFirst: false },
      { label: 'Feedback', count: 0, rate: 0, isFirst: false }
    ];
    const neutralTrend = { trendValue: '-', trendLabel: 'Compare off', trendClass: 'trend-neutral', trendIcon: 'bi-dash' };
    const kpis = [
      { label: 'Mentees', value: 0, meta: 'Unique mentees in range.', icon: 'bi-people-fill', iconClass: 'green', ...neutralTrend },
      { label: 'Sessions', value: 0, meta: 'Total sessions scheduled.', icon: 'bi-calendar-event', iconClass: 'yellow', ...neutralTrend },
      { label: 'Completed', value: 0, meta: 'Completed sessions in range.', icon: 'bi-check2-circle', iconClass: 'blue', ...neutralTrend },
      { label: 'Avg Rating', value: '0.0', meta: 'Based on 0 feedback', icon: 'bi-star-fill', iconClass: 'purple', ...neutralTrend }
    ];
    return res.render('organization/organization-analytics', { 
      user: req.user, 
      stats: { mentees: 0, sessions: 0, completed: 0, avgRating: '0.0', ratingCount: 0 },
      rangeDays,
      compareEnabled,
      rangeLabel: 'Last 30 days',
      compareLabel: 'Previous 30 days',
      kpis,
      ratingsBreakdown: emptyRatings,
      responseRate: { value: 0, label: '0 of 0 completed sessions', statusClass: 'status-bad', target: 'Target 60-70%' },
      funnelSteps: emptyFunnel,
      strengthThemes: [],
      improvementThemes: []
    });
  }
  
  const sessions = await Session.find({ organization: org._id }).lean().catch(()=>[]);
  const menteeIds = [...new Set(sessions.map(s=>s.mentee?.toString()).filter(Boolean))];
  const sessionFeedbacks = await Feedback.find({ session: { $in: sessions.map(s=>s._id) }, isHidden: { $ne: true } }).lean().catch(()=>[]);
  
  const rangeDays = [7, 30, 90].includes(parseInt(req.query.range, 10)) ? parseInt(req.query.range, 10) : 30;
  const compareEnabled = req.query.compare === '1' || req.query.compare === 'true';
  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setDate(rangeStart.getDate() - rangeDays);
  const prevRangeEnd = new Date(rangeStart);
  const prevRangeStart = new Date(rangeStart);
  prevRangeStart.setDate(prevRangeStart.getDate() - rangeDays);

  const inRange = (value, start, end) => {
    if (!value) return false;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    return date >= start && date <= end;
  };

  const sessionsInRange = sessions.filter(s => inRange(s.scheduledAt, rangeStart, now));
  const sessionsPrevRange = compareEnabled ? sessions.filter(s => inRange(s.scheduledAt, prevRangeStart, prevRangeEnd)) : [];
  const menteesInRange = [...new Set(sessionsInRange.map(s => s.mentee?.toString()).filter(Boolean))];
  const menteesPrevRange = [...new Set(sessionsPrevRange.map(s => s.mentee?.toString()).filter(Boolean))];
  const completedInRange = sessionsInRange.filter(s => s.status === 'completed').length;
  const completedPrevRange = sessionsPrevRange.filter(s => s.status === 'completed').length;

  const feedbacksInRange = sessionFeedbacks.filter(f => inRange(f.createdAt, rangeStart, now));
  const feedbacksPrevRange = compareEnabled ? sessionFeedbacks.filter(f => inRange(f.createdAt, prevRangeStart, prevRangeEnd)) : [];
  const avgRating = feedbacksInRange.length > 0
    ? (feedbacksInRange.reduce((sum,f)=>sum+(f.rating||0),0) / feedbacksInRange.length).toFixed(1)
    : '0.0';
  const prevAvgRating = feedbacksPrevRange.length > 0
    ? (feedbacksPrevRange.reduce((sum,f)=>sum+(f.rating||0),0) / feedbacksPrevRange.length)
    : 0;

  const buildDelta = (current, previous, isRating = false) => {
    if (!compareEnabled) {
      return { trendValue: '-', trendLabel: 'Compare off', trendClass: 'trend-neutral', trendIcon: 'bi-dash' };
    }
    if (previous === 0) {
      if (current === 0) {
        return { trendValue: '-', trendLabel: 'No prior data', trendClass: 'trend-neutral', trendIcon: 'bi-dash' };
      }
      return { trendValue: 'New', trendLabel: `vs previous ${rangeDays} days`, trendClass: 'trend-up', trendIcon: 'bi-arrow-up-right' };
    }
    if (isRating) {
      const diff = current - previous;
      const formatted = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`;
      return {
        trendValue: formatted,
        trendLabel: `vs previous ${rangeDays} days`,
        trendClass: diff >= 0 ? 'trend-up' : 'trend-down',
        trendIcon: diff >= 0 ? 'bi-arrow-up-right' : 'bi-arrow-down-right'
      };
    }
    const pct = ((current - previous) / previous) * 100;
    const formattedPct = `${pct >= 0 ? '+' : ''}${Math.round(pct)}%`;
    return {
      trendValue: formattedPct,
      trendLabel: `vs previous ${rangeDays} days`,
      trendClass: pct >= 0 ? 'trend-up' : 'trend-down',
      trendIcon: pct >= 0 ? 'bi-arrow-up-right' : 'bi-arrow-down-right'
    };
  };

  const ratingsBreakdown = [5,4,3,2,1].map(stars => {
    const count = feedbacksInRange.filter(f => (f.rating || 0) === stars).length;
    const percent = feedbacksInRange.length > 0 ? Math.round((count / feedbacksInRange.length) * 100) : 0;
    return { stars, count, percent };
  });

  const responseRateValue = completedInRange > 0 ? Math.min(100, Math.round((feedbacksInRange.length / completedInRange) * 100)) : 0;
  const responseRate = {
    value: responseRateValue,
    label: `${feedbacksInRange.length} of ${completedInRange} completed sessions`,
    statusClass: responseRateValue >= 70 ? 'status-good' : responseRateValue >= 60 ? 'status-warn' : 'status-bad',
    target: 'Target 60-70%'
  };

  const funnelRequested = sessionsInRange.length;
  const funnelAccepted = sessionsInRange.filter(s => s.status === 'accepted' || s.status === 'completed').length;
  const funnelCompleted = completedInRange;
  const funnelFeedback = feedbacksInRange.length;
  const funnelSteps = [
    { label: 'Requested', count: funnelRequested, rate: null, isFirst: true },
    { label: 'Accepted', count: funnelAccepted, rate: funnelRequested > 0 ? Math.round((funnelAccepted / funnelRequested) * 100) : 0, isFirst: false },
    { label: 'Completed', count: funnelCompleted, rate: funnelAccepted > 0 ? Math.round((funnelCompleted / funnelAccepted) * 100) : 0, isFirst: false },
    { label: 'Feedback', count: funnelFeedback, rate: funnelCompleted > 0 ? Math.round((funnelFeedback / funnelCompleted) * 100) : 0, isFirst: false }
  ];

  const themeKeywords = {
    'Clear communication': ['clear', 'communication', 'communicative', 'clarity'],
    'Actionable guidance': ['actionable', 'practical', 'guidance', 'advice', 'tips'],
    'Supportive tone': ['support', 'encourag', 'empat', 'helpful', 'patient'],
    'Subject expertise': ['knowledge', 'expert', 'expertise', 'insight', 'skilled', 'experience'],
    'Structured sessions': ['structured', 'structure', 'organized', 'organization', 'plan', 'planning'],
    'Responsive follow-up': ['responsive', 'timely', 'quick', 'fast', 'follow up', 'follow-up']
  };

  const scoreThemes = (items) => {
    const counts = Object.keys(themeKeywords).reduce((acc, label) => {
      acc[label] = 0;
      return acc;
    }, {});
    items.forEach(f => {
      const text = (f.comment || '').toLowerCase();
      Object.entries(themeKeywords).forEach(([label, keywords]) => {
        if (keywords.some(word => text.includes(word))) {
          counts[label] += 1;
        }
      });
    });
    return Object.entries(counts)
      .filter(([,count]) => count > 0)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, count]) => ({ label, count }));
  };

  const strengthThemes = scoreThemes(feedbacksInRange.filter(f => (f.rating || 0) >= 4));
  const improvementThemes = scoreThemes(feedbacksInRange.filter(f => (f.rating || 0) <= 3));

  const stats = {
    mentees: menteesInRange.length,
    sessions: sessionsInRange.length,
    completed: completedInRange,
    avgRating,
    ratingCount: feedbacksInRange.length
  };

  const kpis = [
    {
      label: 'Mentees',
      value: menteesInRange.length,
      meta: 'Unique mentees in range.',
      icon: 'bi-people-fill',
      iconClass: 'green',
      ...buildDelta(menteesInRange.length, menteesPrevRange.length)
    },
    {
      label: 'Sessions',
      value: sessionsInRange.length,
      meta: 'Total sessions scheduled.',
      icon: 'bi-calendar-event',
      iconClass: 'yellow',
      ...buildDelta(sessionsInRange.length, sessionsPrevRange.length)
    },
    {
      label: 'Completed',
      value: completedInRange,
      meta: 'Completed sessions in range.',
      icon: 'bi-check2-circle',
      iconClass: 'blue',
      ...buildDelta(completedInRange, completedPrevRange)
    },
    {
      label: 'Avg Rating',
      value: avgRating,
      meta: `Based on ${feedbacksInRange.length} feedback`,
      icon: 'bi-star-fill',
      iconClass: 'purple',
      ...buildDelta(parseFloat(avgRating) || 0, prevAvgRating, true)
    }
  ];

  res.render('organization/organization-analytics', { 
    user: req.user, 
    stats,
    rangeDays,
    compareEnabled,
    rangeLabel: `Last ${rangeDays} days`,
    compareLabel: `Previous ${rangeDays} days`,
    kpis,
    ratingsBreakdown,
    responseRate,
    funnelSteps,
    strengthThemes,
    improvementThemes
  });
};

exports.profile = async (req,res)=> {
  if(!req.user || req.user.role !== 'organization') return res.redirect('/auth/login');
  const org = await Organization.findOne({ user: req.user._id }).lean().catch(()=>null);

  let profileCompleteness = 0;
  let profileIncomplete = true;
  if (org) {
    const fields = [
      org.programName, org.website, org.description, org.location,
      org.linkedinProfile, org.programType, org.sessionFormat,
      org.targetLevel, org.programDuration,
      org.focusAreas && org.focusAreas.length > 0,
      org.memberCapacity > 0,
      org.openToNewMembers !== undefined
    ];
    const filled = fields.filter(Boolean).length;
    profileCompleteness = Math.round((filled / fields.length) * 100);
    profileIncomplete = profileCompleteness < 100;
  }

  res.render('organization/organization-profile', { user: req.user, organization: org, profileCompleteness, profileIncomplete });
};

exports.updateProfile = async (req,res)=>{
  if(!req.user || req.user.role !== 'organization') return res.redirect('/auth/login');
  try {
    const data = {
      programName: req.body.programName,
      website: req.body.website,
      description: req.body.description,
      location: req.body.location,
      linkedinProfile: req.body.linkedinProfile,
      focusAreas: (req.body.focusAreas||'').split(',').map(s=>s.trim()).filter(Boolean),
      programType: req.body.programType,
      sessionFormat: req.body.sessionFormat,
      targetLevel: req.body.targetLevel,
      programDuration: req.body.programDuration,
      openToNewMembers: req.body.openToNewMembers === 'on' || req.body.openToNewMembers === 'true',
      memberCapacity: parseInt(req.body.memberCapacity) || 0
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
