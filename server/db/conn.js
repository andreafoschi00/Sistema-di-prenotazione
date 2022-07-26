const { MongoClient } = require("mongodb");
const Db = "mongodb+srv://gianlucazani:uJJxmUwcZs0FrCgd@sdpcluster.qakmidq.mongodb.net/?retryWrites=true&w=majority" // process.env.ATLAS_URI; uncomment this when not debugging
const client = new MongoClient(Db, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

var _db;

module.exports = {
    connectToServer: function (callback) {
        client.connect(function (err, db) {
            // Verify we got a good "db" object
            if (db) {
                _db = db.db("sdp_db");
                console.log("Successfully connected to MongoDB.");
            }
            return callback(err);
        });
    },

    getDb: function () {
        return _db;
    },
};