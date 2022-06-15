const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const jwt = require("jsonwebtoken");
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

//token verivication function
function verifyJWT(req, res, next) {
	const authHeader = req.headers.authorization;
	if (!authHeader) {
		return res.status(401).send({ message: "UnAuthorized access" });
	}
	const token = authHeader.split(" ")[1];
	jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
		if (err) {
			return res.status(403).send({ message: "Forbidden access" });
		}
		req.decoded = decoded;
		next();
	});
}

async function run() {
	try {
		await client.connect();
		const serviceCollection = client
			.db("doctors-portal")
			.collection("services");
		const bookingCollection = client
			.db("doctors-portal")
			.collection("bookings");

		const userCollection = client.db("doctors-portal").collection("users");
		const doctorCollection = client
			.db("doctors-portal")
			.collection("doctors");

		//verify admin
		const verifyAdmin = async (req, res, next) => {
			const requester = req.decoded.email;
			const requesterAccount = await userCollection.findOne({
				email: requester,
			});
			if (requesterAccount.role == "admin") {
				next();
			} else {
				res.status(403).send({ message: "Forbidden" });
			}
		};

		//put user informtion
		app.put("/user/:email", async (req, res) => {
			const email = req.params.email;
			const user = req.body;
			const filter = { email: email };
			const options = { upsert: true };
			const updatedUser = {
				$set: user,
			};

			const result = await userCollection.updateOne(
				filter,
				updatedUser,
				options
			);
			const token = jwt.sign(
				{ email: email },
				process.env.ACCESS_TOKEN_SECRET,
				{ expiresIn: "23h" }
			);
			res.send({ result, token });
		});
		//put user admin information
		app.put(
			"/user/admin/:email",
			verifyJWT,
			verifyAdmin,
			async (req, res) => {
				const email = req.params.email;

				const filter = { email: email };
				const updatedUser = {
					$set: { role: "admin" },
				};
				const result = await userCollection.updateOne(
					filter,
					updatedUser
				);
				res.send(result);
			}
		);

		//get admin data
		app.get("/admin/:email", verifyJWT, async (req, res) => {
			const email = req.params.email;
			const user = await userCollection.findOne({ email: email });
			const isAdmin = user.role === "admin";
			res.send({ admin: isAdmin });
		});

		//get all users
		app.get("/users", verifyJWT, async (req, res) => {
			const users = await userCollection.find().toArray();
			res.send(users);
		});

		//get service data
		app.get("/service", async (req, res) => {
			const cursor = serviceCollection.find({}).project({ name: 1 });
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
		//get booking data for individual user
		app.get("/booking", verifyJWT, async (req, res) => {
			const patient = req.query.patient;
			const decodedEmail = req.decoded.email;
			if (patient === decodedEmail) {
				const query = { patientEmail: patient };
				const booking = await bookingCollection.find(query).toArray();
				return res.send(booking);
			} else {
				return res.status(403).send({ message: "Forbidden access" });
			}
		});

		// available appointment time
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
		//add doctor information
		app.post("/doctor", verifyJWT, verifyAdmin, async (req, res) => {
			const doctor = req.body;
			const result = await doctorCollection.insertOne(doctor);
			res.send(result);
		});
		//get doctor information
		app.get("/doctor", verifyJWT, verifyAdmin, async (req, res) => {
			const doctor = await doctorCollection.find().toArray();
			res.send(doctor);
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
//somthing change
