import User from '../models/User.js';
import Rider from '../models/Rider.js';
import Admin from '../models/Admin.js';
import OTPService from '../utils/otpService.js';
import TokenService from '../utils/tokenService.js';
import { body, validationResult } from 'express-validator';

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => e.msg)
    });
  }
  next();
};

// ==================== ADMIN REGISTRATION ====================
export const registerAdmin = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('phoneNumber')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\+?[1-9]\d{9,14}$/).withMessage('Invalid phone number format'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role')
    .optional()
    .isIn(['admin', 'super_admin']).withMessage('Role must be admin or super_admin'),
  validate,
  async (req, res) => {
    try {
      const { name, email, phoneNumber, password, role } = req.body;

      const existingAdmin = await Admin.findOne({ 
        $or: [{ email }, { phoneNumber }] 
      });

      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          message: 'Admin with this email or phone already exists'
        });
      }

      const admin = new Admin({
        name,
        email,
        phoneNumber,
        password,
        role: role || 'admin'
      });

      await admin.save();

      const token = TokenService.getToken(admin);

      return res.status(201).json({
        success: true,
        message: 'Admin registered successfully',
        data: {
          admin: {
            id: admin._id,
            name: admin.name,
            email: admin.email,
            phoneNumber: admin.phoneNumber,
            role: admin.role
          }
        },
        token: token.token,
        expiresIn: token.expiresIn
      });
    } catch (err) {
      console.error('Admin registration error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to register admin',
        ...(process.env.NODE_ENV === 'development' && { error: err.message })
      });
    }
  }
];

// ==================== ADMIN LOGIN ====================
export const adminLogin = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const admin = await Admin.findOne({ email, isActive: true });
      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      const isValid = await admin.comparePassword(password);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      const otp = OTPService.generate();
      admin.otp = { code: otp, expiresAt: OTPService.expiryDate() };
      await admin.save();

      await OTPService.send(admin.phoneNumber, otp, 'admin login');

      return res.status(200).json({
        success: true,
        message: 'Password verified. OTP sent.',
        data: {
          email: admin.email,
          phoneNumber: admin.phoneNumber.replace(/(\d{2})\d+(\d{2})/, '$1*****$2')
        }
      });
    } catch (err) {
      console.error('Admin login error:', err);
      return res.status(500).json({
        success: false,
        message: 'Admin login failed',
        ...(process.env.NODE_ENV === 'development' && { error: err.message })
      });
    }
  }
];

// ==================== ADMIN VERIFY OTP ====================
export const adminVerifyOTP = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('otp')
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
    .isNumeric().withMessage('OTP must be numeric'),
  validate,
  async (req, res) => {
    try {
      const { email, otp } = req.body;

      const admin = await Admin.findOne({ email });
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Admin not found'
        });
      }

      const result = OTPService.validate(admin.otp, otp);
      if (!result.valid) {
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }

      admin.otp = undefined;
      admin.lastLogin = new Date();
      await admin.save();

      const token = TokenService.getToken(admin);

      return res.status(200).json({
        success: true,
        message: 'Admin login successful!',
        data: {
          admin: {
            id: admin._id,
            name: admin.name,
            email: admin.email,
            phoneNumber: admin.phoneNumber,
            role: admin.role
          }
        },
        token: token.token,
        expiresIn: token.expiresIn
      });
    } catch (err) {
      console.error('Admin verify OTP error:', err);
      return res.status(500).json({
        success: false,
        message: 'Admin OTP verification failed',
        ...(process.env.NODE_ENV === 'development' && { error: err.message })
      });
    }
  }
];

// ==================== SEND OTP ====================
export const sendOTP = [
  body('phoneNumber')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\+?[1-9]\d{9,14}$/).withMessage('Invalid phone number format'),
  validate,
  async (req, res) => {
    try {
      const { phoneNumber } = req.body;

      let user = await User.findOne({ phoneNumber });
      
      if (!user) {
        user = new User({
          phoneNumber,
          role: 'user'
        });
        await user.save();
      }

      const otp = OTPService.generate();
      user.otp = { code: otp, expiresAt: OTPService.expiryDate() };
      await user.save();

      await OTPService.send(phoneNumber, otp, 'registration');

      return res.status(200).json({
        success: true,
        message: 'OTP sent successfully.',
        data: {
          phoneNumber,
          isNewUser: !user.name,
          otp: otp
        }
      });
    } catch (err) {
      console.error('Send OTP error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP',
        ...(process.env.NODE_ENV === 'development' && { error: err.message })
      });
    }
  }
];

