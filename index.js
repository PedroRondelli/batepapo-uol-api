import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import joi from "joi";
import dotenv from "dotenv";
import dayjs from "dayjs";

const app = express();
app.use(express.json());
app.use(cors());
app.listen(5000, () => console.log("It's running maaaaan ..."));
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

try {
  await mongoClient.connect();
  db = mongoClient.db("chatUol");
} catch (erro) {
  console.log(erro);
}

const participantSchema = joi.object({
  name: joi.string().required(),
});

const messageSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.string().valid("message", "private_message"),
});

function chooseMsgs(message, user) {
  const userCanRead =
    message.type === "message" ||
    message.type === "status" ||
    (message.type === "private_message" && message.to === user) ||
    (message.type === "private_message" && message.from === user);
  return userCanRead;
}

setInterval(async () => {
  try {
    const allParticipants = await db
      .collection("participants")
      .find()
      .toArray();

    allParticipants.forEach(async (participant) => {
      if (Date.now() - participant.lastStatus > 10000) {
        await db
          .collection("participants")
          .deleteOne({ name: participant.name });
        await db.collection("messages").insertOne({
          from: participant.name,
          to: "Todos",
          text: "sai da sala...",
          type: "status",
          time: dayjs().format("HH:mm:ss"),
        });
      }
    });
  } catch (erro) {
    console.log(erro);
  }
}, 15000);

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
    res.send(allParticipants);
  } catch (erro) {
    console.log(erro);
  }
});

app.post("/messages", async (req, res) => {
  const validation = messageSchema.validate(req.body, { abortEarly: false });
  const participantOnline = await db
    .collection("participants")
    .findOne({ name: req.headers.user });

  if (validation.error || !participantOnline) {
    res.sendStatus(422);
    return;
  }
  await db.collection("messages").insertOne({
    from: req.headers.user,
    to: req.body.to,
    text: req.body.text,
    type: req.body.type,
    time: dayjs().format("HH:mm:ss"),
  });
  res.sendStatus(201);
});

app.get("/messages", async (req, res) => {
  const { limit } = req.query;
  const limitNumber = parseInt(limit);
  console.log(limitNumber);
  try {
    const allMessages = await db.collection("messages").find().toArray();

    const canBeRead = allMessages.filter((message) => {
      const userCanRead = chooseMsgs(message, req.headers.user);

      if (userCanRead) {
        return true;
      } else {
        return false;
      }
    });
    if (limitNumber) {
      console.log(limitNumber);
      res.send(canBeRead.reverse().filter((element, idx) => idx < limitNumber));
      return;
    }
    res.send(canBeRead.reverse());
  } catch (erro) {
    console.log(erro);
  }
});

app.post("/status", async (req, res) => {
  const participant = req.headers.user;
  const participantExists = await db
    .collection("participants")
    .findOne({ name: participant });

  if (!participantExists) {
    res.sendStatus(404);
    return;
  }
  await db
    .collection("participants")
    .updateOne({ name: participant }, { $set: { lastStatus: Date.now() } });

  res.sendStatus(200);
});
