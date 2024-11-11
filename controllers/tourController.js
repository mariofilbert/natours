// const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

// Used for testing purposes
// const tours = JSON.parse(
//   fs.readFileSync(`${__dirname}/../dev-data/data/tours-simple.json`),
// );

/*

// Previously used for showing how middleware works
exports.checkID = (req, res, next, val) => {
  const id = Number(req.params.id);
  if (id > tours.length) {
    return res.status(404).json({
      status: 'fail',
      message: 'Invalid ID',
    });
  }
  next();
};

exports.checkBody = (req, res, next) => {
  if (!req.body.name || !req.body.price) {
    return res.status(400).json({
      status: 'fail',
      message: 'Missing name or price',
    });
  }
  next();
};

*/

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images!', 400), false);
  }
};

const upload = multer({
  // dest: 'public/img/users'
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadTourImages = upload.fields([
  { name: 'imageCover', maxCount: 1 }, // only have one image cover
  { name: 'images', maxCount: 3 }, // only have three images
]);

// if only single upload
// upload.single('image'); -> will produce req.file
// if only there was one field which accepts multiple images
// upload.array('images', 5); -> will produce req.files

exports.resizeTourImages = catchAsync(async (req, res, next) => {
  // console.log(req.files);

  if (!req.files.imageCover || !req.files.images) {
    console.log('no image');
    return next();
  }

  // 1) Cover image
  // putting the image filename on req.body so that it can be used in the next middleware
  req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;
  await sharp(req.files.imageCover[0].buffer)
    .resize(2000, 1333)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/tours/${req.body.imageCover}`);

  // 2) Images
  // creating an empty array to store the images
  // putting the image filename on req.body so that it can be used in the next middleware
  req.body.images = [];
  // in order to save all images, as map returns an array which can be awaited in a promise
  await Promise.all(
    // req.files.images is an array
    req.files.images.map(async (file, i) => {
      const filename = `tour-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;
      await sharp(file.buffer)
        .resize(2000, 1333)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(`public/img/tours/${filename}`);

      req.body.images.push(filename);
    }),
  );

  next();
});

exports.aliasTopTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,summary,difficulty';
  next();
};

exports.checkValidName = catchAsync(async (req, res, next) => {
  // Validate name format
  if (!/^[a-zA-Z\s]+$/.test(req.body.name)) {
    return next(new AppError(`${req.body.name} is not a valid name!`, 400));
  }

  next();
});

exports.createTour = factory.createOne(Tour);
exports.updateTour = factory.updateOne(Tour);
exports.deleteTour = factory.deleteOne(Tour);
exports.getTour = factory.getOne(Tour, { path: 'reviews' });
exports.getAllTours = factory.getAll(Tour);

exports.getTourStats = catchAsync(async (req, res, next) => {
  const stats = await Tour.aggregate([
    {
      $match: {
        ratingsAverage: { $gte: 4.5 },
      },
    },
    {
      $group: {
        // _id: '$ratingsAverage',
        _id: { $toUpper: '$difficulty' },
        numRatings: { $sum: '$ratingsQuantity' },
        numTours: { $sum: 1 }, //for every data passed, 1 will be added
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    {
      $sort: { avgPrice: 1 }, //sorting in an ascending order (negative for descending)
    },

    // stages can also be repeated
    // {
    //   $match: {
    //     _id: { $ne: 'EASY' },
    //   },
    // },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats,
    },
  });
});

exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = +req.params.year;
  const plan = await Tour.aggregate([
    {
      $unwind: '$startDates',
    },
    {
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$startDates' },
        numToursStarts: { $sum: 1 },
        tours: { $push: '$name' },
      },
    },
    {
      $addFields: {
        month: '$_id',
      },
    },
    {
      $project: {
        _id: 0,
      },
    },
    {
      $sort: {
        numToursStarts: -1,
      },
    },
    {
      $limit: 20, //just for showcase
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      plan,
    },
  });
});

// /tours-within/:distance/center/:latlng/unit/:unit
// /tours-within/233/center/33.807209, -117.925659/unit/mi
exports.getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  // converting to radians (obtained by dividing the distance by the radius of the Earth)
  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;

  if (!lat || !lng) {
    next(
      new AppError(
        'Please provide latitude and longitude in the format lat, lng.',
        400,
      ),
    );
  }

  const tours = await Tour.find({
    startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
  });
  console.log(distance, lat, lng, unit);

  res.status(200).json({
    status: 'success',
    results: tours.length,
    data: {
      data: tours,
    },
  });
});

