const express = require('express');

const router = express.Router();
router.get('/', (req, res) => {
    res.send ("It works")
    console.log (req)
})

const app  = express();
app.use('/', router);

const server = app.listen(3005,  () => {
    console.log ("backend is running");
});

