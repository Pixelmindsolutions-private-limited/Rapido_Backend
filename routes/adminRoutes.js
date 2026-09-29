import express from 'express';
import { authenticateAdmin } from '../middleware/auth.js';
import * as adminController from '../controllers/adminController.js';

const router = express.Router();


// ==================== ADMIN PROFILE ====================
router.get('/profile', authenticateAdmin, adminController.getProfile);
router.get('/dashboard', authenticateAdmin, adminController.getDashboardStats);

// ==================== ADMIN - USER MANAGEMENT ====================
router.get('/users', authenticateAdmin, adminController.getAllUsers);
router.get('/users/:id', authenticateAdmin, adminController.getUserById);
router.put('/users/deactivate/:id', authenticateAdmin, adminController.deactivateUser);
router.put('/users/activate/:id', authenticateAdmin, adminController.activateUser);
router.delete('/users/:id', authenticateAdmin, adminController.deleteUser);


// ==================== ADMIN - RIDER MANAGEMENT ====================
router.get('/riders', authenticateAdmin, adminController.getAllRiders);
router.get('/riders/:id', authenticateAdmin, adminController.getRiderById);
router.put('/riders/verify/:id', authenticateAdmin, adminController.updateVerification);
router.put('/riders/online/:id', authenticateAdmin, adminController.toggleRiderOnlineStatus);
router.delete('/riders/:id', authenticateAdmin, adminController.deleteRider);


//===================== ADMIN - Booking====================
router.get('/users-bookings', adminController.getAllRides);
router.post('/rides/get-by-id', authenticateAdmin, adminController.getRideById);

export default router;