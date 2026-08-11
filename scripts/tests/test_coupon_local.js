const mongoose = require('mongoose');
const { Coupon } = require('./server/models.js');
require('dotenv').config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB");
  
  const lastCoupon = await Coupon.findOne().sort({ id: -1 });
  console.log("Last coupon:", lastCoupon);
  
  process.exit(0);
}
test().catch(console.error);
