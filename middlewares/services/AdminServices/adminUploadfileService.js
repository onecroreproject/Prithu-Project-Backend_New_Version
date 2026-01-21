const Feed = require("../../../models/feedModel");
const Categories = require("../../../models/categorySchema");
const Admin = require("../../../models/adminModels/adminModel");
const ChildAdmin = require("../../../models/childAdminModel");
const mongoose = require("mongoose");
const sharp = require("sharp");
const crypto = require("crypto");

class FeedService {
  /**
   * Upload feed with design metadata
   */
  static async uploadFeed(feedData, file, userId, roleRef) {
    const session = await mongoose.startSession();
    
    try {
      await session.startTransaction();
      
      const {
        language,
        categoryId,
        type,
        dec,
        contentUrl,
        storageType,
        driveFileId,
        designMetadata,
        themeColors,
        scheduleDate
      } = feedData;

      // Validate required fields
      if (!language || !categoryId || !type) {
        throw new Error("Missing required fields: language, categoryId, type");
      }

      if (!file || !contentUrl) {
        throw new Error("Invalid file data");
      }

      // Extract dominant color if not provided
      let extractedTheme = themeColors || await this.extractThemeFromFile(file);
      
      // Create feed document
      const feedDoc = {
        type,
        language,
        category: categoryId,
        createdByAccount: userId,
        roleRef,
        contentUrl,
        storageType,
        driveFileId,
        
        // Files array
        files: [{
          url: contentUrl,
          type,
          mimeType: file.mimetype,
          size: file.size || 0,
          duration: file.duration || null,
          storageType,
          driveFileId,
          order: 0,
          ...(file.thumbnail && { thumbnail: file.thumbnail }),
          ...(file.dimensions && { dimensions: file.dimensions })
        }],

        dec: dec || "",
        fileHash: file.fileHash,
        
        // Theme colors
        themeColor: {
          primary: extractedTheme.primary,
          secondary: extractedTheme.secondary,
          accent: extractedTheme.accent || "#ffffff",
          gradient: extractedTheme.gradient || `linear-gradient(135deg, ${extractedTheme.primary}, ${extractedTheme.secondary})`,
          text: extractedTheme.text || "#000000"
        },

        // Design metadata from frontend
        editMetadata: designMetadata || {},

        // Scheduling
        isScheduled: !!scheduleDate,
        scheduleDate: scheduleDate ? new Date(scheduleDate) : null,
        status: scheduleDate ? "Scheduled" : "Published"
      };

      const newFeed = new Feed(feedDoc);
      await newFeed.save({ session });

      // Update category
      await this.updateCategoryFeed(categoryId, newFeed._id, session);

      await session.commitTransaction();
      
      return {
        success: true,
        feed: newFeed,
        message: "Feed uploaded successfully"
      };

    } catch (error) {
      await session.abortTransaction();
      console.error("Feed upload service error:", error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Extract dominant color from file
   */
  static async extractThemeFromFile(file) {
    try {
      // For images, use sharp to extract dominant color
      if (file.mimetype.startsWith('image/') && file.buffer) {
        const { dominant } = await sharp(file.buffer)
          .resize(100, 100)
          .raw()
          .toBuffer({ resolveWithObject: true })
          .then(({ data, info }) => {
            // Simple dominant color extraction
            let r = 0, g = 0, b = 0;
            for (let i = 0; i < data.length; i += 4) {
              r += data[i];
              g += data[i + 1];
              b += data[i + 2];
            }
            const count = data.length / 4;
            return {
              r: Math.round(r / count),
              g: Math.round(g / count),
              b: Math.round(b / count)
            };
          });

        const primary = this.rgbToHex(dominant.r, dominant.g, dominant.b);
        const secondary = this.darkenHex(primary, 40);
        
        return {
          primary,
          secondary,
          gradient: `linear-gradient(135deg, ${primary}, ${secondary})`
        };
      }
    } catch (error) {
      console.error("Theme extraction failed:", error);
    }

    // Fallback colors
    return {
      primary: "#2563eb",
      secondary: "#1e40af",
      gradient: "linear-gradient(135deg, #2563eb, #1e40af)"
    };
  }

  /**
   * RGB to Hex conversion
   */
  static rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    }).join("");
  }

