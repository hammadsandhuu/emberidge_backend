const cron = require("node-cron");
const Deal = require("../models/deal.model");

cron.schedule("*/5 * * * *", async () => {
  const now = new Date();

  await Deal.updateMany(
    { startDate: { $lte: now }, endDate: { $gte: now } },
    { $set: { isActive: true } }
  );

  await Deal.updateMany(
    { $or: [{ endDate: { $lt: now } }, { startDate: { $gt: now } }] },
    { $set: { isActive: false } }
  );

  console.log("Deals synced with current time");
});
