import mongoose, { Schema, Document } from "mongoose";

export interface IPost extends Document {
  title: string;
  content?: string;
  published: boolean;
  tags: string[];
  authorId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
    },
    published: {
      type: Boolean,
      default: false,
    },
    tags: {
      type: [String],
      default: [],
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "posts",
  }
);

export default mongoose.model<IPost>('Post', PostSchema);
