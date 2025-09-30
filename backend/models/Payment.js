// models/Payment.js
const pool = require("../config/db");

// Create Payments table if not exists
const initPaymentTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      user_id INT,                                 
      amount NUMERIC(10,2) NOT NULL,
      amount_paid NUMERIC(10,2),                   
      method VARCHAR(50) NOT NULL,                 
      status VARCHAR(20) DEFAULT 'initiated',      
      checkout_request_id VARCHAR(255) UNIQUE,     -- CRITICAL: Used to link STK push to callback
      merchant_request_id VARCHAR(255),            
      mpesa_receipt_number VARCHAR(255),           
      transaction_date VARCHAR(255),               
      phone_number VARCHAR(255),                   
      error_description TEXT,                      
      result_code INT,                             
      transaction_id VARCHAR(255),                 
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
    )
  `);
};

const Payment = {
  /**
   * Creates a new 'initiated' payment record when STK push is started.
   */
  async create({
    order_id,
    user_id,
    amount,
    method,
    status,
    checkout_request_id,
    merchant_request_id,
  }) {
    const result = await pool.query(
      `INSERT INTO payments (
        order_id, user_id, amount, method, status, checkout_request_id, merchant_request_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        order_id,
        user_id,
        amount,
        method,
        status,
        checkout_request_id,
        merchant_request_id,
      ]
    );
    return result.rows[0];
  },

  /**
   * Finds a payment record by its CheckoutRequestID and updates all callback data.
   * This is the CORE function used by the paymentsController.stkCallback.
   */
  async updateStatusByCheckoutID(checkoutID, updateData) {
    const {
      status,
      mpesa_receipt_number,
      amount_paid,
      transaction_date,
      phone_number,
      error_description,
      result_code,
      transaction_id,
    } = updateData;

    // Build the query dynamically
    let setClauses = [];
    const values = [];
    let paramIndex = 1;

    const addClause = (field, value) => {
      if (value !== undefined) {
        setClauses.push(`${field} = $${paramIndex++}`);
        values.push(value);
      }
    };

    addClause("status", status);
    addClause("mpesa_receipt_number", mpesa_receipt_number);
    addClause("amount_paid", amount_paid);
    addClause("transaction_date", transaction_date);
    addClause("phone_number", phone_number);
    addClause("error_description", error_description);
    addClause("result_code", result_code);
    addClause("transaction_id", transaction_id);
    addClause("updated_at", new Date());

    if (setClauses.length === 0) {
      return null; // Nothing to update
    }

    const query = `
      UPDATE payments 
      SET ${setClauses.join(", ")} 
      WHERE "checkout_request_id" = $${paramIndex} 
      RETURNING *
    `;
    values.push(checkoutID); // The last parameter is the checkoutID

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // --- Utility Functions (For your CRUD routes) ---

  async findAll() {
    const result = await pool.query(
      "SELECT * FROM payments ORDER BY created_at DESC"
    );
    return result.rows;
  },

  async findById(id) {
    const result = await pool.query("SELECT * FROM payments WHERE id = $1", [
      id,
    ]);
    return result.rows[0];
  },

  async updateStatus(id, status) {
    const result = await pool.query(
      "UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
      [status, id]
    );
    return result.rows[0];
  },
};

// initPaymentTable(); // REMOVED - Initialization is now controlled in server.js

module.exports = Payment;
module.exports.initPaymentTable = initPaymentTable; // EXPORTED
