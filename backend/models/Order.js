// models/Order.js
const pool = require("../config/db");

// Create Orders table if not exists
const initOrderTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_name VARCHAR(100) NOT NULL,
      product VARCHAR(100) NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      transaction_id VARCHAR(255),  -- NEW: To store a generic transaction ID
      mpesa_receipt_number VARCHAR(255), -- NEW: To store M-Pesa specific receipt
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const Order = {
  async create({ customer_name, product, amount }) {
    const result = await pool.query(
      "INSERT INTO orders (customer_name, product, amount) VALUES ($1, $2, $3) RETURNING *",
      [customer_name, product, amount]
    );
    return result.rows[0];
  },

  async findAll() {
    const result = await pool.query(
      "SELECT * FROM orders ORDER BY created_at DESC"
    );
    return result.rows;
  },

  async findById(id) {
    const result = await pool.query("SELECT * FROM orders WHERE id = $1", [id]);
    return result.rows[0];
  },

  // OLD: async updateStatus(id, status) { ... }

  // NEW: Method to update status and payment details
  async updateStatusWithPaymentRef(id, status, mpesaReceipt, transactionId) {
    const result = await pool.query(
      "UPDATE orders SET status = $1, mpesa_receipt_number = $2, transaction_id = $3 WHERE id = $4 RETURNING *",
      [status, mpesaReceipt, transactionId, id]
    );
    return result.rows[0];
  },

  // I will keep the old one too, just in case other parts of the app use it
  async updateStatus(id, status) {
    const result = await pool.query(
      "UPDATE orders SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );
    return result.rows[0];
  },
};

initOrderTable();

module.exports = Order;
