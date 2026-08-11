require('dotenv').config();
const mongoose = require('mongoose');
const { Notification, User } = require('./server/models.js');

mongoose.connect('mongodb+srv://admin:admin@cluster0.z2b6o.mongodb.net/facelook?retryWrites=true&w=majority&appName=Cluster0')
  .then(async () => {
    try {
      const user = await User.findOne();
      if(user) {
        const notifs = await Notification.find({ user_id: user.id });
        console.log("Found notifications:", JSON.stringify(notifs.slice(0, 2), null, 2));
      }
    } catch(e) { console.error(e); }
    process.exit();
  });
