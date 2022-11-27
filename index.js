const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;
const app = express();

//middleware
app.use(cors());
app.use(express.json());


//verify the token
function verifyJWT(req, res, next) {

    //secondly verify here
    //console.log('token from client:', req.headers.authorization);

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
        const booksCollection = client.db('secondShelf').collection('books');
        const bookingsCollection = client.db('secondShelf').collection('bookings');
        const reportedItemCollection = client.db('secondShelf').collection('reportItems');

        //Seller verify middleware
        const verifySeller = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.userRole !== 'Seller') {
                return res.status(403).send({ message: 'forbidden' })
            }
            next();
        }

        //Admin verify middleware
        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.userRole !== 'Admin') {
                return res.status(403).send({ message: 'forbidden' })
            }
            next();
        }


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
        });

        //check the user that already loggedin An Seller or not
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            // console.log(user);
            res.send({ isSeller: user?.userRole === 'Seller' });
        });


        //All books get api
        app.get('/bookscatgory/:catName', async (req, res) => {
            const catName = req.params.catName;
            const query = { category: catName };
            const allBooks = await booksCollection.find(query).toArray();
            //console.log(allBooks);
            res.send(allBooks);
        });

        //sent booking info to mongodb
        app.post('/bookings', verifyJWT, async (req, res) => {
            const bookingData = req.body;
            //console.log(bookingData);
            const result = await bookingsCollection.insertOne(bookingData);
            res.send(result);
        });

        //sent report item info to mongodb
        app.post('/report', verifyJWT, async (req, res) => {
            const reportData = req.body;
            //console.log(reportData);
            const result = await reportedItemCollection.insertOne(reportData);
            res.send(result);
        });


        //------Admin start----------

        //get all sellers api
        app.get('/sellers', async (req, res) => {
            const query = {}
            const users = await usersCollection.find(query).toArray();
            const sellers = users.filter(user => user?.userRole === 'Seller');
            //console.log(sellers);
            res.send(sellers);
        });

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
        });

        //delete a User
        app.delete('/users/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        });

        //get all reported items
        app.get('/reportitems', async (req, res) => {
            const query = {}
            const reportitems = await reportedItemCollection.find(query).toArray();
            res.send(reportitems);
        });

        //delete a reported items
        app.delete('/reportitems/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await reportedItemCollection.deleteOne(filter);
            res.send(result);
        });

        //------Admin end----------

        //------Seller start----------

        //send books info to mongoDB
        app.post('/books', verifyJWT, verifySeller, async (req, res) => {
            const book = req.body;
            const result = await booksCollection.insertOne(book);
            res.send(result);
        });

        //get books for a specific seller
        app.get('/books', verifyJWT, async (req, res) => {
            const email = req.query.email;

            //check user
            const decodedEmail = req.decoded.email;
            //console.log(email,decodedEmail)
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }

            const query = { email: email };
            const books = await booksCollection.find(query).toArray();
            res.send(books);
        });


        //Advertise Book
        app.put('/books/advertise/:id', verifyJWT, async (req, res) => {

            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    advertise: true
                }
            }
            const result = await booksCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

        //delete a Book
        app.delete('/books/:id', verifyJWT, verifySeller, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await booksCollection.deleteOne(filter);
            res.send(result);
        });

        //------Seller end----------

        //------Buyers start--------
        //get booked items for a specific buyer
        app.get('/bookeditems', verifyJWT, async (req, res) => {
            const email = req.query.email;

            //check user
            const decodedEmail = req.decoded.email;
            //console.log(email,decodedEmail)
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }

            const query = { buyerEmail: email };
            const items = await bookingsCollection.find(query).toArray();
            res.send(items);
        })
        //------Buyers end--------


        //------payment-----------
        //A single bookeditem api by item id
        app.get('/bookeditems/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const item = await bookingsCollection.findOne(query);
            res.send(item);
        })

        //payment intent post api (Stripe)
        app.post('/create-payment-intent', async (req, res) => {
            const item = req.body;
            const price = item.resalePrice;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
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