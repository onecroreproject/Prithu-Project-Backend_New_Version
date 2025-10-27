const JobPost = require("../../models/JobPost/jobSchema");


// ✅ Create Job Post (User)
exports.createJobPost = async (req, res) => {
  try {
    const userId = req.Id;
    const { title, description, companyName, location, category, startDate, endDate, isPaid, image } = req.body;

    if (!title || !description || !startDate || !endDate)
      return res.status(400).json({ message: "All required fields must be filled" });

    const job = await JobPost.create({
      postedBy: userId,
      title,
      description,
      companyName,
      location,
      category,
      startDate,
      endDate,
      isPaid: isPaid || false,
      image,
      priorityScore: isPaid ? 10 : 1, // Paid posts get higher priority
    });

    res.status(201).json({ message: "Job post created successfully", job });
  } catch (error) {
    console.error("Error creating job post:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// ✅ Get All Jobs (Feed) - visible to users
exports.getAllJobs = async (req, res) => {
  try {
    const { category, location, isPaid, language } = req.query;

    const filter = { status: "active" };
    if (category) filter.category = category;
    if (location) filter.location = location;
    if (isPaid) filter.isPaid = isPaid === "true";
    if (language) filter.language = language;

    // Sort by: Paid → priority → recent
    const jobs = await JobPost.find(filter)
      .sort({ isPaid: -1, priorityScore: -1, createdAt: -1 })
      .populate("postedBy", "name email");

    res.json(jobs);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// ✅ Get Job by ID (detail view)
exports.getJobById = async (req, res) => {
  try {
    const job = await JobPost.findById(req.params.id).populate("postedBy", "name email");
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json(job);
  } catch (error) {
    console.error("Error fetching job:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Auto deactivate expired jobs (can also be run by CRON)
exports.deactivateExpiredJobs = async () => {
  const now = new Date();
  await JobPost.updateMany(
    { endDate: { $lt: now }, status: "active" },
    { $set: { status: "expired" } }
  );
  console.log("✅ Expired jobs deactivated");
};
