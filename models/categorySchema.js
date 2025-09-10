const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  feedIds:[{type:mongoose.Schema.Types.ObjectId,ref:'Feed'}],
  
  createdAt: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model('Categories', categorySchema, 'Categories');
