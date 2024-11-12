/* eslint-disable prefer-arrow-callback */
const mongoose = require('mongoose');
const slugify = require('slugify');
// const User = require('./userModel');
// const validator = require('validator');

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      unique: true,
      trim: true,
      maxLength: [40, 'A tour name must have less or equal than 40 characters'],
      minLength: [10, 'A tour name must have more or equal than 10 characters'],

      // isnt used because this hinders the mongodb driver to do validation
      // validate: {
      //   validator: function (val) {
      //     return /^[a-zA-Z\s]+$/.test(val);
      //   },
      //   message: (property) => `${property.value} is not a valid name!`,
      // },

      // validate: validator.isAlpha,
      // used to showcase external library to perform validation
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must gave a difficulty'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either: easy, medium, difficult',
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.8,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating is maxed at 5.0'],
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price'],
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (val) {
          // this only points to current doc on NEW document creation
          return val < this.price;
        },
        message: 'Discount price ({VALUE}) should be below regular price',
      },
    },
    summary: {
      type: String,
      trim: true,
      required: [true, 'A tour mush have a description'],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image'],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false,
    },
    startLocation: {
      // GeoJSON
      type: {
        type: String,
        // the default for geometries in MongoDB is usually point, but othbers like polygons, or lines can also be used
        default: 'Point',
        // Ensures only 'Point' type is allowed
        enum: ['Point'],
      },
      coordinates: [Number],
      address: String,
      description: String,
    },
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number,
      },
    ],
    // guides: Array,
    guides: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexing to speed up queries (making database to narrow down searches to the right documents)
// tourSchema.index({ price: 1 });

// Compound index (2 fields)
tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ slug: 1 });

tourSchema.index({ startLocation: '2dsphere' });

tourSchema.virtual('durationWeeks').get(function () {
  return this.duration / 7;
});

// Virtual populate
tourSchema.virtual('reviews', {
  // the name of the model to be referenced
  ref: 'Review',
  // the id located in the parent document
  foreignField: 'tour',
  // the id located in the child document
  localField: '_id',
});

//DOCUMENT MIDDLEWARE: runs before .save() and .create()
tourSchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

// For embedding guides in tour
// tourSchema.pre('save', async function (next) {
//   const guidesPromises = this.guides.map(async (id) => await User.findById(id));

//   this.guides = await Promise.all(guidesPromises);

//   next();
// });
// -------------------------

// tourSchema.pre('save', function (next) {
//   console.log(`Will save document...`);
//   next();
// });

// tourSchema.post('save', function (doc, next) {
//   console.log(doc);
//   next();
// });

//QUERY MIDDLEWARE
// tourSchema.pre('find', function (next) {
tourSchema.pre(/^find/, function (next) {
  this.find({ secretTour: { $ne: true } });

  this.start = Date.now();
  next();
});

tourSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt',
  });

  next();
});

// Was used to test the post find middleware
// tourSchema.post(/^find/, function (docs, next) {
//   // console.log(docs);
//   console.log(`Query took ${Date.now() - this.start} milliseconds`);
//   next();
// });

//AGGREGATION MIDDLEWARE
tourSchema.pre('aggregate', function (next) {
  const firstInPipeline = Object.keys(this.pipeline()[0]);
  if (firstInPipeline[0] !== '$geoNear') {
    this.pipeline().unshift({ $match: { secretTour: { $ne: true } } });

    // console.log(this.pipeline());
  } else {
    this.pipeline().splice(1, 0, { $match: { secretTour: { $ne: true } } });

    // console.log(this.pipeline());
  }
  next();
});

const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