exports.getDistances = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  const multiplier = unit === 'mi' ? 0.000621371 : 0.001;

  if (!lat || !lng) {
    next(
      new AppError(
        'Please provide latitude and longitude in the format lat, lng.',
        400,
      ),
    );
  }

  const distances = await Tour.aggregate([
    {
      $geoNear: {
        // near is the point from which to calculate the distances
        near: {
          type: 'Point',
          coordinates: [lng * 1, lat * 1],
        },
        // distanceField is the field where the calculated distances will be stored
        distanceField: 'distance', // calculated in meters
        distanceMultiplier: multiplier, // converting to km (or mi)
      },
    },

    // used to include or exclude a certain field from the output
    {
      $project: {
        distance: 1,
        name: 1,
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      data: distances,
    },
  });
});

// ------------------------------------------------------------- //

// exports.getTour = catchAsync(async (req, res, next) => {
//   const tour = await Tour.findById(req.params.id).populate('reviews');
//   // Tour.findOne({ _id: req.params.id })

//   if (!tour) {
//     return next(new AppError('No tour found with that ID', 404));
//   }
//   res.status(200).json({
//     status: 'success',
//     data: {
//       tour,
//     },
//   });
// });

// exports.getAllTours = catchAsync(async (req, res, next) => {
//   // EXECUTE QUERY
//   const features = new APIFeatures(Tour.find(), req.query)
//     .filter()
//     .sort()
//     .limitFields()
//     .paginate();
//   const tours = await features.query;

//   // SEND RESPONSE
//   res.status(200).json({
//     status: 'success',
//     results: tours.length,
//     data: {
//       tours,
//     },
//   });
// });

// try {
//   // console.log(req.query);

//   // BUILD QUERY (BEFORE REFACTORING)

//   // 1A) FILTERING
//   // const queryObj = { ...req.query };
//   // const exlcudedFields = ['page', 'sort', 'limit', 'fields'];
//   // exlcudedFields.forEach((el) => delete queryObj[el]);

//   // // console.log(queryObj);

//   // // 1B) Advanced FILTERING
//   // let queryStr = JSON.stringify(queryObj);
//   // queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);
//   // console.log(JSON.parse(queryStr));

//   // Query chaining, another way of chaining queries
//   // const query = await Tour.find()
//   //   .where('duration')
//   //   .equals(5)
//   //   .where('difficulty')
//   //   .equals('easy');

//   // let query = Tour.find(JSON.parse(queryStr));

//   // 2) SORTING
//   // if (req.query.sort) {
//   //   const sortBy = req.query.sort.split(',').join(' ');
//   //   query = query.sort(sortBy);
//   //   // sort('price ratingsAverage')
//   // } else {
//   //   query = query.sort('-createdAt');
//   // }

//   // 3) FIELD LIMITING
//   // if (req.query.fields) {
//   //   const fields = req.query.fields.split(',').join(' ');
//   //   query = query.select(fields);
//   // } else {
//   //   query = query.select('-__v');
//   // }

//   // 4) PAGINATION
//   // const page = req.query.page * 1 || 1;
//   // const limit = req.query.limit * 1 || 100;
//   // const skip = (page - 1) * limit;

//   // // page=2&limit=10, 1-10, page1, 11-20, page2, 11-20
//   // query = query.skip(skip).limit(limit);

//   // if (req.query.page) {
//   //   const numTours = await Tour.countDocuments();

//   //   if (skip >= numTours) throw new Error('This Page Does Not Exist');
//   // }

// Before using the asynchronous error handling (still using try catch)
//   // EXECUTE QUERY
//   const features = new APIFeatures(Tour.find(), req.query)
//     .filter()
//     .sort()
//     .limitFields()
//     .paginate();
//   const tours = await features.query;

//   // SEND RESPONSE
//   res.status(200).json({
//     status: 'success',
//     results: tours.length,
//     data: {
//       tours,
//     },
//   });
// } catch (err) {
//   res.status(404).json({
//     status: 'fail',
//     message: err,
//   });
// }

