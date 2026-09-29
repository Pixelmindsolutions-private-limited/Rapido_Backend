import Rider from '../models/Rider.js';

export const authenticateRider = async (req, res, next) => {
  try {
    const rider = await Rider.findOne({
      userId: req.user.id
    });

    if (!rider) {
      return res.status(403).json({
        success: false,
        message: 'Rider profile not found'
      });
    }

    req.rider = rider;

    next();
  } catch (err) {
    console.error('Rider authentication error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to authenticate rider'
    });
  }
};
