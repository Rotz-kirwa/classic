// routes/payments.js
const express = require("express");
const paymentsController = require("../controllers/paymentsController");
const { initiateStkPush } = require("../lib/mpesa");
const Payment = require("../models/Payment"); // <-- Needed to create initial payment record
const router = express.Router();

// --- Existing CRUD Routes ---
router.get("/", paymentsController.getPayments);
router.get("/:id", paymentsController.getPaymentById);
router.post("/", paymentsController.createPayment);
router.put("/:id/status", paymentsController.updatePaymentStatus);

// --- M-Pesa STK Push Route (Client-facing) ---
router.post("/stk", async (req, res) => {
  try {
    // Collect data needed for M-Pesa AND for your DB record
    const { amount, phoneNumber, accountReference, orderId, userId } = req.body;

    if (!amount || !phoneNumber || !orderId) {
      return res
        .status(400)
        .json({ error: "Amount, phone number, and orderId required" });
    }

    // 1. Initiate the STK Push with Safaricom
    const mpesaResult = await initiateStkPush({
      amount,
      phoneNumber,
      accountReference,
    });

    // Check if the request was ACCEPTED by Safaricom (ResponseCode 0 means request received)
    if (mpesaResult.ResponseCode !== "0") {
      // Log the Safaricom error and respond to the client
      console.error("STK Push failed at Safaricom:", mpesaResult);
      return res.status(400).json({
        error: "STK Push request denied by M-Pesa.",
        details: mpesaResult.ResponseDescription || mpesaResult.errorMessage,
      });
    }

    // 2. CRITICAL STEP: Create a PENDING payment record in your DB
    // This allows the callback function (stkCallback) to find the record later.
    await Payment.create({
      order_id: orderId,
      user_id: userId,
      amount: amount,
      method: "mpesa_stk",
      status: "pending", // Set status to pending
      checkout_request_id: mpesaResult.CheckoutRequestID, // KEY LINKING ID
      merchant_request_id: mpesaResult.MerchantRequestID,
    });

    // 3. Send success response back to the client
    res.json({
      message:
        "STK Push initiated successfully. Awaiting payment confirmation.",
      checkout_request_id: mpesaResult.CheckoutRequestID,
      merchant_request_id: mpesaResult.MerchantRequestID,
      customer_message: mpesaResult.CustomerMessage,
    });
  } catch (err) {
    console.error("STK Push initiation error (External):", err.message);
    const errorDetails = err.response
      ? err.response.data
      : "Internal server error. Check M-Pesa credentials.";
    res
      .status(500)
      .json({ error: "Payment initiation failed", details: errorDetails });
  }
});

// --- M-Pesa Callback Route (Safaricom-facing) ---
router.post("/callback", paymentsController.stkCallback);

module.exports = router;