// ==================== VERIFY OTP ====================
export const verifyOTP = [
  body('phoneNumber').trim().notEmpty().withMessage('Phone number is required'),
  body('otp')
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 4, max: 6 }).withMessage('OTP must be 4-6 digits')
    .isNumeric().withMessage('OTP must be numeric'),
  validate,
  async (req, res) => {
    try {
      const { phoneNumber, otp } = req.body;

      const user = await User.findOne({ phoneNumber });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Phone number not found.'
        });
      }

      const result = OTPService.validate(user.otp, otp);
      if (!result.valid) {
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }

      user.isPhoneVerified = true;
      user.otp = undefined;
      await user.save();

      // ✅ Generate tempToken for registration
      const tempToken = TokenService.generateToken({
        _id: user._id,
        phoneNumber: user.phoneNumber,
        role: user.role
      });

      return res.status(200).json({
        success: true,
        message: 'Phone verified!',
        data: {
          tempToken,
          phoneNumber,
          role: user.role,
          isProfileComplete: user.isProfileComplete
        }
      });
    } catch (err) {
      console.error('Verify OTP error:', err);
      return res.status(500).json({
        success: false,
        message: 'OTP verification failed',
        ...(process.env.NODE_ENV === 'development' && { error: err.message })
      });
    }
  }
];

// ==================== RESEND OTP ====================
export const resendOTP = [
  body('phoneNumber')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\+?[1-9]\d{9,14}$/).withMessage('Invalid phone number format'),
  validate,
  async (req, res) => {
    try {
      const { phoneNumber, context = 'registration' } = req.body;

      const user = await User.findOne({ phoneNumber });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Phone number not found'
        });
      }

      const otp = OTPService.generate();
      user.otp = { code: otp, expiresAt: OTPService.expiryDate() };
      await user.save();

      await OTPService.send(phoneNumber, otp, context);

      return res.status(200).json({
        success: true,
        message: 'OTP resent.',
        data: {
          phoneNumber,
          otp: otp
        }
      });
    } catch (err) {
      console.error('Resend OTP error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to resend OTP',
        ...(process.env.NODE_ENV === 'development' && { error: err.message })
      });
    }
  }
];

// ==================== REGISTER USER ====================
export const registerUser = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  body('email')
    .optional()
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  validate,
  async (req, res) => {
    try {
      const { name, email } = req.body;
      const userId = req.user.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      if (!user.isPhoneVerified) {
        return res.status(400).json({
          success: false,
          message: 'Phone not verified'
        });
      }
      if (user.isProfileComplete) {
        return res.status(400).json({
          success: false,
          message: 'Profile already completed'
        });
      }

      if (email) {
        const emailExists = await User.findOne({ email, _id: { $ne: userId } });
        if (emailExists) {
          return res.status(400).json({
            success: false,
            message: 'Email already in use'
          });
        }
      }

      user.name = name;
      user.email = email;
      user.role = 'user';
      user.isProfileComplete = true;
      await user.save();

      const token = TokenService.getToken(user);

      return res.status(201).json({
        success: true,
        message: 'Registration successful!',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role
          }
        },
        token: token.token,
        expiresIn: token.expiresIn
      });
    } catch (err) {
      console.error('Register user error:', err);
      return res.status(500).json({
        success: false,
        message: 'Registration failed',
        ...(process.env.NODE_ENV === 'development' && { error: err.message })
      });
    }
  }
];


