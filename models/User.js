import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    // ==================== BASIC INFO ====================
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    name: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    
    // ==================== VERIFICATION ====================
    isPhoneVerified: {
      type: Boolean,
      default: false
    },
    isProfileComplete: {
      type: Boolean,
      default: false
    },
    
    // ==================== ROLE ====================
    role: {
      type: String,
      enum: ['user', 'rider'],
      default: 'user'  // ✅ Always 'user'
    },
    
    // ==================== OTP ====================
    otp: {
      code: String,
      expiresAt: Date
    },
    
    // ==================== STATUS ====================
    isActive: {
      type: Boolean,
      default: true
    },
    
    // ==================== LOCATION ====================
    location: {
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
    }
  },
  { timestamps: true }  // ✅ Adds createdAt, updatedAt
);

// ✅ Geospatial index for location queries
userSchema.index({ 'location.coordinates': '2dsphere' });

export default mongoose.model('User', userSchema);