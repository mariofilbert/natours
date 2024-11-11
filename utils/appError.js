class AppError extends Error {
  constructor(message, statusCode) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith(`4`) ? `fail` : `error`;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor); //used so that the error does not pollute the stack trace
  }
}

module.exports = AppError;