export const registerRider = [
  body('phoneNumber')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\+?[1-9]\d{9,14}$/).withMessage('Invalid phone number format'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('dateOfBirth')
    .notEmpty().withMessage('Date of birth is required')
    .isISO8601().withMessage('Invalid date format'),
  body('aadhaarNumber')
    .notEmpty().withMessage('Aadhaar number is required')
    .matches(/^\d{12}$/).withMessage('Aadhaar must be 12 digits'),
  body('panNumber')
    .notEmpty().withMessage('PAN number is required')
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).withMessage('Invalid PAN format'),
  body('dlNumber').notEmpty().withMessage('Driving license number is required'),
  body('dlExpiry')
    .notEmpty().withMessage('License expiry date is required')
    .isISO8601().withMessage('Invalid date format'),
  body('vehicleType')
    .isIn(['bike', 'auto', 'car']).withMessage('Vehicle type must be bike, auto, or car'),
  body('vehicleNumber').notEmpty().withMessage('Vehicle number is required'),
  body('vehicleModel').notEmpty().withMessage('Vehicle model is required'),
  body('vehicleYear')
    .isInt({ min: 2000, max: new Date().getFullYear() + 1 })
    .withMessage('Invalid vehicle year'),
  validate,
  async (req, res) => {
    try {
      const {
        phoneNumber,
        name, email,
        fullName, dateOfBirth, gender,
        aadhaarNumber, panNumber,
        dlNumber, dlExpiry,
        vehicleType, vehicleNumber, vehicleModel, vehicleYear, vehicleColor,
        bankAccountNumber, ifscCode, accountHolderName, bankName,
        address
      } = req.body;

      // ✅ Find or create user (role is always 'user')
      let user = await User.findOne({ phoneNumber });
      
      if (!user) {
        user = new User({
          phoneNumber,
          role: 'user',  // ✅ Always 'user' - never 'rider'
          name: name,
          email: email,
          isPhoneVerified: true,
          isProfileComplete: true
        });
        await user.save();
      } else {
        // ✅ Update existing user
        user.name = name;
        user.email = email;
        user.isPhoneVerified = true;
        user.isProfileComplete = true;
        // ✅ DO NOT change role - keep as 'user'
        await user.save();
      }

      // ✅ Check if user already has a rider profile
      const existingRider = await Rider.findOne({ userId: user._id });
      if (existingRider) {
        return res.status(400).json({
          success: false,
          message: 'User already has a rider profile'
        });
      }

      // ✅ Check unique fields
      const checks = await Promise.all([
        Rider.findOne({ 'aadhaar.number': aadhaarNumber }),
        Rider.findOne({ 'pan.number': panNumber }),
        Rider.findOne({ 'drivingLicense.number': dlNumber }),
        Rider.findOne({ 'vehicle.number': vehicleNumber })
      ]);

      if (checks[0]) {
        return res.status(400).json({
          success: false,
          message: 'Aadhaar already registered'
        });
      }
      if (checks[1]) {
        return res.status(400).json({
          success: false,
          message: 'PAN already registered'
        });
      }
      if (checks[2]) {
        return res.status(400).json({
          success: false,
          message: 'Driving license already registered'
        });
      }
      if (checks[3]) {
        return res.status(400).json({
          success: false,
          message: 'Vehicle already registered'
        });
      }

      if (email) {
        const emailExists = await User.findOne({ email, _id: { $ne: user._id } });
        if (emailExists) {
          return res.status(400).json({
            success: false,
            message: 'Email already in use'
          });
        }
      }

      // ✅ Create rider profile (separate collection)
      const rider = new Rider({
        userId: user._id,
        fullName,
        dateOfBirth,
        gender,
        address,
        aadhaar: { number: aadhaarNumber },
        pan: { number: panNumber },
        drivingLicense: { number: dlNumber, expiryDate: dlExpiry },
        vehicle: {
          type: vehicleType,
          number: vehicleNumber,
          model: vehicleModel,
          year: vehicleYear,
          color: vehicleColor
        },
        bank: { accountNumber: bankAccountNumber, ifscCode, accountHolderName, bankName },
        verificationStatus: 'pending',
        isApproved: false,
        isOnline: false
      });

      await rider.save();

      // ✅ Generate token
      const token = TokenService.getToken(user);

      return res.status(201).json({
        success: true,
        message: 'Rider registration successful!',
        data: {
          user: {
            id: user._id,
            name: user.name,
            phoneNumber: user.phoneNumber,
            role: user.role  // ✅ Always 'user'
          },
          rider: {
            id: rider._id,
            verificationStatus: rider.verificationStatus
          }
        },
        token: token.token,
        expiresIn: token.expiresIn
      });
    } catch (err) {
      console.error('Register rider error:', err);
      return res.status(500).json({
        success: false,
        message: 'Rider registration failed',
        ...(process.env.NODE_ENV === 'development' && { error: err.message })
      });
    }
  }
];

