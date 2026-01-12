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

    // verify Admin Middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.user.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }

    // verify Buyer Middleware
    const verifyBuyer = async (req, res, next) => {
        const email = req.user?.email;
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        const isBuyer = user?.role === 'buyer';
        if (!isBuyer) {
            return res.status(403).send({ message: 'forbidden access' });
        }
        next();
    }

    // verify Worker Middleware
    const verifyWorker = async (req, res, next) => {
        const email = req.user?.email;
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        const isWorker = user?.role === 'worker';
        if (!isWorker) {
            return res.status(403).send({ message: 'forbidden access' });
        }
        next();
    }

    // --- USERS API ---
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
        const result = await usersCollection.find().toArray();
        res.send(result);
    });

    app.get('/users/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
        if (req.user.email !== email) return res.status(403).send({ message: 'forbidden access' });
        const query = { email: email };
        const result = await usersCollection.findOne(query);
        res.send(result);
    });

    app.post('/users', async (req, res) => {
        const user = req.body;
        const query = { email: user.email };
        const existingUser = await usersCollection.findOne(query);
        if (existingUser) {
            return res.send({ message: 'user already exists', insertedId: null })
        }
        if(user.role === 'worker') user.coins = 10;
        else if(user.role === 'buyer') user.coins = 50;
        else user.coins = 0; 

        const result = await usersCollection.insertOne(user);
        res.send(result);
    });

    app.get('/users/role/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
        if (req.user.email !== email) return res.status(403).send({ message: 'forbidden access' });
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        res.send({ role: user?.role });
    });

    // --- SEED SECTIONS (Temporary) ---
    app.get('/seed', async (req, res) => {
        const workers = [
            { name: "John Doe", email: "john@worker.com", role: "worker", coins: 500, photo_url: "https://i.ibb.co/L8090mG/p1.jpg" },
            { name: "Jane Smith", email: "jane@worker.com", role: "worker", coins: 450, photo_url: "https://i.ibb.co/3W6m8M9/p2.jpg" },
            { name: "Alex Johnson", email: "alex@worker.com", role: "worker", coins: 400, photo_url: "https://i.ibb.co/vYmK3f3/p3.jpg" },
            { name: "Sarah Williams", email: "sarah@worker.com", role: "worker", coins: 350, photo_url: "https://i.ibb.co/9vP1P4Y/p4.jpg" },
            { name: "Michael Brown", email: "michael@worker.com", role: "worker", coins: 300, photo_url: "https://i.ibb.co/SfX5N3b/p5.jpg" },
            { name: "Emily Davis", email: "emily@worker.com", role: "worker", coins: 250, photo_url: "https://i.ibb.co/Tq8m5vJ/p6.jpg" },
            { name: "Admin User", email: "admin@microearn.com", role: "admin", coins: 0, photo_url: "https://i.ibb.co/L8090mG/p1.jpg" },
            { name: "Demo Buyer", email: "buyer@microearn.com", role: "buyer", coins: 1000, photo_url: "https://i.ibb.co/3W6m8M9/p2.jpg" }
        ];

        const tasks = [
            {
                task_title: "Watch YouTube Video and Subscribe",
                task_detail: "Watch the full video, like it, and subscribe to the channel. Send a screenshot as proof.",
                required_workers: 50,
                payable_amount: 10,
                completion_date: "2026-12-31",
                submission_info: "Screenshot of subscription and like",
                task_image_url: "https://i.ibb.co/XW7KzHj/youtube-task.jpg",
                buyer_email: "buyer@microearn.com",
                buyer_name: "Demo Buyer",
                created_at: new Date()
            },
            {
                task_title: "Facebook Post Share",
                task_detail: "Share the pinned post from our page to your timeline (public).",
                required_workers: 30,
                payable_amount: 5,
                completion_date: "2026-12-25",
                submission_info: "Link to your shared post",
                task_image_url: "https://i.ibb.co/3s6qM6m/fb-task.jpg",
                buyer_email: "buyer@microearn.com",
                buyer_name: "Demo Buyer",
                created_at: new Date()
            },
            {
                task_title: "App Store Review",
                task_detail: "Download the app and leave a 5-star review with positive feedback.",
                required_workers: 20,
                payable_amount: 25,
                completion_date: "2026-12-20",
                submission_info: "Screenshot of review and username",
                task_image_url: "https://i.ibb.co/VvzKzR2/app-task.jpg",
                buyer_email: "buyer@microearn.com",
                buyer_name: "Demo Buyer",
                created_at: new Date()
            }
        ];

        await usersCollection.deleteMany({});
        await usersCollection.insertMany(workers);
        await tasksCollection.deleteMany({});
        await tasksCollection.insertMany(tasks);

        res.send({ message: 'Database seeded successfully' });
    });

    app.patch('/users/role/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const { role } = req.body;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { role } };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
    });

    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await usersCollection.deleteOne(query);
        res.send(result);
    });

    app.get('/best-workers', async (req, res) => {
        const result = await usersCollection.find({ role: 'worker' }).sort({ coins: -1 }).limit(6).toArray();
        res.send(result);
    });

    // --- TASKS API ---
    app.post('/tasks', verifyToken, verifyBuyer, async (req, res) => {
        const task = req.body;
        const totalPayable = task.required_workers * task.payable_amount;
        
        const user = await usersCollection.findOne({ email: task.buyer_email });
        if (user.coins < totalPayable) {
            return res.status(400).send({ message: 'Not enough coins' });
        }

        // Deduct coins
        await usersCollection.updateOne(
            { email: task.buyer_email },
            { $inc: { coins: -totalPayable } }
        );

        const result = await tasksCollection.insertOne({
            ...task,
            created_at: new Date()
        });
        res.send(result);
    });

    app.get('/tasks', verifyToken, async (req, res) => {
        const result = await tasksCollection.find({ required_workers: { $gt: 0 } }).sort({ created_at: -1 }).toArray();
        res.send(result);
    });

    app.get('/tasks/admin', verifyToken, verifyAdmin, async (req, res) => {
        const result = await tasksCollection.find().toArray();
        res.send(result);
    });

    app.get('/tasks/buyer/:email', verifyToken, verifyBuyer, async (req, res) => {
        const email = req.params.email;
        const result = await tasksCollection.find({ buyer_email: email }).sort({ completion_date: -1 }).toArray();
        res.send(result);
    });

    app.get('/tasks/:id', verifyToken, async (req, res) => {
        const id = req.params.id;
        const result = await tasksCollection.findOne({ _id: new ObjectId(id) });
        res.send(result);
    });

    app.patch('/tasks/:id', verifyToken, verifyBuyer, async (req, res) => {
        const id = req.params.id;
        const updatedTask = req.body;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
            $set: {
                task_title: updatedTask.task_title,
                task_detail: updatedTask.task_detail,
                submission_info: updatedTask.submission_info
            }
        };
        const result = await tasksCollection.updateOne(filter, updateDoc);
        res.send(result);
    });

    app.delete('/tasks/:id', verifyToken, async (req, res) => {
        const id = req.params.id;
        const task = await tasksCollection.findOne({ _id: new ObjectId(id) });
        
        // If buyer deletes, refund coins for uncompleted slots
        if (req.user.role === 'buyer') {
            const refundAmount = task.required_workers * task.payable_amount;
            await usersCollection.updateOne(
                { email: task.buyer_email },
                { $inc: { coins: refundAmount } }
            );
        }

        const result = await tasksCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
    });

    // --- SUBMISSIONS API ---
    app.post('/submissions', verifyToken, verifyWorker, async (req, res) => {
        const submission = req.body;
        const result = await submissionsCollection.insertOne({
            ...submission,
            status: 'pending',
            current_date: new Date()
        });

        // Add Notification for Buyer
        await notificationsCollection.insertOne({
            message: `A new submission for "${submission.task_title}" from ${submission.worker_name}`,
            toEmail: submission.buyer_email,
            actionRoute: '/dashboard/buyer-home',
            time: new Date(),
            isRead: false
        });

        res.send(result);
    });

    app.get('/submissions/worker/:email', verifyToken, verifyWorker, async (req, res) => {
        const email = req.params.email;
        const page = parseInt(req.query.page) || 0;
        const size = parseInt(req.query.size) || 10;
        
        const result = await submissionsCollection.find({ worker_email: email })
            .skip(page * size)
            .limit(size)
            .toArray();
        
        const count = await submissionsCollection.countDocuments({ worker_email: email });
        res.send({ result, count });
    });

    app.get('/submissions/buyer/:email', verifyToken, verifyBuyer, async (req, res) => {
        const email = req.params.email;
        const result = await submissionsCollection.find({ buyer_email: email, status: 'pending' }).toArray();
        res.send(result);
    });

    app.patch('/submissions/approve/:id', verifyToken, verifyBuyer, async (req, res) => {
        const id = req.params.id;
        const submission = await submissionsCollection.findOne({ _id: new ObjectId(id) });
        
        // Update User (Worker) Coin
        await usersCollection.updateOne(
            { email: submission.worker_email },
            { $inc: { coins: submission.payable_amount } }
        );

        // Update Submission Status
        const result = await submissionsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: 'approved' } }
        );

        // Update Task (Decrease required_workers is NOT explicitly required on approval, but TaskList only shows > 0. Actually, creation deducted coins for all. Approval just gives it to worker. So required_workers logic is usually handled on submission or creation? Wait. The requirement says: "On clicking Reject Button... increase required_workers by 1". And "TaskList... see tasks where required_worker > 0". So we should decrease it when it's Approved or when it's submitted? 
        // Re-reading: "increase required_workers by 1" on Reject. This implies we should DECREASE it on Approve or when someone takes the task.
        // Actually, the common flow is: Task created with 10 slots. 10 people submit. Count becomes 0. If one is rejected, it becomes 1 again.
        // So let's decrease on Approval.
        await tasksCollection.updateOne(
            { _id: new ObjectId(submission.task_id) },
            { $inc: { required_workers: -1 } }
        );

        // Notify Worker
        await notificationsCollection.insertOne({
            message: `You have earned ${submission.payable_amount} from ${submission.buyer_name} for completing "${submission.task_title}"`,
            toEmail: submission.worker_email,
            actionRoute: '/dashboard/worker-home',
            time: new Date(),
            isRead: false
        });

        res.send(result);
    });

    app.patch('/submissions/reject/:id', verifyToken, verifyBuyer, async (req, res) => {
        const id = req.params.id;
        const submission = await submissionsCollection.findOne({ _id: new ObjectId(id) });

        const result = await submissionsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: 'rejected' } }
        );

        // No need to increase required_workers if we didn't decrease it on submission? 
        // Requirement says: "On clicking the Reject Button... Increase required_workers by 1".
        // This is safe regardless of when we decrease it.
        await tasksCollection.updateOne(
            { _id: new ObjectId(submission.task_id) },
            { $inc: { required_workers: 1 } }
        );

        // Notify Worker
        await notificationsCollection.insertOne({
            message: `Your submission for "${submission.task_title}" was rejected by ${submission.buyer_name}`,
            toEmail: submission.worker_email,
            actionRoute: '/dashboard/worker-home',
            time: new Date(),
            isRead: false
        });

        res.send(result);
    });

    // --- WITHDRAWALS API ---
    app.post('/withdrawals', verifyToken, verifyWorker, async (req, res) => {
        const withdrawal = req.body;
        const result = await withdrawalsCollection.insertOne({
            ...withdrawal,
            status: 'pending',
            withdraw_date: new Date()
        });
        res.send(result);
    });

    app.get('/withdrawals', verifyToken, verifyAdmin, async (req, res) => {
        const result = await withdrawalsCollection.find({ status: 'pending' }).toArray();
        res.send(result);
    });

    app.patch('/withdrawals/approve/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const withdrawal = await withdrawalsCollection.findOne({ _id: new ObjectId(id) });

        // Update user coin
        await usersCollection.updateOne(
            { email: withdrawal.worker_email },
            { $inc: { coins: -withdrawal.withdrawal_coin } }
        );

        // Update withdrawal status
        const result = await withdrawalsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: 'approved' } }
        );

        // Notify Worker
        await notificationsCollection.insertOne({
            message: `Your withdrawal request of $${withdrawal.withdrawal_amount} was approved!`,
            toEmail: withdrawal.worker_email,
            actionRoute: '/dashboard/worker-home',
            time: new Date(),
            isRead: false
        });

        res.send(result);
    });

    // --- PAYMENTS API ---
    app.post('/create-payment-intent', verifyToken, verifyBuyer, async (req, res) => {
        const { price } = req.body;
        const amount = parseInt(price * 100);
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            payment_method_types: ['card']
        });
        res.send({ clientSecret: paymentIntent.client_secret });
    });

    app.post('/payments', verifyToken, verifyBuyer, async (req, res) => {
        const payment = req.body;
        const result = await paymentsCollection.insertOne(payment);

        // Update Buyer's coin
        await usersCollection.updateOne(
            { email: payment.buyer_email },
            { $inc: { coins: payment.coins_purchased } }
        );

        res.send(result);
    });

    app.get('/payments/:email', verifyToken, verifyBuyer, async (req, res) => {
        const email = req.params.email;
        const result = await paymentsCollection.find({ buyer_email: email }).toArray();
        res.send(result);
    });

    // --- NOTIFICATIONS API ---
    app.get('/notifications/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
        const result = await notificationsCollection.find({ toEmail: email }).sort({ time: -1 }).toArray();
        res.send(result);
    });

    // --- STATS API ---
    app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
        const totalWorkers = await usersCollection.countDocuments({ role: 'worker' });
        const totalBuyers = await usersCollection.countDocuments({ role: 'buyer' });
        const totalCoinsAgg = await usersCollection.aggregate([
            { $group: { _id: null, total: { $sum: "$coins" } } }
        ]).toArray();
        const totalCoins = totalCoinsAgg[0]?.total || 0;
        
        const totalPaymentsAgg = await paymentsCollection.aggregate([
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]).toArray();
        const totalPayments = totalPaymentsAgg[0]?.total || 0;

        res.send({ 
            totalWorkers, 
            totalBuyers, 
            totalCoins, 
            totalPayments 
        });
    });

    app.get('/buyer-stats/:email', verifyToken, verifyBuyer, async (req, res) => {
        const email = req.params.email;
        const totalTasks = await tasksCollection.countDocuments({ buyer_email: email });
        
        const tasks = await tasksCollection.find({ buyer_email: email }).toArray();
        const pendingWorkers = tasks.reduce((sum, task) => sum + task.required_workers, 0);

        const totalPaidAgg = await submissionsCollection.aggregate([
            { $match: { buyer_email: email, status: 'approved' } },
            { $group: { _id: null, total: { $sum: "$payable_amount" } } }
        ]).toArray();
        const totalPaid = totalPaidAgg[0]?.total || 0;

        res.send({ totalTasks, pendingWorkers, totalPaid });
    });

    app.get('/worker-stats/:email', verifyToken, verifyWorker, async (req, res) => {
        const email = req.params.email;
        const totalSubmissions = await submissionsCollection.countDocuments({ worker_email: email });
        const pendingSubmissions = await submissionsCollection.countDocuments({ worker_email: email, status: 'pending' });
        
        const earningsAgg = await submissionsCollection.aggregate([
            { $match: { worker_email: email, status: 'approved' } },
            { $group: { _id: null, total: { $sum: "$payable_amount" } } }
        ]).toArray();
        const totalEarnings = earningsAgg[0]?.total || 0;

        res.send({ totalSubmissions, pendingSubmissions, totalEarnings });
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
