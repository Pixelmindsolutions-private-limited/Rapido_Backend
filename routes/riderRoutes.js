import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authenticateRider } from '../middleware/authenticateRider.js';
import * as riderController from '../controllers/riderController.js';

const router = express.Router();


// ==================== RIDER PROFILE ====================
router.get('/profile', authenticate, authenticateRider, riderController.getMyProfile);
router.put('/profile', authenticate, authenticateRider, riderController.updateMyProfile);
router.put('/online-status', authenticate, authenticateRider, riderController.setOnlineStatus);

// ==================== RIDER LOCATION ====================
router.put('/location', authenticate, authenticateRider, riderController.updateRiderLocation);
router.get('/location/:riderId', authenticate, riderController.getRiderLocation);

// ==================== RIDER DETAILS ====================
router.get('/:riderId', riderController.getRiderById);

router.get(
    '/rides/new',
    authenticate,
    authenticateRider,
    riderController.getNewRideNotifications
);


// ==================== RIDER RIDES ====================
router.put('/ride/accept/:rideId', authenticate, authenticateRider, riderController.acceptRide);
router.put('/ride/reject/:rideId', authenticate, authenticateRider, riderController.rejectRide);
router.put('/ride/verify-start/:rideId', authenticate, authenticateRider, riderController.verifyOTPAndStartRide);
router.put('/ride/complete/:rideId', authenticate, authenticateRider, riderController.completeRide);
router.get('/ride/details/:rideId', authenticate, authenticateRider, riderController.getRideDetails);

router.get(
    '/ride/history',
    authenticate,
    authenticateRider,
    riderController.getRiderRides
);



export default router;
