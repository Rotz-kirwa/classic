// lib/mpesa.js
const axios = require("axios");
require("dotenv").config();

const {
  MPESA_ENV,
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_SHORTCODE,
  MPESA_PASSKEY,
  MPESA_CALLBACK_URL,
} = process.env;

function endpoints() {
  const baseURL =
    MPESA_ENV === "sandbox"
      ? "https://sandbox.safaricom.co.ke"
      : "https://api.safaricom.co.ke";

  return {
    oauth: `${baseURL}/oauth/v1/generate?grant_type=client_credentials`,
    stk: `${baseURL}/mpesa/stkpush/v1/processrequest`,
  };
}

async function getToken() {
  const url = endpoints().oauth;
  const auth = Buffer.from(
    `${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`
  ).toString("base64");

  const res = await axios.get(url, {
    headers: { Authorization: `Basic ${auth}` },
  });
  return res.data.access_token;
}

function buildPassword() {
  // Generate timestamp in YYYYMMDDhhmmss format
  const date = new Date();
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hour = date.getHours().toString().padStart(2, "0");
  const minute = date.getMinutes().toString().padStart(2, "0");
  const second = date.getSeconds().toString().padStart(2, "0");

  const timestamp = `${year}${month}${day}${hour}${minute}${second}`;

  const raw = `${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`;
  return { password: Buffer.from(raw).toString("base64"), timestamp };
}

async function initiateStkPush({
  amount,
  phoneNumber,
  accountReference = "ORDER",
}) {
  const token = await getToken();
  const { password, timestamp } = buildPassword();
  const url = endpoints().stk;

  const body = {
    BusinessShortCode: MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: phoneNumber,
    PartyB: MPESA_SHORTCODE,
    PhoneNumber: phoneNumber,
    CallBackURL: MPESA_CALLBACK_URL,
    AccountReference: accountReference,
    TransactionDesc: "School Fee Payment",
  };

  const res = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  return res.data;
}

module.exports = { initiateStkPush };
