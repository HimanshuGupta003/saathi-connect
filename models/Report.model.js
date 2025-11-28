import mongoose from "mongoose";
const { Schema } = mongoose;

const addressSchema = new Schema(
  {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true, default: "India" },
  },
  { _id: false }
);

const historyEntrySchema = new Schema({
  status: String,
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  timestamp: { type: Date, default: Date.now },
  notes: String,
  proofImageUrl: String,
});

const reportSchema = new Schema(
  {
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    isAnonymous: { type: Boolean, default: false },
    description: { type: String, required: true, trim: true },
    location: {
      type: { type: String, enum: ["Point"], required: true },
      coordinates: { type: [Number], required: true },
    },
    address: addressSchema,
    imageUrl: { type: String, required: true },
    category: { type: String, required: true },
    status: {
      type: String,
      enum: [
        "Pending",
        "Approved",
        "AssignedToDept",
        "AssignedToWorker",
        "InProgress",
        "Resolved",
        "Rejected",
      ],
      default: "Pending",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
    },
    upvotes: { type: Number, default: 0 },
    upvotedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    assignedDepartment: { type: Schema.Types.ObjectId, ref: "Department" },
    zone: { type: Schema.Types.ObjectId, ref: "Zone" },
    assignedWorker: { type: Schema.Types.ObjectId, ref: "User" },
    fundsAllocated: { type: Number, default: 0 },
    rejectionReason: { type: String, trim: true },
    history: [historyEntrySchema],
    locationAuthenticity: {
      type: String,
      enum: ['VERIFIED_IN_APP', 'GALLERY_UPLOAD', 'LOCATION_MISMATCH', 'NO_EXIF_DATA', 'CHECK_FAILED', 'NOT_AVAILABLE'],
      default: 'NOT_AVAILABLE'
    },
    // AI analysis metadata (optional)
    aiAnalyzed: { type: Boolean, default: false },
    aiPredictedCategory: { type: String, trim: true },
    aiSource: { type: String, trim: true }, // e.g., 'on-device', 'server'
    aiConfidence: { type: Number },
  },
  { timestamps: true }
);

// Primary geospatial index
reportSchema.index({ location: "2dsphere" });
// Optional compound index if needed by query patterns (uncomment if required)
// reportSchema.index({ category: 1, status: 1 });

const Report = mongoose.model("Report", reportSchema);
export default Report;
