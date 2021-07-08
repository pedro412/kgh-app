const express = require('express');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
const port = 3000;
require('dotenv').config();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 100 requests per windowMs
});

app.use(limiter);

app.use(cors());

const uri = `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_URI}/${process.env.MONGODB_DATABASE}?retryWrites=true&writeConcern=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function insert(collection, item) {
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE);
    const contactos = db.collection(collection);
    await contactos.insertOne(item);
  } catch (e) {
    throw new Error('Error', e);
  } finally {
    await client.close();
  }
}

const getConfirmationTemplate = (toEmail) => ({
  from: '"Hola 👋" <hola@karenhernandezginecologa.com>',
  to: toEmail,
  subject: 'Tus solicitud ha sido confirmada',
  text: 'Datos recibidos',
  html: '<h1>Gracias, pronto nos pondremos en contacto.</h1>',
});

const sendEmail = async (template, userEmail) => {
  const transporter = nodemailer.createTransport({
    host: 'smtp.titan.email',
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
      user: 'hola@karenhernandezginecologa.com',
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  await transporter.sendMail(getConfirmationTemplate(userEmail));

  await transporter.sendMail(template);
};

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'welcome!',
  });
});

app.post('/contactos', async (req, res) => {
  const { name, email, phone, comments } = req.query;

  if (!name || !email || !phone) {
    return res.status(400).json({
      status: 'invalid',
      message: 'missing data',
    });
  }

  try {
    await insert('contactos', {
      name,
      email,
      phone,
      comments,
    });

    const template = {
      from: '"Hola 👋" <hola@karenhernandezginecologa.com>',
      to: 'hola@karenhernandezginecologa.com',
      subject: 'Nuevo registro (Contacto)',
      text: 'Nuevo Contacto',
      html: `
        <h1>Nuevo contacto</h1>
          <ul>
            <li>Nombre: ${name}</li>
            <li>Correo: ${email}</li>
            <li>Telefono: ${phone}</li>
            <li>Comentarios: ${comments}</li>
          </ul>
        `,
    };
    // don't await for the email since is not important if the email is not send...
    sendEmail(template, email);
    return res.status(200).json({ status: 'ok', message: 'Datos guardados' });
  } catch (error) {
    console.log(error);
    return res.status(400).json({
      status: 'error',
      message: 'Internal Error',
    });
  }
});

app.listen(port, () => {
  console.log(`app listening at http://localhost:${port}`);
});
