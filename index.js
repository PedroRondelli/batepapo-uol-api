import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import joi from "joi";
import dotenv from "dotenv";
import dayjs from "dayjs";

const app = express();
app.use(express.json());
app.use(cors());
dotenv.config();
app.listen(5000, () => console.log("It's running maaaaan ..."));

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

try {
  await mongoClient.connect();
  db = mongoClient.db("chatUol");
} catch (erro) {
  console.log(erro);
}

const participantSchema = joi.object({
  name: joi.string().alphanum().min(1).required(),
});

app.post("/participants", async (req, res) => {
  const participant = req.body;
  const validation = participantSchema.validate(participant, {
    abortEarly: false,
  });

  if (validation.error) {
    const erros = validation.error.details.map((detail) => detail.message);
    res.status(422).send(erros);
    return;
  }

  try {
    const participantExist = await db.collection("participants").findOne({
      name: participant.name,
    });

    if (participantExist) {
      res.sendStatus(409);
      return;
    }
    await db.collection("participants").insertOne({
      ...participant,
      lastStatus: Date.now(),
    });
    await db.collection("messages").insertOne({
      from: participant.name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });
    res.sendStatus(201);
  } catch (error) {
    console.log(error);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const allParticipants = await db
      .collection("participants")
      .find()
      .toArray();
    console.log(allParticipants)  
    res.send(allParticipants);
  } catch (erro) {
    console.log(erro);
  }
});
