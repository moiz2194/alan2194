const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
    code: String,
    discountPercentage:Number,
    date: {
        type: Date,
        default: Date.now, 
    }
})

module.exports = CouponModel = new mongoose.model("Coupon",CouponSchema);