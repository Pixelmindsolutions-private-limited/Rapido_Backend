import Admin from '../models/Admin.js';
import User from '../models/User.js';
import Rider from '../models/Rider.js';
import Ride from '../models/Ride.js';
import TokenService from '../utils/tokenService.js';


// ==================== ADMIN PROFILE ====================
export const getProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select('-password -otp -__v');
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Admin profile fetched',
      data: { admin }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { error: err.stack })
    });
  }
};

export const getDashboardStats = async (req, res) => {
  try {
    const [totalUsers, totalRiders, pendingRiders, approvedRiders] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Rider.countDocuments(),
      Rider.countDocuments({ verificationStatus: 'pending' }),
      Rider.countDocuments({ isApproved: true })
    ]);

    return res.status(200).json({
      success: true,
      message: 'Dashboard stats fetched',
      data: {
        totalUsers,
        totalRiders,
        pendingRiders,
        approvedRiders
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { error: err.stack })
    });
  }
};

// ==================== ADMIN - USER MANAGEMENT ====================
export const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { role: 'user' };
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { phoneNumber: { $regex: req.query.search } }
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter).select('-otp -__v').skip(skip).limit(limit).sort({ createdAt: -1 }),
      User.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      message: 'Users fetched successfully',
      data: {
        users,
        pagination: { total, page, pages: Math.ceil(total / limit) }
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { error: err.stack })
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-otp -__v');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    return res.status(200).json({
      success: true,
      message: 'User fetched successfully',
      data: { user }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { error: err.stack })
    });
  }
};

export const deactivateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    return res.status(200).json({
      success: true,
      message: 'User deactivated successfully',
      data: { id: user._id }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { error: err.stack })
    });
  }
};

export const activateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    return res.status(200).json({
      success: true,
      message: 'User activated successfully',
      data: { id: user._id }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { error: err.stack })
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    return res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      data: { id: req.params.id }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { error: err.stack })
    });
  }
};

// ==================== ADMIN - RIDER MANAGEMENT ====================
export const getAllRiders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.verificationStatus = req.query.status;
    if (req.query.vehicleType) filter['vehicle.type'] = req.query.vehicleType;

    const [riders, total] = await Promise.all([
      Rider.find(filter)
        .populate('userId', 'name email phoneNumber')
        .select('-__v')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Rider.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      message: 'Riders fetched successfully',
      data: {
        riders,
        pagination: { total, page, pages: Math.ceil(total / limit) }
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { error: err.stack })
    });
  }
};

export const getRiderById = async (req, res) => {
  try {
    const rider = await Rider.findById(req.params.id)
      .populate('userId', 'name email phoneNumber');
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider not found'
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Rider fetched successfully',
      data: { rider }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { error: err.stack })
    });
  }
};

export const updateVerification = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const validStatuses = ['pending', 'under_review', 'verified', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be: pending, under_review, verified, or rejected'
      });
    }

    const rider = await Rider.findById(req.params.id);
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider not found'
      });
    }

    rider.verificationStatus = status;
    rider.isApproved = status === 'verified';
    if (status === 'rejected') {
      rider.rejectionReason = rejectionReason || 'Documents invalid';
    }
    await rider.save();

    return res.status(200).json({
      success: true,
      message: `Rider ${status} successfully`,
      data: {
        id: rider._id,
        verificationStatus: rider.verificationStatus,
        isApproved: rider.isApproved
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { error: err.stack })
    });
  }
};

export const toggleRiderOnlineStatus = async (req, res) => {
  try {
    const { isOnline } = req.body;
    const rider = await Rider.findById(req.params.id);
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider not found'
      });
    }

    rider.isOnline = isOnline;
    await rider.save();

    return res.status(200).json({
      success: true,
      message: `Rider is now ${isOnline ? 'online' : 'offline'}`,
      data: {
        id: rider._id,
        isOnline: rider.isOnline
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { error: err.stack })
    });
  }
};

export const deleteRider = async (req, res) => {
  try {
    const rider = await Rider.findByIdAndDelete(req.params.id);
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider not found'
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Rider deleted successfully',
      data: { id: req.params.id }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { error: err.stack })
    });
  }
};

export const getAllRides = async (req, res) => {
  try {
    const { status } = req.query;

    const filter = {};

    // Filter by status if provided
    if (status) {
      const validStatuses = [
        'searching',
        'accepted',
        'started',
        'completed',
        'cancelled',
        'expired'
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      filter.status = status;
    }

    const rides = await Ride.find(filter)
      .populate('userId', 'name phoneNumber email')
      .populate('riderId', 'fullName')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: status
        ? `${status} rides fetched successfully`
        : 'All rides fetched successfully',
      data: {
        rides,
        count: rides.length,
        status: status || 'all'
      }
    });

  } catch (err) {
    console.error('Get all rides error:', err);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch rides',
      ...(process.env.NODE_ENV === 'development' && {
        error: err.message
      })
    });
  }
};
export const getRideById = async (req, res) => {
  try {
    const { rideId } = req.body;

    if (!rideId) {
      return res.status(400).json({
        success: false,
        message: 'rideId is required',
      });
    }

    const ride = await Ride.findById(rideId)
      .populate('userId', 'name phoneNumber email')
      .populate('riderId', 'fullName');

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Ride fetched successfully',
      data: {
        ride,
      },
    });
  } catch (err) {
    console.error('Get ride by ID error:', err);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch ride',
      ...(process.env.NODE_ENV === 'development' && {
        error: err.message,
      }),
    });
  }
};
