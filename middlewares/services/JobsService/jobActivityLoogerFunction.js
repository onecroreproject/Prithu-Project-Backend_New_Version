const CompanyActivityLog = require("../../../models/Job/CompanyModel/companyActivityLog");

exports.logCompanyActivity = async ({
  companyId,
  action,
  description = "",
  jobId = null,
  paymentId = null,
  changes = {},
  req = null,
}) => {
  try {
    await CompanyActivityLog.create({
      companyId,
      action,
      description,
      jobId,
      paymentId,
      changes,
      meta: {
        ip: req?.ip || "",
        userAgent: req?.headers["user-agent"] || "",
      },
    });
  } catch (err) {
    console.error("⚠ Error logging activity:", err.message);
  }
};
