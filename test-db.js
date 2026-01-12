const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.swu9d.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri);

async function test() {
    try {
        console.log("Connecting to:", uri.replace(process.env.DB_PASS, '****'));
        await client.connect();
        const dbs = await client.db().admin().listDatabases();
        console.log("Databases:", dbs.databases.map(d => d.name));
    } catch (err) {
        console.error("Test failed:", err);
    } finally {
        await client.close();
    }
}
test();
