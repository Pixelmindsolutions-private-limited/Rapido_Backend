// import dns from 'dns';
// import express from 'express';
// import cors from 'cors';
// import helmet from 'helmet';
// import morgan from 'morgan';
// import rateLimit from 'express-rate-limit';
// import dotenv from 'dotenv';
// import mongoose from 'mongoose';
// import connectDB from './config/db.js';
// import authRoutes from './routes/authRoutes.js';
// import userRoutes from './routes/userRoutes.js';
// import riderRoutes from './routes/riderRoutes.js';
// import adminRoutes from './routes/adminRoutes.js';

// // DNS settings
// dns.setDefaultResultOrder('ipv4first');
// dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

// dotenv.config();

// const app = express();
// const PORT = process.env.PORT || 6033;

// // Connect to MongoDB
// connectDB();


// mongoose.connection.once('open', async () => {
//   try {
//     // Create geospatial index for riders
//     await mongoose.connection.db.collection('riders').createIndex(
//       { "currentLocation.coordinates": "2dsphere" }
//     );
//     console.log('✅ Geospatial index created for riders');
//   } catch (error) {
//     console.log('⚠️ Index creation warning:', error.message);
//   }
// });


// // Middleware
// app.use(helmet());
// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// if (process.env.NODE_ENV === 'development') {
//   app.use(morgan('dev'));
// }

// // Rate limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100,
//   message: { success: false, message: 'Too many requests, please try again later.' }
// });
// app.use('/api/', limiter);

// // Routes
// app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/riders', riderRoutes);
// app.use('/api/admin', adminRoutes);

// // Health check
// app.get('/health', (req, res) => {
//   res.status(200).json({
//     success: true,
//     message: 'Server is running',
//     timestamp: new Date(),
//     environment: process.env.NODE_ENV
//   });
// });

// // 404 handler
// app.use((req, res) => {
//   res.status(404).json({
//     success: false,
//     message: `Route ${req.originalUrl} not found`
//   });
// });

// // Global error handler
// app.use((err, req, res, next) => {
//   console.error('❌ Error:', err.message);
//   res.status(err.statusCode || 500).json({
//     success: false,
//     message: err.message || 'Internal Server Error',
//     ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
//   });
// });

// // Start server
// app.listen(PORT, () => {
//   console.log('='.repeat(50));
//   console.log(`🚀 Server running on port ${PORT}`);
//   console.log(`📌 Environment: ${process.env.NODE_ENV || 'development'}`);
//   console.log(`🔗 API base: http://localhost:${PORT}/api`);
//   console.log(`💡 OTP Mode: ${process.env.OTP_DEV_MODE === 'true' ? 'DEV (1234)' : 'PRODUCTION'}`);
//   console.log('='.repeat(50));
// });


import dns from 'dns';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createServer } from 'http';  // ✅ Required for Socket.IO
import { Server as SocketServer } from 'socket.io';  // ✅ Socket.IO import
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import riderRoutes from './routes/riderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

// DNS settings
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 6033;

// ✅ CREATE HTTP SERVER (Instead of app.listen directly)
const server = createServer(app);

