const { promisify } = require('util');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

const signToken = (id) =>
  jwt.sign({ id: id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

/**
 * Creates a new JWT token and sends it to the client in the response.
 *
 * @param {User} user - The user document to be used for creating the JWT token.
 * @param {Number} statusCode - The HTTP status code to be sent back to the client.
 * @param {Response} res - The Express response object to use for sending the response.
 */
const createAndSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  // Remove password from output, will not affect database because it is not saved but only set to undefined before sending the response to the client
  user.password = undefined;

  res.cookie('jwt', token, cookieOptions);

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  // const newUser = await User.create(req.body);
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
    role: req.body.role,
  });
  // the req.protocol will be either http or https
  // the req.get('host') will be the domain
  const url = `${req.protocol}://${req.get('host')}/me`;
  // console.log(url);
  await new Email(newUser, url).sendWelcome();

  createAndSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password !', 400));
  }

  // 2) Check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password');
  // console.log(user);

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password !', 401));
  }
  // 3) If everything is ok, send token to client
  createAndSendToken(user, 200, res);
});

exports.logout = (req, res) => {
  // sending the same name, but give a dummy text to change the token
  // res.cookie('jwt', 'loggedout', {
  //   expires: new Date(Date.now() + 10 * 1000),
  //   httpOnly: true,
  // });

  // clearing the cookie, another way other than renaming the cookie
  res.clearCookie('jwt');

  res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check of it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }
  // console.log(token);

  if (!token) {
    res.redirect('/login');

    // this is not necessary
    // return next(
    //   new AppError('You are not logged in! Please log in to get access!', 401),
    // );
  }

  // 2) Verification the token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // console.log(decoded);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist !',
        401,
      ),
    );
  }

  // 4) Check if user changed password after the JWT was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    //the iat is -> issued at - property from decoded variable (line 75)
    return next(
      new AppError('User recently changed password! Please log in again', 401),
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  // give access to the pug template
  res.locals.user = currentUser;

  // console.log(req.user);
  next();
});

// Only for rendered pages, no errors!
exports.isLoggedIn = async (req, res, next) => {
  // check for logged out user
  if (req.cookies.jwt === null) {
    return next();
  }

  if (req.cookies.jwt) {
    try {
      // 1) Verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET,
      );

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 3) Check if user changed password after the JWT was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        //the iat is -> issued at - property from decoded variable (line 75)
        return next();
      }

      // THERE IS A LOGGED IN USER, GRANT ACCESS TO THE PROTECTED VIEW
      // using res.locals is similar to passing data into template using the res.render function
      res.locals.user = currentUser;
      //VERY IMPORTANT! Each and every pug template will have access to res.locals. So whatever variable defiend thru locals is accessible by PUG files.

      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};

exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    // only stated roles in the router can access
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403),
      );
    }
    next();
  };

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  // console.log(`${await User.findOne(req.body.email)}`);

  if (!user) {
    return next(new AppError('No user found with that email address', 404));
  }

  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Send the request to the user's email
  try {
    // await sendEmail({
    //   email: user.email,
    //   subject: 'Your password reset token (valid for 10 mins)',
    //   message,
    // });

    const resetURL = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;

    const message = `Forgot your password? Submit a request with your new password and password confirmation to: ${resetURL}.\n If you didn't forget your password, please ignore this email!`;

    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'There was an error sending the email. Try again later !',
        500,
      ),
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  // 2) If token has not expired, and there is a user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // 3) Update changedPasswordAt property for the current user

  // 4) Log the user in
  createAndSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong', 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;

  // .save() used to save and validate the password
  await user.save();

  // User.findByIdAndUpdate will NOT work as intended

  // 4) Log user in, send JWT
  createAndSendToken(user, 200, res);
});
