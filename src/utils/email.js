const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  // 1) Create a transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT, // usually 587
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  // 2) Define email options
  const mailOptions = {
    from: "<no-reply@emberidge.com>",
    to: options.email,
    subject: options.subject,
    text: options.message,
    // html: options.html,  // optional, for HTML templates
  };

  // 3) Send the email
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
