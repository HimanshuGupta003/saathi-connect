import { Schema as _Schema, model } from "mongoose";
const Schema = _Schema;

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

const userSchema = new Schema(
  {
    googleId: { type: String },
    name: { type: String, required: true, trim: true },
    avatarUrl: { type: String, default: "" },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phoneNumber: { type: String, trim: true },
    password: { type: String },
    address: addressSchema,
    role: {
      type: String,
      enum: ["citizen", "worker", "subhead", "admin", "super-admin"],
      default: "citizen",
    },
    zone: { type: Schema.Types.ObjectId, ref: "Zone" },
    department: { type: Schema.Types.ObjectId, ref: "Department" },
    points: { type: Number, default: 0 },
    fcmToken: { type: String, trim: true },
    badges: [{ name: String, earnedAt: { type: Date, default: Date.now } }],
    preferredLanguage: { type: String, default: "en", trim: true },
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  { timestamps: true }
);

const User = model("User", userSchema);
export default User;
