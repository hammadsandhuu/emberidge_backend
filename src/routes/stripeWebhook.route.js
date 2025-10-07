const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const Order = require("../models/order.model");
const sendEmail = require("../utils/email");
const orderConfirmationEmail = require("../templates/emails/orderConfirmationEmail");

/*
  ⚠️ IMPORTANT
  Mount this route BEFORE express.json() middleware in app.js, e.g.:

  app.use("/api/stripe", require("./routes/stripeWebhook"));
  app.use(express.json());
*/

router.post(
  "/webhook",
  express.raw({ type: "application/json" }), // Stripe requires raw body
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    if (!sig) {
      console.error("Missing Stripe signature");
      return res.status(400).send("Missing Stripe signature");
    }

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        //  Payment successful
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object;
          console.log(" PaymentIntent succeeded:", paymentIntent.id);

          const order = await Order.findOneAndUpdate(
            { paymentIntentId: paymentIntent.id },
            {
              paymentStatus: "paid",
              orderStatus: "processing", // or "confirmed" if you want manual ship after this
              updatedAt: new Date(),
            },
            { new: true }
          );

          if (!order) {
            console.warn(
              `No order found for PaymentIntent: ${paymentIntent.id}`
            );
            break;
          }

          // Optional: send confirmation email after successful payment
          try {
            await sendEmail({
              email: order.user.email || paymentIntent.receipt_email,
              subject: `Payment Received - Order ${order.orderNumber}`,
              html: orderConfirmationEmail({
                fullName: order.shippingAddress.fullName,
                orderNumber: order.orderNumber,
                trackingNumber:
                  order.trackingNumber || "Tracking will be shared soon",
                totalAmount: order.totalAmount.toFixed(2),
                paymentMethod: order.paymentMethod,
                orderStatus: order.orderStatus,
                streetAddress: order.shippingAddress.streetAddress,
                city: order.shippingAddress.city,
                country: order.shippingAddress.country,
              }),
            });
            console.log(` Confirmation email sent for ${order.orderNumber}`);
          } catch (emailErr) {
            console.error(" Email sending failed:", emailErr.message);
          }

          break;
        }

        //  Payment failed
        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object;
          console.log("PaymentIntent failed:", paymentIntent.id);

          await Order.findOneAndUpdate(
            { paymentIntentId: paymentIntent.id },
            { paymentStatus: "failed", updatedAt: new Date() },
            { new: true }
          );
          break;
        }

        // Refunds (optional)
        case "charge.refunded": {
          const charge = event.data.object;
          console.log("Payment refunded:", charge.payment_intent);

          await Order.findOneAndUpdate(
            { paymentIntentId: charge.payment_intent },
            { paymentStatus: "refunded", orderStatus: "cancelled" },
            { new: true }
          );
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      // Always acknowledge Stripe webhook receipt
      res.status(200).json({ received: true });
    } catch (err) {
      console.error("Webhook handler error:", err);
      res.status(500).send("Webhook handler error");
    }
  }
);

module.exports = router;