/* 
  // Code previously used with database coming from tours-simple.json

  // console.log(req.requestTime);

  res.status(200).json({
    status: 'success',
    requestedAt: req.requestTime,
    results: tours.length,
    data: {
      tours, // tours: tours , if the file being read above was x. then tours: x will be the one written
    },
  });

  */

// Before using the asynchronous error handling (still using try catch)
// try {
//   const tour = await Tour.findById(req.params.id);
//   // Tour.findOne({ _id: req.params.id })

//   res.status(200).json({
//     status: 'success',
//     data: {
//       tour,
//     },
//   });
// } catch (err) {
//   res.status(404).json({
//     status: 'fail',
//     messagee: err,
//   });
// }

/*

  // Code previously used with database coming from tours-simple.json


  // console.log(req.params);
  // console.log(req);
  // const id = Number(req.params.id);
  // if (id > tours.length) {
  //   return res.status(404).json({
  //     status: 'fail',
  //     message: 'Invalid ID',
  //   });
  // };

  const id = Number(req.params.id);
  const tour = tours.find((el) => el.id === id);

  res.status(200).json({
    status: 'success',
    // results: tours.length,
    data: {
      tour, // tours: tours , if the file being read above was x. then tours: x will be the one written
    },
  });

  */

// exports.createTour = catchAsync(async (req, res, next) => {
//   // Validate name format
//   if (!/^[a-zA-Z\s]+$/.test(req.body.name)) {
//     return next(new AppError(`${req.body.name} is not a valid name!`, 400));
//   }

//   const newTour = await Tour.create(req.body);

//   res.status(201).json({
//     status: 'success',
//     data: {
//       tour: newTour,
//     },
//   });
// });

// try {
//   // const newTour = new Tour({});
//   // newTour.save();

//   const newTour = await Tour.create(req.body);

//   res.status(201).json({
//     status: 'success',
//     data: {
//       tour: newTour,
//     },
//   });
// } catch (err) {
//   res.status(400).json({
//     status: 'fail',
//     message: err,
//   });
// }

// // console.log(req.body);
// const newId = tours[tours.length - 1].id + 1;
// const newTour = Object.assign({ id: newId }, req.body);
// tours.push(newTour);
// fs.writeFile(
//   `${__dirname}/dev-data/data/tours-simple.json`,
//   JSON.stringify(tours),
//   (err) => {
//     res.status(201).json({
//       status: 'success',
//       data: {
//         tour: newTour,
//       },
//     });
//   },
// );

// exports.updateTour = catchAsync(async (req, res, next) => {
//   const previousTour = await Tour.findById(req.params.id);
//   const updatedTour = await Tour.findByIdAndUpdate(req.params.id, req.body, {
//     new: true,
//     runValidators: true,
//     rawResult: true,
//   });

//   if (!updatedTour) {
//     return next(new AppError('No tour found with that ID', 404));
//   }

//   res.status(200).json({
//     status: 'success',
//     data: {
//       previousTour,
//       updatedTour,
//     },
//   });
// });

// Before using the asynchronous error handling (still using try catch)
// try {
//   const previousTour = await Tour.findById(req.params.id);
//   const updatedTour = await Tour.findByIdAndUpdate(req.params.id, req.body, {
//     new: true,
//     runValidators: true,
//     rawResult: true,
//   });
//   res.status(200).json({
//     status: 'success',
//     data: {
//       previousTour,
//       updatedTour,
//     },
//   });
// } catch (err) {
//   res.status(404).json({
//     status: 'fail',
//     message: 'Invalid ID',
//   });
// }

/*
  // Code previously used with database coming from tours-simple.json
  const id = +req.params.id;
  const updateTour = tours.find((el) => el.id === id);
  const properties = Object.keys(req.body);

  //using this is better than using "if (id > tours.length)" as written in app.get
  // if (!updateTour) {
  //   return res.status(404).json({
  //     status: 'fail',
  //     message: 'Invalid ID',
  //   });
  // }

  // Deep copy of the original tour
  const originalTour = JSON.parse(JSON.stringify(updateTour));

  // Update the properties of the tour based on the request body
  properties.forEach((prop) => {
    updateTour[prop] = req.body[prop];
  });

  // Update the tours array with the modified tour
  tours.map((tour) => (tour.id === updateTour.id ? updateTour : tour));

  fs.writeFile(
    `${__dirname}/../dev-data/data/tours-simple.json`,
    JSON.stringify(tours),
    (err) => {
      if (err) {
        return res.status(500).json({
          status: 'error',
          message: 'Failed to write data to file',
        });
      }

      res.status(200).json({
        status: 'success',
        data: {
          updateTour,
          originalTour,
        },
      });
    },
  );

  // res.status(200).json({
  //   status: 'success',
  //   data: {
  //     tour: '<Updated tour here...>',
  //   },
  // });
  */

