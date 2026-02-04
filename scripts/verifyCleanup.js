require("dotenv").config();
const mongoose = require("mongoose");
const { prithuDB } = require("../database");
const { deleteFeedsBatch } = require("./feedCleanup");

// Models to verify
const Feed = require("../models/feedModel");
const UserComment = require("../models/userCommentModel");
const UserView = require("../models/userModels/userViewFeedsModel");
const UserFeedActions = require("../models/userFeedInterSectionModel");

async function runVerification() {
    try {
        console.log("🚀 Starting cleanup verification...");

        // 1. Get a test environment (need a user and a feed)
        // For testing, we'll create a dummy feed with a unique random ID
        const tempFeedId = new mongoose.Types.ObjectId();
        const tempUserId = new mongoose.Types.ObjectId();
        const testCategoryId = "68eddf4b7365581a6b2911df"; // Existing category "Joy"

        console.log(`📝 Creating test data for Feed ${tempFeedId}...`);

        // Create a dummy feed record with required fields
        await Feed.create({
            _id: tempFeedId,
            caption: "TEST_CLEANUP_FEED",
            uploadType: "normal",
            postType: "image",
            category: testCategoryId,
            mediaUrl: "temp_test_file.jpg",
            language: "en",
            status: "published",
            postedBy: {
                userId: tempUserId,
                name: "Test User"
            },
            storage: { paths: { media: "temp_test_file.jpg" } }
        });

        // Create a test comment
        await UserComment.create({
            feedId: tempFeedId,
            userId: tempUserId,
            commentText: "Test comment for cleanup"
        });

        // Create a test view
        await UserView.create({
            feedId: tempFeedId,
            userId: tempUserId,
            watchDuration: 10
        });

        // Create a test action in UserFeedActions
        await UserFeedActions.findOneAndUpdate(
            { userId: tempUserId },
            { $push: { likedFeeds: { feedId: tempFeedId } } },
            { upsert: true, new: true }
        );

        console.log("🌵 Test data created. Verifying existence...");

        const check1 = await Feed.findById(tempFeedId);
        const check2 = await UserComment.findOne({ feedId: tempFeedId });
        const check3 = await UserView.findOne({ feedId: tempFeedId });
        const check4 = await UserFeedActions.findOne({ userId: tempUserId, "likedFeeds.feedId": tempFeedId });

        if (check1 && check2 && check3 && check4) {
            console.log("✅ All test records exist. Running cleanup...");
        } else {
            console.error("❌ Failed to create all test records pre-cleanup.");
            process.exit(1);
        }

        // 2. Run Cleanup
        await deleteFeedsBatch(null, [tempFeedId.toString()]);

        // 3. Verify Deletion
        console.log("🔍 Verifying deletion results...");

        const finalCheck1 = await Feed.findById(tempFeedId);
        const finalCheck2 = await UserComment.findOne({ feedId: tempFeedId });
        const finalCheck3 = await UserView.findOne({ feedId: tempFeedId });
        const finalCheck4 = await UserFeedActions.findOne({ userId: tempUserId, "likedFeeds.feedId": tempFeedId });

        const errors = [];
        if (finalCheck1) errors.push("Feed document still exists");
        if (finalCheck2) errors.push("Comment document still exists");
        if (finalCheck3) errors.push("View document still exists");
        if (finalCheck4) errors.push("Interaction still exists in UserFeedActions");

        if (errors.length === 0) {
            console.log("🏆 SUCCESS: All related data was successfully deleted/updated!");
        } else {
            console.error("❌ FAILURE: Some records remain:", errors);
        }

    } catch (err) {
        console.error("💥 Verification Crash:", err);
    } finally {
        process.exit(0);
    }
}

// Wait for DB connection
prithuDB.on('connected', runVerification);
