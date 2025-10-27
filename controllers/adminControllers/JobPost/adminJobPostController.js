const JobPost = require("../../models/JobPost/jobSchema");

// ✅ Admin: view all jobs (with filters)
exports.getAllJobPostsAdmin = async (req, res) => {
  try {
    const { status, category } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

    const jobs = await JobPost.find(filter).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Admin: block or remove a job post
exports.blockJobPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const job = await JobPost.findByIdAndUpdate(
      id,
      { status: "blocked", isApproved: false, reasonForBlock: reason },
      { new: true }
    );

    res.json({ message: "Job blocked", job });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
