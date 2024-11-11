const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');
const Tour = require('../models/tourModel');
const Booking = require('../models/bookingModel');

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  // 1) Get the currently booked tour
  const tour = await Tour.findById(req.params.tourId);

  // 2) Create checkout sesion
  const productDetails = [
    {
      // quantity of item (in this case the tour)
      quantity: 1,
      price_data: {
        // price expected in cents
        unit_amount: tour.price * 100,
        currency: 'usd',
        product_data: {
          name: `${tour.name} Tour`,
          description: tour.summary,
          // need to be live images as they are stored on the stripe's server
          images: [
            // `${req.protocol}://${req.get('host')}/public/img/tours/${tour.imageCover}`,
            `http://www.natours.dev/img/tours/${tour.imageCover}`,
          ],
        },
      },
    },
  ];

  const session = await stripe.checkout.sessions.create({
    // creating a payment method of credit card
    payment_method_types: ['card'],
    // redirection after successful payments
    // stripe will create a get request to this url (cant send body or any data other than the query string)
    success_url: `${req.protocol}://${req.get('host')}/?tour=${req.params.tourId}&user=${req.user.id}&price=${tour.price}`,
    // redirection after failed payments
    cancel_url: `${req.protocol}://${req.get('host')}/tour/${tour.slug}`,
    // customer email
    customer_email: req.user.email,
    // field to pass in some data about the sesion currently created (getting access to the session object)
    client_reference_id: req.params.tourId,
    // details about the product
    line_items: productDetails,
    // mode of the checkout session (required)
    mode: 'payment',
  });

  // 3) Create session as response
  res.status(200).json({
    status: 'success',
    session,
  });
});

exports.createBookingCheckout = catchAsync(async (req, res, next) => {
  // this is only TEMPORARY, because it's UNSECURE: everyone can make boookings without paying
  const { tour, user, price } = req.query;

  if (!tour && !user && !price) return next();

  // Creating the new booking document
  await Booking.create({ tour, user, price });

  // Redirecting the user to the original page (deleting the query string)
  // another way of writing this ${req.protocol}://${req.get('host')}/

  res.redirect(req.originalUrl.split('?')[0]);
  // what redirect does is that it will cerate another request to the route url, it will then hit the middleware of line 19 in the viewRoutes, but the tour, user, and price are no longer defined as the link is only (${req.protocol}://${req.get('host')}/)

  next();
});

exports.createBooking = factory.createOne(Booking);
exports.viewBooking = factory.getOne(Booking);
exports.viewAllBookings = factory.getAll(Booking);
exports.updateBooking = factory.updateOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);
