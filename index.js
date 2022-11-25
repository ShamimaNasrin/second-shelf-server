const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const app = express();

//middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.klfob8q.mongodb.net/?retryWrites=true&w=majority`;
// console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        const usersCollection = client.db('secondShelf').collection('users');



        //sent user info to mongodb
        app.post('/users', async (req, res) => {
            const user = req.body;
            //console.log(user);
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        //create jwt token
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            //console.log(user);
            res.send({ accessToken: 'token' })
        });

    }
    finally {

    }
}
run().catch(e => console.error(e));

app.get('/', async (req, res) => {
    res.send('Second Shelf surver running');
})

app.listen(port, () => {
    console.log(`Second Shelf server running on port: ${port}`)
})