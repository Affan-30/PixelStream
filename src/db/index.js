 import mongoose from "mongoose";
//  import { DB_NAME } from "../constants.js";
 
 const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGO_URI}/${process.env.DB_NAME}`)

        console.log(`\n ${process.env.MONGO_URI}/${process.env.DB_NAME}`);
        console.log(`\n MONGO DB CONNECTED SUCCESSFULLY ! : DB NAME : ${connectionInstance.connection.name}`);
        console.log(`\n MONGO DB CONNECTED SUCCESSFULLY ! : DB HOST : ${connectionInstance.connection.host}`);
        
    } catch (error) {
        console.error("MONGO DB CONNECTION ERROR: ", error)
        process.exit(1)
    }
 }
 
 export default connectDB;