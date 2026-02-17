const mongoose = require("mongoose");
const { prithuDB } = require("../database");

const staticPageSchema = new mongoose.Schema(
    {
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        title: {
            type: String,
            required: true
        },
        content: {
            type: String,
            required: true
        },
        lastUpdatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin"
        }
    },
    { timestamps: true }
);

module.exports = prithuDB.model("StaticPage", staticPageSchema, "StaticPage");
