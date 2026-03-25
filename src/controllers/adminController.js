const User = require('../models/User');
const Mentor = require('../models/Mentor');
const Mentee = require('../models/Mentee');
const Organization = require('../models/Organization');
const Session = require('../models/Session');
const AdminAudit = require('../models/AdminAudit');
const Feedback = require('../models/Feedback');
const MentorFeedback = require('../models/MentorFeedback');
const Announcement = require('../models/Announcement');

async function logAdminAction(adminId, action, targetUserId, metadata) {
  try {
    await AdminAudit.create({
      admin: adminId,
      action,
      targetUser: targetUserId || undefined,
      metadata: metadata || {}
    });
  } catch (error) {
    console.error('Admin audit log error:', error);
  }
}

function buildCsv(data, headers) {
  const escapeValue = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  };
  const headerLine = headers.map(h => escapeValue(h.label)).join(',');
  const rows = data.map(row => headers.map(h => escapeValue(row[h.key])).join(','));
  return [headerLine, ...rows].join('\n');
}

// Admin Dashboard - Show all users
exports.dashboard = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.redirect('/auth/login');
  
  try {
    // Get all users
    const users = await User.find({ role: { $ne: 'admin' } }).lean();
    const normalizedUsers = users.map(user => ({
      ...user,
      status: user.status || 'active'
    }));
    
    // Calculate stats
    const stats = {
      totalUsers: normalizedUsers.length,
      mentors: normalizedUsers.filter(u => u.role === 'mentor').length,
      mentees: normalizedUsers.filter(u => u.role === 'mentee').length,
      organizations: normalizedUsers.filter(u => u.role === 'organization').length
    };

    const auditsRaw = await AdminAudit.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .populate('admin', 'name email')
      .populate('targetUser', 'name email')
      .lean()
      .catch(() => []);

    const actionLabels = {
      update_role: 'Role updated',
      update_status: 'Status updated',
      delete_user: 'User deleted',
      hide_feedback: 'Feedback hidden',
      restore_feedback: 'Feedback restored',
      create_announcement: 'Announcement created',
      toggle_announcement: 'Announcement toggled'
    };
    const audits = auditsRaw.map(audit => ({
      ...audit,
      actionLabel: actionLabels[audit.action] || audit.action
    }));

    const sessions = await Session.find().lean().catch(() => []);
    const totalSessions = sessions.length;
    const pendingSessions = sessions.filter(s => s.status === 'pending').length;
    const acceptedSessions = sessions.filter(s => s.status === 'accepted').length;
    const completedSessions = sessions.filter(s => s.status === 'completed').length;
    const cancelledSessions = sessions.filter(s => s.status === 'cancelled').length;
    const acceptedOrCompleted = acceptedSessions + completedSessions;
    const acceptanceRate = totalSessions > 0 ? Math.round((acceptedOrCompleted / totalSessions) * 100) : 0;
    const completionRate = acceptedOrCompleted > 0 ? Math.round((completedSessions / acceptedOrCompleted) * 100) : 0;
    const cancellationRate = totalSessions > 0 ? Math.round((cancelledSessions / totalSessions) * 100) : 0;

    const visibleFeedbackCount = await Feedback.countDocuments({ isHidden: { $ne: true } }).catch(() => 0);
    const visibleMentorFeedbackCount = await MentorFeedback.countDocuments({ isHidden: { $ne: true } }).catch(() => 0);
    const platformStats = {
      totalSessions,
      pendingSessions,
      acceptedSessions,
      completedSessions,
      cancelledSessions,
      acceptanceRate,
      completionRate,
      cancellationRate,
      feedbackVolume: visibleFeedbackCount + visibleMentorFeedbackCount
    };

    const mentors = await Mentor.find().populate('user', 'name email').lean().catch(() => []);
    const mentorIds = mentors.map(m => m._id).filter(Boolean);
    const mentorUserIds = mentors.map(m => m.user?._id).filter(Boolean);
    const mentorSessions = mentorIds.length > 0
      ? await Session.find({ mentor: { $in: mentorIds } }).lean().catch(() => [])
      : [];
    const mentorFeedbacks = mentorUserIds.length > 0
      ? await Feedback.find({ to: { $in: mentorUserIds }, isHidden: { $ne: true } }).lean().catch(() => [])
      : [];

    const mentorSessionMap = new Map();
    mentorSessions.forEach(session => {
      const key = session.mentor?.toString();
      if (!key) return;
      const current = mentorSessionMap.get(key) || { total: 0, cancelled: 0 };
      current.total += 1;
      if (session.status === 'cancelled') current.cancelled += 1;
      mentorSessionMap.set(key, current);
    });

    const mentorFeedbackMap = new Map();
    mentorFeedbacks.forEach(feedback => {
      const key = feedback.to?.toString();
      if (!key) return;
      const current = mentorFeedbackMap.get(key) || { totalRating: 0, count: 0 };
      current.totalRating += Number(feedback.rating) || 0;
      current.count += 1;
      mentorFeedbackMap.set(key, current);
    });

    const mentorFlags = mentors.map(mentor => {
      const sessionStats = mentorSessionMap.get(mentor._id.toString()) || { total: 0, cancelled: 0 };
      const feedbackStats = mentorFeedbackMap.get(mentor.user?._id?.toString()) || { totalRating: 0, count: 0 };
      const avgRating = feedbackStats.count > 0
        ? Number((feedbackStats.totalRating / feedbackStats.count).toFixed(1))
        : null;
      const cancelRate = sessionStats.total > 0
        ? Math.round((sessionStats.cancelled / sessionStats.total) * 100)
        : 0;
      const flags = [];
      if (avgRating !== null && feedbackStats.count >= 3 && avgRating < 3.5) flags.push('Low rating');
      if (sessionStats.total >= 5 && cancelRate >= 30) flags.push('High cancellations');
      return {
        userId: mentor.user?._id,
        name: mentor.user?.name || 'Mentor',
        email: mentor.user?.email || '',
        avgRating: avgRating !== null ? avgRating : '-',
        ratingCount: feedbackStats.count,
        cancelRate,
        totalSessions: sessionStats.total,
        flags
      };
    }).filter(item => item.flags.length > 0);

    const organizations = await Organization.find().populate('user', 'name email').lean().catch(() => []);
    const orgIds = organizations.map(org => org._id).filter(Boolean);
    const orgUserIds = organizations.map(org => org.user?._id).filter(Boolean);
    const orgSessions = orgIds.length > 0
      ? await Session.find({ organization: { $in: orgIds } }).lean().catch(() => [])
      : [];
    const orgFeedbacks = orgUserIds.length > 0
      ? await Feedback.find({ to: { $in: orgUserIds }, isHidden: { $ne: true } }).lean().catch(() => [])
      : [];

    const orgSessionMap = new Map();
    orgSessions.forEach(session => {
      const key = session.organization?.toString();
      if (!key) return;
      const current = orgSessionMap.get(key) || { total: 0, cancelled: 0 };
      current.total += 1;
      if (session.status === 'cancelled') current.cancelled += 1;
      orgSessionMap.set(key, current);
    });

    const orgFeedbackMap = new Map();
    orgFeedbacks.forEach(feedback => {
      const key = feedback.to?.toString();
      if (!key) return;
      const current = orgFeedbackMap.get(key) || { totalRating: 0, count: 0 };
      current.totalRating += Number(feedback.rating) || 0;
      current.count += 1;
      orgFeedbackMap.set(key, current);
    });

    const organizationFlags = organizations.map(org => {
      const sessionStats = orgSessionMap.get(org._id.toString()) || { total: 0, cancelled: 0 };
      const feedbackStats = orgFeedbackMap.get(org.user?._id?.toString()) || { totalRating: 0, count: 0 };
      const avgRating = feedbackStats.count > 0
        ? Number((feedbackStats.totalRating / feedbackStats.count).toFixed(1))
        : null;
      const cancelRate = sessionStats.total > 0
        ? Math.round((sessionStats.cancelled / sessionStats.total) * 100)
        : 0;
      const flags = [];
      if (avgRating !== null && feedbackStats.count >= 3 && avgRating < 3.5) flags.push('Low rating');
      if (sessionStats.total >= 5 && cancelRate >= 30) flags.push('High cancellations');
      return {
        userId: org.user?._id,
        name: org.programName || org.user?.name || 'Organization',
        email: org.user?.email || '',
        avgRating: avgRating !== null ? avgRating : '-',
        ratingCount: feedbackStats.count,
        cancelRate,
        totalSessions: sessionStats.total,
        flags
      };
    }).filter(item => item.flags.length > 0);

    const recentMenteeFeedbacks = await Feedback.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('from', 'name email')
      .populate('to', 'name email role')
      .lean()
      .catch(() => []);
    const recentMentorFeedbacks = await MentorFeedback.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('from', 'name email')
      .populate('to', 'name email')
      .lean()
      .catch(() => []);

    const buildExcerpt = (text, limit = 120) => {
      if (!text) return '';
      const trimmed = text.trim();
      if (trimmed.length <= limit) return trimmed;
      return `${trimmed.slice(0, limit)}...`;
    };

    const moderationQueue = [
      ...recentMenteeFeedbacks.map(feedback => ({
        id: feedback._id,
        type: 'mentee',
        typeLabel: 'Mentee feedback',
        fromName: feedback.from?.name || 'Mentee',
        toName: feedback.to?.name || 'Recipient',
        toRole: feedback.to?.role || '',
        createdAt: feedback.createdAt,
        isHidden: feedback.isHidden === true,
        comment: buildExcerpt(feedback.comment)
      })),
      ...recentMentorFeedbacks.map(feedback => ({
        id: feedback._id,
        type: 'mentor',
        typeLabel: 'Mentor feedback',
        fromName: feedback.from?.name || 'Mentor',
        toName: feedback.to?.name || 'Mentee',
        toRole: 'mentee',
        createdAt: feedback.createdAt,
        isHidden: feedback.isHidden === true,
        comment: buildExcerpt(feedback.comment)
      }))
    ].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);

    const now = new Date();
    const last7 = new Date(now);
    last7.setDate(last7.getDate() - 7);
    const last30 = new Date(now);
    last30.setDate(last30.getDate() - 30);
    const newUsers7d = await User.countDocuments({ createdAt: { $gte: last7 }, role: { $ne: 'admin' } }).catch(() => 0);
    const newUsers30d = await User.countDocuments({ createdAt: { $gte: last30 }, role: { $ne: 'admin' } }).catch(() => 0);
    const newSessions7d = await Session.countDocuments({ scheduledAt: { $gte: last7 } }).catch(() => 0);
    const newSessions30d = await Session.countDocuments({ scheduledAt: { $gte: last30 } }).catch(() => 0);

    const cohortStats = {
      newUsers7d,
      newUsers30d,
      newSessions7d,
      newSessions30d
    };

    const announcements = await Announcement.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .populate('createdBy', 'name email')
      .lean()
      .catch(() => []);
    
    res.render('admin/admin-dashboard', { 
      user: req.user, 
      users: normalizedUsers, 
      stats, 
      audits,
      platformStats,
      mentorFlags,
      organizationFlags,
      moderationQueue,
      cohortStats,
      announcements
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.render('admin/admin-dashboard', { 
      user: req.user, 
      users: [], 
      stats: { totalUsers: 0, mentors: 0, mentees: 0, organizations: 0 }, 
      audits: [],
      platformStats: { totalSessions: 0, pendingSessions: 0, acceptedSessions: 0, completedSessions: 0, cancelledSessions: 0, acceptanceRate: 0, completionRate: 0, cancellationRate: 0, feedbackVolume: 0 },
      mentorFlags: [],
      organizationFlags: [],
      moderationQueue: [],
      cohortStats: { newUsers7d: 0, newUsers30d: 0, newSessions7d: 0, newSessions30d: 0 },
      announcements: []
    });
  }
};

