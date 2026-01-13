const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
require('dotenv').config();

const serviceAccount = require("./micro-task-firebase-adminsdk.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 3000;


app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'https://micro-task-870de.web.app',
        'https://micro-task-870de.firebaseapp.com'
    ],
    credentials: true
}));
app.use(express.json());

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Email Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendEmail = (to, subject, html) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject,
        html
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Error sending email:', error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
};

async function run() {
    try {
        await client.connect();

        const db = client.db("microTaskDB");
        const usersCollection = db.collection("users");
        const tasksCollection = db.collection("tasks");
        const submissionsCollection = db.collection("submissions");
        const withdrawalsCollection = db.collection("withdrawals");
        const paymentsCollection = db.collection("payments");
        const notificationsCollection = db.collection("notifications");
        const reportsCollection = db.collection("reports");

        // --- MIDDLEWARES ---
        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }

        const verifyBuyer = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const isBuyer = user?.role === 'buyer';
            if (!isBuyer) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }

        const verifyWorker = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const isWorker = user?.role === 'worker';
            if (!isWorker) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }

        // --- AUTH API ---
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        });

        // --- USERS API ---
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });

        app.get('/users/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
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
            if (user.role === 'worker') user.coins = 10;
            else if (user.role === 'buyer') user.coins = 50;
            else user.coins = 0;

            // Add metadata
            user.createdAt = new Date();
            user.lastLogin = new Date();

            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        app.patch('/users/login-update', async (req, res) => {
            const { email } = req.body;
            const filter = { email: email };
            const updateDoc = {
                $set: {
                    lastLogin: new Date()
                }
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        app.get('/users/role/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send({ role: user?.role });
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
            const { search, sort, minReward, maxReward } = req.query;

            // Build the match stage
            const matchStage = { required_workers: { $gt: 0 } };

            if (search) {
                matchStage.task_title = { $regex: search, $options: 'i' };
            }

            if (minReward || maxReward) {
                matchStage.payable_amount = {};
                if (minReward) matchStage.payable_amount.$gte = parseInt(minReward);
                if (maxReward) matchStage.payable_amount.$lte = parseInt(maxReward);
            }

            // Build the sort stage
            let sortStage = { created_at: -1 };
            if (sort === 'asc') {
                sortStage = { payable_amount: 1 };
            } else if (sort === 'desc') {
                sortStage = { payable_amount: -1 };
            }

            // Aggregation Pipeline
            const pipeline = [
                { $match: matchStage },
                { $sort: sortStage }
            ];

            const result = await tasksCollection.aggregate(pipeline).toArray();
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

            // Check if user is buyer (owner) or admin
            const user = await usersCollection.findOne({ email: req.decoded.email });

            if (user.role === 'buyer' && task.buyer_email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden' });
            }

            // If buyer deletes, refund coins for uncompleted slots
            if (user.role === 'buyer') {
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

            // Check if already submitted
            const query = { task_id: submission.task_id, worker_email: submission.worker_email };
            const existingSubmission = await submissionsCollection.findOne(query);

            if (existingSubmission) {
                return res.send({ message: 'You have already submitted this task', insertedId: null });
            }

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

            // Send Email to Buyer
            sendEmail(
                submission.buyer_email,
                'New Submission Received',
                `<p>You have a new submission for your task <strong>${submission.task_title}</strong> from <strong>${submission.worker_name}</strong>.</p>`
            );

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

            // Send Email to Worker
            sendEmail(
                submission.worker_email,
                'Submission Approved',
                `<p>Congratulations! Your submission for <strong>${submission.task_title}</strong> has been approved. You earned <strong>${submission.payable_amount}</strong> coins.</p>`
            );

            res.send(result);
        });

        app.patch('/submissions/reject/:id', verifyToken, verifyBuyer, async (req, res) => {
            const id = req.params.id;
            const submission = await submissionsCollection.findOne({ _id: new ObjectId(id) });

            const result = await submissionsCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { status: 'rejected' } }
            );

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

            // Send Email to Worker
            sendEmail(
                submission.worker_email,
                'Submission Rejected',
                `<p>We are sorry. Your submission for <strong>${submission.task_title}</strong> was rejected by the buyer.</p>`
            );

            res.send(result);
        });

        // --- WITHDRAWALS API ---
        app.post('/withdrawals', verifyToken, verifyWorker, async (req, res) => {
            const withdrawal = req.body;

            // Validate if user has enough coins
            const user = await usersCollection.findOne({ email: withdrawal.worker_email });
            if (user.coins < withdrawal.withdrawal_coin) {
                return res.status(400).send({ message: 'Insufficient coins' });
            }

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
            const result = await usersCollection.updateOne(
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

            // Send Email to Worker
            sendEmail(
                withdrawal.worker_email,
                'Withdrawal Approved',
                `<p>Your withdrawal request of <strong>$${withdrawal.withdrawal_amount}</strong> has been approved and processed.</p>`
            );

            res.send(result);
        });

        // --- REPORTS API ---
        app.post('/reports', verifyToken, async (req, res) => {
            const report = req.body;
            const result = await reportsCollection.insertOne({
                ...report,
                report_date: new Date()
            });
            res.send(result);
        });

        app.get('/reports', verifyToken, verifyAdmin, async (req, res) => {
            const result = await reportsCollection.find().toArray();
            res.send(result);
        });

        app.delete('/reports/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const result = await reportsCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        // --- PAYMENTS API ---
        app.post('/create-payment-intent', verifyToken, async (req, res) => {
            const { price } = req.body;
            if (!price) return res.status(400).send({ message: "Price is required" });

            const amount = Math.round(parseFloat(price) * 100);
            if (amount < 1) return res.status(400).send({ message: "Invalid price amount" });

            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: 'usd',
                    payment_method_types: ['card']
                });
                res.send({ clientSecret: paymentIntent.client_secret });
            } catch (error) {
                console.error("Stripe Error:", error);
                res.status(500).send({ message: error.message });
            }
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

        // --- STATS API ---
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
            try {
                const email = req.params.email;
                const totalSubmissions = await submissionsCollection.countDocuments({ worker_email: email });
                const pendingSubmissions = await submissionsCollection.countDocuments({ worker_email: email, status: 'pending' });

                const earningsAgg = await submissionsCollection.aggregate([
                    { $match: { worker_email: email, status: 'approved' } },
                    { $group: { _id: null, total: { $sum: "$payable_amount" } } }
                ]).toArray();
                const totalEarnings = earningsAgg[0]?.total || 0;

                res.send({ totalSubmissions, pendingSubmissions, totalEarnings });
            } catch (error) {
                console.error("Error in worker-stats:", error);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });

        app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
            const totalWorkers = await usersCollection.countDocuments({ role: 'worker' });
            const totalBuyers = await usersCollection.countDocuments({ role: 'buyer' });
            const totalCoinsAgg = await usersCollection.aggregate([
                { $group: { _id: null, total: { $sum: "$coins" } } }
            ]).toArray();
            const totalCoins = totalCoinsAgg[0]?.total || 0;

            const totalPaymentsAgg = await paymentsCollection.aggregate([
                { $group: { _id: null, total: { $sum: "$price" } } }
            ]).toArray();
            const totalPayments = totalPaymentsAgg[0]?.total || 0;

            res.send({
                totalWorkers,
                totalBuyers,
                totalCoins,
                totalPayments
            });
        });

        app.get('/best-workers', async (req, res) => {
            const result = await usersCollection.find({ role: 'worker' })
                .sort({ coins: -1 })
                .limit(6)
                .toArray();
            res.send(result);
        });

        // --- NOTIFICATIONS API ---
        app.get('/notifications/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const result = await notificationsCollection.find({ toEmail: email }).sort({ time: -1 }).toArray();
            res.send(result);
        });

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

    } finally {
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
// restart
