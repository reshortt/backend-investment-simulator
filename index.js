const express = require('express');
const {MongoClient}=require('mongodb')

const url = 'mongodb://localhost:27017'
const client = new MongoClient(url)

const router = express.Router();
router.get('/investors/fetch_all', async (req, res) => {

    await client.connect();
    const db = client.db('investments')
    const collection = db.collection('assets')
    const findResult = await (collection.find({})).toArray()


    res.send (findResult)
    console.log (req)
})

const app  = express();
app.use('/', router);

const server = app.listen(3005,  () => {
    console.log ("backend is running");
});



