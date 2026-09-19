import mongoose from "mongoose";
import connectDB from "./db/index.js";
import { app } from "./app.js";

// Connect to Database
connectDB()
.then(
    ()=>{
        app.listen(process.env.PORT || 8000 , () => {
            console.log(`Server is running on port : ${process.env.PORT}`);
            
        });
    }
)
.catch((err) => {
    console.log("MONGO DB CONNECTION ERROR : ", err)
})
/*
import express from "express"
const app = express()
( async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("errror", (error) => {
            console.log("ERRR: ", error);
            throw error
        })

        app.listen(process.env.PORT, () => {
            console.log(`App is listening on port ${process.env.PORT}`);
        })

    } catch (error) {
        console.error("ERROR: ", error)
        throw err
    }
})()

*/