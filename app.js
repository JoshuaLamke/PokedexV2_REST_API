const express = require('express');
const cors = require('cors');
const AWS = require("aws-sdk");
const axios = require('axios').default || require('axios');

const DynamoDBConnector = require('./DynamoDBConnector');

// AWS.config.credentials = new AWS.SharedIniFileCredentials();
AWS.config.region = "us-east-1";
const client = new AWS.DynamoDB.DocumentClient();
const tableName = "pokedex-db";

const connector = new DynamoDBConnector(client, tableName);

const app = express()

app.use(express.json());
app.use(cors());
 
app.get('/', (req, res) => {
  res.status(200).json({response: 'Pokedex REST API'})
})

app.get('/pokemon/all', async (req, res) => {
  const getAllLink = "https://pokeapi.co/api/v2/pokemon?limit=10000";
  const { data: { results: pokemonList } } = await axios.get(getAllLink);
  let scanResult, data;
  scanResult = await connector.scan();
  data = scanResult.Items;
  while(scanResult.lastEvaluatedKey) {
    scanResult = await connector.scan(lastEvaluatedKey);
    data.concat(scanResult.Items);
  }
  if(data.length >= pokemonList.length) {
    return res.status(200).json({"Data": data});
  }
  const results = await Promise.all(pokemonList.map((pokemon) => axios.get(pokemon.url)));
  const timestamp = Date.now();
  const pokemonData = results.map((r) => r.data);
  const batch = pokemonData.map(({name, sprites: { other: official_artwork }, types, url}) => ({
    key: {
      pk: name,
      sk: "pokemon"
    },
    inputParams: {
      image_url: official_artwork,
      types,
      url,
      timestamp,
      deleted: false,
      lastModifiedBy: "pokemon-service",
      discriminator: "pokemon"
    }
  }));
  await connector.batchUpdate(batch);
  res.status(200).json({"Data": pokemonData});
})

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.status(404).json({"Error": "Endpoint doesn't exist."});
});

module.exports = app;