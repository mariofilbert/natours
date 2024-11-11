const nodemailer = require('nodemailer');
const pug = require('pug');
const { convert } = require('html-to-text');

//new Email(user, url).sendWelcome(); --> just for example reference

module.exports = class Email {
  constructor(user, url) {
    // target email
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = `Natours Team ${process.env.EMAIL_FROM}`;
  }

  newTransport() {
    if (process.env.NODE_ENV === 'production') {
      // Gmail
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.GMAIL_USERNAME,
          pass: process.env.GMAIL_PASSWORD,
          clientId: process.env.OAUTH_CLIENTID,
          clientSecret: process.env.OAUTH_CLIENT_SECRET,
          refreshToken: process.env.OAUTH_REFRESH_TOKEN,
        },
      });
    }
    return nodemailer.createTransport({
      // service: 'Gmail',
      // Activate in gmail "less secure app" option
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  // Send the actual email
  async send(template, subject) {
    // 1) Render the HTML based on a pug template
    // __dirname is the location of the currently running script (being utils folder)
    // this method(pug.renderFile) is the connection to the pug template
    const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`, {
      // passing data to the render file, to do personalization(ex. name) and passing in the url
      firstName: this.firstName,
      url: this.url,
      subject,
    });

    // 2) Define email options
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject: subject,
      html: html,
      // converting HTML to text (using the htmlToText package)
      text: convert(html),
    };

    // 3) Create a transport and send email
    await this.newTransport().sendMail(mailOptions);
    // await transporter.sendMail(mailOptions);
  }

  async sendWelcome() {
    // needs to be await, as this.send is an async function
    await this.send('welcome', 'Welcome to the Natours Family!');
  }

  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      'Your password reset token (valid for only 10 mins)',
    );
  }
};

//-----------------------------------------------------------------
// OLD VERSION
// const sendEmail = async (options) => {
// 1) Create a transporter
// const transporter = nodemailer.createTransport({
//   // service: 'Gmail',
//   // Activate in gmail "less secure app" option
//   host: process.env.EMAIL_HOST,
//   port: process.env.EMAIL_PORT,
//   auth: {
//     user: process.env.EMAIL_USERNAME,
//     pass: process.env.EMAIL_PASSWORD,
//   },
// });

// 2) Define the email options
// const mailOptions = {
//   from: 'Mario Filbert <hello@mario.io>',
//   to: options.email,
//   subject: options.subject,
//   text: options.message,
//   // html:
// };

// 3) Actually send the email
// await transporter.sendMail(mailOptions);
// };

// module.exports = sendEmail;
