import mongoose, {Schema} from "mongoose";

const subscriptionSchema = new Schema({
    subscriber: {
        type: Schema.Types.ObjectId, // one who is subscribing
        ref: "User"
    },
    channel: {
        type: Schema.Types.ObjectId, // one to whom 'subscriber' is subscribing - Channel owner
        ref: "User"
    }
}, {timestamps: true});

// To retrive the subscribers count of a Channel ex. Harmain.info -> we count documents containing field channel=Harmain.info

// To retrive the count of a Channels subscribed by a user ex. A -> we count documents containing field subscriber=A

// channel -> count of subscribers
// subscriber -> count of channels I subscribed

export const Subscription = mongoose.model("Subscription", subscriptionSchema);