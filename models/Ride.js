import mongoose from 'mongoose';

const rideSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Rider',
      default: null
    },
    
    // Pickup Location
    pickup: {
      address: { type: String, required: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    },
    
    // Dropoff Location
    dropoff: {
      address: { type: String, required: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    },
    
    // Ride Details
    distance: { type: Number, required: true },
    fare: { type: Number, required: true },
    vehicleType: { 
      type: String, 
      enum: ['bike', 'auto', 'car', 'car_premium', 'parcel'], 
      default: 'bike' 
    },
    
    // Lady Captain
    ladyCaptain: { type: Boolean, default: false },
    
     rideOTP: {
      code: { type: String },
      expiresAt: { type: Date }
    },
    
    // Status
    status: {
      type: String,
      enum: ['searching', 'accepted', 'started', 'completed', 'cancelled', 'expired'],
      default: 'searching'
    },
    
    // Rider Responses
    rejectedRiders: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Rider' 
    }],
    
    // Timestamps
    requestedAt: { type: Date, default: Date.now },
    acceptedAt: Date,
    startedAt: Date,
    completedAt: Date,
    
    // Expiry (30 seconds timeout)
    expiresAt: { 
      type: Date, 
      default: () => new Date(Date.now() + 30 * 1000) 
    }
  },
  { timestamps: true }
);

export default mongoose.model('Ride', rideSchema);