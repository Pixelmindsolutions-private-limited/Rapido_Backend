import Rider from '../models/Rider.js';
import User from '../models/User.js';
import Ride from '../models/Ride.js';
import { calculateDistance } from '../utils/fareCalculator.js';

// ==================== RIDER PROFILE ====================
export const getMyProfile = async (req, res) => {
  try {
    const rider = await Rider.findOne({ userId: req.user.id })
      .populate('userId', 'name email phoneNumber')
      .select('-__v');
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider profile not found'
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Rider profile fetched',
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

export const updateMyProfile = async (req, res) => {
  try {
    const allowed = ['gender', 'address', 'bank', 'vehicle.color', 'vehicle.image'];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const rider = await Rider.findOneAndUpdate(
      { userId: req.user.id },
      { $set: updates },
      { new: true }
    );
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider profile not found'
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Profile updated',
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

export const setOnlineStatus = async (req, res) => {
  try {
    const { isOnline } = req.body;
    const rider = await Rider.findOne({ userId: req.user.id });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider not found'
      });
    }
    if (!rider.isApproved) {
      return res.status(403).json({
        success: false,
        message: 'Account not approved'
      });
    }

    rider.isOnline = isOnline;
    await rider.save();
    return res.status(200).json({
      success: true,
      message: `You are now ${isOnline ? 'online' : 'offline'}`,
      data: { isOnline }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { error: err.stack })
    });
  }
};

