const Categories= require('../../models/categorySchema');



exports.adminAddCategory = async (req, res) => {
  try {
    const { names } = req.body; // expects a string: "Men, Women, Kids"
    if (!names ) {
      return res.status(400).json({ message: "Category names are required" });
    }
 
    // Split by comma, trim spaces, capitalize first letter
    const inputCategories = names
      .filter(name => name) // remove empty strings
      .map(name => name.charAt(0).toUpperCase() + name.slice(1));
 
    if (!inputCategories.length) {
      return res.status(400).json({ message: "No valid category names provided" });
    }
 
    // Find existing categories in DB
    const existingCategories = await Categories.find({
      name: { $in: inputCategories }
    }).select("name").lean();
 
    const existingNames = existingCategories.map(cat => cat.name);
 
    // Filter out duplicates
    const newCategories = inputCategories.filter(name => !existingNames.includes(name));
 
    if (!newCategories.length) {
      return res.status(409).json({ message: "All categories already exist" });
    }
 
    // Insert new categories
    const createdCategories = await Categories.insertMany(
      newCategories.map(name => ({ name }))
    );
 
    return res.status(201).json({
      message: "Categories added successfully",
      addedCategories: createdCategories.map(cat => ({
        id: cat._id,
        name: cat.name
      }))
    });
  } catch (error) {
    console.error("Error adding categories:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};


exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.body; // expects category ID in body

    if (!id) {
      return res.status(400).json({ message: "Category ID is required" });
    }

    // Check if category exists
    const category = await Categories.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Delete the category
    await Categories.findByIdAndDelete(id);

    return res.status(200).json({
      message: "Category deleted successfully",
      deletedCategory: { id: category._id, name: category.name }
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

