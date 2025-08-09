const nodemailer = require("nodemailer");
const pug = require("pug");
const { htmlToText } = require("html-to-text");

module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(" ")[0];
    this.url = url;
    this.from = this.getFromAddress();
  }

  getFromAddress() {
    if (process.env.NODE_ENV === "production") {
      return `Emberidge <admin@emberidge.com>`; // Your real domain in production
    }
    return `Emberidge <${process.env.EMAIL_FROM}>`; // Use mailtrap.io in development
  }

  newTransport() {
    if (process.env.NODE_ENV === "production") {
      return nodemailer.createTransport({
        service: "SendGrid",
        auth: {
          user: process.env.SENDGRID_USERNAME,
          pass: process.env.SENDGRID_PASSWORD,
        },
      });
    }

    // Development (Mailtrap)
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  async send(template, subject) {
    try {
      // 1) Render HTML
      const html = pug.renderFile(
        `${__dirname}/../views/email/${template}.pug`,
        {
          firstName: this.firstName,
          url: this.url,
          subject,
        }
      );

      // 2) Define mail options
      const mailOptions = {
        from: this.from,
        to: this.to,
        subject,
        html,
        text: htmlToText(html),
      };

      // 3) Send email
      const info = await this.newTransport().sendMail(mailOptions);
      console.log(`Email sent: ${info.messageId}`);
    } catch (err) {
      console.error(`Email sending failed:`, err);
      throw new Error(`Failed to send email: ${err.message}`);
    }
  }

  async sendWelcome() {
    await this.send("welcome", "Welcome to Emberidge!");
  }

  async sendPasswordReset() {
    await this.send(
      "passwordReset",
      "Your password reset token (valid for 10 minutes)"
    );
  }
};