// ==================== RIDER LOCATION ====================
export const updateRiderLocation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude, address } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({
        success: false,
        message: 'Invalid latitude. Must be between -90 and 90'
      });
    }

    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: 'Invalid longitude. Must be between -180 and 180'
      });
    }

    const rider = await Rider.findOne({ userId });
    
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider profile not found'
      });
    }

    rider.currentLocation = {
      type: 'Point',
      coordinates: [parseFloat(longitude), parseFloat(latitude)],
      address: address || '',
      updatedAt: new Date()
    };

    await rider.save();

    return res.status(200).json({
      success: true,
      message: 'Rider location updated',
      data: {
        location: rider.currentLocation
      }
    });
  } catch (err) {
    console.error('Update rider location error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update rider location',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

export const getRiderLocation = async (req, res) => {
  try {
    const { riderId } = req.params;

    const rider = await Rider.findById(riderId).select('currentLocation');
    
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Rider location fetched',
      data: {
        location: rider.currentLocation || {
          coordinates: [0, 0],
          address: '',
          updatedAt: null
        }
      }
    });
  } catch (err) {
    console.error('Get rider location error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get rider location',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

// ==================== GET RIDER BY ID ====================
export const getRiderById = async (req, res) => {
  try {
    const { riderId } = req.params;

    // ✅ Find rider by ID
    const rider = await Rider.findById(riderId)
      .populate('userId', 'name phoneNumber email')
      .select('fullName dateOfBirth gender address aadhaar pan drivingLicense vehicle bank verificationStatus isApproved isOnline currentLocation rating totalRides totalEarnings createdAt');

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
    console.error('Get rider by ID error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch rider',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};



// ==================== RIDER RIDE FUNCTIONS ====================

// ✅ Helper: Generate 4-digit OTP
// const generateRideOTP = () => {
//   return Math.floor(1000 + Math.random() * 9000).toString();
// };

const generateRideOTP = 1234;

// ✅ Get new ride notifications for active rider
export const getNewRideNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    // ✅ Get rider details
    const rider = await Rider.findOne({ userId });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider profile not found'
      });
    }

    // ✅ Check if rider is approved
    if (!rider.isApproved) {
      return res.status(403).json({
        success: false,
        message: 'Your account is not approved yet'
      });
    }

    // ✅ Check if rider is online
    if (!rider.isOnline) {
      return res.status(403).json({
        success: false,
        message: 'You are offline. Please go online first'
      });
    }

    // ✅ Check if rider has location
    if (!rider.currentLocation || rider.currentLocation.coordinates[0] === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please update your location first'
      });
    }

    // ✅ Get all searching rides (not expired, not rejected by this rider)
    const rides = await Ride.find({
      status: 'searching',
      expiresAt: { $gt: new Date() },
      rejectedRiders: { $ne: rider._id }
    })
    .populate('userId', 'name phoneNumber')
    .sort({ createdAt: -1 })
    .limit(20);

    // ✅ If no rides available
    if (rides.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No new ride notifications',
        data: {
          rides: [],
          count: 0,
          riderStatus: {
            isApproved: rider.isApproved,
            isOnline: rider.isOnline,
            hasLocation: true
          }
        }
      });
    }

    // ✅ Calculate distance and filter within 5km
    const nearbyRides = rides.map(ride => {
      const distance = calculateDistance(
        rider.currentLocation.coordinates[1],
        rider.currentLocation.coordinates[0],
        ride.pickup.latitude,
        ride.pickup.longitude
      );
      return {
        rideId: ride._id,
        userId: ride.userId,
        pickup: ride.pickup,
        dropoff: ride.dropoff,
        distance: parseFloat(distance.toFixed(1)),
        fare: ride.fare,
        ladyCaptain: ride.ladyCaptain,
        vehicleType: ride.vehicleType,
        createdAt: ride.createdAt,
        expiresAt: ride.expiresAt
      };
    })
    .filter(ride => ride.distance <= 5)
    .sort((a, b) => a.distance - b.distance);

    return res.status(200).json({
      success: true,
      message: nearbyRides.length > 0 
        ? `Found ${nearbyRides.length} new ride${nearbyRides.length > 1 ? 's' : ''} nearby` 
        : 'No rides available nearby',
      data: {
        rides: nearbyRides,
        count: nearbyRides.length,
        riderStatus: {
          isApproved: rider.isApproved,
          isOnline: rider.isOnline,
          location: {
            latitude: rider.currentLocation.coordinates[1],
            longitude: rider.currentLocation.coordinates[0]
          }
        }
      }
    });
  } catch (err) {
    console.error('Get new ride notifications error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get new ride notifications',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

// ✅ Accept a ride with OTP generation
export const acceptRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user.id;

    const rider = await Rider.findOne({ userId });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider profile not found'
      });
    }

    if (!rider.isApproved) {
      return res.status(403).json({
        success: false,
        message: 'Your account is not approved yet'
      });
    }

    if (!rider.isOnline) {
      return res.status(403).json({
        success: false,
        message: 'You are offline. Please go online first'
      });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });      
    }

    if (ride.status !== 'searching') {
      return res.status(400).json({
        success: false,
        message: `Ride is already ${ride.status}`
      });
    }

    if (ride.expiresAt && new Date() > ride.expiresAt) {
      ride.status = 'expired';
      await ride.save();
      return res.status(400).json({
        success: false,
        message: 'Ride request has expired'
      });
    }

    // ✅ Generate OTP
    const otp = generateRideOTP;
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    ride.riderId = rider._id;
    ride.status = 'accepted';
    ride.acceptedAt = new Date();
    ride.rideOTP = {
      code: otp,
      expiresAt: otpExpiry
    };
    await ride.save();

    const user = await User.findById(ride.userId).select('name phoneNumber');

    const io = req.app.get('io');
    io.to(`user_${ride.userId}`).emit('ride:accepted', {
      rideId: ride._id,
      riderId: rider._id,
      riderDetails: {
        id: rider._id,
        name: rider.fullName,
        phone: rider.userId?.phoneNumber,
        vehicle: rider.vehicle,
        rating: rider.rating
      },
      otp: otp,
      message: 'Rider accepted your ride! Share this OTP with the rider to start the ride.'
    });

    return res.status(200).json({
      success: true,
      message: 'Ride accepted successfully',
      data: {
        rideId: ride._id,
        status: 'accepted',
        otp: otp,
        otpExpiresIn: '5 minutes',
        user: {
          id: user._id,
          name: user.name,
          phone: user.phoneNumber
        },
        pickup: ride.pickup,
        dropoff: ride.dropoff,
        fare: ride.fare
      }
    });
  } catch (err) {
    console.error('Accept ride error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to accept ride',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

// ✅ Reject a ride
// export const rejectRide = async (req, res) => {
//   try {
//     const { rideId } = req.params;
//     const userId = req.user.id;

//     const rider = await Rider.findOne({ userId });
//     if (!rider) {
//       return res.status(404).json({
//         success: false,
//         message: 'Rider profile not found'
//       });
//     }

//     const ride = await Ride.findById(rideId);
//     if (!ride) {
//       return res.status(404).json({
//         success: false,
//         message: 'Ride not found'
//       });
//     }

//     if (ride.status !== 'searching') {
//       return res.status(400).json({
//         success: false,
//         message: 'Ride is no longer available'
//       });
//     }

//     if (!ride.rejectedRiders) ride.rejectedRiders = [];
//     if (!ride.rejectedRiders.includes(rider._id)) {
//       ride.rejectedRiders.push(rider._id);
//       await ride.save();
//     }

//     const nearbyCount = await Rider.countDocuments({
//       isApproved: true,
//       isOnline: true,
//       'currentLocation.coordinates': {
//         $near: {
//           $geometry: {
//             type: 'Point',
//             coordinates: [ride.pickup.longitude, ride.pickup.latitude]
//           },
//           $maxDistance: 5000
//         }
//       }
//     });

//     const rejectedCount = ride.rejectedRiders.length;

//     const io = req.app.get('io');
//     io.to(`user_${ride.userId}`).emit('ride:rejected', {
//       rideId: ride._id,
//       riderId: rider._id,
//       rejectedCount: rejectedCount,
//       totalRiders: nearbyCount,
//       message: `${rejectedCount}/${nearbyCount} riders declined`
//     });

//     if (rejectedCount >= nearbyCount) {
//       ride.status = 'expired';
//       await ride.save();
//       io.to(`user_${ride.userId}`).emit('ride:expired', {
//         rideId: ride._id,
//         message: 'No riders accepted. Please try again.'
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       message: 'Ride rejected',
//       data: {
//         rejectedCount,
//         totalRiders: nearbyCount,
//         remaining: nearbyCount - rejectedCount
//       }
//     });
//   } catch (err) {
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to reject ride',
//       ...(process.env.NODE_ENV === 'development' && { error: err.message })
//     });
//   }
// };

export const rejectRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user.id;

    const rider = await Rider.findOne({ userId });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider profile not found'
      });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    if (ride.status !== 'searching') {
      return res.status(400).json({
        success: false,
        message: 'Ride is no longer available'
      });
    }

    // Track rejected riders
    if (!ride.rejectedRiders) ride.rejectedRiders = [];
    if (!ride.rejectedRiders.includes(rider._id)) {
      ride.rejectedRiders.push(rider._id);
      await ride.save();
    }

    // ✅ FIX: Use $geoWithin instead of $near
    const nearbyCount = await Rider.countDocuments({
      isApproved: true,
      isOnline: true,
      'currentLocation.coordinates': {
        $geoWithin: {
          $centerSphere: [
            [ride.pickup.longitude, ride.pickup.latitude],
            // Convert 5km to radians (5km / 6378.1km)
            5 / 6378.1
          ]
        }
      }
    });

    const rejectedCount = ride.rejectedRiders.length;

    const io = req.app.get('io');
    io.to(`user_${ride.userId}`).emit('ride:rejected', {
      rideId: ride._id,
      riderId: rider._id,
      rejectedCount: rejectedCount,
      totalRiders: nearbyCount,
      message: `${rejectedCount}/${nearbyCount} riders declined`
    });

    if (rejectedCount >= nearbyCount) {
      ride.status = 'expired';
      await ride.save();
      io.to(`user_${ride.userId}`).emit('ride:expired', {
        rideId: ride._id,
        message: 'No riders accepted. Please try again.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Ride rejected',
      data: {
        rejectedCount,
        totalRiders: nearbyCount,
        remaining: nearbyCount - rejectedCount
      }
    });
  } catch (err) {
    console.error('Reject ride error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject ride',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

// ✅ Get ride details for rider
export const getRideDetails = async (req, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user.id;

    const rider = await Rider.findOne({ userId });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider profile not found'
      });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    if (ride.riderId && ride.riderId.toString() !== rider._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this ride'
      });
    }

    const user = await User.findById(ride.userId).select('name phoneNumber');

    return res.status(200).json({
      success: true,
      data: {
        rideId: ride._id,
        status: ride.status,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phoneNumber
        },
        pickup: ride.pickup,
        dropoff: ride.dropoff,
        distance: ride.distance,
        fare: ride.fare,
        ladyCaptain: ride.ladyCaptain,
        createdAt: ride.createdAt
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get ride details',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

// ✅ Combined: Verify OTP & Start Ride (NO RESEND OTP)
export const verifyOTPAndStartRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { otp } = req.body;
    const userId = req.user.id;

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'OTP is required'
      });
    }

    const rider = await Rider.findOne({ userId });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider profile not found'
      });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    if (ride.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        message: `Ride is ${ride.status}. OTP verification only allowed for accepted rides.`
      });
    }

    if (ride.riderId.toString() !== rider._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to verify this ride'
      });
    }

    if (!ride.rideOTP || !ride.rideOTP.code) {
      return res.status(400).json({
        success: false,
        message: 'OTP not generated for this ride'
      });
    }

    if (new Date() > ride.rideOTP.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please try again with a new ride request.'
      });
    }

    if (ride.rideOTP.code !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.'
      });
    }

    // ✅ OTP Verified - Start Ride
    ride.status = 'started';
    ride.otpVerifiedAt = new Date();
    ride.startedAt = new Date();
    ride.rideOTP = undefined;
    await ride.save();

    const io = req.app.get('io');
    io.to(`user_${ride.userId}`).emit('ride:started', {
      rideId: ride._id,
      status: 'started',
      message: 'Ride has started! 🚗'
    });

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully. Ride started!',
      data: {
        rideId: ride._id,
        status: ride.status,
        startedAt: ride.startedAt
      }
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify OTP and start ride',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

// ✅ Complete ride
export const completeRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user.id;

    const rider = await Rider.findOne({ userId });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider profile not found'
      });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    if (ride.riderId.toString() !== rider._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to complete this ride'
      });
    }

    if (ride.status !== 'started') {
      return res.status(400).json({
        success: false,
        message: `Cannot complete ${ride.status} ride. Ride must be 'started' first.`
      });
    }

    ride.status = 'completed';
    ride.completedAt = new Date();
    await ride.save();

    const io = req.app.get('io');
    io.to(`user_${ride.userId}`).emit('ride:completed', {
      rideId: ride._id,
      status: 'completed',
      message: 'Ride completed! Please rate your rider. ⭐'
    });

    return res.status(200).json({
      success: true,
      message: 'Ride completed successfully',
      data: {
        rideId: ride._id,
        status: ride.status,
        completedAt: ride.completedAt
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to complete ride',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

// ✅ Get rider ride history
export const getRiderRides = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit = 20, page = 1 } = req.query;

    const rider = await Rider.findOne({ userId });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider profile not found'
      });
    }

    const query = { riderId: rider._id };
    if (status) query.status = status;

    const rides = await Ride.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('userId', 'name phoneNumber');

    const total = await Ride.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: {
        rides,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get ride history',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};