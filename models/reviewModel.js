const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review can not be empty!'],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      set: (val) => Math.round(val * 10) / 10, //setting to two decimal places (10 will be one decimal place)
    },
    createdAt: {
      type: Date,
      default: Date.now(),
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must belong to a tour!'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user!'],
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// reviewSchema.virtual('tour', {
//   ref: 'Tour',
//   localField: 'tour',
//   foreignField: '_id',
// });

// Making it so that a user can only have one review per tour
reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

reviewSchema.pre(/^find/, function (next) {
  // this.populate({
  //   path: 'tour',
  //   select: 'name summary ',
  // }).populate({
  //   path: 'user',
  //   select: 'name photo',
  // });
  this.populate({
    path: 'user',
    select: 'name photo',
  });

  next();
});

reviewSchema.statics.calcAverageRatings = async function (tourId) {
  const stats = await this.aggregate([
    {
      $match: { tour: tourId },
    },
    {
      $group: {
        _id: '$tour',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
    {
      $addFields: {
        avgRating: { $round: ['$avgRating', 1] },
      },
    },
  ]);
  // console.log(stats);

  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.8,
    });
  }
};

// at pre save, the current review is not in the collection yet
// reviewSchema.pre('save', function (next) {
//   this.constructor.calcAverageRatings(this.tour);

//   next();
// });

// Saving a review to the tour when creating a new review
reviewSchema.post('save', function () {
  // this points to current review (this.constructor === Review, refers to the current document)
  this.constructor.calcAverageRatings(this.tour);

  // the same as stating this, but the code below cant execute as Review is not yet defined
  // Review.calcAverageRatings(this.tour)
});

// Calculating the review statistics when a review is updated or deleted (findByIdAndUpdate and findByIdAndDelete)
reviewSchema.pre(/^findOneAnd/, async function (next) {
  // const query = this.getQuery();
  // const r = await this.findOne();
  // the this in this function refers to the query, which is why the code above wouldn't work and the model is required to call the findOne method
  this.r = await this.model.findOne(this.getQuery());
  // console.log(this.r);

  // console.log('Query:', this.getQuery());
});

reviewSchema.post(/^findOneAnd/, async function () {
  // await this.r.constructor.calcAverageRatings(this.r.tour);
  // the code below is basically the same as the code above because the method calcAverageRatings is available on the model (both methods will owrk the same, assuming this.r is a valid instance model)
  //this.model.calcAverageRatings: This directly accesses the static method from the model, making it clear that you're calling a method defined on the schema.
  //this.r.constructor.calcAverageRatings: This accesses the constructor of the document instance, which will also refer to the same model and thus the same static method.

  await this.model.calcAverageRatings(this.r.tour);
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
