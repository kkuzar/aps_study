import mongoose , { MongooseError }from "mongoose";
import {config} from "./config";

const makeDbConnection = async () => {
    try {
        await mongoose.connect(config.mongoUri);
        console.log("Connected to MongoDB");
    } catch (error: unknown) {
        if (error instanceof MongooseError) {
            console.error(error.message);
        } else {
            console.log("Error connecting to MongoDB", (error as Error).message);
        }
    }
};

export default makeDbConnection;