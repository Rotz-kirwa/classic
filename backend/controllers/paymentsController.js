// controllers/paymentsController.js
const Payment = require("../models/Payment");
const Order = require("../models/Order"); // <-- NEW: Import Order Model

const paymentsController = {
  // --- Existing CRUD Functions ---
  async createPayment(req, res) {
    try {
      const { order_id, amount, method } = req.body;
      if (!order_id || !amount || !method) {
        return res.status(400).json({ error: "All fields are required" });
      }

      const payment = await Payment.create({
        order_id,
        amount,
        method,
        status: "initiated",
      });
      res.status(201).json(payment);
    } catch (err) {
      console.error("Error creating payment:", err.message);
      res.status(500).json({ error: "Server error" });
    }
  },

  async getPayments(req, res) {
    try {
      const payments = await Payment.findAll();
      res.json(payments);
    } catch (err) {
      console.error("Error fetching payments:", err.message);
      res.status(500).json({ error: "Server error" });
    }
  },

  async getPaymentById(req, res) {
    try {
      const { id } = req.params;
      const payment = await Payment.findById(id);
      if (!payment) return res.status(404).json({ error: "Payment not found" });
      res.json(payment);
    } catch (err) {
      console.error("Error fetching payment:", err.message);
      res.status(500).json({ error: "Server error" });
    }
  },

  async updatePaymentStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const updated = await Payment.updateStatus(id, status);
      if (!updated) return res.status(404).json({ error: "Payment not found" });
      res.json(updated);
    } catch (err) {
      console.error("Error updating payment:", err.message);
      res.status(500).json({ error: "Server error" });
    }
  },
  // --------------------------------

  /**
   * Helper function to process the M-Pesa callback data and link it to the DB.
   */
  async linkMpesaPayment(data) {
    const checkoutID = data.CheckoutRequestID;
    const resultCode = data.ResultCode;

    if (resultCode === 0) {
      // SUCCESSFUL TRANSACTION (ResultCode 0)
      const metadata = data.CallbackMetadata.Item;

      const amount = metadata.find((item) => item.Name === "Amount")?.Value;
      const receipt = metadata.find(
        (item) => item.Name === "MpesaReceiptNumber"
      )?.Value;
      const transactionDate = metadata.find(
        (item) => item.Name === "TransactionDate"
      )?.Value;
      const phoneNumber = metadata.find(
        (item) => item.Name === "PhoneNumber"
      )?.Value;

      const transactionId = `${receipt}-${transactionDate}`; // Create a unique ID

      console.log(
        `SUCCESS: M-Pesa Payment of KES ${amount} with Receipt: ${receipt}`
      );

      const updateData = {
        status: "completed",
        mpesa_receipt_number: receipt,
        amount_paid: parseFloat(amount), // Assuming a new field for paid amount
        transaction_date: transactionDate,
        phone_number: phoneNumber,
        transaction_id: transactionId, // NEW: Pass the generated ID
        // Add any other fields you want to save from the metadata
      };

      // *** DATABASE OPERATION: Update the pending PAYMENT record ***
      const updatedPayment = await Payment.updateStatusByCheckoutID(
        checkoutID,
        updateData
      );

      if (updatedPayment) {
        console.log(`DB Update Success for Payment CheckoutID: ${checkoutID}`);

        // --- NEW CRITICAL LOGIC ---
        // 1. Get the original order ID from the updated payment record
        const orderId = updatedPayment.order_id;

        // 2. Mark the ORDER as paid using the new method
        const updatedOrder = await Order.updateStatusWithPaymentRef(
          orderId,
          "paid", // Set order status to 'paid'
          receipt,
          transactionId
        );

        if (updatedOrder) {
          console.log(
            `DB Update Success for Order ID: ${orderId} (Marked as paid)`
          );
        } else {
          console.error(
            `DB Error: Could not find or update Order ID: ${orderId}`
          );
        }
        // --- END NEW CRITICAL LOGIC ---
      } else {
        console.error(
          `DB Error: Could not find or update payment with CheckoutID: ${checkoutID}`
        );
      }

      return updatedPayment;
    } else {
      // FAILED/CANCELLED TRANSACTION (Non-zero ResultCode)
      console.log(
        `FAILED: Transaction failed with code ${resultCode}. Description: ${data.ResultDesc}`
      );

      // *** DATABASE OPERATION: Update status to failed ***
      const updatedPayment = await Payment.updateStatusByCheckoutID(
        checkoutID,
        {
          status: "failed",
          error_description: data.ResultDesc,
          result_code: resultCode,
        }
      );

      // OPTIONAL: Also mark the corresponding order as 'failed' if needed
      if (updatedPayment) {
        await Order.updateStatus(updatedPayment.order_id, "payment_failed");
      }

      return updatedPayment;
    }
  },

  /**
   * Handles the callback from the M-Pesa API (The main external endpoint).
   */
  async stkCallback(req, res) {
    try {
      // Safaricom sends data inside req.body.Body.stkCallback
      const callbackData = req.body.Body.stkCallback;

      // Use 'await' to ensure processing is done (or pass it to a queue
      // like RabbitMQ/Redis for production resilience)
      await paymentsController.linkMpesaPayment(callbackData);

      // CRITICAL: Safaricom MUST receive a 200 OK response immediately
      // The response body is also part of the M-Pesa requirement.
      res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    } catch (err) {
      console.error("Error processing M-PESA callback:", err.message);
      // Still send 200 to Safaricom to prevent retries
      res
        .status(200)
        // If your internal server error causes the processing to fail,
        // you still tell M-Pesa you got the message, but with a different code
        .json({ ResultCode: 1, ResultDesc: "Internal Server Error" });
    }
  },
};

module.exports = paymentsController;
