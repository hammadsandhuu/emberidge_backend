const cron = require("node-cron");
const Deal = require("../models/deal.model");

cron.schedule("*/5 * * * *", async () => {
  try {
    const now = new Date();

    const activate = await Deal.updateMany(
      { startDate: { $lte: now }, endDate: { $gte: now }, isActive: false },
      { $set: { isActive: true } }
    );

    const deactivate = await Deal.updateMany(
      {
        $or: [{ endDate: { $lt: now } }, { startDate: { $gt: now } }],
        isActive: true,
      },
      { $set: { isActive: false } }
    );

    console.log(
      `[${new Date().toISOString()}] Deal Sync → activated: ${
        activate.modifiedCount
      }, deactivated: ${deactivate.modifiedCount}`
    );
  } catch (err) {
    console.error("Deal Sync Error:", err.message);
  }
});