// View specific user
exports.viewUser = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.redirect('/auth/login');
  
  try {
    const viewUser = await User.findById(req.params.id).lean();
    
    if (!viewUser) {
      return res.redirect('/admin/dashboard');
    }
    
    // Get role-specific profile data
    let profile = null;
    if (viewUser.role === 'mentor') {
      profile = await Mentor.findOne({ user: viewUser._id }).lean();
    } else if (viewUser.role === 'mentee') {
      profile = await Mentee.findOne({ user: viewUser._id }).lean();
    } else if (viewUser.role === 'organization') {
      profile = await Organization.findOne({ user: viewUser._id }).lean();
    }
    
    res.render('admin/admin-user-view', { 
      user: req.user, 
      viewUser: { ...viewUser, status: viewUser.status || 'active' }, 
      profile 
    });
  } catch (error) {
    console.error('View user error:', error);
    res.redirect('/admin/dashboard');
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.redirect('/auth/login');
  
  try {
    const userId = req.params.id;
    const userToDelete = await User.findById(userId);
    
    if (!userToDelete) {
      return res.redirect('/admin/dashboard');
    }
    
    // Prevent deleting admin accounts
    if (userToDelete.role === 'admin') {
      return res.redirect('/admin/dashboard');
    }
    
    // Delete role-specific profile data
    if (userToDelete.role === 'mentor') {
      const mentor = await Mentor.findOne({ user: userId });
      if (mentor) {
        // Delete all sessions for this mentor
        await Session.deleteMany({ mentor: mentor._id });
        await Mentor.deleteOne({ user: userId });
      }
    } else if (userToDelete.role === 'mentee') {
      const mentee = await Mentee.findOne({ user: userId });
      if (mentee) {
        // Delete all sessions for this mentee
        await Session.deleteMany({ mentee: mentee._id });
        await Mentee.deleteOne({ user: userId });
      }
    } else if (userToDelete.role === 'organization') {
      const org = await Organization.findOne({ user: userId });
      if (org) {
        // Delete all sessions for this organization
        await Session.deleteMany({ organization: org._id });
        await Organization.deleteOne({ user: userId });
      }
    }
    
    // Delete the user
    await User.findByIdAndDelete(userId);

    await logAdminAction(req.user._id, 'delete_user', userId, { role: userToDelete.role, email: userToDelete.email });
    
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Delete user error:', error);
    res.redirect('/admin/dashboard');
  }
};

