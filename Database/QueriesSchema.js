const mongoose = require('mongoose');

const QueriesSchema = new mongoose.Schema({
    name: String,
    subject: String,
    email: String,
    phone: String,
    message: String,
    msgTime: {
        type: Date,
        default: Date.now, 
    }
})

module.exports = QueriesModel = new mongoose.model("Querie",QueriesSchema);