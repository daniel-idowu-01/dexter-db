import mongoose from "mongoose";

const currencySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    ticker: {
      type: String,
      required: true,
    },
    chainId: {
      type: String,
    },
    chainIcon: {
      type: String,
    },
    isCrypto: {
      type: Boolean,
      default: true,
    },
    network: {
      type: String,
    },
    description: {
      type: String,
    },
    icon: {
      type: String,
    },
    website: {
      type: String,
    },
    twitter: {
      type: String,
    },
    explorer: {
      type: String,
    },
    baseAmount: {
      type: Number,
    },
    priceFeedId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PriceFeed",
    },
    gasTokenTicker: {
      type: String,
    },
    minGasAmount: {
      type: Number,
    },
    gasBuffer: {
      type: Number,
    },
    isDeleted: {
      type: Boolean,
    },
    deletedAt: {
      type: Date,
    },
  }
);

currencySchema.index({ contract: 1 }, { sparse: true });

export default mongoose.model<any>("Currency", currencySchema);
