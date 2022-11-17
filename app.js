const express = require('express')
const fetch = require('node-fetch')
const path = require('path');
const admin = require('firebase-admin'); 
const cors = require('cors')
const app = express()

app.use(express.json());
app.use(cors());

// let serviceAccount;
// if (fs.existsSync('./swe-432-hw3-fe757-firebase-adminsdk-4ooff-096b4f91bd.json')) {
//     serviceAccount = require('./swe-432-hw3-fe757-firebase-adminsdk-4ooff-096b4f91bd.json');
// } else {
//     serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
// }   

// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount)
// });
// let db = admin.firestore();
 
app.get('/', (req, res) => {
  res.status(200).json({response: 'Pokedex REST API'})
})

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.status(404).json({"Error": "Endpoint doesn't exist."});
});

module.exports = app;