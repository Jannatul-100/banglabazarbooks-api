import * as mongoose from 'mongoose';

export const AdminSchema = new mongoose.Schema(
  {
    readOnly: {
      type: Boolean,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    phoneNo: {
      type: String,
      required: false,
    },
    email: {
      type: String,
      required: false,
    },
    gender: {
      type: String,
      required: false,
    },
    profileImg: {
      type: String,
    },
    hasAccess: {
      type: Boolean,
      required: true,
    },
    role: {
      type: String,
      required: true,
    },
    permissions: {
      type: [String],
      required: false,
    },
    accessPages: {
      type: [String],
      required: false,
    },
    registrationAt: {
      type: String,
      required: false,
    },
    lastLoggedIn: {
      type: Date,
      required: false,
    },
    publisher: {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Publisher',
        required: false,
      },
      name: {
        type: String,
        required: false,
      },
      slug: {
        type: String,
        required: false,
      },
    },
  },
  {
    versionKey: false,
    timestamps: true,
  },
);
