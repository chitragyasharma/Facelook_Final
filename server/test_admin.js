require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const { AdminUser } = require('./models');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    const admins = await AdminUser.find({});
    console.log('Admins:', admins.map(a => ({ email: a.email, name: a.name })));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
