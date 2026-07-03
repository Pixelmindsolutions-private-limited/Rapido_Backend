import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import * as riderController from '../controllers/riderController.js';

const router = express.Router();


// ==================== RIDER PROFILE ====================
router.get('/profile', authenticate, authorize('rider'), riderController.getMyProfile);
router.put('/profile', authenticate, authorize('rider'), riderController.updateMyProfile);
router.put('/online-status', authenticate, authorize('rider'), riderController.setOnlineStatus);

// ==================== RIDER LOCATION ====================
router.put('/location', authenticate, authorize('rider'), riderController.updateRiderLocation);
router.get('/location/:riderId', authenticate, riderController.getRiderLocation);

// ==================== RIDER DETAILS ====================
router.get('/:riderId', riderController.getRiderById);

router.get('/rides/new', authenticate, authorize('rider'), riderController.getNewRideNotifications);


// ==================== RIDER RIDES ====================
router.put('/ride/accept/:rideId', authenticate, authorize('rider'), riderController.acceptRide);
router.put('/ride/reject/:rideId', authenticate, authorize('rider'), riderController.rejectRide);
router.put('/ride/verify-start/:rideId', authenticate, authorize('rider'), riderController.verifyOTPAndStartRide);
router.put('/ride/complete/:rideId', authenticate, authorize('rider'), riderController.completeRide);
router.get('/ride/details/:rideId', authenticate, authorize('rider'), riderController.getRideDetails);

router.get('/ride/history', authenticate, authorize('rider'), riderController.getRiderRides);



export default router;