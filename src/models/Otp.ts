import mongoose from "mongoose";

const OtpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    otp: {
      type: String,
      required: false,
    },
    rawOtp: {
      type: String,
      required: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    email: {
      type: String,
    },
    username: {
      type: String,
    },
    smsOtp: {
      type: String,
    },
    rawSmsOtp: {
      type: String,
    },
    phoneNumber: {
      type: String,
    },
    otpCount: {
      type: Number,
      default: 0,
    },
    termiiPinId: {
      type: String,
    },
    channel: {
      type: String,
    },
  }
);

export default mongoose.model<any>("Otp", OtpSchema);
