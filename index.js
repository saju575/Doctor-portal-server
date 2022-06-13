const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { send } = require("express/lib/response");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.2yzfk.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	serverApi: ServerApiVersion.v1,
});

async function run() {
	try {
		await client.connect();
		const serviceCollection = client
			.db("doctors-portal")
			.collection("services");
		const bookingCollection = client
			.db("doctors-portal")
			.collection("bookings");

		//get service data
		app.get("/service", async (req, res) => {
			const query = {};
			const cursor = serviceCollection.find(query);
			const result = await cursor.toArray();
			res.send(result);
		});

		//insert booking info

		app.post("/booking", async (req, res) => {
			const booking = req.body;
			const query = {
				treatmentName: booking.treatmentName,
				date: booking.date,
				patientName: booking.patientName,
			};
			const exists = await bookingCollection.findOne(query);
			if (exists) {
				return res.send({ success: false, booking: exists });
			} else {
				const result = await bookingCollection.insertOne(booking);
				return res.send({ success: true, result });
			}
		});
		// || "May 21, 2022"
		app.get("/available", async (req, res) => {
			const date = req.query.date || "Jun 13, 2022";
			//console.log(date);
			const services = await serviceCollection.find().toArray();
			//geting booking of that day
			const query = { date: date };
			const bookings = await bookingCollection.find(query).toArray();

			services.forEach((service) => {
				const serviceBooking = bookings.filter(
					(b) => b.treatmentName === service.name
				);
				//console.log(serviceBooking);
				const booked = serviceBooking.map((s) => s.slot);
				const available = service.slots.filter(
					(s) => !booked.includes(s)
				);
				service.available = available;
			});

			res.send(services);
		});
	} finally {
	}
}

run().catch(console.dir);

app.get("/", (req, res) => {
	res.send("Hello from doctor uncle");
});

app.listen(port, () => {
	console.log(`Doctor App listening on port ${port}`);
});