// ==================== LOGIN - SEND OTP ====================
export const loginSendOTP = [
  body('phoneNumber')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\+?[1-9]\d{9,14}$/).withMessage('Invalid phone number format'),
  validate,
  async (req, res) => {
    try {
      const { phoneNumber } = req.body;

      const user = await User.findOne({ phoneNumber, isProfileComplete: true });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Account not found. Please register first.'
        });
      }
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account deactivated.'
        });
      }

      const otp = OTPService.generate();
      user.otp = { code: otp, expiresAt: OTPService.expiryDate() };
      await user.save();

      await OTPService.send(phoneNumber, otp, 'login');

      return res.status(200).json({
        success: true,
        message: 'OTP sent for login.',
        data: {
          phoneNumber,
          role: user.role,
          otp: otp
        }
      });
    } catch (err) {
      console.error('Login send OTP error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to send login OTP',
        ...(process.env.NODE_ENV === 'development' && { error: err.message })
      });
    }
  }
];

// ==================== LOGIN - VERIFY OTP ====================
// export const loginVerifyOTP = [
//   body('phoneNumber').trim().notEmpty().withMessage('Phone number is required'),
//   body('otp')
//     .notEmpty().withMessage('OTP is required')
//     .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
//     .isNumeric().withMessage('OTP must be numeric'),
//   validate,
//   async (req, res) => {
//     try {
//       const { phoneNumber, otp } = req.body;

//       const user = await User.findOne({ phoneNumber });
//       if (!user) {
//         return res.status(404).json({
//           success: false,
//           message: 'User not found'
//         });
//       }

//       const result = OTPService.validate(user.otp, otp);
//       if (!result.valid) {
//         return res.status(400).json({
//           success: false,
//           message: result.message
//         });
//       }

//       user.otp = undefined;
//       await user.save();

//       let extraData = {};

//       if (user.role === 'rider') {
//         const rider = await Rider.findOne({ userId: user._id });
//         if (!rider) {
//           return res.status(404).json({
//             success: false,
//             message: 'Rider profile not found'
//           });
//         }
//         user.riderId = rider._id;
//         extraData = {
//           rider: {
//             id: rider._id,
//             verificationStatus: rider.verificationStatus,
//             isApproved: rider.isApproved,
//             isOnline: rider.isOnline
//           }
//         };
//       }

//       const token = TokenService.getToken(user);

//       return res.status(200).json({
//         success: true,
//         message: 'Login successful!',
//         data: {
//           user: {
//             id: user._id,
//             name: user.name,
//             email: user.email,
//             phoneNumber: user.phoneNumber,
//             role: user.role
//           },
//           ...extraData
//         },
//         token: token.token,
//         expiresIn: token.expiresIn
//       });
//     } catch (err) {
//       console.error('Login verify OTP error:', err);
//       return res.status(500).json({
//         success: false,
//         message: 'Login failed',
//         ...(process.env.NODE_ENV === 'development' && { error: err.message })
//       });
//     }
//   }
// ];

// ==================== LOGIN - VERIFY OTP ====================
export const loginVerifyOTP = [
  body('phoneNumber').trim().notEmpty().withMessage('Phone number is required'),
  body('otp')
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
    .isNumeric().withMessage('OTP must be numeric'),
  validate,
  async (req, res) => {
    try {
      const { phoneNumber, otp } = req.body;

      const user = await User.findOne({ phoneNumber });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const result = OTPService.validate(user.otp, otp);
      if (!result.valid) {
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }

      user.otp = undefined;
      await user.save();

      let extraData = {};

      // ✅ ALWAYS check Rider collection directly
      const rider = await Rider.findOne({ userId: user._id });
      if (rider) {
        extraData = {
          rider: {
            id: rider._id,
            verificationStatus: rider.verificationStatus,
            isApproved: rider.isApproved,
            isOnline: rider.isOnline
          }
        };
      }

      const token = TokenService.getToken(user);

      return res.status(200).json({
        success: true,
        message: 'Login successful!',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role
          },
          ...extraData
        },
        token: token.token,
        expiresIn: token.expiresIn
      });
    } catch (err) {
      console.error('Login verify OTP error:', err);
      return res.status(500).json({
        success: false,
        message: 'Login failed',
        ...(process.env.NODE_ENV === 'development' && { error: err.message })
      });
    }
  }
];

// ==================== LOGOUT ====================
export const logout = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({
      success: false,
      message: 'Logout failed',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};