  /**
   * Darken hex color
   */
  static darkenHex(hex, amount = 30) {
    let c = hex.replace("#", "");
    if (c.length === 3) {
      c = c.split('').map(char => char + char).join('');
    }
    
    let r = parseInt(c.slice(0, 2), 16);
    let g = parseInt(c.slice(2, 4), 16);
    let b = parseInt(c.slice(4, 6), 16);

    r = Math.max(0, r - amount);
    g = Math.max(0, g - amount);
    b = Math.max(0, b - amount);

    return this.rgbToHex(r, g, b);
  }

  /**
   * Update category with feed ID
   */
  static async updateCategoryFeed(categoryId, feedId, session) {
    try {
      await mongoose.model('Categories').updateOne(
        { _id: categoryId },
        { $addToSet: { feedIds: feedId } },
        { session }
      );
    } catch (error) {
      console.error("Category update failed:", error);
      throw error;
    }
  }

  /**
   * Bulk upload feeds
   */
  static async bulkUploadFeeds(feedDataArray, userId, roleRef) {
    const session = await mongoose.startSession();
    const results = [];

    try {
      await session.startTransaction();

      for (const feedData of feedDataArray) {
        try {
          const result = await this.uploadFeed(feedData, feedData.file, userId, roleRef);
          results.push({
            success: true,
            feedId: result.feed._id,
            filename: feedData.file.filename
          });
        } catch (error) {
          results.push({
            success: false,
            filename: feedData.file?.filename,
            error: error.message
          });
        }
      }

      await session.commitTransaction();
      return results;

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get feed with optimized query
   */
  static async getFeed(feedId, userId) {
    try {
      const feed = await Feed.findOne({
        _id: feedId,
        $or: [
          { audience: "public" },
          { audience: "followers" },
          { createdByAccount: userId },
          { allowedUsers: userId }
        ]
      })
      .select('-__v -previousVersions')
      .populate('category', 'name icon color')
      .populate('createdByAccount', 'username name profilePic')
      .lean();

      if (!feed) {
        throw new Error("Feed not found or access denied");
      }

      // Add virtuals manually
      feed.formattedUrl = feed.contentUrl || (feed.files && feed.files[0]?.url);
      feed.thumbnailUrl = feed.type === 'video' && feed.files && feed.files[0]?.thumbnail 
        ? feed.files[0].thumbnail 
        : feed.formattedUrl;

      return feed;
    } catch (error) {
      console.error("Get feed error:", error);
      throw error;
    }
  }

  /**
   * Update feed design metadata
   */
  static async updateDesignMetadata(feedId, userId, designData) {
    const session = await mongoose.startSession();
    
    try {
      await session.startTransaction();

      const feed = await Feed.findOne({
        _id: feedId,
        createdByAccount: userId
      }).session(session);

      if (!feed) {
        throw new Error("Feed not found or access denied");
      }

      // Save current version to history
      await feed.saveEditHistory(userId);

      // Update with new design data
      feed.editMetadata = {
        ...feed.editMetadata,
        ...designData
      };

      // Update theme colors if provided
      if (designData.themeColors) {
        feed.themeColor = {
          ...feed.themeColor,
          ...designData.themeColors
        };
      }

      await feed.save({ session });
      await session.commitTransaction();

      return {
        success: true,
        feed: feed,
        message: "Design updated successfully"
      };

    } catch (error) {
      await session.abortTransaction();
      console.error("Update design error:", error);
      throw error;
    } finally {
      session.endSession();
    }
  }
}

module.exports = FeedService;




