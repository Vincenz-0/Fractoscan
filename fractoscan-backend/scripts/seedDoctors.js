const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const Doctor = require("../models/Doctor");

const doctors = [
  {
    doctor_id: "DOC-CAL-001",
    name: "Dr. Arun Kumar",
    specialization: "Orthopedic",
    hospital_name: "Calicut Orthopedic Clinic",
    role: "doctor",
    email: "arun.kumar@caliortho.in",
    password: "password",
    phone: "7994164536",
    latitude: 11.2588,
    longitude: 75.7804,
    city: "Calicut"
  },
  {
    doctor_id: "DOC-CAL-002",
    name: "Dr. Meera Nair",
    specialization: "Orthopedic",
    hospital_name: "Baby Memorial Hospital",
    role: "doctor",
    email: "meera.nair@bmhcalicut.in",
    password: "password",
    phone: "7994164536",
    latitude: 11.2747,
    longitude: 75.776,
    city: "Calicut"
  },
  {
    doctor_id: "DOC-CAL-003",
    name: "Dr. Rahul Menon",
    specialization: "Orthopedic",
    hospital_name: "MIMS Hospital",
    role: "doctor",
    email: "rahul.menon@mimscalicut.in",
    password: "password",
    phone: "7994164536",
    latitude: 11.2895,
    longitude: 75.7845,
    city: "Calicut"
  },
  {
    doctor_id: "DOC-CAL-004",
    name: "Dr. Anil Varma",
    specialization: "Orthopedic",
    hospital_name: "Aster MIMS",
    role: "doctor",
    email: "anil.varma@astermims.in",
    password: "password",
    phone: "7994164536",
    latitude: 11.2921,
    longitude: 75.7873,
    city: "Calicut"
  },
  {
    doctor_id: "DOC-CAL-005",
    name: "Dr. Suresh Nair",
    specialization: "Orthopedic",
    hospital_name: "National Hospital Calicut",
    role: "doctor",
    email: "suresh.nair@nationalcalicut.in",
    password: "password",
    phone: "7994164536",
    latitude: 11.2605,
    longitude: 75.78,
    city: "Calicut"
  }
];

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected for doctor seeding");

  const operations = doctors.map((doctor) => ({
    updateOne: {
      filter: { doctor_id: doctor.doctor_id },
      update: { $set: doctor },
      upsert: true
    }
  }));

  const result = await Doctor.bulkWrite(operations, { ordered: false });
  console.log(
    `✅ Doctor seed complete | matched: ${result.matchedCount}, modified: ${result.modifiedCount}, upserted: ${result.upsertedCount}`
  );
}

run()
  .catch((error) => {
    console.error("❌ Doctor seeding failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
