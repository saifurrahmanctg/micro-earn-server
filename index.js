const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.swu9d.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    
    const db = client.db("microEarnDB");
    const usersCollection = db.collection("users");
    const tasksCollection = db.collection("tasks");
    const submissionsCollection = db.collection("submissions");
    const withdrawalsCollection = db.collection("withdrawals");
    const paymentsCollection = db.collection("payments");
    const notificationsCollection = db.collection("notifications");

    // JWT Generation
    app.post('/jwt', async (req, res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '365d' });
        res
        .cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true });
    });

    app.get('/logout', async (req, res) => {
        res.clearCookie('token', {
            maxAge: 0, 
            secure: process.env.NODE_ENV === 'production', 
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        }).send({ success: true })
    })

    // Verify Token Middleware
    const verifyToken = (req, res, next) => {
        const token = req.cookies?.token;
        if (!token) {
            return res.status(401).send({ message: 'unauthorized access' });
        }
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            req.user = decoded;
            next();
        })
    }

    // --- USERS API ---
    app.get('/users/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
        if (req.user.email !== email) return res.status(403).send({ message: 'forbidden access' });
        const query = { email: email };
        const result = await usersCollection.findOne(query);
        res.send(result);
    });

    app.post('/users', async (req, res) => {
        const user = req.body;
        // Check if user exists
        const query = { email: user.email };
        const existingUser = await usersCollection.findOne(query);
        if (existingUser) {
            return res.send({ message: 'user already exists', insertedId: null })
        }
        // Assign default coins
        if(user.role === 'worker') user.coins = 10;
        else if(user.role === 'buyer') user.coins = 50;
        else user.coins = 0; // Should not happen for admin registration usually

        const result = await usersCollection.insertOne(user);
        res.send(result);
    });


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Micro Earn Server is running')
})

app.listen(port, () => {
  console.log(`Micro Earn Server is running on port: ${port}`)
})
