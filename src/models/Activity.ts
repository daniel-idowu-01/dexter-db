import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    activity: {
      type: String,
      enum: [
        "login",
        "logout",
        "online",
        "changes",
        "bankAccount",
        "walletDetails",
        "order",
        "verification",
        "deactivate",
        "reactivate",
        "swap",
        "withdrawal",
        "supportConversation",
        "priceAlert",
        "watchList",
        "loyalty",
        "otp",
      ],
      default: "login",
      required: true,
    },

    description: {
      type: String,
    },

    iPAddress: {
      type: String,
    },

    location: {
      type: String,
    },

    userAgent: {
      type: String,
    },

    newDevice: {
      type: Boolean,
    },

    longitude: {
      type: Number,
    },

    latitude: {
      type: Number,
    },

    changeType: {
      type: String,
    },

    oldValue: {
      type: String,
    },

    newValue: {
      type: String,
    },
  }
);

export default mongoose.model<any>("Activity", activitySchema);
