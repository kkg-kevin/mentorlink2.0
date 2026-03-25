const Thread = require('../models/Thread');
const Message = require('../models/Message');
const Mentor = require('../models/Mentor');
const Mentee = require('../models/Mentee');
const Session = require('../models/Session');
const User = require('../models/User');

function requireMentorOrMentee(req, res) {
  if (!req.user || (req.user.role !== 'mentee' && req.user.role !== 'mentor')) {
    res.redirect('/auth/login');
    return false;
  }
  return true;
}

function getAvatar(user) {
  return user && user.profilePicture ? user.profilePicture : '/images/Logo 1.png';
}

function sortParticipantIds(a, b) {
  const aStr = a.toString();
  const bStr = b.toString();
  return aStr < bStr ? [a, b] : [b, a];
}

async function getConnections(currentUser) {
  if (!currentUser) return [];

  if (currentUser.role === 'mentee') {
    const mentee = await Mentee.findOne({ user: currentUser._id });
    if (!mentee) return [];

    const sessions = await Session.find({ mentee: mentee._id, mentor: { $ne: null } })
      .populate({ path: 'mentor', populate: { path: 'user' } })
      .lean()
      .catch(() => []);

    const map = new Map();
    sessions.forEach((session) => {
      const mentorUser = session.mentor && session.mentor.user;
      if (!mentorUser) return;
      const key = mentorUser._id.toString();
      const existing = map.get(key);
      const sessionDate = session.scheduledAt || session.createdAt;
      if (!existing || (sessionDate && sessionDate > existing.lastSessionAt)) {
        map.set(key, {
          userId: mentorUser._id,
          name: mentorUser.name || 'Mentor',
          role: mentorUser.role || 'mentor',
          avatar: getAvatar(mentorUser),
          lastSessionAt: sessionDate || null
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (!a.lastSessionAt && !b.lastSessionAt) return a.name.localeCompare(b.name);
      if (!a.lastSessionAt) return 1;
      if (!b.lastSessionAt) return -1;
      return new Date(b.lastSessionAt) - new Date(a.lastSessionAt);
    });
  }

  if (currentUser.role === 'mentor') {
    const mentor = await Mentor.findOne({ user: currentUser._id });
    if (!mentor) return [];

    const sessions = await Session.find({ mentor: mentor._id, mentee: { $ne: null } })
      .populate({ path: 'mentee', populate: { path: 'user' } })
      .lean()
      .catch(() => []);

    const map = new Map();
    sessions.forEach((session) => {
      const menteeUser = session.mentee && session.mentee.user;
      if (!menteeUser) return;
      const key = menteeUser._id.toString();
      const existing = map.get(key);
      const sessionDate = session.scheduledAt || session.createdAt;
      if (!existing || (sessionDate && sessionDate > existing.lastSessionAt)) {
        map.set(key, {
          userId: menteeUser._id,
          name: menteeUser.name || 'Mentee',
          role: menteeUser.role || 'mentee',
          avatar: getAvatar(menteeUser),
          lastSessionAt: sessionDate || null
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (!a.lastSessionAt && !b.lastSessionAt) return a.name.localeCompare(b.name);
      if (!a.lastSessionAt) return 1;
      if (!b.lastSessionAt) return -1;
      return new Date(b.lastSessionAt) - new Date(a.lastSessionAt);
    });
  }

  return [];
}

async function canMessage(currentUser, targetUserId) {
  if (!currentUser || !targetUserId) return false;
  if (currentUser._id.toString() === targetUserId.toString()) return false;

  const targetUser = await User.findById(targetUserId).lean();
  if (!targetUser) return false;

  if (currentUser.role === 'mentee' && targetUser.role === 'mentor') {
    const mentee = await Mentee.findOne({ user: currentUser._id });
    const mentor = await Mentor.findOne({ user: targetUser._id });
    if (!mentee || !mentor) return false;
    const existingSession = await Session.exists({ mentee: mentee._id, mentor: mentor._id });
    return !!existingSession;
  }

  if (currentUser.role === 'mentor' && targetUser.role === 'mentee') {
    const mentor = await Mentor.findOne({ user: currentUser._id });
    const mentee = await Mentee.findOne({ user: targetUser._id });
    if (!mentor || !mentee) return false;
    const existingSession = await Session.exists({ mentee: mentee._id, mentor: mentor._id });
    return !!existingSession;
  }

  return false;
}

exports.listThreads = async (req, res) => {
  if (!requireMentorOrMentee(req, res)) return;

  const threads = await Thread.find({ participants: req.user._id })
    .sort({ lastMessageAt: -1, createdAt: -1 })
    .populate('participants')
    .lean()
    .catch(() => []);

  const threadCards = await Promise.all(
    threads.map(async (thread) => {
      const other = (thread.participants || []).find(
        (participant) => participant._id.toString() !== req.user._id.toString()
      );
      const unreadCount = await Message.countDocuments({
        thread: thread._id,
        sender: { $ne: req.user._id },
        readBy: { $ne: req.user._id }
      });

      return {
        id: thread._id,
        otherName: other ? other.name : 'User',
        otherAvatar: getAvatar(other),
        lastMessagePreview: thread.lastMessagePreview || 'No messages yet.',
        lastMessageAt: thread.lastMessageAt || thread.createdAt,
        unreadCount
      };
    })
  );

  const connections = await getConnections(req.user);
  const hasConnections = connections.length > 0;
  const hasThreads = threadCards.length > 0;

  res.render('messages/messages-list', {
    user: req.user,
    threads: threadCards,
    connections,
    hasConnections,
    hasThreads
  });
};

exports.viewThread = async (req, res) => {
  if (!requireMentorOrMentee(req, res)) return;

  const thread = await Thread.findById(req.params.id)
    .populate('participants')
    .lean()
    .catch(() => null);

  if (!thread) return res.redirect('/messages');

  const isParticipant = (thread.participants || []).some(
    (participant) => participant._id.toString() === req.user._id.toString()
  );
  if (!isParticipant) return res.redirect('/messages');

  const other = (thread.participants || []).find(
    (participant) => participant._id.toString() !== req.user._id.toString()
  );

  const messages = await Message.find({ thread: thread._id })
    .sort({ createdAt: 1 })
    .populate('sender')
    .lean()
    .catch(() => []);

  await Message.updateMany(
    { thread: thread._id, sender: { $ne: req.user._id }, readBy: { $ne: req.user._id } },
    { $addToSet: { readBy: req.user._id } }
  );

  const messageCards = messages.map((message) => ({
    id: message._id,
    body: message.body,
    createdAt: message.createdAt,
    isOwn: message.sender && message.sender._id.toString() === req.user._id.toString(),
    senderName: message.sender ? message.sender.name : 'User',
    senderAvatar: getAvatar(message.sender)
  }));

  res.render('messages/messages-thread', {
    user: req.user,
    threadId: thread._id,
    otherUser: {
      name: other ? other.name : 'User',
      avatar: getAvatar(other),
      role: other ? other.role : ''
    },
    messages: messageCards,
    hasMessages: messageCards.length > 0
  });
};

exports.startThread = async (req, res) => {
  if (!requireMentorOrMentee(req, res)) return;

  try {
    const targetUserId = (req.body.targetUserId || '').trim();
    if (!targetUserId) return res.redirect('/messages');

    const allowed = await canMessage(req.user, targetUserId);
    if (!allowed) return res.redirect('/messages');

    const participants = sortParticipantIds(req.user._id, targetUserId);
    let thread = await Thread.findOne({ participants: { $all: participants, $size: 2 } });

    if (!thread) {
      thread = new Thread({
        participants,
        lastMessageAt: null,
        lastMessagePreview: ''
      });
      await thread.save();
    }

    res.redirect(`/messages/${thread._id}`);
  } catch (error) {
    console.error('Start thread error:', error);
    res.redirect('/messages');
  }
};

exports.sendMessage = async (req, res) => {
  if (!requireMentorOrMentee(req, res)) return;

  try {
    const thread = await Thread.findById(req.params.id).lean().catch(() => null);
    if (!thread) return res.redirect('/messages');

    const isParticipant = (thread.participants || []).some(
      (participant) => participant.toString() === req.user._id.toString()
    );
    if (!isParticipant) return res.redirect('/messages');

    const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
    if (!body) return res.redirect(`/messages/${thread._id}`);

    const message = new Message({
      thread: thread._id,
      sender: req.user._id,
      body,
      readBy: [req.user._id]
    });
    await message.save();

    await Thread.findByIdAndUpdate(thread._id, {
      lastMessageAt: new Date(),
      lastMessagePreview: body.slice(0, 120)
    });

    res.redirect(`/messages/${thread._id}`);
  } catch (error) {
    console.error('Send message error:', error);
    res.redirect('/messages');
  }
};
