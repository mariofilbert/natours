const express = require('express');
const bookingController = require('../controllers/bookingController');
const authController = require('../controllers/authController');

const router = express.Router();

// router
//   .route('/checkout-session/:tourId')
//   .get(authController.protect, bookingController.getCheckoutSession);

router.use(authController.protect);

router.get('/checkout-session/:tourId', bookingController.getCheckoutSession);

router.use(authController.restrictTo('admin', 'lead-guide'));

router
  .route('/')
  .get(bookingController.viewAllBookings)
  .post(bookingController.createBooking);

router
  .route('/:id')
  .get(bookingController.viewBooking)
  .patch(bookingController.updateBooking)
  .delete(bookingController.deleteBooking);
module.exports = router;
