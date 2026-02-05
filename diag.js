require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');

const PRITHU_DB_URI = process.env.PRITHU_DB_URI;
const db = mongoose.createConnection(PRITHU_DB_URI);

db.on('connected', async () => {
    try {
        const Feed = db.model('Feed', new mongoose.Schema({}, { strict: false }), 'Feeds');
        const UserCategory = db.model('UserCategory', new mongoose.Schema({}, { strict: false }), 'UserCategorys');

        const allFeeds = await Feed.find({ isDeleted: false }).sort({ createdAt: -1 }).limit(10);
        if (allFeeds.length === 0) return db.close();

        const creatorId = allFeeds[0].createdByAccount;
        console.log(`Checking UserCategory for ID: ${creatorId}`);

        const userCat = await UserCategory.findOne({ userId: creatorId });
        if (userCat) {
            console.log("\nUserCategory Object:");
            console.log(JSON.stringify(userCat, null, 2));
        } else {
            console.log("\nNo UserCategory found for this user.");
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        db.close();
    }
});
