const ChildAdmin =require ('../../models/childAdminModel');


exports.getChildAdmins = async (req, res) => {
  try {
    const parentAdminId = req.Id;

    const childAdmins = await ChildAdmin.find(
      { parentAdminId, isActive: true },
      'userName email childAdminId childAdminType isApprovedByParent createdAt'
    ).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, admins: childAdmins });
  } catch (error) {
    console.error('Error fetching child admins:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};





exports.getChildAdminPermissions = async (req, res) => {
  try {
    const { childAdminId } = req.params;
    if (!childAdminId) {
      return res.status(400).json({ success: false, message: 'Child Admin ID is required' });
    }

    const childAdmin = await ChildAdmin.findOne({ _id: childAdminId })
      .select('childAdminId userName email grantedPermissions ungrantedPermissions customPermissions menuPermissions isApprovedByParent');

    if (!childAdmin) {
      return res.status(404).json({ success: false, message: 'Child admin not found' });
    }

    return res.status(200).json({
      success: true,
      childAdmin: {
        childAdminId: childAdmin.childAdminId,
        userName: childAdmin.userName,
        email: childAdmin.email,
        isApprovedByParent: childAdmin.isApprovedByParent,
        grantedPermissions: childAdmin.grantedPermissions,
        ungrantedPermissions: childAdmin.ungrantedPermissions,
        customPermissions: childAdmin.customPermissions,
        menuPermissions: childAdmin.menuPermissions,
      },
    });
  } catch (error) {
    console.error('Failed to fetch child admin permissions:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};






exports.updateChildAdminPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { grantedPermissions = [], customPermissions = {}, menuPermissions = [] } = req.body;

    if (!Array.isArray(grantedPermissions)) {
      return res.status(400).json({ success: false, message: 'grantedPermissions must be an array' });
    }

    // ✅ List of all defined system permissions
    const ALL_PERMISSIONS = [
      'canManageChildAdmins',
      'canManageUsers',
      'canManageCreators',
      'canManageFeeds',
      'canManageSettings',
      'canManageBusinesses',
      'canManageCategories',
      'canManageReports',
      'canViewAnalytics'
    ];

    // Compute ungranted permissions
    const ungrantedPermissions = ALL_PERMISSIONS.filter(p => !grantedPermissions.includes(p));

    // ✅ Update efficiently using findOneAndUpdate
    const updatedAdmin = await ChildAdmin.findOneAndUpdate(
      { childAdminId: id },
      {
        grantedPermissions,
        ungrantedPermissions,
        customPermissions,
        menuPermissions,
        updatedBy: req.Id, // parent admin id
      },
      { new: true, lean: true }
    );

    if (!updatedAdmin) {
      return res.status(404).json({ success: false, message: 'Child admin not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Permissions updated successfully',
      childAdmin: {
        childAdminId: updatedAdmin.childAdminId,
        grantedPermissions: updatedAdmin.grantedPermissions,
        ungrantedPermissions: updatedAdmin.ungrantedPermissions,
        customPermissions: updatedAdmin.customPermissions,
        menuPermissions: updatedAdmin.menuPermissions,
      },
    });
  } catch (error) {
    console.error('Error updating child admin permissions:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
