import express = require('express');
import cors = require("cors");
import { MongoClient } from 'mongodb';

const url:string = 'mongodb://localhost:27017'
const client:MongoClient = new MongoClient(url)

// const port:integer = 3005 - no integer type in TypeScript?
const  port:number = 3005 

const router:express.Router = express.Router();
router.get('/investors/fetch_all', async (req, res) => {

    await client.connect();
    const db = client.db('investments')
    const collection = db.collection('investors')
    console.log("investors is " + collection)
    const findResult = await (collection.find({})).toArray()
    console.log("req is " + req)

    res.send (findResult)
})

router.get('/assets/:tickerSymbol', async (req, res) => {

    await client.connect();
    const db = client.db('investments')
    const collection = db.collection('assets')
    console.log("investors is " + collection)

    const findQuery = (collection.find({
        symbol: req.params.tickerSymbol
    }))
    console.log("req is " + req)

    res.send (await findQuery.toArray())
})

const app = express()
app.use(cors())
app.options("*", cors())
app.use('/', router);

const server = app.listen(port,  () => {
    console.log ("backend is running");
});

router.post ('/signup', (req, res) => {
    console.log (req)
    const email = req.body.email
    const password = req.body.password
    console.log("email is " + email)
    console.log("password is " + password)
})