const mongoose = require('mongoose');

const ProfitDetail = new mongoose.Schema({
    email: String,
    from: Date,
    to: Date,
    profit: Number,
    planName: String,
    date: {
        type: Date,
        default: Date.now,
    }
})

module.exports = ProfitDetailModel = new mongoose.model("Profit",ProfitDetail);