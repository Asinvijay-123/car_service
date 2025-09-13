const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();

// Enable CORS for all routes and origins
app.use(cors());

// Middleware to parse incoming JSON and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create a connection pool instead of a single connection
// This is a best practice for handling multiple requests efficiently
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// A simple test route to ensure the server is running
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// New booking submission endpoint
app.post("/book", async (req, res) => {
  let connection;
  try {
    const bookingData = req.body;

    // Log the received data for debugging
    console.log("New booking received:", bookingData);

    // Get a connection from the pool
    connection = await pool.getConnection();

    // Insert data into your 'bookings' table
    const insertQuery = `
      INSERT INTO bookings (
        customer_name, phone, email, city, sub_area, address,
        service, car_type, price, payment_method, terms_agreed,
        water_electricity_available, booking_date, time_slots
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Ensure timeSlots array is stringified for database storage
    const timeSlotsString = JSON.stringify(bookingData.timeSlots);
    const serviceString = bookingData.package;

    const values = [
      bookingData.name,
      bookingData.phone,
      bookingData.email,
      bookingData.city,
      bookingData.subArea,
      bookingData.address,
      serviceString,
      bookingData.carType,
      bookingData.price,
      bookingData.paymentMethod,
      bookingData.termsAgreed,
      bookingData.waterElectricityAvailable,
      bookingData.bookingDate,
      timeSlotsString,
    ];

    await connection.execute(insertQuery, values);

    // Send a success response
    res.status(200).send("Booking saved successfully!");

  } catch (err) {
    console.error("Database error:", err);
    res.status(500).send("Error submitting your booking. Please try again.");
  } finally {
    // Release the connection back to the pool
    if (connection) connection.release();
  }
});

// Endpoint to fetch all booking data
app.get("/admin/bookings", async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query("SELECT * FROM bookings ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    console.error("Database query error:", err);
    res.status(500).send("Error fetching booking data.");
  } finally {
    if (connection) connection.release();
  }
});

// Endpoint to delete a booking by ID
app.delete("/admin/bookings/:id", async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();
    const [result] = await connection.execute("DELETE FROM bookings WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).send("Booking not found.");
    }
    res.status(200).send("Booking deleted successfully!");
  } catch (err) {
    console.error("Database deletion error:", err);
    res.status(500).send("Error deleting booking.");
  } finally {
    if (connection) connection.release();
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
  console.log("Database connection pool created successfully!");
});
