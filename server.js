const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();

// Configure CORS explicitly to allow all origins during development
const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type'],
};
app.use(cors(corsOptions));

// Middleware to parse incoming JSON and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let pool;

// Self-executing async function to handle database connection and server startup
(async function initServer() {
    try {
        // Create a connection pool and test the connection
        pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        });

        const connection = await pool.getConnection();
        console.log("Database connection pool created successfully!");
        connection.release();

        // Start the server only after a successful database connection
      app.listen(process.env.PORT, "0.0.0.0", () => {
           console.log(`Server running on port ${process.env.PORT}`);
      });


    } catch (err) {
        console.error("Failed to start the server: Database connection error.");
        // Log a detailed error message based on the error code
        if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('Error: Access denied for user. Check DB_USER and DB_PASSWORD.');
        } else if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
            console.error('Error: DB_HOST not found. Check the hostname or network connection.');
        } else if (err.code === 'ECONNREFUSED') {
            console.error('Error: Connection refused. Check if the database server is running and accessible.');
        } else {
            console.error('An unexpected database error occurred:', err.message);
        }
        process.exit(1);
    }
})();

// A simple test route to ensure the server is running
app.get("/", (req, res) => {
    res.send("Server is running!");
});

// New booking submission endpoint
app.post("/book", async (req, res) => {
    let connection;
    try {
        const bookingData = req.body;

        // --- NEW LOGGING ADDED HERE ---
        console.log("-------------------");
        console.log("New booking received from client:");
        console.log(bookingData);
        console.log("-------------------");
        console.log("Preparing values for SQL insertion:");

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
        console.log(values);
        console.log("-------------------");

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
