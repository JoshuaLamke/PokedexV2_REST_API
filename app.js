const express = require("express");
const cors = require("cors");
const AWS = require("aws-sdk");
const axios = require('axios');
const DynamoDBConnector = require("./DynamoDBConnector");
const multer = require("multer");
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const serverless = require("serverless-http");

// const credentials = new AWS.SharedIniFileCredentials()
// AWS.config.credentials = credentials;

AWS.config.region = "us-east-1";
const client = new AWS.DynamoDB.DocumentClient();
const tableName = "pokedex-db";
const customPokemonClient = new AWS.DynamoDB.DocumentClient();
const customTableName = "custom-pokemon-db";

const S3 = new S3Client({
  // credentials: {
  //   accessKeyId: credentials.accessKeyId,
  //   secretAccessKey: credentials.secretAccessKey
  // },
  region: "us-east-1"
})

const connector = new DynamoDBConnector(client, tableName);
const customConnector = new DynamoDBConnector(customPokemonClient, customTableName);

const app = express()
app.use(express.json());
app.use(cors());

const upload = multer({
  storage: multer.memoryStorage()
});


app.get('/', (req, res) => {
  res.status(200).json({response: 'Pokedex REST API'})
})

app.get('/pokemon/all', async (req, res) => {
  const getAllLink = "https://pokeapi.co/api/v2/pokemon?limit=10000";
  try {
    const { data: { results: pokemonList }} = await axios.get(getAllLink);
    let scanResult, data;
    scanResult = await connector.scan();
    data = scanResult.Items;
    while(scanResult.lastEvaluatedKey) {
      scanResult = await connector.scan(scanResult.lastEvaluatedKey);
      data.concat(scanResult.Items);
    }

    if(data.length >= pokemonList.length) {
      return res.status(200).json(data);
    }
    const names = {};
    for(let i = 0; i < data.length; i++) {
      names[data[i].pk] = true;
    }
    const results = await Promise.all(pokemonList.map((pokemon) => axios.get(pokemon.url)));
    const timestamp = Date.now();
    const pokemonData = results.map((r) => r.data);
    const batch = pokemonData.filter((p) => !names[p.name])
      .map(({name, sprites: { other: official_artwork }, types, url, id}) => ({
        key: {
          pk: name,
          sk: "pokemon"
        },
        inputParams: {
          image_url: official_artwork,
          types,
          url,
          timestamp,
          id,
          deleted: false,
          lastModifiedBy: "pokemon-service",
          discriminator: "pokemon"
        }
      }));
    await connector.batchUpdate(batch);
    res.status(200).json([ ...data, ...batch.map((b) => ({
      ...b.inputParams,
      ...b.key
    }))]);
  } catch(e) {
    res.status(500).send({"Error": e});
  }
});

app.get('/custom/all', async (req, res) => {
  try {
    let scanResult, data;
    scanResult = await customConnector.scan();
    data = scanResult.Items;
    while(scanResult.lastEvaluatedKey) {
      scanResult = await customConnector.scan(scanResult.lastEvaluatedKey);
      data.concat(scanResult.Items);
    }
    const customPokemon = data.reduce((prev, curr) => {
      return {
        ...prev,
        [curr.pk]: curr
      }
    }, {});
    return res.status(200).json(customPokemon);
  } catch(e) {
    return res.status(500).json({"Error": e});
  }
});

app.post('/custom/update', async (req, res) => {
  const {originalData, name, ...customPokemon} = req.body;
  try {
    await customConnector.update({
      pk: name,
      sk: "custom-pokemon"
    },
    {
      ...customPokemon,
      deleted: false,
      lastModifiedBy: "pokemon-service",
      discriminator: "custom-pokemon"
    });
    return res.status(200).send(req.body);
  } catch(e) {
    return res.status(501).send({"Error": JSON.stringify(e)});
  }
});

app.post('/custom/delete', async (req, res) => {
  const { pk, sk, img } = req.body;
  try {
    await customConnector.delete({
      pk,
      sk
    });
    const fileDeletecommand = new DeleteObjectCommand({
      Bucket: "custom-pokemon-images",
      Key: `${pk}/${img}`
    });
    await S3.send(fileDeletecommand);
    const bucketDeletecommand = new DeleteObjectCommand({
      Bucket: "custom-pokemon-images",
      Key: `${pk}/`
    });
    await S3.send(bucketDeletecommand);
    return res.status(200).send({"Success": `Deleted ${pk} successfully`});
  } catch(e) {
    return res.status(501).send({"Error": JSON.stringify(e)});
  }
});

app.post('/custom/updateImg', upload.single("file"), async (req, res) => {
  try {
    const oldImageName = req.body.oldImageName;
    const params = {
      Bucket: "custom-pokemon-images",
      ContentType: req.file.mimetype,
      Body: req.file.buffer,
      Key: `${req.body.customPokemonName}/${req.file.originalname}`,
    };

    if(oldImageName) {
      const deleteParams = {
        Bucket: "custom-pokemon-images",
        Key: `${req.body.customPokemonName}/${oldImageName}`,
      };
      const deleteCommand = new DeleteObjectCommand(deleteParams);
      await S3.send(deleteCommand);
    }

    const command = new PutObjectCommand(params);

    await S3.send(command);

    return res.send({
        message: "Uploaded!",
    });
  } catch(e) {
    return res.status(501).send({"Error": JSON.stringify(e)});
  }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.status(404).json({"Error": "Endpoint doesn't exist."});
});

// app.listen(
//   process.env.PORT || 5000, 
//   () => console.log(`server starting on port ${process.env.PORT || 5000}!`)
// );

module.exports.server = serverless(app);