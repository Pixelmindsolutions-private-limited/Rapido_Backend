import User from '../models/User.js';
import Rider from '../models/Rider.js';
import Ride from '../models/Ride.js'; 
import { getRouteDistance, calculateFare } from '../utils/fareCalculator.js';
// ==================== USER PROFILE ====================

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-otp -__v');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Profile fetched',
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

export const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (email && email !== user.email) {
      const exists = await User.findOne({ email, _id: { $ne: req.user.id } });
      if (exists) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use'
        });
      }
    }

    if (name) user.name = name;
    if (email) user.email = email;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role
        }
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

// ==================== USER LOCATION ====================
export const updateUserLocation = async (req, res) => {
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

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'location.coordinates': [parseFloat(longitude), parseFloat(latitude)],
          'location.address': address || '',
          'location.updatedAt': new Date()
        }
      },
      { new: true }
    ).select('-otp -__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Location updated successfully',
      data: {
        location: user.location
      }
    });
  } catch (err) {
    console.error('Update location error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update location',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

export const getUserLocation = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('location');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Location fetched successfully',
      data: {
        location: user.location || {
          coordinates: [0, 0],
          address: '',
          updatedAt: null
        }
      }
    });
  } catch (err) {
    console.error('Get location error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get location',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

// ==================== FIND NEARBY RIDERS ====================
export const findNearbyRiders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude, radius = 5 } = req.query;

    // ✅ Get user location
    let searchLat = latitude;
    let searchLng = longitude;

    if (!searchLat || !searchLng) {
      const user = await User.findById(userId).select('location');
      
      if (!user || !user.location || user.location.coordinates[0] === 0) {
        return res.status(400).json({
          success: false,
          message: 'User location not set. Please provide latitude and longitude or update your location first.'
        });
      }
      
      [searchLng, searchLat] = user.location.coordinates;
    }

    const lat = parseFloat(searchLat);
    const lng = parseFloat(searchLng);

    // ✅ Find nearby riders (only approved and online)
    const nearbyRiders = await Rider.find({
      isApproved: true,
      isOnline: true,
      'currentLocation.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          $maxDistance: radius * 1000
        }
      }
    });

    // ✅ Super minimal response - only what's needed for map
    const formattedRiders = nearbyRiders.map(rider => ({
      id: rider._id,
      name: rider.fullName,
      lat: rider.currentLocation.coordinates[1],
      lng: rider.currentLocation.coordinates[0],
      vehicle: rider.vehicle.type,
      online: rider.isOnline
    }));

    return res.status(200).json({
      success: true,
      message: `Found ${formattedRiders.length} nearby riders`,
      data: {
        nearbyRiders: formattedRiders,
        count: formattedRiders.length,
        radius: radius,
        searchLocation: {
          latitude: lat,
          longitude: lng
        }
      }
    });
  } catch (err) {
    console.error('Find nearby riders error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to find nearby riders',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};


// ==================== FARE ESTIMATE ====================

export const getFareEstimate = async (req, res) => {
  try {
    const { pickup, dropoff, ladyCaptain = false } = req.body;

    if (!pickup || !dropoff || 
        !pickup.latitude || !pickup.longitude || 
        !dropoff.latitude || !dropoff.longitude) {
      return res.status(400).json({
        success: false,
        message: 'Pickup and dropoff locations with coordinates are required'
      });
    }

    // ✅ Google Maps distance
    const routeData = await getRouteDistance(pickup, dropoff);
    const distance = routeData.distanceKm;
    const durationMinutes = routeData.durationMinutes;
    const polyline = routeData.polyline;

    // ✅ Vehicle types (only necessary info)
    const vehicleTypes = [
      { type: 'bike',        displayName: 'Bike',         icon: 'bike',         capacity: 1 },
      { type: 'auto',        displayName: 'Auto Rickshaw', icon: 'auto',         capacity: 3 },
      { type: 'car',         displayName: 'Car',           icon: 'car',          capacity: 4 },
      { type: 'car_premium', displayName: 'Premium Car',  icon: 'car_premium',  capacity: 4 },
      { type: 'parcel',      displayName: 'Parcel',        icon: 'parcel',       capacity: 0 }
    ];

    // ✅ Fare for each vehicle type (no breakdown)
    const fareEstimates = vehicleTypes.map(vehicle => ({
      vehicleType: vehicle.type,
      displayName: vehicle.displayName,
      icon: vehicle.icon,
      capacity: vehicle.capacity,
      fare: calculateFare(distance, vehicle.type, ladyCaptain),
      currency: '₹'
    }));

    return res.status(200).json({
      success: true,
      message: 'Fare estimates fetched successfully',
      data: {
        ride: {
          pickup,
          dropoff,
          distance: distance.toFixed(1),
          duration: durationMinutes,
          polyline,
          ladyCaptain
        },
        fareEstimates
      }
    });

  } catch (err) {
    console.error('Get fare estimate error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get fare estimate',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

// ===================== Booking  Rides =======================

export const requestRide = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pickup, dropoff, vehicleType = 'bike', ladyCaptain = false } = req.body;

    // ✅ Validate input
    if (!pickup || !dropoff || 
        !pickup.latitude || !pickup.longitude || 
        !dropoff.latitude || !dropoff.longitude) {
      return res.status(400).json({
        success: false,
        message: 'Pickup and dropoff locations with coordinates are required'
      });
    }

    // ✅ Validate vehicleType
    const validVehicleTypes = ['bike', 'auto', 'car', 'car_premium', 'parcel'];
    if (!validVehicleTypes.includes(vehicleType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid vehicle type. Must be: ${validVehicleTypes.join(', ')}`
      });
    }

    // ✅ Check existing active ride
    const existingRide = await Ride.findOne({
      userId,
      status: { $in: ['searching', 'accepted', 'started'] }
    });

    if (existingRide) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active ride',
        data: { rideId: existingRide._id, status: existingRide.status }
      });
    }

    // ✅ Get real road distance from Google Maps
    const routeData = await getRouteDistance(pickup, dropoff);
    const distance = routeData.distanceKm;
    const durationMinutes = routeData.durationMinutes;
    const polyline = routeData.polyline;

    // ✅ Calculate fare
    const fare = calculateFare(distance, vehicleType, ladyCaptain);

    // ✅ Create ride
    const ride = new Ride({
      userId,
      pickup,
      dropoff,
      distance,
      fare,
      vehicleType,
      ladyCaptain,
      status: 'searching',
      expiresAt: new Date(Date.now() + 30 * 1000)
    });

    await ride.save();

    // ✅ Find nearby riders matching vehicle type
    const nearbyRiders = await Rider.find({
      isApproved: true,
      isOnline: true,
      'vehicle.type': vehicleType === 'car_premium' ? 'car' : 
                      vehicleType === 'parcel' ? 'bike' : vehicleType,
      ...(ladyCaptain && { gender: 'female' }),
      'currentLocation.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [pickup.longitude, pickup.latitude]
          },
          $maxDistance: 5000
        }
      }
    }).select('_id');

    if (nearbyRiders.length === 0) {
      ride.status = 'expired';
      await ride.save();
      return res.status(404).json({
        success: false,
        message: ladyCaptain 
          ? 'No lady riders available for this vehicle type. Try without Lady Captain.' 
          : 'No riders available nearby for this vehicle type.'
      });
    }

    // ✅ Send to riders via Socket.IO
    const io = req.app.get('io');
    nearbyRiders.forEach(r => {
      io.to(`rider_${r._id}`).emit('ride:new-request', {
        rideId: ride._id,
        userId: userId,
        pickup: pickup,
        dropoff: dropoff,
        distance: distance.toFixed(1),
        duration: durationMinutes,
        fare: fare,
        ladyCaptain: ladyCaptain,
        vehicleType: vehicleType,
        timestamp: new Date()
      });
    });

    // ✅ Notify user
    io.to(`user_${userId}`).emit('ride:searching', {
      rideId: ride._id,
      totalRiders: nearbyRiders.length,
      message: `Searching for riders... (0/${nearbyRiders.length})`
    });

    return res.status(201).json({
      success: true,
      message: 'Ride requested. Searching for riders...',
      data: {
        rideId: ride._id,
        status: 'searching',
        totalRiders: nearbyRiders.length,
        distance: distance.toFixed(1),
        duration: durationMinutes,
        fare: fare,
        polyline: polyline,
        vehicleType: vehicleType,
        expiresIn: '30 seconds'
      }
    });
  } catch (err) {
    console.error('Request ride error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to request ride',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

// Get ride status
export const getRideStatus = async (req, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user.id;

    const ride = await Ride.findOne({ _id: rideId, userId });
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    let riderDetails = null;
    if (ride.riderId) {
      const rider = await Rider.findById(ride.riderId)
        .populate('userId', 'name phoneNumber');
      if (rider) {
        riderDetails = {
          id: rider._id,
          name: rider.fullName,
          phone: rider.userId?.phoneNumber,
          vehicle: rider.vehicle,
          rating: rider.rating,
          otp: rider.rideOTP
        };
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        rideId: ride._id,
        status: ride.status,
        otp: ride.rideOTP,
        fare: ride.fare,
        pickup: ride.pickup,
        dropoff: ride.dropoff,
        ladyCaptain: ride.ladyCaptain,
        rejectedCount: ride.rejectedRiders?.length || 0,
        rider: riderDetails,
        createdAt: ride.createdAt,
        acceptedAt: ride.acceptedAt
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get ride status',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

// Cancel ride
export const cancelRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user.id;

    const ride = await Ride.findOne({ _id: rideId, userId });
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    if (['completed', 'cancelled', 'expired'].includes(ride.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel ${ride.status} ride`
      });
    }

    ride.status = 'cancelled';
    await ride.save();

    if (ride.riderId) {
      const io = req.app.get('io');
      io.to(`rider_${ride.riderId}`).emit('ride:cancelled', {
        rideId: ride._id,
        message: 'User cancelled the ride'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Ride cancelled successfully'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel ride',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

// Get user ride history
export const getRideHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit = 20, page = 1 } = req.query;

    const query = { userId };
    if (status) query.status = status;

    const rides = await Ride.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('riderId', 'fullName vehicle');

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