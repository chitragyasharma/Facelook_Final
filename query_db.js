require('dotenv').config({ path: './server/.env' });
const mongoose = require('mongoose');
const { Coupon } = require('./server/models');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const coupons = await Coupon.find();
  console.log(JSON.stringify(coupons, null, 2));
  process.exit();
}).catch(err => {
  console.error(err);
  process.exit(1);
});
