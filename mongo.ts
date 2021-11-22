import { MongoClient, ObjectId, Document } from "mongodb";

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


export const getEmailById = async (userId:string): Promise<string> => {
  await client.connect();
  console.log("getting email from user id ", userId)
  const db = client.db("investments");
  const collection = db.collection("investors");
  const foundUser = await collection.findOne({
    _id: new ObjectId(userId),
  });
  if (!foundUser) {
    return "";
  }
  return foundUser.email;
}



export const getUser = async (userId:string): Promise<Document> => {
  await client.connect();
  console.log("getting email from user id ", userId)
  const db = client.db("investments");
  const collection = db.collection("investors");
  const foundUser = await collection.findOne({
    _id: new ObjectId(userId),
  });
  if (!foundUser) {
    return null;
  }
  return foundUser;
}

export const getBalance = async (userId:string): Promise<number> => {
  await client.connect();
  const user = await getUser(userId);
  return 1.0;
}


