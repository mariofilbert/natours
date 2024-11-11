const multer = require('multer');
const sharp = require('sharp');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

// const multerStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     //the first argument is the error, the second being the destination
//     cb(null, 'public/img/users');
//   },
//   filename: (req, file, cb) => {
//     // user-userid-timestamp.fileextension (the name of the file)
//     const ext = file.mimetype.split('/')[1];
//     cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
//   },
// });

// image stored as as buffer (which is available at req.file.buffer)
// when storing into memory (as a buffer) the file name will not be set
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

// the upload.single() middleware will take the name of the file from the form('photo') and upload it to the 'public/img/users' folder
exports.uploadUserPhoto = upload.single('photo');

exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  // redefining the filename of the user photo
  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

  // changing the size of the user photo

  await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/users/${req.file.filename}`);

  next();
});

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });

  return newObj;
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // console.log(req.file);
  // console.log(req.body);

  // 1)  Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password update. Please use /updateMyPassword',
      ),
      400,
    );
  }

  // 2) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(req.body, 'name', 'email');
  // adding photo if the user uploads a new photo
  if (req.file) filteredBody.photo = req.file.filename;

  // 3) Update the user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    data: updatedUser,
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not defined ! Please use /signup instead',
  });
};

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;

  next();
};

exports.getUser = factory.getOne(User);
exports.getAllUsers = factory.getAll(User);

// Do NOT update passwords with this !
exports.updateUser = factory.updateOne(User);

exports.deleteUser = factory.deleteOne(User);
