const path = require('path');

/**
 * Footer Style Configuration
 * 
 * You can manually edit these values to change the look of the footer 
 * in the downloaded videos.
 */
module.exports = {
    // Path to the font file (relative to this file or absolute)
    fontFile: path.join(__dirname, '../assets/OutfitVariableFont.ttf'),

    // Footer Dimensions (if null, defaults to heightPercent calculated from media)
    footerHeight: null, // Set to px value if you want to override heightPercent

    // Padding and Spacing (in px)
    paddingLeft: 60,
    paddingRight: 60,
    paddingTop: 25,   // Spacing from media-footer boundary
    paddingBottom: 0,
    socialIconSpacing: 72,

    // Elemental Gaps (in px)
    usernameSocialGap: 40,   // Minimum horizontal gap between name and icons
    emailPhoneGap: 40,       // Minimum horizontal gap between email and phone
    verticalRowSpacing: 50,  // Vertical gap between Row 1 and Row 2

    // Font sizes for different elements (in px)
    nameSize: 50,
    emailSize: 50,
    phoneSize: 50,

    // Shadow settings
    shadowColor: 'black@0.6',
    shadowX: 2,
    shadowY: 2
};
