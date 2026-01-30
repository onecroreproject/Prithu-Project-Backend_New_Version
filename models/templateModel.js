const mongoose = require("mongoose");
const { prithuDB } = require("../database");

const templateSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        previewImage: {
            driveFileId: { type: String },
            previewUrl: { type: String },
            mimeType: { type: String },
            originalName: { type: String },
            storageType: { type: String }
        },
        backgroundVideo: {
            driveFileId: { type: String, required: true },
            previewUrl: { type: String, required: true },
            mimeType: { type: String },
            originalName: { type: String },
            storageType: { type: String }
        },
        avatarMaskVideo: {
            driveFileId: { type: String },
            previewUrl: { type: String },
            mimeType: { type: String },
            originalName: { type: String },
            storageType: { type: String }
        },
        usernameMaskVideo: {
            driveFileId: { type: String },
            previewUrl: { type: String },
            mimeType: { type: String },
            originalName: { type: String },
            storageType: { type: String }
        },
        footerMaskVideo: {
            driveFileId: { type: String },
            previewUrl: { type: String },
            mimeType: { type: String },
            originalName: { type: String },
            storageType: { type: String }
        },
        templateJson: {
            duration: { type: Number, default: 8 },
            avatar: {
                x: { type: Number },
                y: { type: Number },
                size: { type: Number }
            },
            username: {
                x: { type: Number },
                y: { type: Number }
            },
            footer: {
                y: { type: Number },
                height: { type: Number }
            },
            textSlots: {
                username: {
                    x: { type: Number },
                    y: { type: Number }
                },
                phone: {
                    x: { type: Number },
                    y: { type: Number }
                },
                socialIcons: {
                    x: { type: Number },
                    y: { type: Number }
                }
            }
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin"
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform: function (doc, ret) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                return ret;
            }
        }
    }
);

module.exports = prithuDB.model("Template", templateSchema, "Templates");
