require('dotenv').config();
const mongoose = require('mongoose');
const { Order, User, Cart, Wishlist, Return, Notification } = require('./models');

async function resetData() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('MONGODB_URI not found in env');
        process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    const resOrders = await Order.deleteMany({});
    console.log(`Deleted ${resOrders.deletedCount} orders.`);

    const resUsers = await User.deleteMany({});
    console.log(`Deleted ${resUsers.deletedCount} customers.`);

    const resCarts = await Cart.deleteMany({});
    console.log(`Deleted ${resCarts.deletedCount} cart entries.`);

    const resWishlists = await Wishlist.deleteMany({});
    console.log(`Deleted ${resWishlists.deletedCount} wishlist entries.`);

    const resReturns = await Return.deleteMany({});
    console.log(`Deleted ${resReturns.deletedCount} return requests.`);

    const resNotifs = await Notification.deleteMany({});
    console.log(`Deleted ${resNotifs.deletedCount} notifications.`);

    console.log('Successfully reset all orders, revenue, and customer records!');
    process.exit(0);
}

resetData().catch(err => {
    console.error('Reset error:', err);
    process.exit(1);
});
