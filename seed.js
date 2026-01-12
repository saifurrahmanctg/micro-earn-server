const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.swu9d.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri);

async function seed() {
    try {
        await client.connect();
        const db = client.db("microEarnDB");
        const usersCollection = db.collection("users");
        const tasksCollection = db.collection("tasks");

        // Demo Workers
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

        await usersCollection.deleteMany({});
        await usersCollection.insertMany(workers);

        // Demo Tasks
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

        await tasksCollection.deleteMany({});
        await tasksCollection.insertMany(tasks);

        console.log("Demo data seeded successfully!");
    } catch (error) {
        console.error("Error seeding data:", error);
    } finally {
        await client.close();
    }
}

seed();
