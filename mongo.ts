import { MongoClient } from "mongodb";

const url: string = "mongodb://localhost:27017";
const client: MongoClient = new MongoClient(url);

export const login = async (email:string, password:string)=> {
    await client.connect();
    const db = client.db("investments");
    const collection = db.collection("investors");
    const foundUser = await collection.findOne({
      email: email,
      password: password
    });
    return foundUser
}