exports.updateRole = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.redirect('/auth/login');
  try {
    const userId = req.params.id;
    const { role } = req.body;
    const allowedRoles = ['mentor', 'mentee', 'organization'];
    if (!allowedRoles.includes(role)) return res.redirect(`/admin/user/${userId}`);

    const userToUpdate = await User.findById(userId);
    if (!userToUpdate) return res.redirect('/admin/dashboard');
    if (userToUpdate.role === 'admin') return res.redirect(`/admin/user/${userId}`);

    const previousRole = userToUpdate.role;
    if (previousRole !== role) {
      userToUpdate.role = role;
      await userToUpdate.save();

      if (role === 'mentor') {
        const mentor = await Mentor.findOne({ user: userId });
        if (!mentor) await Mentor.create({ user: userId });
      }
      if (role === 'mentee') {
        const mentee = await Mentee.findOne({ user: userId });
        if (!mentee) await Mentee.create({ user: userId });
      }
      if (role === 'organization') {
        const org = await Organization.findOne({ user: userId });
        if (!org) await Organization.create({ user: userId });
      }

      await logAdminAction(req.user._id, 'update_role', userId, { from: previousRole, to: role });
    }

    res.redirect(`/admin/user/${userId}`);
  } catch (error) {
    console.error('Update role error:', error);
    res.redirect('/admin/dashboard');
  }
};

