// models/userModels/userProfile/certificationSchema.js
const mongoose = require("mongoose");

const certificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  issuingOrganization: { type: String, required: true },
  issueDate: { type: Date },
  expirationDate: { type: Date },
  credentialId: { type: String },
  credentialURL: { type: String },
});

module.exports = certificationSchema;