// exports.deleteTour = catchAsync(async (req, res, next) => {
//   const tour = await Tour.findByIdAndDelete(req.params.id);

//   if (!tour) {
//     return next(new AppError('No tour found with that ID', 404));
//   }

//   res.status(204).json({
//     status: 'success',
//     data: null,
//   });
// });

// Before using the asynchronous error handling (still using try catch)

// try {
//   await Tour.findByIdAndDelete(req.params.id);
//   res.status(204).json({
//     status: 'success',
//     data: null,
//   });
// } catch (err) {
//   res.status(404).json({
//     status: 'fail',
//     message: 'Invalid ID',
//   });
// }

// Before using the asynchronous error handling (still using try catch)

// try {
//   const stats = await Tour.aggregate([
//     {
//       $match: {
//         ratingsAverage: { $gte: 4.5 },
//       },
//     },
//     {
//       $group: {
//         // _id: '$ratingsAverage',
//         _id: { $toUpper: '$difficulty' },
//         numRatings: { $sum: '$ratingsQuantity' },
//         numTours: { $sum: 1 }, //for every data passed, 1 will be added
//         avgRating: { $avg: '$ratingsAverage' },
//         avgPrice: { $avg: '$price' },
//         minPrice: { $min: '$price' },
//         maxPrice: { $max: '$price' },
//       },
//     },
//     {
//       $sort: { avgPrice: 1 }, //sorting in an ascending order (negative for descending)
//     },

//     // stages can also be repeated
//     // {
//     //   $match: {
//     //     _id: { $ne: 'EASY' },
//     //   },
//     // },
//   ]);

//   res.status(200).json({
//     status: 'success',
//     data: {
//       stats,
//     },
//   });
// } catch (err) {
//   res.status(404).json({
//     status: 'fail',
//     message: 'Invalid ID',
//   });
// }

// Before using the asynchronous error handling (still using try catch)

// try {
//   const year = +req.params.year;
//   const plan = await Tour.aggregate([
//     {
//       $unwind: '$startDates',
//     },
//     {
//       $match: {
//         startDates: {
//           $gte: new Date(`${year}-01-01`),
//           $lte: new Date(`${year}-12-31`),
//         },
//       },
//     },
//     {
//       $group: {
//         _id: { $month: '$startDates' },
//         numToursStarts: { $sum: 1 },
//         tours: { $push: '$name' },
//       },
//     },
//     {
//       $addFields: {
//         month: '$_id',
//       },
//     },
//     {
//       $project: {
//         _id: 0,
//       },
//     },
//     {
//       $sort: {
//         numToursStarts: -1,
//       },
//     },
//     {
//       $limit: 20, //just for showcase
//     },
//   ]);

//   res.status(200).json({
//     status: 'success',
//     data: {
//       plan,
//     },
//   });

//   // console.log(plan);
// } catch (err) {
//   res.status(404).json({
//     status: 'fail',
//     message: err,
//   });
// }

/*
  // Code previously used with database coming from tours-simple.json
  const id = +req.params.id;
  const tourIndex = tours.findIndex((el) => el.id === id);

  // if (tourIndex === -1) {
  //   return res.status(404).json({
  //     status: 'fail',
  //     message: 'Invalid ID',
  //   });
  // }

  // Store the original tour data
  const deletedTour = tours[tourIndex];

  // Deleting the tour
  // tours.map((tour) => {
  //   tour.id === deleteTour.id ? tours.splice(tourIndex, 1) : tour;
  // });

  tours.splice(tourIndex, 1);

  fs.writeFile(
    `${__dirname}/dev-data/data/tours-simple.json`,
    JSON.stringify(tours),
    (err) => {
      res.status(204).json({
        status: 'success',
        data: {
          deletedTour,
        },
      });
    },

    // res.status(204).json({
    //   status: 'success',
    //   data: null,
    // });
  );
  */
