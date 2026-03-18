const Feedback = require('../models/Feedback');

function normalizeMentorId(value) {
  if (!value) return null;
  return value.toString();
}

async function getMentorRatingMap(mentorUserIds = []) {
  const ids = [...new Set(mentorUserIds.map(normalizeMentorId).filter(Boolean))];
  if (ids.length === 0) {
    return new Map();
  }

  const feedbacks = await Feedback.find({ to: { $in: ids } })
    .select('to rating')
    .lean()
    .catch(() => []);

  const summaryMap = new Map();

  feedbacks.forEach((feedback) => {
    const key = normalizeMentorId(feedback.to);
    const current = summaryMap.get(key) || { totalRating: 0, ratingCount: 0 };
    current.totalRating += Number(feedback.rating) || 0;
    current.ratingCount += 1;
    summaryMap.set(key, current);
  });

  return new Map(
    [...summaryMap.entries()].map(([key, value]) => [
      key,
      {
        avgRating: Number((value.totalRating / value.ratingCount).toFixed(1)),
        ratingCount: value.ratingCount
      }
    ])
  );
}

async function getMentorReviews(mentorUserId, limit = 5) {
  if (!mentorUserId) {
    return [];
  }

  return Feedback.find({ to: mentorUserId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('from', 'name role profilePicture')
    .lean()
    .catch(() => []);
}

module.exports = {
  getMentorRatingMap,
  getMentorReviews
};
