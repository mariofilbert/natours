const express = require('express');
const tourController = require('../controllers/tourController');
const authController = require('../controllers/authController');
const reviewRouter = require('./reviewRoutes');
// const reviewController = require('../controllers/reviewController');

// This can also be done through destructuring so that tourController is not needed, and the functions can be called directly
// const { getAllTours,
//   createTour,
//   getTour,
//   updateTour,
//   deleteTour,
// } = require('../controllers/tourController');

const router = express.Router();

// The param function previously used to define parameter middleware
// router.param('id', tourController.checkID);

// router.param('id', (req, res, next, val) => {
//   console.log(`Tour id is: ${val}`);
//   next();
// });

// Implementing review routes
// POST /tour/234fad4/reviews
// GET /tour/234fad4/reviews
// GET /tour/234fad4/reviews/123fad4

// router
//   .route('/:tourId/reviews')
//   .post(
//     authController.protect,
//     authController.restrictTo('user'),
//     reviewController.createReview,
//   );

// Re-directing to the reviewRouter
router.use('/:tourId/reviews', reviewRouter);

router
  .route('/top-5-cheap')
  .get(tourController.aliasTopTours, tourController.getAllTours);

router.route('/tour-stats').get(tourController.getTourStats);

router
  .route('/monthly-plan/:year')
  .get(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide', 'guide'),
    tourController.getMonthlyPlan,
  );

//this was done before using the regular expression
// /tours-within?distance=233&center=-40,45&unit=mi

//this will be used instead as it is a standard of specifying URLs
router
  .route('/tours-within/:distance/center/:latlng/unit/:unit')
  .get(tourController.getToursWithin);
// /tours-within/233/center/-40,45/unit/mi

router.route('/distances/:latlng/unit/:unit').get(tourController.getDistances);

router
  .route('/')
  .get(tourController.getAllTours)
  .post(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.checkValidName,
    tourController.createTour,
  );
// .post(tourController.checkBody, tourController.createTour);

router
  .route('/:id')
  .get(tourController.getTour)
  .patch(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.uploadTourImages,
    tourController.resizeTourImages,
    tourController.updateTour,
  )
  .delete(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.deleteTour,
  );

module.exports = router;
