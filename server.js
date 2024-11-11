const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Handling uncaught exceptions (synchronous code error) (safety net for errors)
process.on('uncaughtException', (err) => {
  console.log('UNHANDLED EXCEPTION! 💥 Shutting down...');
  console.log(err);

  // process.exit(1);
});

dotenv.config({ path: './config.env' });

const app = require('./app');

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD,
);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  .then(() => {
    // console.log(con.connections);
    console.log('DB connection successful!');
  })
  .catch((err) => {
    console.log(err);
  });

//Previously used for testing
// const testTour = new Tour({
//   name: 'The Park Camper',
//   price: 997,
// });

// testTour
//   .save()
//   .then((doc) => {
//     console.log(doc);
//   })
//   .catch((err) => {
//     console.log('ERROR 💥', err);
//   });

// console.log(app.get('env'));
// console.log(process.env);

const port = 3000 || process.env.PORT;
const server = app.listen(port, () => {
  console.log(`App is running on port ${port}`);
});

// Handling unhandled promise rejections (asynchronous code error) (safety net for errors)
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err);

  server.close(() => {
    // process.exit(1);
  });
});