// ✅ INITIALIZE SOCKET.IO
const io = new SocketServer(server, {
  cors: {
    origin: '*',  // Allow all origins (configure for production)
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// ✅ Make io available globally and in routes
global.io = io;
app.set('io', io);

// Connect to MongoDB
connectDB();

// ✅ Create geospatial index for riders
mongoose.connection.once('open', async () => {
  try {
    // Check if riders collection exists
    const collections = await mongoose.connection.db.listCollections().toArray();
    const ridersExists = collections.some(col => col.name === 'riders');
    
    if (ridersExists) {
      await mongoose.connection.db.collection('riders').createIndex(
        { "currentLocation.coordinates": "2dsphere" }
      );
      console.log('✅ Geospatial index created for riders');
    } else {
      console.log('⚠️ Riders collection not found, index will be created when first rider is added');
    }
  } catch (error) {
    console.log('⚠️ Index creation warning:', error.message);
  }
});

// ==================== EXPRESS MIDDLEWARE ====================
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// ==================== EXPRESS ROUTES ====================
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/riders', riderRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date(),
    environment: process.env.NODE_ENV,
    database: dbStatus,
    socketIO: io ? 'Enabled' : 'Disabled'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ==================== SOCKET.IO EVENTS ====================
io.on('connection', (socket) => {
  console.log(`🔵 User connected: ${socket.id}`);

  // ---- 1. RIDER JOINS ----
  socket.on('rider:join', (data) => {
    const { riderId } = data;
    if (riderId) {
      socket.join(`rider_${riderId}`);
      console.log(`🏍️ Rider ${riderId} joined room`);
    }
  });

  // ---- 2. USER JOINS ----
  socket.on('user:join', (data) => {
    const { userId } = data;
    if (userId) {
      socket.join(`user_${userId}`);
      console.log(`👤 User ${userId} joined room`);
    }
  });

  // ---- 3. RIDER SENDS LOCATION ----
  socket.on('rider:location', (data) => {
    const { riderId, latitude, longitude, address } = data;
    
    if (riderId) {
      // Broadcast to users tracking this rider
      socket.to(`rider_${riderId}`).emit('rider:location:update', {
        riderId,
        latitude,
        longitude,
        address,
        timestamp: new Date()
      });
      console.log(`📍 Rider ${riderId} location updated`);
    }
  });

  // ---- 4. USER TRACKS RIDER ----
  socket.on('user:track-rider', (data) => {
    const { riderId, userId } = data;
    if (riderId) {
      socket.join(`rider_${riderId}`);
      console.log(`👤 User ${userId} tracking rider ${riderId}`);
    }
  });

  // ---- 5. USER STOPS TRACKING ----
  socket.on('user:stop-tracking', (data) => {
    const { riderId } = data;
    if (riderId) {
      socket.leave(`rider_${riderId}`);
      console.log(`👤 User stopped tracking rider ${riderId}`);
    }
  });


  // ✅ ---- 6. RIDER ACCEPTS RIDE (NEW) ----
  socket.on('ride:accept-ride', (data) => {
    const { rideId, riderId, userId } = data;
    console.log(`✅ Rider ${riderId} accepted ride ${rideId}`);
    io.to(`user_${userId}`).emit('ride:accepted', {
      rideId,
      riderId,
      message: 'Rider accepted your ride! They are on the way.'
    });
  });

  // ✅ ---- 7. RIDER REJECTS RIDE (NEW) ----
  socket.on('ride:reject-ride', (data) => {
    const { rideId, riderId, userId, rejectedCount, totalRiders } = data;
    console.log(`❌ Rider ${riderId} rejected ride ${rideId}`);
    io.to(`user_${userId}`).emit('ride:rejected', {
      rideId,
      riderId,
      rejectedCount,
      totalRiders,
      message: `${rejectedCount}/${totalRiders} riders declined`
    });
  });

  // ✅ ---- 8. RIDE STATUS UPDATE (NEW) ----
  socket.on('ride:status-update', (data) => {
    const { rideId, userId, status, message } = data;
    io.to(`user_${userId}`).emit('ride:status-update', {
      rideId,
      status,
      message,
      timestamp: new Date()
    });
    console.log(`📢 Ride ${rideId} status: ${status}`);
  });

  // ✅ ---- 9. RIDE CANCELLED (NEW) ----
  socket.on('ride:cancelled', (data) => {
    const { rideId, userId, message } = data;
    io.to(`user_${userId}`).emit('ride:cancelled', {
      rideId,
      message,
      timestamp: new Date()
    });
    console.log(`❌ Ride ${rideId} cancelled`);
  });

  // ---- 6. DISCONNECT ----
  socket.on('disconnect', () => {
    console.log(`🔴 User disconnected: ${socket.id}`);
  });

  // ---- 7. ERROR HANDLING ----
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// ==================== START SERVER ====================
server.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📌 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API base: http://localhost:${PORT}/api`);
  console.log(`📡 Socket.IO: Enabled`);
  console.log(`💡 OTP Mode: ${process.env.OTP_DEV_MODE === 'true' ? 'DEV (1234)' : 'PRODUCTION'}`);
  console.log('='.repeat(50));
});