exports.updateStatus = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.redirect('/auth/login');
  try {
    const userId = req.params.id;
    const { status } = req.body;
    const allowedStatus = ['active', 'suspended'];
    if (!allowedStatus.includes(status)) return res.redirect(`/admin/user/${userId}`);

    const userToUpdate = await User.findById(userId);
    if (!userToUpdate) return res.redirect('/admin/dashboard');
    if (userToUpdate.role === 'admin') return res.redirect(`/admin/user/${userId}`);

    const previousStatus = userToUpdate.status || 'active';
    if (previousStatus !== status) {
      userToUpdate.status = status;
      await userToUpdate.save();
      await logAdminAction(req.user._id, 'update_status', userId, { from: previousStatus, to: status });
    }

    res.redirect(`/admin/user/${userId}`);
  } catch (error) {
    console.error('Update status error:', error);
    res.redirect('/admin/dashboard');
  }
};

exports.updateFeedbackVisibility = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.redirect('/auth/login');
  try {
    const { type, id } = req.params;
    const visibility = req.body.visibility;
    const shouldHide = visibility === 'hide';
    const Model = type === 'mentee' ? Feedback : type === 'mentor' ? MentorFeedback : null;
    if (!Model) return res.redirect('/admin/dashboard');

    const feedback = await Model.findById(id);
    if (!feedback) return res.redirect('/admin/dashboard');

    feedback.isHidden = shouldHide;
    await feedback.save();

    await logAdminAction(req.user._id, shouldHide ? 'hide_feedback' : 'restore_feedback', feedback.to, { type });

    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Feedback visibility error:', error);
    res.redirect('/admin/dashboard');
  }
};

