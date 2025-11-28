import { connect } from "mongoose";

const connectDB = async () => {
  try {
    const autoIndex = process.env.NODE_ENV !== "production";
    await connect(process.env.MONGO_URI, { autoIndex });
    console.log("✅ Successfully connected to MongoDB Atlas!");
  } catch (err) {
    console.error("❌ Error connecting to MongoDB Atlas:", err.message);
    process.exit(1);
  }
};

export default connectDB;
