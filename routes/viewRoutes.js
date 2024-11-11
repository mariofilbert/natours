const express = require('express');
const viewController = require('../controllers/viewController');
const authController = require('../controllers/authController');
const bookingController = require('../controllers/bookingController');

const router = express.Router();

router.get('/me', authController.protect, viewController.getAccount);
router.get('/my-tours', authController.protect, viewController.getMyTours);
router.post(
  '/submit-user-data',
  authController.protect,
  viewController.updateUserData,
);

// Running middleware to decide on the header template
router.use(authController.isLoggedIn);

// Rendering the template file from base.pug
router.get(
  '/',
  bookingController.createBookingCheckout,
  viewController.getOverview,
);
router.get('/tours/:slug', viewController.getTour);

// /login route
router.get('/login', viewController.getLoginForm);
router.get('/signup', viewController.getSignupForm);

module.exports = router;
