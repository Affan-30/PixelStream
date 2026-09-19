import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN, //Allow only our frontend
    credentials: true                // Allows cookies to flow through
}))

app.use(cookieParser())

app.use(express.json({ limit: "15kb"})) // accept the incoming json data with a limit

app.use(express.urlencoded({extended : true, limit : "15kb"})) // accept the data coming in the URL

app.use(express.static("public"))






export {app}