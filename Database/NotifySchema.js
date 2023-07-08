const mongoose = require('mongoose');

const NotifySchema = new mongoose.Schema({
    adder: String,
    added: String,
    time: {
        type: Date,
        default: Date.now, 
    }
})

module.exports = NotifyModel = new mongoose.model("Notification",NotifySchema);