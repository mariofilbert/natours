const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');
const Tour = require('../models/tourModel');
const Booking = require('../models/bookingModel');
const User = require('../models/userModel');

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
          // need to be live images (from live websites) as they are stored on the stripe's server
          images: [`${req.protocol}://${req.get('host')}/${tour.imageCover}`],
        },
      },
    },
  ];

  const session = await stripe.checkout.sessions.create({
    // creating a payment method of credit card
    payment_method_types: ['card'],

    // redirection after successful payments
    // stripe will create a get request to this url (cant send body or any data other than the query string)
    // success_url: `${req.protocol}://${req.get('host')}/?tour=${req.params.tourId}&user=${req.user.id}&price=${tour.price}`,

    success_url: `${req.protocol}://${req.get('host')}/my-tours?alert=booking`,

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

//----------------------------------------------------------------
// exports.createBookingCheckout = catchAsync(async (req, res, next) => {
//   // this is only TEMPORARY, because it's UNSECURE: everyone can make boookings without paying
//   const { tour, user, price } = req.query;

//   if (!tour && !user && !price) return next();

//   // Creating the new booking document
//   await Booking.create({ tour, user, price });

//   // Redirecting the user to the original page (deleting the query string)
//   // another way of writing this ${req.protocol}://${req.get('host')}/

//   res.redirect(req.originalUrl.split('?')[0]);
//   // what redirect does is that it will cerate another request to the route url, it will then hit the middleware of line 19 in the viewRoutes, but the tour, user, and price are no longer defined as the link is only (${req.protocol}://${req.get('host')}/)

//   next();
// });
//----------------------------------------------------------------

// a function to later be called in the webhookCheckout
// the session data will be coming from the session that was created earlier in the getCheckoutSession
const createBookingCheckout = async (session) => {
  // available from the session object
  const tour = session.client_reference_id;
  const user = (await User.findOne({ email: session.customer_email })).id;

  // based on the log of the session (from the stripe website)
  const price = session.amount_total / 100;

  // Creating the new booking document
  await Booking.create({ tour, user, price });
};

// this function will be called by stripe (whenever a payment was successful)
exports.webhookCheckout = (req, res, next) => {
  // 1) Getting the signature coming from stripe (it will add a header to the request) when it calls our webhook
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    // 2) Creating the stripe event
    // the req.body is the raw data coming from stripe (the code from app.js line 87)
    // signature coming from the header
    event = stripe.webhooks.constructEvent(
      req.body,
      // signature and secret to validate the data coming from stripe
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    // stripe will be the one receiving the response as it is the one calling the URL(webhook)
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    // using the session located at event.data.object
    createBookingCheckout(event.data.object);
  }

  // acknowledgement of the webhook (successful)
  res.status(200).json({ received: true });
};

exports.createBooking = factory.createOne(Booking);
exports.viewBooking = factory.getOne(Booking);
exports.viewAllBookings = factory.getAll(Booking);
exports.updateBooking = factory.updateOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);