exports.createAnnouncement = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.redirect('/auth/login');
  try {
    const title = (req.body.title || '').trim();
    const message = (req.body.message || '').trim();
    const targetRole = req.body.targetRole || 'all';
    if (!title || !message) return res.redirect('/admin/dashboard');

    const announcement = await Announcement.create({
      title,
      message,
      targetRole,
      createdBy: req.user._id
    });
    await logAdminAction(req.user._id, 'create_announcement', null, { announcementId: announcement._id, targetRole });

    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Create announcement error:', error);
    res.redirect('/admin/dashboard');
  }
};

exports.toggleAnnouncement = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.redirect('/auth/login');
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.redirect('/admin/dashboard');
    announcement.isActive = !announcement.isActive;
    await announcement.save();
    await logAdminAction(req.user._id, 'toggle_announcement', null, { announcementId: announcement._id, isActive: announcement.isActive });
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Toggle announcement error:', error);
    res.redirect('/admin/dashboard');
  }
};

exports.exportCsv = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.redirect('/auth/login');
  try {
    const type = req.params.type;
    if (type === 'users') {
      const users = await User.find({ role: { $ne: 'admin' } }).lean().catch(() => []);
      const csv = buildCsv(users, [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role' },
        { key: 'status', label: 'Status' },
        { key: 'createdAt', label: 'CreatedAt' }
      ]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
      return res.send(csv);
    }

    if (type === 'sessions') {
      const sessions = await Session.find()
        .populate('mentor', 'user')
        .populate('mentee', 'user')
        .populate('organization', 'user programName')
        .lean()
        .catch(() => []);
      const rows = sessions.map(session => ({
        id: session._id,
        status: session.status,
        scheduledAt: session.scheduledAt,
        mentorId: session.mentor?._id || '',
        menteeId: session.mentee?._id || '',
        organizationId: session.organization?._id || ''
      }));
      const csv = buildCsv(rows, [
        { key: 'id', label: 'SessionId' },
        { key: 'status', label: 'Status' },
        { key: 'scheduledAt', label: 'ScheduledAt' },
        { key: 'mentorId', label: 'MentorId' },
        { key: 'menteeId', label: 'MenteeId' },
        { key: 'organizationId', label: 'OrganizationId' }
      ]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="sessions.csv"');
      return res.send(csv);
    }

    if (type === 'feedback') {
      const feedbacks = await Feedback.find().lean().catch(() => []);
      const csv = buildCsv(feedbacks, [
        { key: '_id', label: 'FeedbackId' },
        { key: 'session', label: 'SessionId' },
        { key: 'from', label: 'FromUserId' },
        { key: 'to', label: 'ToUserId' },
        { key: 'rating', label: 'Rating' },
        { key: 'comment', label: 'Comment' },
        { key: 'isHidden', label: 'Hidden' },
        { key: 'createdAt', label: 'CreatedAt' }
      ]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=\"feedback.csv\"');
      return res.send(csv);
    }

    if (type === 'mentor-feedback') {
      const feedbacks = await MentorFeedback.find().lean().catch(() => []);
      const csv = buildCsv(feedbacks, [
        { key: '_id', label: 'FeedbackId' },
        { key: 'session', label: 'SessionId' },
        { key: 'from', label: 'FromUserId' },
        { key: 'to', label: 'ToUserId' },
        { key: 'comment', label: 'Comment' },
        { key: 'isHidden', label: 'Hidden' },
        { key: 'createdAt', label: 'CreatedAt' }
      ]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=\"mentor_feedback.csv\"');
      return res.send(csv);
    }

    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('CSV export error:', error);
    res.redirect('/admin/dashboard');
  }
};
