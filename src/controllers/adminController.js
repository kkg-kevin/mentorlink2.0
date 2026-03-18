const User = require('../models/User');
const Mentor = require('../models/Mentor');
const Mentee = require('../models/Mentee');
const Organization = require('../models/Organization');
const Session = require('../models/Session');

// Admin Dashboard - Show all users
exports.dashboard = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.redirect('/auth/login');
  
  try {
    // Get all users
    const users = await User.find({ role: { $ne: 'admin' } }).lean();
    
    // Calculate stats
    const stats = {
      totalUsers: users.length,
      mentors: users.filter(u => u.role === 'mentor').length,
      mentees: users.filter(u => u.role === 'mentee').length,
      organizations: users.filter(u => u.role === 'organization').length
    };
    
    res.render('admin/admin-dashboard', { user: req.user, users, stats });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.render('admin/admin-dashboard', { user: req.user, users: [], stats: { totalUsers: 0, mentors: 0, mentees: 0, organizations: 0 } });
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
    
    res.render('admin/admin-user-view', { user: req.user, viewUser, profile });
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
    
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Delete user error:', error);
    res.redirect('/admin/dashboard');
  }
};
