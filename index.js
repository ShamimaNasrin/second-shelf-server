const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const app = express();

//middleware
app.use(cors());
app.use(express.json());


//verify the token
function verifyJWT(req, res, next) {

    //secondly verify here
    console.log('token from client:', req.headers.authorization);

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }


    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            console.log(err)
            return res.status(403).send({ message: 'forbidden access' })
        }


        req.decoded = decoded;
        next();
    })

}


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

        //check the user that already loggedin An Admin or not
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            // console.log(user);
            res.send({ isAdmin: user?.userRole === 'Admin' });
        })

        //check the user that already loggedin An Seller or not
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            // console.log(user);
            res.send({ isSeller: user?.userRole === 'Seller' });
        })

        //get all sellers api
        app.get('/sellers', async (req, res) => {
            const query = {}
            const users = await usersCollection.find(query).toArray();
            const sellers = users.filter(user => user?.userRole === 'Seller');
            //console.log(sellers);
            res.send(sellers);
        })

        //make a seller verified
        app.put('/sellers/verified/:id', verifyJWT, async (req, res) => {

            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    sellerType: 'verified'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

        //get all buyers api
        app.get('/buyers', async (req, res) => {
            const query = {}
            const users = await usersCollection.find(query).toArray();
            const buyers = users.filter(user => user?.userRole !== 'Seller' && user?.userRole !== 'Admin');
            //console.log(buyers);
            res.send(buyers);
        })

        //create jwt token
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            //console.log(user);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' })
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: '' })
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