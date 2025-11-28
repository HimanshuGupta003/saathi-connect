// --- IMPORT CORE LIBRARIES (ESM) ---
import dotenv from "dotenv";
dotenv.config();
import express, { json } from "express";
import cors from "cors";
import passport from "passport";
import cookieParser from "cookie-parser";
import http from 'http';
import { Server } from 'socket.io';

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import userManagementRoutes from "./routes/userManagement.routes.js";
import departmentRoutes from "./routes/department.routes.js";
import zoneRoutes from "./routes/zone.routes.js";
import reportRoutes from "./routes/report.routes.js";
import gamificationRoutes from "./routes/gamification.routes.js";
import transparencyRoutes from "./routes/transparency.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import superAdminRoutes from "./routes/superadmin.routes.js";
import subheadRoutes from "./routes/subhead.routes.js";
import notificationRoutes from "./routes/notification.routes.js";

import Report from "./models/Report.model.js";
import Zone from "./models/Zone.model.js";

// --- IMPORT CUSTOM FILES & JOBS (ensure .js extensions) ---
import connectDB from "./config/db.js";
import slaTracker from "./jobs/slaTracker.js";
import weatherJob from "./jobs/weatherJob.js";
import configurePassport from "./config/passport.js";

// --- INITIALIZE THE APP ---
await connectDB();
const app = express();
const server = http.createServer(app); //himanshu

// ---MIDDLEWARE SETUP ---
app.use(cors({ origin: true, credentials: true }));
app.use(json());
app.use(cookieParser());

// --- PASSPORT MIDDLEWARE ---
configurePassport(passport);
app.use(passport.initialize());

const io = new Server(server, {//himanshu
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173", // Use env variable for production
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.set('socketio', io);//himanshu

io.on('connection', (socket) => {//himanshu
  console.log('✅ A user connected via WebSocket:', socket.id);
  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
  });
});

app.get("/", (req, res) => res.send("Civic Issue API is running..."));


// Mount
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin/staff", userManagementRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/zones", zoneRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/gamification", gamificationRoutes);
app.use("/api/transparency", transparencyRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/super-admin", superAdminRoutes);
app.use("/api/subhead", subheadRoutes);
app.use("/api/notifications", notificationRoutes);

// --- 5. ENSURE INDEXES (especially 2dsphere) ---
const shouldSyncIndexes =
  process.env.SYNC_INDEXES === "true" || process.env.NODE_ENV !== "production";
if (shouldSyncIndexes) {
  try {
    await Report.syncIndexes();
    await Zone.syncIndexes();
    console.log("✅ Mongoose indexes are in sync.");
  } catch (e) {
    console.warn("⚠️ Index sync warning:", e?.message || e);
  }
} else {
  console.log(
    "ℹ️ Skipping index sync (production mode). Set SYNC_INDEXES=true to force."
  );
}

// --- 6. SCHEDULE BACKGROUND JOBS ---
slaTracker.startSlaTracker();
weatherJob.startWeatherJob();

// --- 7. START THE SERVER ---
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`🚀 Server started on port ${PORT}`));
