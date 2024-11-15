const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const cors = require('cors');

// eslint-disable-next-line import/newline-after-import
const AppError = require('./utils/appError');
const globalErrorHandler = require(`./controllers/errorController`);
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const bookingController = require('./controllers/bookingController');
const viewRouter = require('./routes/viewRoutes');

const app = express();

// used to trust proxy
app.set('trust proxy', true);

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

//1) GLOBAL MIDDLEWARES
// Implement CORS
app.use(cors());
// Access-Control-Allow-Origin * --> allows everyone to consume our API

// ex: we have our api on api.natours.com, and want to use it on natours.com (the frontend)
// app.use(cors({origin: 'https://www.natours.com'}))
// only works on simple requests (get and post requests)

// responding to preflight requests
app.options('*', cors());
// app.options('/api/v1/tours/:id', cors());

// Serving static files
// app.use(express.static(`${__dirname}/public`));
app.use(express.static(path.join(__dirname, 'public')));

// Set security HTTP headers
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'script-src': [
        "'self'",
        'https:',
        // 'https://unpkg.com',
        // 'https://cdnjs.cloudflare.com/ajax/libs/axios/1.7.7/axios.min.js',
      ],
      'img-src': [
        "'self'",
        'data:',
        'blob:',
        'https:',
        // 'https://*.tile.openstreetmap.org',
      ],
      'connect-src': ["'self'", 'https:', 'ws:'],
      'frame-src': ["'self'", 'https:', 'data:'],
    },
  }),
);

// Development logging
console.log(process.env.NODE_ENV);
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Limit requests from same API
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!',
});
app.use('/api', limiter);

//the route is put right here and not in the bookingRoutes, because the function(webhookCheckout) requires a raw body (raw form - string or buffer) coming from stripe and not a JSON object
app.post(
  '/webhook-checkout',
  //added body parsing as a raw buffer instead of parsing it to JSON
  express.raw({ type: 'application/json' }),
  bookingController.webhookCheckout,
);

// when request comes in this middleware, the body will be parsed and converted to JSON
// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' })); // limit amount of data

// Parsing data from a URL encoded form
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Parse data from cookie
app.use(cookieParser());

// Data sanitization against NOSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS (Cross-site scripting attacks)
app.use(xss());

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: [
      'duration',
      'difficulty',
      'ratingsAverage',
      'ratingsQuantity',
      'price',
      'maxGroupSize',
    ],
  }),
);

// app.use((req, res, next) => {
//   console.log('Hello from the middleware 👋');
//   next();
// });

// Compressing the response (compression package)
app.use(compression());

// Test middlewares
app.use((req, res, next) => {
  const date = new Date();
  // const options = { timeZone: 'Asia/Bangkok', hour12: false };
  // const time = date.toLocaleTimeString('en-US', options);

  const utc = date.getTime();
  const dateInUTCPlus7 = new Date(utc + 7 * 3600000);

  req.requestTime = dateInUTCPlus7.toISOString().replace('Z', ', UTC+7');
  // console.log(req.requestTime);

  // console.log(req.headers);

  // Available from the cookie parser
  // console.log(req.cookies);

  next();
});

// 2) ROUTE HANDLERS (now placed in a separated file, these below were test cases)
// app.get('/', (req, res) => {
//   res
//     .status(200)
//     .json({ message: 'Hello from the server side!', app: 'Natours' });
// });

// app.post('/', (req, res) => {
//   res.send('You can post to this endpoint <3');
// });

// 3) ROUTES
// app.get('/api/v1/tours', getAllTours);
// app.post('/api/v1/tours', createTour);
// app.get('/api/v1/tours/:id', getTour);
// app.patch('/api/v1/tours/:id', updateTour);
// app.delete('/api/v1/tours/:id', deleteTour);

// Creating and mounting multiple routers
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

// Making the code easier to read and to edit

// Handling unregistered (not handled) routes
app.all('*', (req, res, next) => {
  // res.status(404).json({
  //   status: 'fail',
  //   message: `Can't find ${req.originalUrl} on this server!`,
  // });
  // next();

  // const err = new Error(`Can't find ${req.originalUrl} on this server!`);
  // err.status = 'fail';
  // err.statusCode = 404;

  // next(err); //Express automatically assumes an error when next is passed with an argument

  next(new AppError(`Can't find ${req.originalUrl} on this server !`, 404));
});

// 4) HANDLING ERRORS (to ommit the html code from the error message and change it to a json file error)
app.use(globalErrorHandler);

// 5) START SERVER
module.exports = app;
