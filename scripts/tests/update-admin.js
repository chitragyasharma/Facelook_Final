const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const { AdminUser } = require('./server/models');

async function updateAdmin() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const admin = await AdminUser.findOne();
        if (admin) {
            admin.email = 'facelook.cs51@gmail.com';
            admin.password = bcrypt.hashSync('Facelook@4411', 10);
            await admin.save();
            console.log('Successfully updated existing admin credentials!');
        } else {
            console.log('No admin found to update.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
}

updateAdmin();
