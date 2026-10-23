import mongoose from 'mongoose';

const riderSchema = new mongoose.Schema(
  {
    // ==================== REFERENCE ====================
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    
    // ==================== PERSONAL DETAILS ====================
    fullName: {
      type: String,
      required: true
    },
    dateOfBirth: {
      type: Date,
      required: true
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other']
    },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String
    },
    
    // ==================== DOCUMENTS ====================
    aadhaar: {
      number: { 
        type: String, 
        required: true, 
        unique: true 
      },
      imageFront: String,
      imageBack: String
    },
    pan: {
      number: { 
        type: String, 
        required: true, 
        unique: true 
      },
      image: String
    },
    drivingLicense: {
      number: { 
        type: String, 
        required: true, 
        unique: true 
      },
      expiryDate: { 
        type: Date, 
        required: true 
      },
      imageFront: String,
      imageBack: String
    },
    
    // ==================== VEHICLE DETAILS ====================
    vehicle: {
      type: { 
        type: String, 
        enum: ['bike', 'auto', 'car', 'car_premium', 'parcel'], 
        required: true 
      },
      number: { 
        type: String, 
        required: true, 
        unique: true 
      },
      model: { 
        type: String, 
        required: true 
      },
      year: { 
        type: Number, 
        required: true 
      },
      color: String,
      image: String,
      insuranceDocument: String,
      pollutionCertificate: String
    },
    
    // ==================== BANK DETAILS ====================
    bank: {
      accountNumber: String,
      ifscCode: String,
      accountHolderName: String,
      bankName: String
    },
    
    // ==================== VERIFICATION STATUS ====================
    verificationStatus: {
      type: String,
      enum: ['pending', 'under_review', 'verified', 'rejected'],
      default: 'pending'
    },
    rejectionReason: String,
    isApproved: {
      type: Boolean,
      default: false
    },
    isOnline: {
      type: Boolean,
      default: false
    },
    
    // ==================== LOCATION ====================
    currentLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        default: [0, 0]
      },
      address: {
        type: String,
        default: ''
      },
      updatedAt: {
        type: Date,
        default: Date.now
      }
    },
    
    // ==================== STATS ====================
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    totalRides: {
      type: Number,
      default: 0
    },
    totalEarnings: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }  // ✅ Adds createdAt, updatedAt
);

// ✅ Geospatial index for nearby rider queries
riderSchema.index({ currentLocation: '2dsphere' });

export default mongoose.model('Rider', riderSchema);