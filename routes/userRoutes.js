import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as userController from '../controllers/userController.js';

const router = express.Router();

// ==================== USER PROFILE ====================
router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, userController.updateProfile);

// ==================== USER LOCATION ====================
router.put('/location', authenticate, userController.updateUserLocation);
router.get('/location', authenticate, userController.getUserLocation);
router.get('/nearby/riders', authenticate, userController.findNearbyRiders);

router.post('/ride/estimate', authenticate, userController.getFareEstimate);

// ==================== USER RIDES ====================
router.post('/ride/request', authenticate, userController.requestRide);
router.get('/ride/status/:rideId', authenticate, userController.getRideStatus);
router.put('/ride/cancel/:rideId', authenticate, userController.cancelRide);
router.get('/ride/history', authenticate, userController.getRideHistory);

export default router;