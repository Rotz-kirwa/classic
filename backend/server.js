// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// DB
const { connectDB } = require('./config/db');

// routes
const ordersRouter = require('./routes/orders');
const paymentsRouter = require('./routes/payments');
const userRouter = require('./routes/users');
const investmentRouter = require('./routes/investments');

const app = express();

// middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// health check route
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// app routes
app.use('/api/orders', ordersRouter);
app.use('/api/pay', paymentsRouter);
app.use('/api/users', userRouter);
app.use('/api/investments', investmentRouter);

// start server
const port = process.env.PORT || 4000;
app.listen(port, async () => {
  console.log(`🚀 Server listening on port ${port}`);
  await connectDB();
});
